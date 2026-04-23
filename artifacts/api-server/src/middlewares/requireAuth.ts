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

export const requireAuth: RequestHandler = (req, res, next) => {
  // Dev fallback: if Clerk isn't configured at all, keep using the
  // single-user demo row so local dev (and CI without secrets) doesn't
  // break. Production sets CLERK_SECRET_KEY, so this branch is skipped.
  if (!process.env["CLERK_SECRET_KEY"]) {
    req.userId = DEFAULT_USER_ID;
    return next();
  }

  const auth = getAuth(req);
  const userId =
    (auth?.sessionClaims?.["userId"] as string | undefined) || auth?.userId;

  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  req.userId = userId;
  next();
};
