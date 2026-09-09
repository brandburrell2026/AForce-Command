/**
 * Server-owned analytics emission (Task #39).
 *
 * The mobile dispatcher owns client events; a few Phase-1 events are
 * BACKEND-owned because only the server observes them with certainty:
 *   - receipt_verified / receipt_activated (scan persistence)
 *
 * (subscription_started was previously emitted here from the Stripe
 *  webhook, but is now CLIENT-emitted as the sole source so it can carry
 *  descriptive non-PII revenue metadata without a payload race — see the
 *  mobile analytics/subscription_tracker.)
 *
 * This module is the single server-side path into the same INTERNAL
 * `aforce_analytics_events` table the mobile ingest route writes to. It
 * reuses the shared contract's envelope assembly + zod validation so the
 * server can never write a row the client ingest path would reject.
 *
 * Privacy + safety invariants:
 *   - analytics_id is the PSEUDONYMOUS id the client forwards under the
 *     `x-aforce-analytics-id` header, only after consent. We re-validate
 *     it against the contract's `anon_` shape (safeParse) so a Clerk user
 *     id or any non-pseudonymous value is dropped, never stored.
 *   - Idempotent: eventId is minted deterministically from a stable seed
 *     so webhook/scan retries collapse via ON CONFLICT DO NOTHING.
 *   - Fire-and-forget: this NEVER throws into the caller and NEVER alters
 *     payment, scan, or any product behavior. Failures are swallowed.
 *   - No fabrication: callers emit only on REAL observed server behavior.
 */

import { createHash } from "node:crypto";
import {
  db,
  aforceAnalyticsEvents,
  type InsertAforceAnalyticsEvent,
  consentedAnalyticsIdFor,
  type Dbx,
} from "@workspace/db";
import {
  assembleEnvelope,
  type AnalyticsEventType,
} from "@workspace/analytics-contract";
import { analyticsEnvelopeSchema } from "@workspace/analytics-contract/zod";
import { logger } from "./logger";

export interface ServerAnalyticsInput {
  eventId: string;
  eventType: AnalyticsEventType;
  analyticsId: string;
  payload?: Record<string, unknown>;
  occurredAt?: string;
}

/**
 * Deterministic, idempotent event id from a stable seed. SHA-256 hex is
 * `[0-9a-f]`, so the result always satisfies the contract's
 * `/^evt_[a-z0-9]+_[a-z0-9]+$/` guard. The same seed always maps to the
 * same id, so retries (Stripe redelivery, client re-POST) dedupe.
 */
export function deterministicEventId(seed: string): string {
  const hex = createHash("sha256").update(seed).digest("hex");
  return `evt_${hex.slice(0, 16)}_${hex.slice(16, 32)}`;
}

/**
 * The pseudonymous analytics-id shape from the shared contract
 * (`@workspace/analytics-contract/zod` → ANALYTICS_ID_RE). Mirrored here so
 * the server can reject a non-`anon_` id (notably a Clerk `user_...` id) at
 * HEADER INGRESS — before it is written ANYWHERE (e.g. into Stripe
 * subscription metadata at checkout), not merely at DB-insert time. Keep in
 * lockstep with the contract regex.
 */
const ANON_ANALYTICS_ID_RE = /^anon_[a-z0-9]+_[a-z0-9]+$/;

/**
 * Validate + normalize a forwarded analytics-id header. Returns the id only
 * when it matches the pseudonymous `anon_` shape (and is within the contract
 * length bound); returns null otherwise. This is the single ingress guard —
 * a non-pseudonymous identifier can never reach Stripe metadata or the DB.
 */
/**
 * THE SHARED WRITER GATE (S1-3).
 *
 * Resolves the pseudonym analytics may be written under from the CALLER'S OWN
 * `req.userId` — it never trusts the `x-aforce-analytics-id` header. One
 * function is therefore simultaneously the consent gate, the suppression
 * gate, and the retired-id refusal.
 *
 * WHY THIS REPLACED THE HEADER AT EVERY WRITER. `aforce_analytics_events` has
 * THREE writers — the ingest route, and `recordServerAnalyticsEvents` called
 * from scans and checkout — and consent was checked only CLIENT-side, by
 * `consentedAnalyticsHeader` in the mobile app. A device holding a stale local
 * grant kept producing rows for a member who had revoked on another device,
 * and a revoked member's checkout still wrote `analytics_id` into Stripe
 * metadata. Server-authoritative consent that guards only the consent ROW and
 * not the DATA PATH is not server-authoritative.
 *
 * Returns null — meaning "write nothing" — for: no consent, revoked consent,
 * a suppressed member, the DEFAULT_USER_ID sentinel, and an unauthenticated
 * caller. It never mints: an emission path must not create an identity as a
 * side effect of writing an event.
 */
export async function consentedAnalyticsIdForRequest(
  req: { userId?: string },
): Promise<string | null> {
  try {
    return await consentedAnalyticsIdFor(db as unknown as Dbx, req.userId);
  } catch {
    // Fail CLOSED: an identity lookup failure must not fall back to emitting
    // under an unverified id.
    return null;
  }
}

export function analyticsIdFromHeader(value: string | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length < 8 || trimmed.length > 128) return null;
  return ANON_ANALYTICS_ID_RE.test(trimmed) ? trimmed : null;
}

/**
 * Persist server-owned analytics events. Validates every envelope through
 * the shared contract schema (dropping any that fail — e.g. a non-`anon_`
 * analytics_id) and inserts idempotently on eventId. Best-effort: any error
 * is logged and swallowed so analytics can never break the caller.
 */
export async function recordServerAnalyticsEvents(
  inputs: ServerAnalyticsInput[],
): Promise<void> {
  if (inputs.length === 0) return;
  try {
    const rows: InsertAforceAnalyticsEvent[] = [];
    for (const input of inputs) {
      const parsed = analyticsEnvelopeSchema.safeParse(
        assembleEnvelope(input),
      );
      if (!parsed.success) continue;
      const e = parsed.data;
      const occurred = new Date(e.occurredAt);
      rows.push({
        eventId: e.eventId,
        analyticsId: e.analytics_id,
        eventType: e.eventType,
        occurredAt: Number.isNaN(occurred.getTime()) ? new Date() : occurred,
        schemaVersion: e.schemaVersion,
        payload: e.payload,
      });
    }
    if (rows.length === 0) return;
    await db
      .insert(aforceAnalyticsEvents)
      .values(rows)
      .onConflictDoNothing({ target: aforceAnalyticsEvents.eventId });
  } catch (err) {
    logger.warn({ err }, "recordServerAnalyticsEvents failed (swallowed)");
  }
}
