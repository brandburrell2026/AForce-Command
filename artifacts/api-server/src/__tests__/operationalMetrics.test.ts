/**
 * Wave-3 PR9 — structured operational metrics (existing
 * observability/metrics.ts, first wiring; no new vendor).
 *
 * Privacy rule under test: dimensions are route buckets / status
 * classes / seam names — NEVER user identity.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import express from "express";
import type { Server } from "node:http";

vi.mock("../lib/logger", () => ({
  logger: { error: () => {}, warn: () => {}, info: () => {}, debug: () => {}, fatal: () => {} },
}));
vi.mock("../lib/entitlementResolver", () => ({
  resolveEntitlement: vi.fn(async () => ({ planId: "core", status: "active" })),
  ACTIVE_STATUSES: new Set(["active", "trialing", "past_due"]),
}));

import { snapshot, incCounter, observeLatency, __resetForTests } from "../observability/metrics";

beforeEach(() => {
  __resetForTests?.();
});

describe("registry behavior", () => {
  it("counters and latency histograms register and snapshot", () => {
    incCounter("requests_total.api_aforce.2xx");
    incCounter("requests_total.api_aforce.2xx");
    observeLatency("api_aforce", 42);
    const snap = snapshot();
    expect(snap.counters["requests_total.api_aforce.2xx"]).toBe(2);
    expect(snap.histograms["latency_ms.api_aforce"]?.count).toBe(1);
  });
});

describe("seam counters fire", () => {
  it("an entitlement denial increments entitlement_failures.403_denied", async () => {
    process.env["NODE_ENV"] = "production";
    process.env["CLERK_SECRET_KEY"] = "sk_configured";
    const { requireEntitlement } = await import("../middlewares/requireEntitlement");
    const mw = requireEntitlement("recovery_mode_enabled");
    await new Promise<void>((done) => {
      const res = {
        status() {
          return this;
        },
        json() {
          done();
          return this;
        },
      };
      void mw({ userId: "user_A", headers: {} } as never, res as never, () => done());
    });
    expect(snapshot().counters["entitlement_failures.403_denied"]).toBe(1);
    delete process.env["CLERK_SECRET_KEY"];
  });

  it("API latency middleware buckets by 2-segment route + status class", async () => {
    const app = express();
    app.use((req, res, next) => {
      const start = Date.now();
      res.on("finish", () => {
        const segments = req.url.split("?")[0]!.split("/").filter(Boolean).slice(0, 2);
        const bucket = segments.join("_") || "root";
        observeLatency(bucket, Date.now() - start);
        incCounter(`requests_total.${bucket}.${Math.floor(res.statusCode / 100)}xx`);
      });
      next();
    });
    app.get("/api/aforce/state/12345", (_req, res) => res.json({ ok: true }));
    const server: Server = await new Promise((r) => {
      const s = app.listen(0, () => r(s));
    });
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    try {
      await fetch(`http://127.0.0.1:${port}/api/aforce/state/12345?userId=SHOULD_NOT_APPEAR`);
      await new Promise((r) => setTimeout(r, 50));
      const snap = snapshot();
      expect(snap.counters["requests_total.api_aforce.2xx"]).toBe(1);
      // no id, no query param, no user identity in any metric name
      for (const name of [...Object.keys(snap.counters), ...Object.keys(snap.histograms)]) {
        expect(name).not.toContain("12345");
        expect(name).not.toContain("SHOULD_NOT_APPEAR");
      }
    } finally {
      server.close();
    }
  });
});

describe("exposure", () => {
  it("the snapshot endpoint is founder-gated (never unauthenticated)", () => {
    const src = readFileSync(resolve(__dirname, "../routes/adminMetrics.ts"), "utf8");
    expect(src).toMatch(/"\/admin\/metrics",\s*requireFounder/);
  });

  it("required seams are wired (source census)", () => {
    const checks: Array<[string, string]> = [
      ["../middlewares/requireAuth.ts", "auth_failures."],
      ["../middlewares/requireEntitlement.ts", "entitlement_failures."],
      ["../lib/entitlementResolver.ts", "entitlement_resolver_fallback."],
      ["../routes/shopifyWebhook.ts", "webhook_failures.shopify"],
      ["../routes/aforce/journal.ts", "score_write_rejected."],
      ["../routes/voiceTts.ts", "claims_gate_suppressions.voice_tts"],
      ["../routes/smartCapture.ts", "claims_gate_suppressions.smart_capture"],
      ["../app.ts", "observeLatency(bucket"],
    ];
    for (const [file, needle] of checks) {
      const src = readFileSync(resolve(__dirname, file), "utf8");
      expect(src, `${file} must wire ${needle}`).toContain(needle);
    }
  });
});
