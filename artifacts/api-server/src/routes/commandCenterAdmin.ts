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
import { serializeError } from "../lib/serializeError";
import { db } from "@workspace/db";
import { sql, type SQL } from "drizzle-orm";
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
import {
  buildPerformanceAgeTrends,
  PerformanceAgeTrendsSchema,
} from "../lib/performanceAgeTrends";
import {
  buildVoiceCheckInUsage,
  VoiceCheckInUsageSchema,
  type VoiceCheckInUsageRow,
} from "../lib/voiceCheckInUsage";
import {
  buildTerritoryEngagement,
  TerritoryEngagementSchema,
  type TerritoryEngagementRow,
} from "../lib/territoryEngagement";
import {
  buildReferralAttribution,
  normalizeReferralFilters,
  tierClaimBounds,
  ReferralAttributionSchema,
  type ReferrerCountRow,
  type ReferralClaimRow,
} from "../lib/referralAttribution";
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
          WHERE level <> 'NOT_COMPUTED'
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
      logger.error({ err: serializeError(err) }, "GET /admin/command-center/summary failed");
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
      logger.error({ err: serializeError(err) }, "GET /admin/command-center/retention-gates failed");
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
 * first_command_completed, first_win_confirmed→first_win_confirmed,
 * subscription_started→subscription_started.
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
          min(occurred_at) FILTER (WHERE event_type = 'first_win_confirmed') AS first_win_confirmed,
          min(occurred_at) FILTER (WHERE event_type = 'subscription_started') AS subscription_started,
          (array_agg(payload ORDER BY occurred_at)
            FILTER (WHERE event_type = 'qr_scanned'))[1] AS qr_payload
        FROM aforce_analytics_events
        WHERE event_type IN (
          'qr_scanned', 'app_opened', 'onboarding_completed',
          'command_followed', 'first_win_confirmed', 'subscription_started'
        )
        GROUP BY analytics_id
      `);

      const rows = ((result as { rows?: Row[] }).rows ?? []).map(
        (r): ActivationFunnelRow => ({
          qrScanned: isoOrNull(r["qr_scanned"]),
          appOpened: isoOrNull(r["app_opened"]),
          profileCompleted: isoOrNull(r["profile_completed"]),
          firstCommandCompleted: isoOrNull(r["first_command_completed"]),
          firstWinConfirmed: isoOrNull(r["first_win_confirmed"]),
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
      logger.error({ err: serializeError(err) }, "GET /admin/command-center/marketing failed");
      return res
        .status(500)
        .json({ error: "command_center_marketing_failed" });
    }
  },
);

/**
 * GET /admin/command-center/voice-checkin-usage — the founder VOICE
 * CHECK-IN™ engagement view over the SAME pseudonymous analytics events.
 *
 * Per pseudonymous identity we read whether it ever opened the app and how
 * many distinct-day voice check-ins it completed (the mobile client emits
 * `voice_checkin_completed` at most once per local day, with NO payload),
 * GROUP BY analytics_id in-DB, then run the pure usage builder in-process.
 * The per-identity rows never leave the server (NEVER joined to users /
 * subscriptions); only aggregate adoption / repeat / cadence + null-safe
 * rates are returned. No-fabrication: an empty denominator reports a null
 * rate (awaiting), never a fabricated 0%.
 */
router.get(
  "/admin/command-center/voice-checkin-usage",
  requireFounder,
  async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT
          bool_or(event_type = 'app_opened') AS app_opened,
          count(*) FILTER (WHERE event_type = 'voice_checkin_completed') AS check_in_count
        FROM aforce_analytics_events
        WHERE event_type IN ('app_opened', 'voice_checkin_completed')
        GROUP BY analytics_id
      `);

      const rows = ((result as { rows?: Row[] }).rows ?? []).map(
        (r): VoiceCheckInUsageRow => ({
          appOpened: r["app_opened"] === true,
          checkInCount: num(r["check_in_count"]),
        }),
      );

      const dto = VoiceCheckInUsageSchema.parse(
        buildVoiceCheckInUsage(rows, new Date().toISOString()),
      );
      return res.json(dto);
    } catch (err) {
      logger.error(
        { err },
        "GET /admin/command-center/voice-checkin-usage failed",
      );
      return res
        .status(500)
        .json({ error: "command_center_voice_checkin_usage_failed" });
    }
  },
);

/**
 * GET /admin/command-center/territory-engagement — the founder TERRITORY
 * engagement view over the SAME pseudonymous analytics events.
 *
 * Per pseudonymous identity we read whether it ever opened the Territory map
 * (`territory_opened`, emitted at most once per local day) and how many real
 * engagement actions it took (`territory_engaged`, with an `action` payload —
 * the mobile client only instruments effectful actions: inspecting a region
 * and supporting a battle side; the stub Join / Challenge buttons are NOT
 * instrumented). We GROUP BY analytics_id in-DB, then run the pure builder
 * in-process. The per-identity rows never leave the server (NEVER joined to
 * users / subscriptions); only aggregate reach / engagement + null-safe
 * rates + an action breakdown are returned. No-fabrication: an empty
 * denominator reports a null rate (awaiting), never a fabricated 0%, and an
 * action nobody performed is simply absent from the breakdown.
 */
router.get(
  "/admin/command-center/territory-engagement",
  requireFounder,
  async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT
          bool_or(event_type = 'territory_opened') AS opened,
          count(*) FILTER (
            WHERE event_type = 'territory_engaged'
              AND payload->>'action' = 'region_selected'
          ) AS region_selected,
          count(*) FILTER (
            WHERE event_type = 'territory_engaged'
              AND payload->>'action' = 'battle_supported'
          ) AS battle_supported
        FROM aforce_analytics_events
        WHERE event_type IN ('territory_opened', 'territory_engaged')
        GROUP BY analytics_id
      `);

      const rows = ((result as { rows?: Row[] }).rows ?? []).map(
        (r): TerritoryEngagementRow => ({
          opened: r["opened"] === true,
          actionCounts: {
            region_selected: num(r["region_selected"]),
            battle_supported: num(r["battle_supported"]),
          },
        }),
      );

      const dto = TerritoryEngagementSchema.parse(
        buildTerritoryEngagement(rows, new Date().toISOString()),
      );
      return res.json(dto);
    } catch (err) {
      logger.error(
        { err },
        "GET /admin/command-center/territory-engagement failed",
      );
      return res
        .status(500)
        .json({ error: "command_center_territory_engagement_failed" });
    }
  },
);

/**
 * GET /admin/command-center/performance-age-trends — the founder Performance
 * Age™ population trend over the pseudonymous `performance_age_snapshot`
 * events.
 *
 * Each event carries ONLY the privacy-safe years delta (performanceAge −
 * actualAge; negative = younger) + a lifecycle status — never an absolute age.
 * We collapse to ONE snapshot per identity per UTC day in-DB (DISTINCT ON,
 * first-of-day wins, matching the mobile client's once-per-day gate, so an
 * occasional client re-emit can never inflate the sample), then aggregate the
 * most recent 7-day window vs the prior 7-day window: mean delta, total daily
 * snapshots, and DISTINCT identities per window.
 *
 * Privacy / Score-Protection: AGGREGATE-ONLY — pseudonymous ids surface solely
 * as distinct counts, NEVER joined to users / subscriptions and NEVER returned
 * raw. The pure builder enforces k-anonymity (a window below
 * PERF_AGE_MIN_COHORT_MEMBERS distinct members reports a null average, never a
 * fabricated number) and only computes a direction when BOTH windows are
 * measured. Performance Age is a display-only projection — this never reads or
 * writes any hydration point.
 */
router.get(
  "/admin/command-center/performance-age-trends",
  requireFounder,
  async (req, res) => {
    try {
      const result = await db.execute(sql`
        WITH daily AS (
          SELECT DISTINCT ON (
            analytics_id, (occurred_at AT TIME ZONE 'UTC')::date
          )
            analytics_id,
            occurred_at,
            (payload->>'deltaYears')::float8 AS delta
          FROM aforce_analytics_events
          WHERE event_type = 'performance_age_snapshot'
            AND occurred_at >= now() - interval '14 days'
            AND jsonb_typeof(payload->'deltaYears') = 'number'
          ORDER BY
            analytics_id,
            (occurred_at AT TIME ZONE 'UTC')::date,
            occurred_at ASC
        )
        SELECT
          avg(delta) FILTER (
            WHERE occurred_at >= now() - interval '7 days'
          ) AS current_avg,
          count(*) FILTER (
            WHERE occurred_at >= now() - interval '7 days'
          ) AS current_count,
          count(DISTINCT analytics_id) FILTER (
            WHERE occurred_at >= now() - interval '7 days'
          ) AS current_members,
          avg(delta) FILTER (
            WHERE occurred_at < now() - interval '7 days'
              AND occurred_at >= now() - interval '14 days'
          ) AS previous_avg,
          count(*) FILTER (
            WHERE occurred_at < now() - interval '7 days'
              AND occurred_at >= now() - interval '14 days'
          ) AS previous_count,
          count(DISTINCT analytics_id) FILTER (
            WHERE occurred_at < now() - interval '7 days'
              AND occurred_at >= now() - interval '14 days'
          ) AS previous_members
        FROM daily
      `);

      const row = firstRow(result);
      const dto = PerformanceAgeTrendsSchema.parse(
        buildPerformanceAgeTrends(
          {
            current: {
              avgDeltaYears: numOrNull(row["current_avg"]),
              snapshotCount: num(row["current_count"]),
              distinctMembers: num(row["current_members"]),
            },
            previous: {
              avgDeltaYears: numOrNull(row["previous_avg"]),
              snapshotCount: num(row["previous_count"]),
              distinctMembers: num(row["previous_members"]),
            },
          },
          new Date().toISOString(),
        ),
      );
      return res.json(dto);
    } catch (err) {
      logger.error(
        { err },
        "GET /admin/command-center/performance-age-trends failed",
      );
      return res
        .status(500)
        .json({ error: "command_center_performance_age_trends_failed" });
    }
  },
);

/**
 * GET /admin/command-center/referral-attribution — the founder REFERRAL &
 * AMBASSADOR attribution view.
 *
 * UNLIKE the analytics-pipeline panels above, this reads the REAL server-side
 * referral ledger that backs the consumer referral loop: `aforce_users`
 * (referral_code) + `aforce_referral_claims`. The founder legitimately needs to
 * see WHO referred WHOM, so referrer/referee identity (Clerk user id + the
 * generated, non-PII referral code) IS surfaced — this is a private founder
 * cockpit, never a consumer view.
 *
 * Score-Protection / data minimisation: a claim row carries nothing about a
 * user's hydration points, readiness, recovery, health, or performance age,
 * and this handler joins ONLY `aforce_users` (for the referral code) — never
 * the per-user state / score tables. Emails are deliberately excluded.
 *
 * Optional filters (query params): `from` / `to` (claim-date range, any
 * Date-parseable string → ISO), `code` (the code used, uppercased),
 * `referrerUserId`, `tier` (referrer lifetime tier — a correlated count
 * sub-query maps each claim's referrer to a tier band so the filter is applied
 * in SQL BEFORE the LIMIT, never after), and `status` (`all` | `claimed`; the
 * ledger has no pending state, so this is a validated no-op). They scope the
 * recent-claims detail table + the `claimsInRange` count; the leaderboard, tier
 * distribution, and lifetime totals are always computed over the full ledger.
 * Tiers are derived in the pure builder so `referralTiers.ts` stays the single
 * source of truth. An unparseable date / unknown tier / unknown status → 400.
 */
router.get(
  "/admin/command-center/referral-attribution",
  requireFounder,
  async (req, res) => {
    const norm = normalizeReferralFilters(req.query);
    if (!norm.ok) {
      return res.status(400).json({ error: norm.error });
    }
    const { filters, recentLimit } = norm.value;

    // Build the claim-filter WHERE clause once (shared by the in-range count
    // and the recent-claims detail query). All values are parameterised.
    const conds: SQL[] = [];
    if (filters.from) conds.push(sql`c.created_at >= ${filters.from}::timestamptz`);
    if (filters.to) conds.push(sql`c.created_at <= ${filters.to}::timestamptz`);
    if (filters.code) conds.push(sql`upper(c.code_used) = ${filters.code}`);
    if (filters.referrerUserId)
      conds.push(sql`c.referrer_user_id = ${filters.referrerUserId}`);
    // Tier is a property of the REFERRER's lifetime claim count, not of a single
    // claim, so map each claim's referrer to a count band via a correlated
    // sub-query. Applied here (inside the shared WHERE) it filters BEFORE the
    // recent-claims LIMIT, so a tier page is never silently truncated.
    if (filters.tier) {
      const b = tierClaimBounds(filters.tier);
      const lifetime = sql`(SELECT count(*) FROM aforce_referral_claims rc WHERE rc.referrer_user_id = c.referrer_user_id)`;
      conds.push(sql`${lifetime} >= ${b.lo}`);
      if (b.hi != null) conds.push(sql`${lifetime} < ${b.hi}`);
    }
    // `status` is intentionally not a SQL predicate: the ledger models only
    // completed claims, so `all` / `claimed` select the same rows. It is
    // validated + echoed for explicit founder intent (never used to hide rows).
    const whereSql =
      conds.length > 0 ? sql`WHERE ${sql.join(conds, sql` AND `)}` : sql``;

    try {
      // Lifetime totals over the whole ledger.
      const totalsRes = await db.execute(sql`
        SELECT
          count(*)::int AS total_claims,
          count(DISTINCT referee_user_id)::int AS total_referred
        FROM aforce_referral_claims
      `);

      // One row per distinct referrer (NEVER capped — drives totals + tier
      // distribution). LEFT JOIN so a deleted referrer still appears (null
      // code → anonymized "Operator ????" handle in the builder).
      const referrersRes = await db.execute(sql`
        SELECT c.referrer_user_id, u.referral_code, c.claims
        FROM (
          SELECT referrer_user_id, count(*)::int AS claims
          FROM aforce_referral_claims
          GROUP BY referrer_user_id
        ) c
        LEFT JOIN aforce_users u ON u.id = c.referrer_user_id
        ORDER BY c.claims DESC, c.referrer_user_id ASC
      `);

      // Count of claims matching the applied filters.
      const inRangeRes = await db.execute(sql`
        SELECT count(*)::int AS n
        FROM aforce_referral_claims c
        ${whereSql}
      `);

      // Recent-claims detail (filtered, newest-first, limited). The referrer's
      // lifetime claim count rides along so the builder can derive their tier.
      const claimsRes = await db.execute(sql`
        SELECT
          c.id,
          c.code_used,
          c.referrer_user_id,
          c.referee_user_id,
          c.created_at,
          u.referral_code AS referrer_code,
          COALESCE(agg.claims, 0)::int AS referrer_lifetime_claims
        FROM aforce_referral_claims c
        LEFT JOIN aforce_users u ON u.id = c.referrer_user_id
        LEFT JOIN (
          SELECT referrer_user_id, count(*)::int AS claims
          FROM aforce_referral_claims
          GROUP BY referrer_user_id
        ) agg ON agg.referrer_user_id = c.referrer_user_id
        ${whereSql}
        ORDER BY c.created_at DESC, c.id DESC
        LIMIT ${recentLimit}
      `);

      const totalsRow = firstRow(totalsRes);

      const referrers = ((referrersRes as { rows?: Row[] }).rows ?? []).map(
        (r): ReferrerCountRow => ({
          referrerUserId: String(r["referrer_user_id"] ?? ""),
          referralCode:
            r["referral_code"] == null ? null : String(r["referral_code"]),
          claims: num(r["claims"]),
        }),
      );

      const recentClaims = ((claimsRes as { rows?: Row[] }).rows ?? []).map(
        (r): ReferralClaimRow => ({
          id: num(r["id"]),
          codeUsed: String(r["code_used"] ?? ""),
          referrerUserId: String(r["referrer_user_id"] ?? ""),
          referrerCode:
            r["referrer_code"] == null ? null : String(r["referrer_code"]),
          referrerLifetimeClaims: num(r["referrer_lifetime_claims"]),
          refereeUserId: String(r["referee_user_id"] ?? ""),
          claimedAt: isoOrNull(r["created_at"]),
        }),
      );

      const dto = ReferralAttributionSchema.parse(
        buildReferralAttribution(
          {
            referrers,
            totals: {
              totalClaims: num(totalsRow["total_claims"]),
              totalReferredUsers: num(totalsRow["total_referred"]),
            },
            recentClaims,
            claimsInRange: num(firstRow(inRangeRes)["n"]),
            filters,
          },
          new Date().toISOString(),
          { recentLimit },
        ),
      );
      return res.json(dto);
    } catch (err) {
      logger.error(
        { err },
        "GET /admin/command-center/referral-attribution failed",
      );
      return res
        .status(500)
        .json({ error: "command_center_referral_attribution_failed" });
    }
  },
);

export default router;
