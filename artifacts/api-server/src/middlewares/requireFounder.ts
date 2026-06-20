/**
 * requireFounder — the founder-only gate for the Command Center.
 *
 * Stricter than `requireRole`: the Command Center is the founders' (Julius
 * + Brandon) private cockpit, so a plain `admin` must NOT see it. We
 * therefore require the resolved role to be EXACTLY `super_admin`
 * (`requireRole("admin","super_admin")` would admit admins because of its
 * minimum-rank semantics) AND, when a `FOUNDER_EMAILS` allow-list is
 * configured, membership in that list.
 *
 * `FOUNDER_EMAILS` (comma-separated, case-insensitive) is optional: until
 * the founders' identities are wired up it can be left unset, in which
 * case super_admin alone suffices — the surface is locked down but never
 * hard-bricked. Once set, BOTH conditions must hold.
 *
 * Mirrors `requireRole`'s dev convenience: with no `CLERK_SECRET_KEY` the
 * gate opens in development (so internal views are reachable locally) and
 * fails closed (503) in production.
 */

import type { RequestHandler } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { resolveRole } from "./requireRole";

const IS_PRODUCTION = process.env["NODE_ENV"] === "production";

/**
 * Parse the comma-separated, case-insensitive `FOUNDER_EMAILS` allow-list.
 * Pure (takes the raw value) so the gate logic is unit-testable without env.
 */
export function parseFounderAllowList(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

/**
 * The pure founder-access decision. A founder must be EXACTLY `super_admin`
 * (never a plain `admin`); when an allow-list is configured, at least one of
 * the caller's emails must also be on it. An empty allow-list means
 * super_admin alone suffices (locked down but never hard-bricked).
 */
export function isFounderAllowed(
  role: string | null | undefined,
  emails: readonly string[],
  allowList: ReadonlySet<string>,
): boolean {
  if (role !== "super_admin") return false;
  if (allowList.size === 0) return true;
  return emails.some((e) => allowList.has(e.toLowerCase()));
}

export const requireFounder: RequestHandler = async (req, res, next) => {
  if (!process.env["CLERK_SECRET_KEY"]) {
    if (IS_PRODUCTION) {
      res.status(503).json({ error: "auth_unavailable" });
      return;
    }
    req.userRole = "super_admin";
    return next();
  }
  try {
    const role = await resolveRole(req);
    if (role !== "super_admin") {
      res.status(403).json({ error: "forbidden" });
      return;
    }

    const allowList = parseFounderAllowList(process.env["FOUNDER_EMAILS"]);
    let emails: string[] = [];
    if (allowList.size > 0) {
      const auth = getAuth(req);
      const userId = auth?.userId;
      if (userId) {
        const user = await clerkClient.users.getUser(userId);
        emails = (user.emailAddresses ?? [])
          .map((e) => e.emailAddress?.toLowerCase())
          .filter((e): e is string => Boolean(e));
      }
    }

    if (!isFounderAllowed(role, emails, allowList)) {
      res.status(403).json({ error: "forbidden" });
      return;
    }

    req.userRole = role;
    return next();
  } catch (err) {
    req.log.error({ err }, "requireFounder failed");
    res.status(500).json({ error: "founder_check_failed" });
  }
};
