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
import { serializeError } from "../../lib/serializeError";
import { db, aforceAnalyticsEvents, type InsertAforceAnalyticsEvent } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  analyticsBatchSchema,
  analyticsForgetSchema,
} from "@workspace/analytics-contract/zod";
import { logger } from "../../lib/logger";
import { sendApiError } from "../../lib/apiError";

const router: IRouter = Router();

router.post("/analytics", async (req, res) => {
  // Validation runs BEFORE the try, so a bad body is answered 400 by a
  // separate path and can never be confused with an operation failure.
  const parsed = analyticsBatchSchema.safeParse(req.body);
  if (!parsed.success) {
    sendApiError(req, res, 400, "invalid_body", "analytics_ingest_failed");
    return;
  }
  const { events } = parsed.data;
  try {
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
    logger.error({ err: serializeError(err) }, "POST /aforce/analytics failed");
    sendApiError(req, res, 500, "analytics_ingest_failed");
    return;
  }
});

router.post("/analytics/forget", async (req, res) => {
  // Validation runs BEFORE the try, so a bad body is answered 400 by a
  // separate path and can never be confused with an operation failure.
  const parsed = analyticsForgetSchema.safeParse(req.body);
  if (!parsed.success) {
    sendApiError(req, res, 400, "invalid_body", "analytics_forget_failed");
    return;
  }
  const { analytics_id } = parsed.data;
  try {
    const deleted = await db
      .delete(aforceAnalyticsEvents)
      .where(eq(aforceAnalyticsEvents.analyticsId, analytics_id))
      .returning({ id: aforceAnalyticsEvents.id });
    return res.json({ deleted: deleted.length });
  } catch (err) {
    logger.error({ err: serializeError(err) }, "POST /aforce/analytics/forget failed");
    sendApiError(req, res, 500, "analytics_forget_failed");
    return;
  }
});

export default router;
