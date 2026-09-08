/**
 * MOUNT-ORDER LAW — /api/smart-capture must reach Clerk before it executes.
 *
 * The defect this pins: `smartCaptureRouter` was mounted in app.ts BEFORE
 * `app.use(clerkMiddleware())`. The route's `requireAuth` calls `getAuth(req)`,
 * and @clerk/express throws `middlewareRequired("getAuth")` when the request was
 * never decorated (dist/index.mjs:214-216). `requireAuth` has no try/catch, so
 * the throw reached app.ts's terminal error handler and an UNAUTHENTICATED
 * caller received 500 {"error":"internal_error"} instead of 401.
 *
 * WHY THIS FILE EXISTS SEPARATELY FROM smartCaptureAuth.test.ts. That suite
 * builds its OWN express app (`const app = express(); app.use("/api", router)`),
 * so it never sees app.ts's real ordering and stayed green through the entire
 * life of the defect. A middleware-order law that constructs its own middleware
 * order proves nothing about production. This file imports the REAL app.
 *
 * ENV DISCIPLINE — the reason this is not a two-line test. `requireAuth` grants
 * DEFAULT_USER_ID whenever NODE_ENV !== 'production' (requireAuth.ts:44,59-62).
 * Under NODE_ENV=test the FIXED code therefore falls through to the demo user
 * and answers 200/400 rather than 401, so the assertion would pass for the wrong
 * reason — or fail for one. Both env values are set BEFORE the dynamic import
 * because requireAuth captures IS_PRODUCTION at module load.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";

// The only module that blocks importing the real app.ts in the DB-less lane:
// lib/integrations-openai-ai-server throws at import when its base URL is unset.
// It throws again if the route is ever reached, so an accidental 2xx cannot pass
// silently.
vi.mock("@workspace/integrations-openai-ai-server", () => ({
  openai: {
    chat: {
      completions: {
        create: vi.fn(async () => {
          throw new Error("OpenAI must never be reached by an unauthenticated request");
        }),
      },
    },
  },
}));

const ENV_KEYS = [
  "NODE_ENV",
  "CLERK_SECRET_KEY",
  "CLERK_PUBLISHABLE_KEY",
  "CORS_ALLOWED_ORIGINS",
] as const;
let prev: Record<string, string | undefined> = {};

beforeEach(() => {
  prev = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  vi.resetModules();
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (prev[k] === undefined) delete process.env[k];
    else process.env[k] = prev[k];
  }
});

/** Boots the REAL app.ts — not a hand-assembled stand-in. */
async function bootRealApp() {
  // Production: closes requireAuth's DEFAULT_USER_ID fallback so a missing
  // identity is a 401 rather than a silent demo-user grant.
  process.env["NODE_ENV"] = "production";
  // Set: forces requireAuth past its unset-secret branch and into getAuth(),
  // which is the exact call that throws when clerkMiddleware has not run.
  //
  // NEITHER OF THESE IS A CREDENTIAL. The publishable key is a synthetic,
  // correctly-SHAPED value that decodes to the non-existent host
  // "mount-order-law.invalid" — clerkMiddleware parses it to build its
  // AuthenticateContext and refuses to run without one, but a request carrying
  // no token is resolved as signed-out without any network call, so the fake
  // host is never contacted. (Discovered the hard way: with the secret set and
  // the publishable key absent, clerkMiddleware throws "Publishable key is
  // missing" and the terminal handler turns it into the SAME 500 this law is
  // meant to catch — a false positive that would have made the fix look broken.)
  process.env["CLERK_SECRET_KEY"] = "NOT-A-KEY-mount-order-law-presence-only";
  process.env["CLERK_PUBLISHABLE_KEY"] = "pk_test_bW91bnQtb3JkZXItbGF3LmludmFsaWQk";
  process.env["CORS_ALLOWED_ORIGINS"] = "https://example.invalid";

  const { default: app } = await import("../app");
  const server = http.createServer(app as never);
  await new Promise<void>((r) => server.listen(0, r));
  const { port } = server.address() as AddressInfo;
  return {
    port,
    close: () => new Promise<void>((r) => server.close(() => r())),
  };
}

async function postSmartCapture(port: number) {
  const res = await fetch(`http://127.0.0.1:${port}/api/smart-capture`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ imageBase64: "x" }),
  });
  const text = await res.text();
  let body: unknown = text;
  try { body = JSON.parse(text); } catch { /* non-JSON body is itself a finding */ }
  return { status: res.status, body };
}

describe("LAW — /api/smart-capture passes through Clerk before executing", () => {
  it("an unauthenticated POST is refused 401, never 500", async () => {
    const app = await bootRealApp();
    try {
      const { status, body } = await postSmartCapture(app.port);

      // 500 is the defect's exact signature: getAuth threw because
      // clerkMiddleware had not decorated the request, and app.ts's terminal
      // handler converted it to internal_error.
      expect(status, "500 means getAuth threw — clerkMiddleware did not run first").not.toBe(500);
      expect(body).not.toEqual({ error: "internal_error" });

      expect(status).toBe(401);
      expect(body).toEqual({ error: "Unauthorized" });
    } finally {
      await app.close();
    }
  });

  it("a photo-sized body still reaches the route — the 64kB cap is not in front of it", async () => {
    // Guards the OTHER way to "fix" this defect, which is fatal: moving
    // smartCaptureRouter below app.ts's global express.json({limit:'64kb'}) so
    // it inherits clerkMiddleware. That looks tidier and 413s every real Smart
    // Capture payload, because photos are 100kB-6MB and the router's own
    // express.json({limit:'8mb'}) would never get to run.
    //
    // Auth precedes the body parser inside the route stack, so an
    // unauthenticated oversize POST must still be refused 401 — never 413.
    const app = await bootRealApp();
    try {
      const oversize = "A".repeat(200_000); // ~200kB, far past the 64kB global cap
      const res = await fetch(`http://127.0.0.1:${app.port}/api/smart-capture`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageBase64: oversize }),
      });
      // Asserted as 401 and nothing else. An earlier draft also asserted
      // `.not.toBe(413)`; the mutation proved that assertion could never fire,
      // because express.json's PayloadTooLargeError reaches app.ts's terminal
      // handler and becomes 500, not 413. A check that cannot fail for its
      // stated reason is worse than no check, so it is gone.
      expect(
        res.status,
        "a photo-sized body must reach the route's own 8mb parser, not the global 64kB cap",
      ).toBe(401);
    } finally {
      await app.close();
    }
  });

  it("the refusal is a JSON contract, not an HTML error page", async () => {
    // app.ts has no JSON 404 catch-all, so a routing regression would surface
    // as Express's default HTML. Pin that the caller gets a parseable object.
    const app = await bootRealApp();
    try {
      const { body } = await postSmartCapture(app.port);
      expect(typeof body).toBe("object");
      expect(body).not.toBeNull();
    } finally {
      await app.close();
    }
  });
});
