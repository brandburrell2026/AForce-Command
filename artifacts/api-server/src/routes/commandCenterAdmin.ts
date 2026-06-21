/**
 * Founder Command Center — INTERNAL read surface (founders only).
 *
 * Deliberately hand-written and kept OUT of the consumer OpenAPI spec /
 * @workspace/api-client-react, mirroring analyticsAdmin.ts: founder
 * analytics must never ship in the mobile or marketing-site bundles. The
 * web cockpit (artifacts/aforce-command-center) consumes this with its own
 * local typed fetch client.
 *
 * Every query is AGGREGATE-ONLY — counts/averages computed inside PG. No
 * PII and no raw rows ever leave the database; pseudonymous analytics_ids
 * are surfaced only as distinct counts and are NEVER joined to user or
 * subscription tables. The pure `buildDailyFive` helper turns the scalar
 * results into the founder DTO with null-safe rates (Score-Protection:
 * real-or-null, never fabricated).
 */

import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireFounder } from "../middlewares/requireFounder";
import {
  buildDailyFive,
  CommandCenterDailyFiveSchema,
  type DailyFiveRaw,
} from "../lib/commandCenter";
import {
  buildRetentionGates,
  RetentionGatesSchema,
  type RetentionGatesRaw,
} from "../lib/retentionGates";
import {
  buildActivationFunnel,
  ActivationFunnelSchema,
  type ActivationFunnelRow,
} from "../lib/activationFunnel";
import {
  buildMarketingAttribution,
  MarketingAttributionSchema,
  type MarketingRow,
} from "../lib/marketingAttribution";
import { logger } from "../lib/logger";

const router: IRouter = Router();

type Row = Record<string, unknown>;

function firstRow(result: unknown): Row {
  const rows = (result as { rows?: Row[] }).rows;
  return rows && rows.length > 0 ? (rows[0] as Row) : {};
}

function num(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (v == null) return 0;
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function numOrNull(v: unknown): number | null {
  if (v == null) return null;
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : null;
}

/** Coerce a PG timestamp (Date or ISO string) into an ISO string, or null. */
function isoOrNull(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") return v;
  return null;
}

/** Coerce a PG jsonb cell (object, or JSON string) into a plain object, or null. */
function payloadOrNull(v: unknown): Record<string, unknown> | null {
  if (v == null) return null;
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      return parsed && typeof parsed === "object"
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
  return typeof v === "object" ? (v as Record<string, unknown>) : null;
}

router.get(
  "/admin/command-center/summary",
  requireFounder,
  async (req, res) => {
    try {
      const [
        activationsTotalRes,
        activationsRecentRes,
        retentionRes,
        confirmationsRes,
        usersRes,
        scoreRes,
      ] = await Promise.all([
        // (1) Activations — distinct identities with >=1 command_followed.
        db.execute(sql`
          SELECT count(DISTINCT analytics_id)::int AS c
          FROM aforce_analytics_events
          WHERE event_type = 'command_followed'
        `),
        // (1b) Recent activations — identities whose FIRST follow is in-window.
        db.execute(sql`
          SELECT count(*)::int AS c
          FROM (
            SELECT analytics_id, min(occurred_at) AS first_follow
            FROM aforce_analytics_events
            WHERE event_type = 'command_followed'
            GROUP BY analytics_id
          ) t
          WHERE t.first_follow >= now() - interval '7 days'
        `),
        // (2) D7+ return: cohort first-seen >=7d ago; returned >= first + 7d.
        db.execute(sql`
          SELECT
            (count(*) FILTER (
              WHERE first_seen <= now() - interval '7 days'
            ))::int AS cohort,
            (count(*) FILTER (
              WHERE first_seen <= now() - interval '7 days'
                AND last_seen >= first_seen + interval '7 days'
            ))::int AS retained
          FROM (
            SELECT
              analytics_id,
              min(occurred_at) AS first_seen,
              max(occurred_at) AS last_seen
            FROM aforce_analytics_events
            GROUP BY analytics_id
          ) t
        `),
        // (3) Command confirmation follow rate.
        db.execute(sql`
          SELECT
            count(*)::int AS total,
            (count(*) FILTER (WHERE followed))::int AS followed
          FROM aforce_confirmations
        `),
        // (4) Account-level subscription conversion.
        db.execute(sql`
          SELECT
            count(*)::int AS total,
            (count(*) FILTER (
              WHERE subscription_status IN ('active', 'trialing')
            ))::int AS subscribed
          FROM aforce_users
        `),
        // (5) Readiness score trend — last 7d vs prior 7d.
        db.execute(sql`
          SELECT
            (avg(score) FILTER (
              WHERE captured_at >= now() - interval '7 days'
            ))::float8 AS current_avg,
            (count(*) FILTER (
              WHERE captured_at >= now() - interval '7 days'
            ))::int AS current_n,
            (avg(score) FILTER (
              WHERE captured_at < now() - interval '7 days'
                AND captured_at >= now() - interval '14 days'
            ))::float8 AS previous_avg,
            (count(*) FILTER (
              WHERE captured_at < now() - interval '7 days'
                AND captured_at >= now() - interval '14 days'
            ))::int AS previous_n
          FROM aforce_score_snapshots
        `),
      ]);

      const retentionRow = firstRow(retentionRes);
      const confirmationsRow = firstRow(confirmationsRes);
      const usersRow = firstRow(usersRes);
      const scoreRow = firstRow(scoreRes);

      const raw: DailyFiveRaw = {
        activationsTotal: num(firstRow(activationsTotalRes)["c"]),
        activationsLast7d: num(firstRow(activationsRecentRes)["c"]),
        retentionCohort: num(retentionRow["cohort"]),
        retentionRetained: num(retentionRow["retained"]),
        confirmationsTotal: num(confirmationsRow["total"]),
        confirmationsFollowed: num(confirmationsRow["followed"]),
        usersTotal: num(usersRow["total"]),
        usersSubscribed: num(usersRow["subscribed"]),
        scoreCurrentAvg: numOrNull(scoreRow["current_avg"]),
        scoreCurrentSamples: num(scoreRow["current_n"]),
        scorePreviousAvg: numOrNull(scoreRow["previous_avg"]),
        scorePreviousSamples: num(scoreRow["previous_n"]),
      };

      const dto = CommandCenterDailyFiveSchema.parse(
        buildDailyFive(raw, new Date().toISOString()),
      );
      return res.json(dto);
    } catch (err) {
      logger.error({ err }, "GET /admin/command-center/summary failed");
      return res.status(500).json({ error: "command_center_summary_failed" });
    }
  },
);

/**
 * RETENTION GATES — the owner's five-gate activation/retention scorecard.
 *
 * Every gate is sourced from the canonical activation lifecycle in
 * `aforce_analytics_events` (the same pseudonymous, never-joined event
 * stream the Daily Five uses). Aggregate-only: each query returns scalar
 * counts / a median, never rows. The pure `buildRetentionGates` turns them
 * into the gate DTO with awaiting states (Score-Protection: a gate with an
 * empty cohort reads `awaiting`, never a fabricated 0%). The funnel events
 * are not instrumented in Phase 1, so the gates read `awaiting` today and
 * light up automatically once the event pipeline lands.
 */
router.get(
  "/admin/command-center/retention-gates",
  requireFounder,
  async (req, res) => {
    try {
      const [gate1Res, gate2Res, gate5Res, retentionRes] = await Promise.all([
        // Gate 1 — App Open → Profile Complete (first profile at/after first open).
        // Event-vocabulary mapping: the owner/activation-core funnel "Profile
        // Complete" stage is recorded by the analytics-contract event
        // `onboarding_completed` (the onboarding wizard captures the profile).
        db.execute(sql`
          WITH firsts AS (
            SELECT
              analytics_id,
              min(occurred_at) FILTER (WHERE event_type = 'app_opened') AS app_open,
              min(occurred_at) FILTER (WHERE event_type = 'onboarding_completed') AS profile
            FROM aforce_analytics_events
            WHERE event_type IN ('app_opened', 'onboarding_completed')
            GROUP BY analytics_id
          )
          SELECT
            (count(*) FILTER (WHERE app_open IS NOT NULL))::int AS entered,
            (count(*) FILTER (
              WHERE app_open IS NOT NULL
                AND profile IS NOT NULL
                AND profile >= app_open
            ))::int AS converted
          FROM firsts
        `),
        // Gate 2 — Profile Complete → First Command, median seconds.
        // Vocabulary mapping: "Profile Complete" = `onboarding_completed`;
        // "First Command" = the FIRST `command_followed` (min occurred_at).
        db.execute(sql`
          WITH m AS (
            SELECT
              analytics_id,
              min(occurred_at) FILTER (WHERE event_type = 'onboarding_completed') AS profile,
              min(occurred_at) FILTER (WHERE event_type = 'command_followed') AS cmd
            FROM aforce_analytics_events
            WHERE event_type IN ('onboarding_completed', 'command_followed')
            GROUP BY analytics_id
          ), d AS (
            SELECT extract(epoch FROM (cmd - profile)) AS secs
            FROM m
            WHERE profile IS NOT NULL AND cmd IS NOT NULL AND cmd >= profile
          )
          SELECT
            count(*)::int AS entered,
            (percentile_cont(0.5) WITHIN GROUP (ORDER BY secs))::float8 AS median_seconds
          FROM d
        `),
        // Gate 5 — QR Scan → Activated. Activation = first `command_followed`.
        // `qr_scanned` is the ACQUISITION QR event (a QR on a purchased can /
        // marketing deep-link), distinct from the in-app HydroScan product scan
        // (`receipt_scanned`). It is instrumented in the deep-link observer; until
        // an acquisition QR is scanned, this gate has an empty cohort → awaiting.
        db.execute(sql`
          WITH firsts AS (
            SELECT
              analytics_id,
              min(occurred_at) FILTER (WHERE event_type = 'qr_scanned') AS qr,
              min(occurred_at) FILTER (WHERE event_type = 'command_followed') AS activated
            FROM aforce_analytics_events
            WHERE event_type IN ('qr_scanned', 'command_followed')
            GROUP BY analytics_id
          )
          SELECT
            (count(*) FILTER (WHERE qr IS NOT NULL))::int AS entered,
            (count(*) FILTER (
              WHERE qr IS NOT NULL
                AND activated IS NOT NULL
                AND activated >= qr
            ))::int AS converted
          FROM firsts
        `),
        // Gates 3 & 4 — Day 1 → Day 7 and Day 7 → Day 30 cohort retention.
        db.execute(sql`
          WITH life AS (
            SELECT
              analytics_id,
              min(occurred_at) AS first_seen,
              max(occurred_at) AS last_seen
            FROM aforce_analytics_events
            GROUP BY analytics_id
          )
          SELECT
            (count(*) FILTER (
              WHERE first_seen <= now() - interval '7 days'
            ))::int AS d7_cohort,
            (count(*) FILTER (
              WHERE first_seen <= now() - interval '7 days'
                AND last_seen >= first_seen + interval '6 days'
            ))::int AS d7_retained,
            (count(*) FILTER (
              WHERE first_seen <= now() - interval '30 days'
                AND last_seen >= first_seen + interval '6 days'
            ))::int AS d30_cohort,
            (count(*) FILTER (
              WHERE first_seen <= now() - interval '30 days'
                AND last_seen >= first_seen + interval '6 days'
                AND last_seen >= first_seen + interval '29 days'
            ))::int AS d30_retained
          FROM life
        `),
      ]);

      const gate1 = firstRow(gate1Res);
      const gate2 = firstRow(gate2Res);
      const gate5 = firstRow(gate5Res);
      const retention = firstRow(retentionRes);

      const raw: RetentionGatesRaw = {
        appOpenEntered: num(gate1["entered"]),
        appOpenConverted: num(gate1["converted"]),
        profileToCmdEntered: num(gate2["entered"]),
        profileToCmdMedianSeconds: numOrNull(gate2["median_seconds"]),
        d7Cohort: num(retention["d7_cohort"]),
        d7Retained: num(retention["d7_retained"]),
        d30Cohort: num(retention["d30_cohort"]),
        d30Retained: num(retention["d30_retained"]),
        qrEntered: num(gate5["entered"]),
        qrConverted: num(gate5["converted"]),
      };

      const dto = RetentionGatesSchema.parse(
        buildRetentionGates(raw, new Date().toISOString()),
      );
      return res.json(dto);
    } catch (err) {
      logger.error({ err }, "GET /admin/command-center/retention-gates failed");
      return res
        .status(500)
        .json({ error: "command_center_retention_gates_failed" });
    }
  },
);

/**
 * ACTIVATION FUNNEL — the owner's QR-acquisition funnel, segmented by
 * attribution (SKU / retail location / geography / campaign).
 *
 * Distinct from the single-number Gate 5 above: this is the full
 * "track every step by SKU / retail / geo" view. We pull one
 * PSEUDONYMOUS row per identity (earliest funnel-milestone timestamps +
 * the attribution payload from its first `qr_scanned`), then run the
 * pure, unit-tested `@workspace/activation-core` funnel engine
 * in-process. The per-identity rows never leave the server (never joined
 * to users / subscriptions); only aggregate stage counts + conversion
 * rates are returned. No-fabrication: an empty cohort reports `awaiting`
 * + null rate, and un-instrumented funnel stages are flagged
 * `instrumented: false` rather than a fake "0 reached".
 *
 * Event → milestone mapping: qr_scanned→qr_scanned, app_opened→app_opened,
 * onboarding_completed→profile_completed, command_followed→
 * first_command_completed, subscription_started→subscription_started.
 */
router.get(
  "/admin/command-center/activation-funnel",
  requireFounder,
  async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT
          min(occurred_at) FILTER (WHERE event_type = 'qr_scanned') AS qr_scanned,
          min(occurred_at) FILTER (WHERE event_type = 'app_opened') AS app_opened,
          min(occurred_at) FILTER (WHERE event_type = 'onboarding_completed') AS profile_completed,
          min(occurred_at) FILTER (WHERE event_type = 'command_followed') AS first_command_completed,
          min(occurred_at) FILTER (WHERE event_type = 'subscription_started') AS subscription_started,
          (array_agg(payload ORDER BY occurred_at)
            FILTER (WHERE event_type = 'qr_scanned'))[1] AS qr_payload
        FROM aforce_analytics_events
        WHERE event_type IN (
          'qr_scanned', 'app_opened', 'onboarding_completed',
          'command_followed', 'subscription_started'
        )
        GROUP BY analytics_id
      `);

      const rows = ((result as { rows?: Row[] }).rows ?? []).map(
        (r): ActivationFunnelRow => ({
          qrScanned: isoOrNull(r["qr_scanned"]),
          appOpened: isoOrNull(r["app_opened"]),
          profileCompleted: isoOrNull(r["profile_completed"]),
          firstCommandCompleted: isoOrNull(r["first_command_completed"]),
          subscriptionStarted: isoOrNull(r["subscription_started"]),
          qrPayload: payloadOrNull(r["qr_payload"]),
        }),
      );

      const dto = ActivationFunnelSchema.parse(
        buildActivationFunnel(rows, new Date().toISOString()),
      );
      return res.json(dto);
    } catch (err) {
      logger.error(
        { err },
        "GET /admin/command-center/activation-funnel failed",
      );
      return res
        .status(500)
        .json({ error: "command_center_activation_funnel_failed" });
    }
  },
);

/**
 * GET /admin/command-center/marketing — the founder MARKETING view: the
 * acquisition→revenue lens over the SAME pseudonymous analytics events.
 *
 * Per pseudonymous identity we read only the first `qr_scanned` (acquisition
 * + attribution payload) and the first `subscription_started` (paid outcome
 * + its NON-PII revenue payload), GROUP BY analytics_id in-DB, then run the
 * pure activation-core engine in-process. The per-identity rows never leave
 * the server (NEVER joined to users / subscriptions / Stripe); only
 * aggregate scans / subscribers / revenue + null-safe rates are returned.
 * No-fabrication: a source nobody scanned reports `subscribeRate: null`
 * (awaiting), and a subscriber whose event carried no valid revenue payload
 * counts toward `subscribers` but contributes no gross (awaiting revenue) —
 * never a fabricated 0% or $0.
 */
router.get(
  "/admin/command-center/marketing",
  requireFounder,
  async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT
          min(occurred_at) FILTER (WHERE event_type = 'qr_scanned') AS qr_scanned,
          min(occurred_at) FILTER (WHERE event_type = 'subscription_started') AS subscription_started,
          (array_agg(payload ORDER BY occurred_at)
            FILTER (WHERE event_type = 'qr_scanned'))[1] AS qr_payload,
          (array_agg(payload ORDER BY occurred_at)
            FILTER (WHERE event_type = 'subscription_started'))[1] AS subscription_payload
        FROM aforce_analytics_events
        WHERE event_type IN ('qr_scanned', 'subscription_started')
        GROUP BY analytics_id
      `);

      const rows = ((result as { rows?: Row[] }).rows ?? []).map(
        (r): MarketingRow => ({
          qrScanned: isoOrNull(r["qr_scanned"]),
          subscriptionStarted: isoOrNull(r["subscription_started"]),
          qrPayload: payloadOrNull(r["qr_payload"]),
          subscriptionPayload: payloadOrNull(r["subscription_payload"]),
        }),
      );

      const dto = MarketingAttributionSchema.parse(
        buildMarketingAttribution(rows, new Date().toISOString()),
      );
      return res.json(dto);
    } catch (err) {
      logger.error({ err }, "GET /admin/command-center/marketing failed");
      return res
        .status(500)
        .json({ error: "command_center_marketing_failed" });
    }
  },
);

export default router;
