/**
 * requireRole — role-tier gate for Express routes.
 *
 * Three tiers: user < admin < super_admin. A route declares the
 * minimum tier(s) it accepts; any caller at or above the lowest
 * declared tier passes. This is the authorization base for the
 * INTERNAL analytics read surface (admin|super_admin only) and leaves
 * room for finer-grained super_admin-only operations later.
 *
 * Role sources (managed, no redeploy needed) — highest wins:
 *   1. Clerk organization role: "super_admin"/"org:super_admin" →
 *      super_admin; "admin"/"org:admin" → admin.
 *   2. Clerk user public/private metadata: `isSuperAdmin: true` or
 *      `role: "super_admin"` → super_admin; `isAdmin: true` or
 *      `role: "admin"` (or a matching entry in a `roles` array) → admin.
 *   3. Bootstrap email allow-lists: SUPER_ADMIN_EMAILS → super_admin,
 *      ADMIN_EMAILS → admin (comma-separated, case-insensitive).
 *
 * When CLERK_SECRET_KEY is unset the gate fails closed in production
 * (503) and opens in development so internal views are reachable for
 * local work without configuring Clerk — mirroring requireAdmin.
 */

import type { RequestHandler, Request } from "express";
import { getAuth, clerkClient } from "@clerk/express";

export type Role = "user" | "admin" | "super_admin";

const RANK: Record<Role, number> = { user: 0, admin: 1, super_admin: 2 };
const IS_PRODUCTION = process.env["NODE_ENV"] === "production";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userRole?: Role;
    }
  }
}

function emailAllowList(envKey: string): Set<string> {
  const raw = process.env[envKey] ?? "";
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

function metadataRole(meta: unknown): Role | null {
  if (!meta || typeof meta !== "object") return null;
  const m = meta as Record<string, unknown>;
  const roleStr =
    typeof m["role"] === "string" ? (m["role"] as string).toLowerCase() : "";
  if (m["isSuperAdmin"] === true) return "super_admin";
  if (roleStr === "super_admin" || roleStr === "superadmin") return "super_admin";
  if (m["isAdmin"] === true) return "admin";
  if (roleStr === "admin") return "admin";
  const roles = m["roles"];
  if (Array.isArray(roles)) {
    const lower = roles
      .filter((r): r is string => typeof r === "string")
      .map((r) => r.toLowerCase());
    if (lower.includes("super_admin") || lower.includes("superadmin")) {
      return "super_admin";
    }
    if (lower.includes("admin")) return "admin";
  }
  return null;
}

function orgRoleToRole(role: string | undefined | null): Role | null {
  if (!role) return null;
  const n = role.toLowerCase();
  if (n === "super_admin" || n === "org:super_admin") return "super_admin";
  if (n === "admin" || n === "org:admin") return "admin";
  return null;
}

/**
 * Resolve the caller's effective role. Dev convenience: with no Clerk
 * secret configured, returns super_admin outside production so internal
 * surfaces are reachable; returns user in production (callers should be
 * behind the explicit 503 guard in `requireRole`).
 */
export async function resolveRole(req: Request): Promise<Role> {
  if (!process.env["CLERK_SECRET_KEY"]) {
    return IS_PRODUCTION ? "user" : "super_admin";
  }
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) return "user";

  let best: Role = "user";
  const consider = (r: Role | null) => {
    if (r && RANK[r] > RANK[best]) best = r;
  };

  consider(orgRoleToRole(auth?.orgRole));

  try {
    const user = await clerkClient.users.getUser(userId);
    consider(metadataRole(user.publicMetadata));
    consider(metadataRole(user.privateMetadata));

    const emails = (user.emailAddresses ?? [])
      .map((e) => e.emailAddress?.toLowerCase())
      .filter((e): e is string => Boolean(e));
    const supers = emailAllowList("SUPER_ADMIN_EMAILS");
    const admins = emailAllowList("ADMIN_EMAILS");
    if (emails.some((e) => supers.has(e))) consider("super_admin");
    if (emails.some((e) => admins.has(e))) consider("admin");

    if (RANK[best] < RANK.super_admin) {
      try {
        const memberships =
          await clerkClient.users.getOrganizationMembershipList({ userId });
        const list = Array.isArray(memberships)
          ? memberships
          : ((memberships as { data?: unknown[] }).data ?? []);
        for (const m of list) {
          consider(orgRoleToRole((m as { role?: string }).role));
        }
      } catch (err) {
        req.log?.debug?.(
          { err },
          "requireRole: org membership lookup skipped",
        );
      }
    }
  } catch (err) {
    req.log?.error?.({ err }, "resolveRole: clerk lookup failed");
  }

  return best;
}

export function requireRole(...allowed: Role[]): RequestHandler {
  const min = Math.min(...allowed.map((r) => RANK[r]));
  return async (req, res, next) => {
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
      if (RANK[role] >= min) {
        req.userRole = role;
        return next();
      }
      res.status(403).json({ error: "forbidden" });
    } catch (err) {
      req.log.error({ err }, "requireRole failed");
      res.status(500).json({ error: "role_check_failed" });
    }
  };
}
