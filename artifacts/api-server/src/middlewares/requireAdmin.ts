/**
 * requireAdmin — gate Express routes behind an allow-listed admin
 * email on the caller's Clerk session.
 *
 * Allow-list source: ADMIN_EMAILS env var, comma-separated, matched
 * case-insensitively against the verified primary email on the
 * session. When ADMIN_EMAILS is unset OR CLERK_SECRET_KEY is unset,
 * the route fails closed in production (503/401) but opens for the
 * local demo user in development so the admin view is reachable
 * without configuring Clerk for ad-hoc work.
 */

import type { RequestHandler } from "express";
import { getAuth, clerkClient } from "@clerk/express";

const IS_PRODUCTION = process.env["NODE_ENV"] === "production";

function parseAllowlist(): Set<string> {
  const raw = process.env["ADMIN_EMAILS"] ?? "";
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

export const requireAdmin: RequestHandler = async (req, res, next) => {
  const allowlist = parseAllowlist();

  // Dev convenience: when Clerk isn't wired up at all, only allow the
  // admin surface outside of production. Production always fails
  // closed so a missing key can never leak the signup list.
  if (!process.env["CLERK_SECRET_KEY"]) {
    if (IS_PRODUCTION) {
      res.status(503).json({ error: "auth_unavailable" });
      return;
    }
    return next();
  }

  try {
    const auth = getAuth(req);
    const userId = auth?.userId;
    if (!userId) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }

    if (allowlist.size === 0) {
      // No allow-list configured. In production this is operator
      // misconfiguration — refuse rather than letting any signed-in
      // user pull the list. In dev it's fine to wave through.
      if (IS_PRODUCTION) {
        res.status(503).json({ error: "admin_not_configured" });
        return;
      }
      return next();
    }

    const user = await clerkClient.users.getUser(userId);
    const emails = (user.emailAddresses ?? [])
      .map((e) => e.emailAddress?.toLowerCase())
      .filter((e): e is string => Boolean(e));

    if (!emails.some((e) => allowlist.has(e))) {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    next();
  } catch (err) {
    req.log.error({ err }, "requireAdmin failed");
    res.status(500).json({ error: "admin_check_failed" });
  }
};
