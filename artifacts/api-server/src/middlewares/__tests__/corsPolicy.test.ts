/**
 * Squad-F MEDIUM finding: outside production, with no CORS_ALLOWED_ORIGINS
 * set, `app.ts`'s CORS origin callback used to reflect ANY origin with
 * credentials:true unconditionally. Production is structurally closed
 * (Dockerfile + artifact.toml pin NODE_ENV=production), but hosted dev
 * previews on *.replit.dev run NODE_ENV=development and are internet-
 * reachable, so that default let a hostile page make credentialed
 * cross-origin READS against a live dev/beta session.
 *
 * This suite proves the fix: reflect-all is now gated behind an explicit
 * CORS_DEV_REFLECT=1 opt-in, the allowlist path is unaffected by the
 * flag, and production never reflects regardless of the flag.
 *
 * Exercises the REAL `buildCorsOptions()` used by `app.ts` (not a copy),
 * mounted on a minimal express app — the same harness style as
 * `routes/__tests__/destructiveEndpointSecurity.test.ts` — so this suite
 * never needs to import the rest of `app.ts`'s dependency graph (DB,
 * Stripe, Shopify, Smart Capture, every provider OAuth router).
 */
import { describe, it, expect, afterEach } from "vitest";
import express, { type Express } from "express";
import cors from "cors";
import http from "node:http";
import { buildCorsOptions } from "../corsPolicy";

const ORIGINAL_NODE_ENV = process.env["NODE_ENV"];
const ORIGINAL_CORS_ALLOWED_ORIGINS = process.env["CORS_ALLOWED_ORIGINS"];
const ORIGINAL_CORS_DEV_REFLECT = process.env["CORS_DEV_REFLECT"];

afterEach(() => {
  if (ORIGINAL_NODE_ENV === undefined) delete process.env["NODE_ENV"];
  else process.env["NODE_ENV"] = ORIGINAL_NODE_ENV;
  if (ORIGINAL_CORS_ALLOWED_ORIGINS === undefined) {
    delete process.env["CORS_ALLOWED_ORIGINS"];
  } else {
    process.env["CORS_ALLOWED_ORIGINS"] = ORIGINAL_CORS_ALLOWED_ORIGINS;
  }
  if (ORIGINAL_CORS_DEV_REFLECT === undefined) {
    delete process.env["CORS_DEV_REFLECT"];
  } else {
    process.env["CORS_DEV_REFLECT"] = ORIGINAL_CORS_DEV_REFLECT;
  }
});

interface Harness {
  baseUrl: string;
  close: () => Promise<void>;
}

async function listen(app: Express): Promise<Harness> {
  const server: http.Server = app.listen(0);
  await new Promise<void>((r) => server.once("listening", () => r()));
  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((r) => server.close(() => r())),
  };
}

/** Builds a fresh app each time — `buildCorsOptions()` reads env vars at
 *  CALL time, so a new `cors()` mount per test (rather than reusing one
 *  across the whole suite) keeps each test's env overrides isolated. */
async function harness(): Promise<Harness> {
  const app = express();
  app.use(cors(buildCorsOptions()));
  app.get("/probe", (_req, res) => {
    res.status(200).json({ ok: true });
  });
  return listen(app);
}

async function fetchWithOrigin(
  baseUrl: string,
  origin: string,
): Promise<Response> {
  return fetch(`${baseUrl}/probe`, { headers: { Origin: origin } });
}

describe("CORS dev-reflect is opt-in (Squad-F CORS finding)", () => {
  it("NODE_ENV=development, no allowlist, no CORS_DEV_REFLECT: a foreign origin gets NO Access-Control-Allow-Origin reflected", async () => {
    process.env["NODE_ENV"] = "development";
    delete process.env["CORS_ALLOWED_ORIGINS"];
    delete process.env["CORS_DEV_REFLECT"];
    const h = await harness();
    try {
      const res = await fetchWithOrigin(h.baseUrl, "https://evil.example");
      expect(res.headers.get("access-control-allow-origin")).toBeNull();
    } finally {
      await h.close();
    }
  });

  it("NODE_ENV=development, no allowlist, CORS_DEV_REFLECT=1: the origin IS reflected", async () => {
    process.env["NODE_ENV"] = "development";
    delete process.env["CORS_ALLOWED_ORIGINS"];
    process.env["CORS_DEV_REFLECT"] = "1";
    const h = await harness();
    try {
      const res = await fetchWithOrigin(h.baseUrl, "http://localhost:8081");
      expect(res.headers.get("access-control-allow-origin")).toBe(
        "http://localhost:8081",
      );
      expect(res.headers.get("access-control-allow-credentials")).toBe(
        "true",
      );
    } finally {
      await h.close();
    }
  });

  it("an allowlist makes the flag irrelevant: listed origin passes, unlisted 403-equivalent (no reflect) regardless of CORS_DEV_REFLECT", async () => {
    process.env["NODE_ENV"] = "development";
    process.env["CORS_ALLOWED_ORIGINS"] = "https://app.drinkaforce.com";

    // Flag OFF — allowlist still governs.
    delete process.env["CORS_DEV_REFLECT"];
    const h1 = await harness();
    try {
      const good = await fetchWithOrigin(
        h1.baseUrl,
        "https://app.drinkaforce.com",
      );
      expect(good.headers.get("access-control-allow-origin")).toBe(
        "https://app.drinkaforce.com",
      );
      const bad = await fetchWithOrigin(h1.baseUrl, "https://evil.example");
      expect(bad.headers.get("access-control-allow-origin")).toBeNull();
    } finally {
      await h1.close();
    }

    // Flag ON — an allow-list already configured makes the dev-reflect
    // affordance irrelevant; an unlisted origin still does not reflect.
    process.env["CORS_DEV_REFLECT"] = "1";
    const h2 = await harness();
    try {
      const bad = await fetchWithOrigin(h2.baseUrl, "https://evil.example");
      expect(bad.headers.get("access-control-allow-origin")).toBeNull();
      const good = await fetchWithOrigin(
        h2.baseUrl,
        "https://app.drinkaforce.com",
      );
      expect(good.headers.get("access-control-allow-origin")).toBe(
        "https://app.drinkaforce.com",
      );
    } finally {
      await h2.close();
    }
  });

  it("production never reflects, even with CORS_DEV_REFLECT=1", async () => {
    process.env["NODE_ENV"] = "production";
    delete process.env["CORS_ALLOWED_ORIGINS"];
    process.env["CORS_DEV_REFLECT"] = "1";
    const h = await harness();
    try {
      const res = await fetchWithOrigin(h.baseUrl, "https://evil.example");
      expect(res.headers.get("access-control-allow-origin")).toBeNull();
    } finally {
      await h.close();
    }
  });

  it("a request with no Origin header is always let through, unaffected by any of these flags", async () => {
    process.env["NODE_ENV"] = "production";
    delete process.env["CORS_ALLOWED_ORIGINS"];
    delete process.env["CORS_DEV_REFLECT"];
    const h = await harness();
    try {
      const res = await fetch(`${h.baseUrl}/probe`);
      expect(res.status).toBe(200);
    } finally {
      await h.close();
    }
  });
});
