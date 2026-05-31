/**
 * requireAuth — gate Express routes behind a valid Clerk session.
 *
 * Resolves the user id via @clerk/express's getAuth(); falls back to a
 * dev-only DEFAULT_USER_ID when CLERK_SECRET_KEY is missing so the
 * existing single-user demo flow keeps working in environments without
 * Clerk wired up.
 *
 * On success, attaches `req.userId` for downstream handlers.
 */

import type { RequestHandler } from "express";
import { getAuth } from "@clerk/express";
import { DEFAULT_USER_ID } from "../lib/aforceState";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

// Fail-closed in production: even if CLERK_SECRET_KEY is somehow
// missing in a prod deployment, refuse the request rather than
// silently granting the demo user. Dev fallback only fires when
// NODE_ENV !== 'production' AND the secret is unset.
const IS_PRODUCTION = process.env["NODE_ENV"] === "production";

export const requireAuth: RequestHandler = (req, res, next) => {
  if (!process.env["CLERK_SECRET_KEY"]) {
    if (IS_PRODUCTION) {
      // Operator misconfiguration — log loudly and reject. Never
      // grant DEFAULT_USER_ID in production.
      // eslint-disable-next-line no-console
      console.error("[requireAuth] CLERK_SECRET_KEY missing in production — denying request");
      res.status(503).json({ error: "auth_unavailable" });
      return;
    }
    req.userId = DEFAULT_USER_ID;
    return next();
  }

  const auth = getAuth(req);
  // Clerk session JWTs carry the user id in the standard `sub` claim;
  // prefer it, then fall back to the resolved auth.userId.
  const userId =
    (auth?.sessionClaims?.["sub"] as string | undefined) || auth?.userId;

  if (!userId) {
    // Dev/preview convenience: when Clerk is configured but the caller
    // hasn't completed sign-in (e.g. canvas iframe preview, ad-hoc
    // curl, integration tests), fall back to the demo user so the app
    // is usable end-to-end. Production still fails closed above.
    if (!IS_PRODUCTION) {
      req.userId = DEFAULT_USER_ID;
      return next();
    }
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  req.userId = userId;
  next();
};
