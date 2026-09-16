/**
 * Resolves the caller's role INSIDE a program, and fails closed.
 *
 * Mounted after `requireAuth`, which populates `req.userId`.
 *
 * Three refusals, in order:
 *
 *   1. THE DEV SENTINEL. `requireAuth` grants `DEFAULT_USER_ID` below
 *      production on two paths. That is harmless on a member's own routes and
 *      actively dangerous here: the sentinel stands for everyone, so a single
 *      shared identity would inherit whatever program membership the seed data
 *      happened to give it. Same reasoning as `requireMemberIdentity`.
 *
 *   2. NO MEMBERSHIP. Not a member, removed, or no such program — all one
 *      answer, 404. Distinguishing them tells an outsider a program exists.
 *
 *   3. AN UNRECOGNISED ROLE STRING. `parseProgramRole` returns null and the
 *      request is refused rather than defaulting to any projection.
 *
 * This middleware deliberately does NOT use `resolveRole` from
 * `requireRole.ts`. That resolver returns `super_admin` whenever
 * `CLERK_SECRET_KEY` is unset outside production, which would hand every
 * developer and every preview session a staff role on this surface. The
 * trainer routes therefore never depend on the rank axis at all — program
 * access is resolved from the database, or it is refused.
 */
import type { RequestHandler } from "express";

import { DEFAULT_USER_ID } from "../lib/aforceState";
import { sendApiError } from "../lib/apiError";
import { serializeError } from "../lib/serializeError";
import { logger } from "../lib/logger";
import { parseProgramRole, redactionLevelFor, type ProgramRole, type RedactionLevel } from "../lib/trainer/roles";
import type { TrainerRepo } from "@workspace/db";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Set by requireProgramAccess. Never set anywhere else. */
      programAccess?: {
        programId: string;
        role: ProgramRole;
        level: RedactionLevel;
      };
    }
  }
}

export function requireProgramAccess(repo: TrainerRepo): RequestHandler {
  return (req, res, next) => {
    void (async () => {
      const userId = req.userId;
      if (!userId || userId === DEFAULT_USER_ID) {
        logger.warn({ route: req.path }, "[requireProgramAccess] refused: sentinel or missing identity");
        sendApiError(req, res, 403, "program_access_requires_member");
        return;
      }

      const programId = req.params["programId"];
      if (typeof programId !== "string" || programId.length === 0) {
        sendApiError(req, res, 400, "program_id_required");
        return;
      }

      let membership;
      try {
        membership = await repo.membership(programId, userId);
      } catch (err) {
        // `serializeError`, like every other error log on this surface. The
        // repo's observability lock greps for the single-key form
        // `logger.error({ err }` and so never saw this two-key call — which
        // is exactly how a raw Error, with whatever a driver hung on it,
        // could reach the log stream from the one middleware every trainer
        // request passes through.
        logger.error(
          { err: serializeError(err), programId },
          "[requireProgramAccess] membership lookup failed",
        );
        // Fail closed on infrastructure failure. A lookup that did not answer
        // is not an answer of "yes".
        sendApiError(req, res, 503, "program_access_unavailable");
        return;
      }

      if (!membership) {
        // 404, not 403: "you are not in this program" and "this program does
        // not exist" must be indistinguishable from outside.
        sendApiError(req, res, 404, "program_not_found");
        return;
      }

      const role = parseProgramRole(membership.role);
      if (!role) {
        logger.error(
          { programId, storedRole: membership.role },
          "[requireProgramAccess] refused: unrecognised program role",
        );
        sendApiError(req, res, 403, "program_role_unrecognised");
        return;
      }

      req.programAccess = { programId, role, level: redactionLevelFor(role) };
      next();
    })();
  };
}
