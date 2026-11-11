import {
  beforeAll,
  afterAll,
  beforeEach,
  describe,
  it,
  expect,
  vi,
} from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import express from "express";
import http from "node:http";
const auth = vi.hoisted(() => ({ owner: "A" as string | null }));
vi.mock("@clerk/express", () => ({ getAuth: () => ({ userId: auth.owner }) }));
vi.mock("../../lib/aforceState", () => ({ DEFAULT_USER_ID: "default" }));
import { buildTravelIntelligenceRouter } from "../travelIntelligence";
import { TravelRepository } from "../../lib/travel/repository";
const db = new PGlite();
const query = async (sql: string, p?: unknown[]) => {
  const r = await db.query(sql, p);
  return { ...r, rowCount: r.affectedRows ?? r.rows.length };
};
const repo = new TravelRepository({
  query,
  connect: async () => ({ query, release() {} }),
} as never);
let server: http.Server, base: string;
beforeAll(async () => {
  await db.exec(
    await readFile(
      new URL(
        "../../../../../lib/db/migrations/20261029_travel_intelligence.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const app = express();
  app.use(
    "/api/travel/intelligence",
    buildTravelIntelligenceRouter(
      async () => repo,
      () => true,
    ),
  );
  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/travel/intelligence`;
});
beforeEach(async () => {
  auth.owner = "A";
  vi.stubEnv("CLERK_SECRET_KEY", "synthetic-local-test");
  vi.stubEnv("AFORCE_TRAVEL_MEMBER_IDS", "A,B");
  await db.exec("TRUNCATE aforce_travel_accounts CASCADE");
});
afterAll(async () => {
  vi.unstubAllEnvs();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await db.close();
});
const call = (path: string, method = "GET", body?: unknown) =>
  fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
describe("travel HTTP → PostgreSQL → response", () => {
  it("requires verified auth and cohort membership before reading trips", async () => {
    auth.owner = null;
    expect((await call("/state")).status).toBe(401);
    auth.owner = "outsider";
    expect((await call("/state")).status).toBe(403);
    auth.owner = "default";
    expect((await call("/state")).status).toBe(401);
  });
  it("rejects injected owners, serializes saves and returns a reviewable conflict", async () => {
    expect(
      (
        await call("/state", "PUT", {
          revision: 0,
          trips: [],
          consent: true,
          userId: "B",
        })
      ).status,
    ).toBe(400);
    await repo.link("A", "private-ciphertext");
    let result = await call("/state", "PUT", {
      revision: 0,
      trips: [],
      consent: true,
    });
    expect(result.status).toBe(200);
    expect(result.headers.get("cache-control")).toBe("private, no-store");
    result = await call("/state", "PUT", {
      revision: 0,
      trips: [],
      consent: true,
    });
    expect(result.status).toBe(409);
    expect((await result.json()).current).toEqual({ revision: 1, trips: [] });
    auth.owner = "B";
    expect((await (await call("/state")).json()).revision).toBe(0);
  });
  it("never returns encrypted grants or raw device credentials and requires explicit clear confirmation", async () => {
    await repo.link("A", "private-ciphertext");
    const state = await (await call("/state")).json();
    expect(state.linked).toBe(true);
    expect(JSON.stringify(state)).not.toContain("private-ciphertext");
    expect((await call("/state", "DELETE", {})).status).toBe(400);
    await repo.link("A", null);
    expect((await call("/state", "DELETE", { confirm: true })).status).toBe(
      200,
    );
    expect((await repo.get("A")).trips).toEqual([]);
  });
});
