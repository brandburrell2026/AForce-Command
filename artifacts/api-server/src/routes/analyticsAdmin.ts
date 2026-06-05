/**
 * INTERNAL analytics read surface — restricted to admin / super_admin.
 *
 * Returns ONLY aggregates (counts), never raw rows and never PII: the
 * Clerk user id is not stored on analytics rows, and `analytics_id` is
 * surfaced only as a distinct-count. This is the server-side "admin
 * dashboard" data layer; there is intentionally no consumer-facing
 * analytics UI (replit.md build lock).
 */

import { Router, type IRouter } from "express";
import { db, aforceAnalyticsEvents } from "@workspace/db";
import { sql, gte } from "drizzle-orm";
import { requireRole } from "../middlewares/requireRole";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

router.get(
  "/admin/analytics/summary",
  requireRole("admin", "super_admin"),
  async (_req, res) => {
    try {
      const sevenDaysAgo = new Date(Date.now() - SEVEN_DAYS_MS);

      const [totals] = await db
        .select({
          totalEvents: sql<number>`count(*)::int`,
          distinctAnalyticsIds: sql<number>`count(distinct ${aforceAnalyticsEvents.analyticsId})::int`,
        })
        .from(aforceAnalyticsEvents);

      const byTypeRows = await db
        .select({
          eventType: aforceAnalyticsEvents.eventType,
          count: sql<number>`count(*)::int`,
        })
        .from(aforceAnalyticsEvents)
        .groupBy(aforceAnalyticsEvents.eventType);

      const [recent] = await db
        .select({ last7dEvents: sql<number>`count(*)::int` })
        .from(aforceAnalyticsEvents)
        .where(gte(aforceAnalyticsEvents.occurredAt, sevenDaysAgo));

      const byType = byTypeRows.reduce<Record<string, number>>((acc, r) => {
        acc[r.eventType] = r.count;
        return acc;
      }, {});

      return res.json({
        totalEvents: totals?.totalEvents ?? 0,
        distinctAnalyticsIds: totals?.distinctAnalyticsIds ?? 0,
        last7dEvents: recent?.last7dEvents ?? 0,
        byType,
      });
    } catch (err) {
      logger.error({ err }, "GET /admin/analytics/summary failed");
      return res.status(500).json({ error: "analytics_summary_failed" });
    }
  },
);

export default router;
