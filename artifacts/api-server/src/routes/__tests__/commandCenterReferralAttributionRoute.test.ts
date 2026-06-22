/**
 * Route-wiring test for the founder Referral & Ambassador Attribution panel.
 *
 * The pure founder-access DECISION (super_admin + optional allow-list) is
 * exhaustively covered in middlewares/__tests__/requireFounder.test.ts. Here we
 * assert the WIRING: the new referral-attribution route — and every other
 * Command Center route — is mounted BEHIND `requireFounder`, so the gate can
 * never be skipped. We introspect the Express router stack directly (no DB / no
 * network), comparing handler references for an exact, refactor-proof guarantee.
 */
import { describe, it, expect } from "vitest";
import router from "../commandCenterAdmin";
import { requireFounder } from "../../middlewares/requireFounder";

interface RouteLayer {
  route?: {
    path?: string;
    stack?: Array<{ handle?: unknown }>;
  };
}

function commandCenterRoutes(): Array<{ path: string; handles: unknown[] }> {
  const stack = (router as unknown as { stack: RouteLayer[] }).stack ?? [];
  return stack
    .filter(
      (l): l is RouteLayer & { route: { path: string } } =>
        typeof l.route?.path === "string" &&
        l.route.path.startsWith("/admin/command-center/"),
    )
    .map((l) => ({
      path: l.route.path,
      handles: (l.route.stack ?? []).map((s) => s.handle),
    }));
}

describe("Command Center referral-attribution route wiring", () => {
  it("registers the referral-attribution route", () => {
    const paths = commandCenterRoutes().map((r) => r.path);
    expect(paths).toContain("/admin/command-center/referral-attribution");
  });

  it("gates the referral-attribution route behind requireFounder", () => {
    const route = commandCenterRoutes().find(
      (r) => r.path === "/admin/command-center/referral-attribution",
    );
    expect(route).toBeDefined();
    expect(route!.handles).toContain(requireFounder);
  });

  it("gates EVERY Command Center route behind requireFounder (no ungated leak)", () => {
    const routes = commandCenterRoutes();
    expect(routes.length).toBeGreaterThan(0);
    for (const r of routes) {
      expect(r.handles, `${r.path} must be founder-gated`).toContain(
        requireFounder,
      );
    }
  });
});
