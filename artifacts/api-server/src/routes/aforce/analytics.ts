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
import { consentedAnalyticsIdForRequest } from "../../lib/serverAnalytics";
import { forgetAnalyticsForMember, type Dbx } from "@workspace/db";
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
  // S1-3 · WRITER GATE. Ingest binds to the CALLER'S resolved pseudonym
  // rather than trusting the one in the envelope. This single check is the
  // consent gate, the suppression gate AND the retired-id refusal: a rotated
  // or suppressed value simply is not what the caller resolves to, so a
  // replay from a stale device cannot match and inserts nothing.
  const allowed = await consentedAnalyticsIdForRequest(req);
  if (allowed === null) {
    // Fail closed, and say nothing about WHY — whether a member exists, has
    // revoked, or was suppressed is not something an ingest reply should leak.
    res.json({ inserted: 0 });
    return;
  }
  const foreign = events.filter((e) => e.analytics_id !== allowed);
  if (foreign.length > 0) {
    sendApiError(req, res, 403, "analytics_id_not_owned", "analytics_ingest_failed");
    return;
  }
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
  // OWNERSHIP (S1-3). The caller-supplied `analytics_id` is deliberately NOT
  // used to select rows. Before this, the route deleted
  // `where analytics_id = <caller-supplied>` with no reference to req.userId,
  // so any authenticated caller who supplied another member's pseudonym
  // erased that member's history. The pseudonym is now resolved server-side
  // from the caller's own identity, and the whole operation — delete, retire
  // the pseudonym, suppress the identity, revoke consent, append evidence —
  // runs in one transaction.
  try {
    const result = await forgetAnalyticsForMember(db as unknown as Dbx, req.userId as string);
    return res.json({ deleted: result.deleted, status: result.status });
  } catch (err) {
    logger.error({ err: serializeError(err) }, "POST /aforce/analytics/forget failed");
    sendApiError(req, res, 500, "analytics_forget_failed");
    return;
  }
});

export default router;
