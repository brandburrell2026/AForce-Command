/**
 * requireRealAuth — the auth gate for DESTRUCTIVE endpoints.
 *
 * `requireAuth` (sibling file) deliberately falls back to
 * `DEFAULT_USER_ID` ("default") in two non-production cases so the
 * single-user demo flow, canvas iframe previews, ad-hoc curl and the
 * route-level test harnesses keep working without Clerk wired up. That
 * is a reasonable convenience for READ and additive-write routes.
 *
 * It is NOT acceptable for irreversible operations. On a dev/preview/
 * staging deployment with CLERK_SECRET_KEY unset — or with Clerk
 * configured but the caller unauthenticated — `requireAuth` would let an
 * anonymous request run `DELETE /api/{provider}/disconnect` or
 * `POST /api/account/delete-health-data` as the demo user and
 * irreversibly destroy that user's tokens, biometrics snapshot and
 * health records. There is no "it's only dev" version of destroying
 * physiological data.
 *
 * So: this middleware requires a GENUINE authenticated identity in
 * EVERY environment. No environment branch grants an identity here.
 *
 *   - CLERK_SECRET_KEY unset            -> 503 auth_unavailable
 *     (operator misconfiguration; we cannot verify anyone, so we refuse
 *     rather than guess. Never DEFAULT_USER_ID.)
 *   - Clerk configured, no session      -> 401 unauthorized
 *   - Resolved id === DEFAULT_USER_ID   -> 401 unauthorized
 *     (belt-and-braces: Clerk ids are `user_…`; the literal string
 *     "default" can only arrive from a fallback path, and no fallback
 *     path may authorize a destructive op.)
 *
 * `requireAuth` is intentionally left UNCHANGED — weakening it would
 * break every read route in dev. Strictness is added at the destructive
 * endpoints only, which is where the blast radius is.
 *
 * Unlike `requireAuth`, nothing here is captured at module-load time:
 * CLERK_SECRET_KEY is read per request so the middleware is directly
 * testable without `vi.resetModules()`.
 */

import type { Request, RequestHandler } from "express";
import { getAuth } from "@clerk/express";
import { DEFAULT_USER_ID } from "../lib/aforceState";

/**
 * Resolves the Clerk identity for a request, or `null`. Exported for
 * unit tests and for any future strict gate that needs the same
 * resolution without the response side effects.
 */
export function resolveRealUserId(req: Request): string | null {
  let auth: ReturnType<typeof getAuth> | null = null;
  try {
    auth = getAuth(req);
  } catch {
    // getAuth() throws when clerkMiddleware() never ran on this app.
    // That is "no verified identity", not a 500.
    auth = null;
  }
  const userId =
    (auth?.sessionClaims?.["sub"] as string | undefined) || auth?.userId;
  if (!userId) return null;
  if (userId === DEFAULT_USER_ID) return null;
  return userId;
}

export const requireRealAuth: RequestHandler = (req, res, next) => {
  if (!process.env["CLERK_SECRET_KEY"]) {
    // eslint-disable-next-line no-console
    console.error(
      "[requireRealAuth] CLERK_SECRET_KEY missing — refusing destructive request in all environments",
    );
    res.status(503).json({ error: "auth_unavailable" });
    return;
  }

  const userId = resolveRealUserId(req);
  if (!userId) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  req.userId = userId;
  next();
};
