/**
 * entitlementResolver — the single server-side answer to "what plan does
 * this user actually have right now?"
 *
 * Extracted verbatim from routes/entitlement.ts (Wave-2 PR1) so that
 * requireEntitlement middleware and the GET /entitlement route share one
 * implementation. Behavior is unchanged from the route:
 *
 *   1. Insert-if-missing aforce_users row on first authenticated read.
 *   2. If a Stripe customer linkage exists, the synced `stripe.*` schema
 *      overrides the cached plan/status (refreshing the cache), and a
 *      missing live subscription forces a safe downgrade to core.
 *   3. The web (Shopify) rail can upgrade core → an allowlisted plan when
 *      the Stripe rail has nothing better.
 *
 * Failure posture: DB errors THROW — callers decide (the route returns
 * 500; requireEntitlement fails closed with 503). The inner Stripe/web
 * lookups keep their existing silent-fallback-to-cache semantics.
 */

import { db, aforceUsers, aforceWebEntitlements } from "@workspace/db";
import { incCounter } from "../observability/metrics";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { logger } from "./logger";
import { fetchVerifiedPrimaryEmail } from "./clerkEmail";

interface SubRow {
  status: string;
  current_period_end: number | null;
  plan_id: string | null;
}

export const ACTIVE_STATUSES = new Set(["active", "trialing", "past_due"]);

export interface ResolvedEntitlement {
  planId: string;
  status: string;
  currentPeriodEnd: Date | null;
  stripeCustomerId: string | null;
}

export async function resolveEntitlement(userId: string): Promise<ResolvedEntitlement> {
  // Insert-if-missing on first authenticated read.
  let [row] = await db
    .select()
    .from(aforceUsers)
    .where(eq(aforceUsers.id, userId))
    .limit(1);
  if (!row) {
    // Wave-3 PR4: establish the commerce email linkage at row creation —
    // the VERIFIED Clerk primary email (never an unverified address, never
    // a Shopify-supplied string). This is what makes the web (Shopify)
    // entitlement rail below reachable; it was previously dead because
    // email was read here but written nowhere.
    const email = await fetchVerifiedPrimaryEmail(userId);
    const [inserted] = await db
      .insert(aforceUsers)
      .values({ id: userId, planId: "core", subscriptionStatus: "none", ...(email ? { email } : {}) })
      .onConflictDoNothing({ target: aforceUsers.id })
      .returning();
    row = inserted ?? (await db.select().from(aforceUsers).where(eq(aforceUsers.id, userId)).limit(1))[0];
  } else if (!row.email) {
    // One-time backfill for rows created before this bridge existed.
    // Best-effort and NEVER overwrites a present email (the Clerk id is
    // canonical identity; a Shopify email must never replace this key).
    const email = await fetchVerifiedPrimaryEmail(userId);
    if (email) {
      try {
        await db
          .update(aforceUsers)
          .set({ email, updatedAt: new Date() })
          .where(and(eq(aforceUsers.id, userId), isNull(aforceUsers.email)));
        row = { ...row, email };
      } catch (err) {
        logger.debug({ err }, "entitlement: email backfill failed; continuing without web rail");
      }
    }
  }

  let planId = row?.planId ?? "core";
  let status = row?.subscriptionStatus ?? "none";
  let currentPeriodEnd: Date | null = row?.currentPeriodEnd ?? null;

  // If we have a Stripe customer linkage, query the synced subscription
  // table and let it override the cached plan/status. Wrapped in
  // try/catch so a missing stripe schema (integration not connected)
  // never breaks the entitlement endpoint.
  if (row?.stripeCustomerId) {
    try {
      const result = await db.execute(sql`
        SELECT
          s.status::text AS status,
          s.current_period_end,
          COALESCE(pr.metadata->>'planId', p.metadata->>'planId') AS plan_id
        FROM stripe.subscriptions s
        LEFT JOIN stripe.subscription_items si ON si.subscription = s.id
        LEFT JOIN stripe.prices pr ON pr.id = si.price
        LEFT JOIN stripe.products p ON p.id = pr.product
        WHERE s.customer = ${row.stripeCustomerId}
          AND s.status IN ('active','trialing','past_due')
        ORDER BY s.created DESC NULLS LAST
        LIMIT 1
      `);
      const live = (result.rows?.[0] ?? null) as unknown as SubRow | null;
      if (live) {
        status = live.status;
        if (live.plan_id) planId = live.plan_id;
        currentPeriodEnd = live.current_period_end
          ? new Date(live.current_period_end * 1000)
          : null;
        // Refresh cache so subsequent reads (or downstream reads via
        // aforce_users) stay current.
        if (
          row.planId !== planId ||
          row.subscriptionStatus !== status ||
          row.currentPeriodEnd?.getTime() !== currentPeriodEnd?.getTime()
        ) {
          await db
            .update(aforceUsers)
            .set({
              planId,
              subscriptionStatus: status,
              currentPeriodEnd,
              updatedAt: new Date(),
            })
            .where(eq(aforceUsers.id, userId));
        }
      } else if (ACTIVE_STATUSES.has(status) || planId !== "core") {
        // No live Stripe sub — force a safe downgrade to core. We do this
        // not just when the cached status is active, but any time the
        // cached planId is paid, so a stale cache (e.g., `canceled` with
        // planId=`recovery_plus`) cannot keep granting paid features.
        planId = "core";
        status = ACTIVE_STATUSES.has(status) ? "canceled" : status;
        currentPeriodEnd = null;
        await db
          .update(aforceUsers)
          .set({
            planId,
            subscriptionStatus: status,
            currentPeriodEnd,
            updatedAt: new Date(),
          })
          .where(eq(aforceUsers.id, userId));
      }
    } catch (err) {
      // stripe schema missing or query failed — silent fallback to cache.
      incCounter("entitlement_resolver_fallback.stripe");
      logger.debug({ err }, "entitlement: stripe.subscriptions lookup failed; using cache");
    }
  }

  // D-2 bridge (slice 4c): a web (Shopify) Command purchase grants app
  // entitlement when the Stripe rail has nothing better. Additive OR —
  // Stripe stays primary; an unexpired active web row upgrades core, never
  // downgrades a live Stripe plan. Cache is NOT overwritten (the web rail
  // is re-checked each read, so a cancelled web sub loses access on the
  // next read — same fail-safe posture as the Stripe path).
  if (planId === "core" && row?.email) {
    try {
      const [web] = await db
        .select()
        .from(aforceWebEntitlements)
        .where(
          and(
            eq(aforceWebEntitlements.email, row.email.trim().toLowerCase()),
            eq(aforceWebEntitlements.status, "active"),
            // Gate FIX-FIRST: expiry must live in SQL — with many rows per
            // email, a redelivered EXPIRED order bumps updatedAt and would
            // shadow a live renewal row at LIMIT 1 (denying a paying user).
            sql`(${aforceWebEntitlements.currentPeriodEnd} IS NULL OR ${aforceWebEntitlements.currentPeriodEnd} > now())`,
          ),
        )
        .orderBy(desc(aforceWebEntitlements.updatedAt))
        .limit(1);
      const unexpired =
        web && (web.currentPeriodEnd == null || web.currentPeriodEnd.getTime() > Date.now());
      // Defense-in-depth (security sign-off; re-applied after a lost race
      // with the #400 merge): the web rail may only ever grant these plans,
      // regardless of what a future writer or DB edit stores.
      const WEB_GRANTABLE_PLANS = new Set(["athlete"]);
      if (web && unexpired && WEB_GRANTABLE_PLANS.has(web.planId)) {
        planId = web.planId;
        status = "active";
        currentPeriodEnd = web.currentPeriodEnd;
        if (web.userId !== userId) {
          await db
            .update(aforceWebEntitlements)
            .set({ userId, updatedAt: new Date() })
            .where(eq(aforceWebEntitlements.id, web.id));
        }
      }
    } catch (err) {
      incCounter("entitlement_resolver_fallback.web");
      logger.debug({ err }, "entitlement: web-entitlement lookup failed; using stripe/cache result");
    }
  }

  return {
    planId,
    status,
    currentPeriodEnd,
    stripeCustomerId: row?.stripeCustomerId ?? null,
  };
}
