/**
 * requireAdmin — gate Express routes behind admin privileges on the
 * caller's Clerk session.
 *
 * Allow-list source (managed, no redeploy needed):
 *   1. Clerk organization role — any membership whose role is
 *      "admin" or "org:admin" grants admin.
 *   2. Clerk user publicMetadata — `role: "admin"` or
 *      `isAdmin: true` grants admin. Editable from the Clerk
 *      dashboard or via the Clerk API.
 *
 * Bootstrap fallback (optional):
 *   ADMIN_EMAILS — comma-separated, matched case-insensitively
 *   against the caller's verified Clerk emails. Intended to seed
 *   the first admin before any Clerk metadata is set; can be
 *   removed once at least one admin is managed via Clerk.
 *
 * When CLERK_SECRET_KEY is unset the route fails closed in
 * production (503) but opens in development so the admin view is
 * reachable for local work without configuring Clerk.
 */

import type { RequestHandler } from "express";
import { getAuth, clerkClient } from "@clerk/express";

const IS_PRODUCTION = process.env["NODE_ENV"] === "production";

function parseBootstrapEmails(): Set<string> {
  const raw = process.env["ADMIN_EMAILS"] ?? "";
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

function metadataGrantsAdmin(meta: unknown): boolean {
  if (!meta || typeof meta !== "object") return false;
  const m = meta as Record<string, unknown>;
  if (m["isAdmin"] === true) return true;
  const role = m["role"];
  if (typeof role === "string" && role.toLowerCase() === "admin") return true;
  const roles = m["roles"];
  if (Array.isArray(roles)) {
    return roles.some(
      (r) => typeof r === "string" && r.toLowerCase() === "admin",
    );
  }
  return false;
}

function orgMembershipGrantsAdmin(role: string | undefined | null): boolean {
  if (!role) return false;
  const normalized = role.toLowerCase();
  return normalized === "admin" || normalized === "org:admin";
}

export const requireAdmin: RequestHandler = async (req, res, next) => {
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

    // 1. Session-level org role check — cheap, no extra API call.
    if (orgMembershipGrantsAdmin(auth?.orgRole)) {
      return next();
    }

    const user = await clerkClient.users.getUser(userId);

    // 2. publicMetadata / privateMetadata flag check.
    if (
      metadataGrantsAdmin(user.publicMetadata) ||
      metadataGrantsAdmin(user.privateMetadata)
    ) {
      return next();
    }

    // 3. Any active org membership where the role is admin.
    try {
      const memberships =
        await clerkClient.users.getOrganizationMembershipList({ userId });
      const list = Array.isArray(memberships)
        ? memberships
        : ((memberships as { data?: unknown[] }).data ?? []);
      if (
        list.some((m) =>
          orgMembershipGrantsAdmin((m as { role?: string }).role),
        )
      ) {
        return next();
      }
    } catch (err) {
      // Org lookups can fail when orgs aren't enabled on the Clerk
      // instance; don't treat that as a hard error, just fall through.
      req.log.debug?.({ err }, "requireAdmin: org membership lookup skipped");
    }

    // 4. Bootstrap fallback: ADMIN_EMAILS env allow-list.
    const bootstrap = parseBootstrapEmails();
    if (bootstrap.size > 0) {
      const emails = (user.emailAddresses ?? [])
        .map((e) => e.emailAddress?.toLowerCase())
        .filter((e): e is string => Boolean(e));
      if (emails.some((e) => bootstrap.has(e))) {
        return next();
      }
    }

    res.status(403).json({ error: "forbidden" });
  } catch (err) {
    req.log.error({ err }, "requireAdmin failed");
    res.status(500).json({ error: "admin_check_failed" });
  }
};
