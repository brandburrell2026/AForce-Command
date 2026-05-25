import { describe, it, expect, beforeEach, afterAll } from "vitest";
import express, { type Express } from "express";
import { eq } from "drizzle-orm";
import { db, earlyAccessSignups } from "@workspace/db";
import earlyAccessRouter from "../earlyAccess";
import { logger } from "../../lib/logger";

// NODE_ENV=test disables the per-IP rate limiter inside the router (see
// `signupLimiter.skip` in earlyAccess.ts), so each test starts fresh.
process.env["NODE_ENV"] = "test";

function buildApp(): Express {
  const app = express();
  app.use(express.json());
  // The router reads req.log via pino-http; provide a minimal shim so
  // unhappy-path logging in the route doesn't crash the test.
  app.use((req, _res, next) => {
    (req as unknown as { log: typeof logger }).log = logger;
    next();
  });
  app.use("/api/early-access", earlyAccessRouter);
  return app;
}

const app = buildApp();
const TEST_EMAIL_DOMAIN = "@earlyaccess.test";

async function cleanupTestRows() {
  // Only delete rows our tests created so we don't trash other data.
  const rows = await db.select().from(earlyAccessSignups);
  for (const r of rows) {
    if (r.email.endsWith(TEST_EMAIL_DOMAIN)) {
      await db.delete(earlyAccessSignups).where(eq(earlyAccessSignups.id, r.id));
    }
  }
}

beforeEach(cleanupTestRows);
afterAll(cleanupTestRows);

async function postSignup(body: unknown): Promise<{ status: number; json: unknown }> {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, async () => {
      const addr = server.address();
      if (typeof addr !== "object" || !addr) {
        server.close();
        reject(new Error("no address"));
        return;
      }
      try {
        const res = await fetch(`http://127.0.0.1:${addr.port}/api/early-access/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = await res.json().catch(() => ({}));
        resolve({ status: res.status, json });
      } catch (err) {
        reject(err);
      } finally {
        server.close();
      }
    });
  });
}

describe("POST /api/early-access", () => {
  it("persists a valid signup with the supplied source", async () => {
    const email = `hero-${Date.now()}${TEST_EMAIL_DOMAIN}`;
    const res = await postSignup({ email, source: "hero_cta" });

    expect(res.status).toBe(200);
    expect(res.json).toEqual({ ok: true });

    const rows = await db
      .select()
      .from(earlyAccessSignups)
      .where(eq(earlyAccessSignups.email, email));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.source).toBe("hero_cta");
  });

  it("returns 400 for an invalid email and writes nothing", async () => {
    const res = await postSignup({ email: "not-an-email", source: "hero_cta" });
    expect(res.status).toBe(400);
    expect(res.json).toEqual({ error: "invalid_input" });

    const rows = await db.select().from(earlyAccessSignups);
    expect(rows.find((r) => r.email === "not-an-email")).toBeUndefined();
  });

  it("is idempotent on the email unique index (second submit still 200, no duplicate row)", async () => {
    const email = `dup-${Date.now()}${TEST_EMAIL_DOMAIN}`;
    const first = await postSignup({ email, source: "hero_cta" });
    const second = await postSignup({ email, source: "footer_cta" });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);

    const rows = await db
      .select()
      .from(earlyAccessSignups)
      .where(eq(earlyAccessSignups.email, email));
    expect(rows).toHaveLength(1);
    // First write wins thanks to onConflictDoNothing.
    expect(rows[0]?.source).toBe("hero_cta");
  });
});
