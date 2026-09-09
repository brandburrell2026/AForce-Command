/**
 * Analytics identity + consent endpoints (S1-3).
 *
 * The server is the authority for BOTH the pseudonym and the operative
 * consent state. The client renders what these return; it no longer mints an
 * identity and no longer asserts its local consent as truth.
 *
 * Every route is behind `requireAuth` (mounted with the aforce router) and
 * `requireMemberIdentity`, which refuses the DEFAULT_USER_ID sentinel.
 *
 * The decision logic lives in `@workspace/db`'s analyticsIdentityRepo, not
 * here — the db-lane race laws drive those functions directly, so what is
 * proven under real concurrency is this code path rather than a copy.
 */
import { Router, type IRouter } from "express";
import { z } from "zod";
import {
  db,
  advanceConsent,
  forgetAnalyticsForMember,
  readConsent,
  resolveAnalyticsIdentity,
  rotateAnalyticsIdentity,
  type Dbx,
} from "@workspace/db";

import { logger } from "../../lib/logger";
import { sendApiError } from "../../lib/apiError";
import { requireMemberIdentity } from "../../middlewares/requireMemberIdentity";
import { serializeError } from "../../lib/serializeError";

const router: IRouter = Router();
const dbx = db as unknown as Dbx;

router.use(requireMemberIdentity);

/**
 * The consent state on the wire.
 *
 * `decisionSeq` is null when the member has NEVER decided — deliberately not
 * 0. Encoding an absent row as 0 makes the first grant a permanent 409 loop:
 * the compare-and-set `where decision_seq = 0` matches no row, and the
 * refusal hands back the same 0 that caused it.
 */
function consentWire(
  c: { granted: boolean; decisionSeq: number; disclosureVersion: number } | null,
) {
  return c === null
    ? { granted: false, decisionSeq: null, disclosureVersion: null }
    : { granted: c.granted, decisionSeq: c.decisionSeq, disclosureVersion: c.disclosureVersion };
}

/**
 * POST /analytics-identity/resolve — the member's active pseudonym, minted on
 * first use. Idempotent, and safe under concurrent calls from two devices.
 *
 * 409 for a suppressed member: a member who asked to be forgotten must never
 * be silently re-minted and re-enrolled by the next app launch.
 */
router.post("/analytics-identity/resolve", async (req, res) => {
  try {
    const identity = await resolveAnalyticsIdentity(dbx, req.userId as string);
    if (identity.status === "suppressed") {
      sendApiError(req, res, 409, "analytics_identity_suppressed");
      return;
    }
    const consent = await readConsent(dbx, req.userId as string);
    res.json({ analyticsId: identity.analyticsId, status: identity.status, consent: consentWire(consent) });
    return;
  } catch (err) {
    logger.error({ err: serializeError(err) }, "POST /analytics-identity/resolve failed");
    sendApiError(req, res, 500, "analytics_identity_failed");
    return;
  }
});

/**
 * POST /analytics-identity/rotate — issue a new pseudonym.
 *
 * History is NOT re-keyed: rows under the retired value keep it and become
 * unattributable. That is the product of rotation, not a side effect.
 * Rotation is an identity operation, so it writes no consent evidence and
 * does not advance `decision_seq`.
 */
router.post("/analytics-identity/rotate", async (req, res) => {
  try {
    const next = await rotateAnalyticsIdentity(dbx, req.userId as string);
    if (next === null) {
      sendApiError(req, res, 409, "analytics_identity_suppressed");
      return;
    }
    res.json({ analyticsId: next });
    return;
  } catch (err) {
    logger.error({ err: serializeError(err) }, "POST /analytics-identity/rotate failed");
    sendApiError(req, res, 500, "analytics_identity_failed");
    return;
  }
});

/** GET /analytics-consent — the operative state the client renders. */
router.get("/analytics-consent", async (req, res) => {
  try {
    res.json(consentWire(await readConsent(dbx, req.userId as string)));
    return;
  } catch (err) {
    logger.error({ err: serializeError(err) }, "GET /analytics-consent failed");
    sendApiError(req, res, 500, "analytics_consent_failed");
    return;
  }
});

const consentBody = z.object({
  action: z.enum(["grant", "revoke"]),
  disclosureVersion: z.number().int().positive(),
  /**
   * The sequence the caller believes is current. `null` means "I believe no
   * decision exists yet" and is the ONLY route into the insert. A literal 0
   * is rejected as a protocol error rather than silently taking the update
   * path, where it could never match.
   */
  expectedSeq: z.number().int().positive().nullable(),
});

/**
 * POST /analytics-consent — record a member decision.
 *
 * Compare-and-set on `decisionSeq`. A device holding a stale state cannot
 * re-grant consent the member revoked on another device: the CAS refuses and
 * returns the CURRENT state so the client can re-render rather than retry
 * blindly. Client timestamps are never used for ordering — two devices with
 * skewed clocks would silently reorder the member's own decisions.
 */
router.post("/analytics-consent", async (req, res) => {
  const parsed = consentBody.safeParse(req.body);
  if (!parsed.success) {
    sendApiError(req, res, 400, "invalid_body", "analytics_consent_failed");
    return;
  }
  try {
    const result = await advanceConsent(dbx, {
      userId: req.userId as string,
      action: parsed.data.action,
      disclosureVersion: parsed.data.disclosureVersion,
      expectedSeq: parsed.data.expectedSeq,
    });
    if (!result.ok) {
      // 409 carries the current state: the client adopts it and re-renders.
      res.status(409).json({
        error: "consent_stale",
        code: "consent_stale",
        current: consentWire(result.current),
      });
      return;
    }
    res.json(consentWire(result.state));
    return;
  } catch (err) {
    logger.error({ err: serializeError(err) }, "POST /analytics-consent failed");
    sendApiError(req, res, 500, "analytics_consent_failed");
    return;
  }
});

/**
 * POST /analytics-identity/forget — delete-my-data.
 *
 * Deletes the member's analytics rows, retires the pseudonym, suppresses the
 * identity and revokes consent, in ONE transaction. The pseudonym is resolved
 * server-side from `req.userId`; no caller-supplied id is accepted.
 */
router.post("/analytics-identity/forget", async (req, res) => {
  try {
    const result = await forgetAnalyticsForMember(dbx, req.userId as string);
    res.json({ deleted: result.deleted, status: result.status });
    return;
  } catch (err) {
    logger.error({ err: serializeError(err) }, "POST /analytics-identity/forget failed");
    sendApiError(req, res, 500, "analytics_forget_failed");
    return;
  }
});

export default router;
