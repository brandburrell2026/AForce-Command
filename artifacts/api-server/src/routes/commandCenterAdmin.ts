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

export default router;
