/**
 * Refuses the shared dev sentinel on identity endpoints.
 *
 * `requireAuth` grants `DEFAULT_USER_ID` ("default") below production on TWO
 * paths — `CLERK_SECRET_KEY` unset, and Clerk configured but the caller not
 * signed in. That fallback exists so the app is usable end-to-end in dev, and
 * it is harmless for most routes.
 *
 * It is NOT harmless here. The analytics identity endpoints mint and resolve
 * ONE pseudonym per member. Operating as the sentinel would mint a single
 * pseudonym shared by every developer, every preview session and every
 * unauthenticated curl — and then bind real analytics rows to it. A "one
 * pseudonym per member" invariant is meaningless if "the member" can be a
 * sentinel that stands for everyone.
 *
 * So these routes fail closed instead. Dev and test obtain an identity by
 * signing in, or by seeding a real user id — never by inheriting the sentinel.
 *
 * Mounted AFTER requireAuth, which is what populates `req.userId`.
 */
import type { RequestHandler } from "express";

import { DEFAULT_USER_ID } from "../lib/aforceState";
import { sendApiError } from "../lib/apiError";
import { logger } from "../lib/logger";

export const requireMemberIdentity: RequestHandler = (req, res, next) => {
  const userId = req.userId;
  if (!userId || userId === DEFAULT_USER_ID) {
    logger.warn(
      { route: req.path },
      "[requireMemberIdentity] refused: analytics identity requires a real member",
    );
    // 403, not 401: the caller IS authenticated as far as requireAuth is
    // concerned — they are simply not a member this endpoint may act for.
    sendApiError(req, res, 403, "identity_requires_member");
    return;
  }
  next();
};
