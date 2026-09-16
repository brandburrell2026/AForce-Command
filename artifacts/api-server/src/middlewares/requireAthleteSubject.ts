/**
 * Resolves the SUBJECT of a request — the athlete named by `:athleteId` — and
 * fails closed.
 *
 * `requireProgramAccess` answers "who is asking, and with what projection".
 * This middleware answers "about whom, and may they be asked about at all".
 * Mounted after it, on every route carrying an `:athleteId` param.
 *
 * It exists because those two questions were previously answered inline, and
 * so were answered differently in each router: the consent gate lived inside
 * `projectAthlete` and therefore only ran in `routes/trainer.ts`, while
 * `trainerDocs`, `trainerRtp` and `trainerReport` disclosed notes, charts and
 * progressions about athletes who had revoked. Membership of the subject was
 * verified in two places out of ten. The invariants belong on the path every
 * router already takes, so a router added later inherits them instead of
 * re-deriving them.
 *
 * Four refusals, in order:
 *
 *   1. NO PROGRAM ACCESS. `req.programAccess` is unset, which means this
 *      middleware was mounted without `requireProgramAccess` before it. That
 *      is a wiring mistake, and the safe response to a wiring mistake is 403.
 *
 *   2. CROSS-SUBJECT SELF READ. An athlete may be the subject of their own
 *      request and no one else's. 404, matching the roster's refusal: that
 *      another athlete exists is itself a disclosure.
 *
 *   3. THE SUBJECT IS NOT AN ATHLETE MEMBER. Not in the program, removed, or
 *      a member holding a staff role — all one answer, 404. Without this, a
 *      note or a return-to-play progression could be filed against an
 *      arbitrary user id, readable by every clinical member of the caller's
 *      program, about a subject who can never see or revoke it.
 *
 *   4. NO CONSENT. Health content is withheld for every staff level including
 *      clinical, per the Phase 0 ruling recorded in
 *      `docs/trainer-dashboard-plan.md` §0b. The athlete reading their own
 *      record is not gated by their own grant.
 *
 * The consent policy is REQUIRED BY DEFAULT and must be opted out of
 * explicitly, so that a route added later is gated unless its author states
 * otherwise in writing. `"not-required"` is not a weaker gate — it marks a
 * route whose disclosure is identity-only, or whose consent question is still
 * open, and the reason belongs at the call site.
 *
 * Consent state is attached to the request whether or not it gated anything,
 * because the audit row needs `consentDecisionSeq` to be provable after the
 * fact. Every `logAccess` outside `routes/trainer.ts` previously hardcoded it
 * to null, which made "this was read while consent stood" unanswerable — the
 * one question the column was added to answer.
 */
import type { RequestHandler } from "express";

import { sendApiError } from "../lib/apiError";
import { logger } from "../lib/logger";
import { serializeError } from "../lib/serializeError";
import type { TrainerRepo } from "@workspace/db";

/**
 * Whether the route may disclose or record health content about the subject.
 *
 * `"required"` — the default. No consent, no request.
 * `"not-required"` — the route discloses nothing health-bearing, or its
 *   consent question is open. State which at the call site.
 */
export type SubjectConsentPolicy = "required" | "not-required";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Set by requireAthleteSubject. Never set anywhere else. */
      athleteSubject?: {
        athleteUserId: string;
        consentGranted: boolean;
        /** Server-issued monotonic decision sequence. Belongs in every audit row. */
        consentDecisionSeq: number;
      };
    }
  }
}

export function requireAthleteSubject(
  repo: TrainerRepo,
  options: { consent?: SubjectConsentPolicy } = {},
): RequestHandler {
  const policy: SubjectConsentPolicy = options.consent ?? "required";

  return (req, res, next) => {
    void (async () => {
      const access = req.programAccess;
      const actorId = req.userId;
      if (!access || !actorId) {
        logger.warn({ route: req.path }, "[requireAthleteSubject] refused: no resolved program access");
        sendApiError(req, res, 403, "program_access_required");
        return;
      }

      const athleteId = req.params["athleteId"];
      if (typeof athleteId !== "string" || athleteId.length === 0) {
        sendApiError(req, res, 400, "athlete_id_required");
        return;
      }

      if (access.level === "self" && athleteId !== actorId) {
        sendApiError(req, res, 404, "athlete_not_found");
        return;
      }

      let member;
      let consent;
      try {
        member = await repo.membership(access.programId, athleteId);
        // The consent read is unconditional: a non-member short-circuits
        // below, and every permitted caller needs the decision sequence for
        // its audit row even when the policy did not gate anything.
        consent = member ? await repo.consent(access.programId, athleteId) : null;
      } catch (err) {
        logger.error(
          { err: serializeError(err), programId: access.programId },
          "[requireAthleteSubject] subject lookup failed",
        );
        // Fail closed. A lookup that did not answer is not an answer of "yes".
        sendApiError(req, res, 503, "athlete_subject_unavailable");
        return;
      }

      if (!member || member.role !== "athlete" || member.status !== "active" || !consent) {
        sendApiError(req, res, 404, "athlete_not_found");
        return;
      }

      if (policy === "required" && !consent.granted && access.level !== "self") {
        // Deliberately not 404. The caller is a member of the program and the
        // roster already tells them this athlete exists and has not consented;
        // pretending otherwise here would contradict it. What is withheld is
        // the content, and the refusal says exactly that.
        sendApiError(req, res, 403, "athlete_consent_required");
        return;
      }

      req.athleteSubject = {
        athleteUserId: athleteId,
        consentGranted: consent.granted,
        consentDecisionSeq: consent.decisionSeq,
      };
      next();
    })();
  };
}
