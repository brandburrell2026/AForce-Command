/**
 * INTERNAL analytics ingestion + delete-my-data.
 *
 * Mounted under `/api/aforce` (so `requireAuth` already gates every
 * route — ingestion is authenticated, never public). There is no
 * public analytics route and no consumer-facing analytics read here;
 * aggregated reads live behind the role gate in `routes/analyticsAdmin`.
 *
 *   POST /analytics         → ingest a consent-gated event batch.
 *                             Idempotent on eventId (ON CONFLICT DO
 *                             NOTHING) so client retries never double-
 *                             count.
 *   POST /analytics/forget  → delete-my-data: remove every row for the
 *                             caller-supplied pseudonymous analytics_id.
 */

import { Router, type IRouter } from "express";
import { db, aforceAnalyticsEvents, type InsertAforceAnalyticsEvent } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  analyticsBatchSchema,
  analyticsForgetSchema,
} from "@workspace/analytics-contract/zod";
import { logger } from "../../lib/logger";

const router: IRouter = Router();

router.post("/analytics", async (req, res) => {
  try {
    const { events } = analyticsBatchSchema.parse(req.body);
    const now = new Date();
    const rows: InsertAforceAnalyticsEvent[] = events.map((e) => {
      const occurred = new Date(e.occurredAt);
      return {
        eventId: e.eventId,
        analyticsId: e.analytics_id,
        eventType: e.eventType,
        // Guard against an unparseable timestamp slipping past the
        // length-only string check; fall back to receive time.
        occurredAt: Number.isNaN(occurred.getTime()) ? now : occurred,
        schemaVersion: e.schemaVersion,
        payload: e.payload,
      };
    });
    const inserted = await db
      .insert(aforceAnalyticsEvents)
      .values(rows)
      .onConflictDoNothing({ target: aforceAnalyticsEvents.eventId })
      .returning({ id: aforceAnalyticsEvents.id });
    return res.json({
      received: events.length,
      accepted: inserted.length,
      deduped: events.length - inserted.length,
    });
  } catch (err) {
    logger.error({ err }, "POST /aforce/analytics failed");
    return res.status(400).json({ error: "analytics_ingest_failed" });
  }
});

router.post("/analytics/forget", async (req, res) => {
  try {
    const { analytics_id } = analyticsForgetSchema.parse(req.body);
    const deleted = await db
      .delete(aforceAnalyticsEvents)
      .where(eq(aforceAnalyticsEvents.analyticsId, analytics_id))
      .returning({ id: aforceAnalyticsEvents.id });
    return res.json({ deleted: deleted.length });
  } catch (err) {
    logger.error({ err }, "POST /aforce/analytics/forget failed");
    return res.status(400).json({ error: "analytics_forget_failed" });
  }
});

export default router;
