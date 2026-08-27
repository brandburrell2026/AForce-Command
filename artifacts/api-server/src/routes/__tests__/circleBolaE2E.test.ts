/**
 * §18 circle member-op cross-owner isolation — END TO END (the follow-up
 * the tranche-7 recon flagged: existing circle.test asserts per-caller
 * WHERE params, but nothing drove A's request against B's member and
 * proved B's row is untouched).
 *
 * This runs the REAL circle router over HTTP against an EXECUTING fake db
 * (stores rows, honors the ownerUserId+memberUserId WHERE on update/delete)
 * — so the whole handler path runs: resolveUserId, param parse, the
 * `and(ownerUserId=caller, memberUserId=param)` WHERE, and the
 * 404-on-no-row branch. A regression that dropped the ownerUserId
 * predicate (letting A mutate B's member) fails these tests.
 *
 * makeFakeDb (the shared helper) deliberately REFUSES writes, so it can't
 * exercise these write handlers; this file carries a minimal executing
 * fake scoped to the two circle tables' update/delete shape.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import http from "node:http";
import { renderWhere } from "./_fakeDrizzleDb";

const { authHolder, dbRef } = vi.hoisted(() => ({
  authHolder: { value: null as { userId: string | null; sessionClaims: unknown } | null },
  dbRef: { current: null as any },
}));
vi.mock("@clerk/express", () => ({ getAuth: () => authHolder.value }));
vi.mock("@workspace/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@workspace/db")>();
  const forward = (m: string) => (...a: never[]) => {
    if (!dbRef.current) throw new Error(`db.${m}() before a fake was installed`);
    return dbRef.current[m](...a);
  };
  return { ...actual, db: { select: forward("select"), insert: forward("insert"), update: forward("update"), delete: forward("delete") } };
});

import circleRouter from "../circle";

interface Row { ownerUserId: string; memberUserId: string; [k: string]: unknown }

/** Executing fake: rows honored against the [owner, member] WHERE params. */
function makeExecutingDb(tables: Record<string, Row[]>) {
  const match = (rows: Row[], where: unknown) => {
    const { params } = renderWhere(where as any); // [ownerUserId, memberUserId]
    const [owner, member] = params as string[];
    return rows.filter((r) => r.ownerUserId === owner && r.memberUserId === member);
  };
  const tableName = (t: any) => (t?.[Symbol.for("drizzle:Name")] ?? t?._?.name ?? "") as string;
  return {
    select: () => {
      const c: any = { from: () => c, where: () => c, orderBy: () => c, limit: () => c,
        then: (ok: any) => Promise.resolve([]).then(ok) };
      return c;
    },
    update: (t: any) => {
      const name = tableName(t);
      let setVals: Record<string, unknown> = {};
      const c: any = {
        set: (v: Record<string, unknown>) => { setVals = v; return c; },
        where: (w: unknown) => {
          const hits = match(tables[name] ?? [], w);
          for (const r of hits) Object.assign(r, setVals);
          c._hits = hits;
          return c;
        },
        returning: async () => c._hits ?? [],
      };
      return c;
    },
    delete: (t: any) => {
      const name = tableName(t);
      const c: any = {
        where: (w: unknown) => {
          const arr = tables[name] ?? [];
          const hits = match(arr, w);
          tables[name] = arr.filter((r) => !hits.includes(r));
          c._hits = hits;
          return Promise.resolve(hits);
        },
      };
      return c;
    },
  };
}

const A = "user_2aAaAaAaAaAaAaAaAaAaAaAa";
const B = "user_2bBbBbBbBbBbBbBbBbBbBbBb";
const ORIGINAL_KEY = process.env["CLERK_SECRET_KEY"];
const ORIGINAL_ENV = process.env["NODE_ENV"];

let server: http.Server;
let baseUrl: string;
let tables: Record<string, Row[]>;

async function call(method: string, path: string, userId: string, body?: unknown, headers: Record<string, string> = {}) {
  authHolder.value = { userId, sessionClaims: null };
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

beforeEach(async () => {
  // B owns a member m_x (active/friends); A owns a same-named member id.
  tables = {
    aforce_circle_users: [
      { ownerUserId: B, memberUserId: "m_x", status: "active", group: "friends", name: "B's friend", initials: "BF", city: "NYC", joinedAt: new Date("2026-03-01T00:00:00Z") },
      { ownerUserId: A, memberUserId: "m_a", status: "active", group: "team", name: "A's teammate", initials: "AT", city: "LA", joinedAt: new Date("2026-03-01T00:00:00Z") },
    ],
    aforce_circle_statuses: [
      { ownerUserId: B, memberUserId: "m_x", score: 90 },
    ],
  };
  dbRef.current = makeExecutingDb(tables);
  const app = express();
  app.use(express.json());
  app.use((r, _res, next) => { (r as any).log = console; next(); });
  app.use(circleRouter);
  server = http.createServer(app);
  await new Promise<void>((r) => server.listen(0, r));
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("no address");
  baseUrl = `http://127.0.0.1:${addr.port}`;
  process.env["NODE_ENV"] = "test";
  process.env["CLERK_SECRET_KEY"] = "sk_test_configured";
});

afterEach(async () => {
  authHolder.value = null; dbRef.current = null;
  if (ORIGINAL_KEY === undefined) delete process.env["CLERK_SECRET_KEY"]; else process.env["CLERK_SECRET_KEY"] = ORIGINAL_KEY;
  if (ORIGINAL_ENV === undefined) delete process.env["NODE_ENV"]; else process.env["NODE_ENV"] = ORIGINAL_ENV;
  await new Promise<void>((r) => server.close(() => r()));
});

describe("§18 BOLA — A cannot mutate B's circle member end to end", () => {
  it("A's status update against B's member m_x returns 404 and leaves B's row untouched", async () => {
    const r = await call("POST", "/users/m_x/status", A, { status: "muted" });
    expect(r.status).toBe(404);
    expect(r.json.error).toBe("member_not_found");
    expect(tables["aforce_circle_users"].find((x) => x.ownerUserId === B)!.status).toBe("active");
  });

  it("A's group move against B's member m_x returns 404 and B's group is unchanged", async () => {
    const r = await call("POST", "/users/m_x/group", A, { group: "team" });
    expect(r.status).toBe(404);
    expect(tables["aforce_circle_users"].find((x) => x.ownerUserId === B)!.group).toBe("friends");
  });

  it("A's delete of B's member m_x removes nothing of B's (row + status snapshot survive)", async () => {
    const r = await call("DELETE", "/users/m_x", A);
    // The handler always 200s (idempotent delete), but B's data must survive.
    expect(r.status).toBe(200);
    expect(tables["aforce_circle_users"].some((x) => x.ownerUserId === B && x.memberUserId === "m_x")).toBe(true);
    expect(tables["aforce_circle_statuses"].some((x) => x.ownerUserId === B && x.memberUserId === "m_x")).toBe(true);
  });

  it("the owner CAN mutate their own member — isolation does not over-block", async () => {
    const r = await call("POST", "/users/m_x/status", B, { status: "muted" });
    expect(r.status).toBe(200);
    expect(tables["aforce_circle_users"].find((x) => x.ownerUserId === B)!.status).toBe("muted");
  });
});
