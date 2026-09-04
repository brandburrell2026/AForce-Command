/**
 * `GET /aforce/state` — the version contract is ADDITIVE, over real HTTP.
 *
 * WHY THIS FILE EXISTS. The unit laws prove the parser and the evaluator. What
 * they cannot prove is the property the founder's ruling actually turns on:
 * that adding this to a live endpoint changes NOTHING for the builds already
 * in the field. Those builds send no header and read only the keys they know,
 * so the proof has to be at the response level — same status, same existing
 * keys, same values, plus one new key they will ignore.
 *
 * MOCKED AT THE `@workspace/db` BOUNDARY, not at `lib/aforceState`. A relative
 * `vi.mock("../../../lib/aforceState")` registered a module the route never
 * resolved to, so the real `getUserState` ran, reached for a database that is
 * not there, and the route answered 500 — with the mock reporting zero calls.
 * A bare package specifier resolves to one identity for both, which is why the
 * dense-capability suite mocks the same boundary.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getTableName, type Table } from "drizzle-orm";

const NOW = new Date("2026-09-04T12:00:00.000Z");

const { dbRef } = vi.hoisted(() => ({
  dbRef: { current: null as { rows(table: string): unknown[] } | null },
}));

vi.mock("@workspace/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@workspace/db")>();
  const chain = () => {
    let table = "";
    const link: Record<string, unknown> = {
      from(t: Table) { table = getTableName(t); return link; },
      where() { return link; },
      orderBy() { return link; },
      limit() { return link; },
      then(ok: (r: unknown[]) => unknown, err: (e: unknown) => unknown) {
        return Promise.resolve(dbRef.current?.rows(table) ?? []).then(ok, err);
      },
    };
    return link;
  };
  // A GET that writes is itself the regression; make it loud.
  const refuse = (m: string) => () => { throw new Error(`fake db: unexpected ${m} on GET /state`); };
  return { ...actual, db: { select: chain, insert: refuse("insert"), update: refuse("update"), delete: refuse("delete") } };
});

// Fire-and-forget side effect; must never influence the response.
vi.mock("../../../lib/whoopForegroundRefresh", () => ({
  triggerWhoopRefreshIfStale: vi.fn(() => undefined),
}));

/** An existing state row, same UTC day as NOW so no rollover write fires. */
const STATE_ROW = {
  userId: "aforce-default-user", ozConsumedToday: 42, unitsConsumedToday: 3,
  aforceUnitsToday: 1, updatedAt: NOW, historyStartAt: new Date("2026-06-01T00:00:00.000Z"),
};

import stateRouter from "../state";
import { serveRouter, type Harness } from "../../__tests__/_fakeDrizzleDb";

let harness: Harness;
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  dbRef.current = { rows: (t) => (t === "aforce_user_state" ? [STATE_ROW] : []) };
  harness = await serveRouter("/api/aforce", stateRouter);
});
afterEach(async () => { await harness.close(); dbRef.current = null; vi.useRealTimers(); vi.clearAllMocks(); });

/** Drive the route with an arbitrary set of headers. */
const get = (headers: Record<string, string> = {}) =>
  harness.get("/api/aforce/state", headers);

describe("GET /state stays additive for every build in the field", () => {

  it("THE COMPATIBILITY PROOF: a request with NO version header is unchanged", async () => {
    // Exactly what iOS build 71 and the shipped Android APK send today.
    const r = await get();
    expect(r.status).toBe(200);
    const body = r.json as Record<string, unknown>;
    // The keys those builds actually read, with their original values.
    expect(body.userState).toEqual(JSON.parse(JSON.stringify(STATE_ROW)));
    expect(typeof body.serverTime).toBe("string");
    // Nothing tells them they are unsupported, because nothing can.
    expect(JSON.stringify(body)).not.toMatch(/unsupported|forceUpdate|mustUpgrade/i);
  });

  it("the policy it publishes gates nobody", async () => {
    const body = (await get()).json as { clientPolicy: { minSupportedBuild: Record<string, number> } };
    expect(body.clientPolicy.minSupportedBuild).toEqual({ ios: 0, android: 0 });
  });

  it("a valid header is accepted and changes nothing about the response", async () => {
    const withHeader = await get({ "x-aforce-client": "ios/1.0.0+71" });
    const without = await get();
    expect(withHeader.status).toBe(200);
    // Identical but for serverTime, which moves on its own.
    const strip = (j: unknown) => { const o = { ...(j as Record<string, unknown>) }; delete o.serverTime; return o; };
    expect(strip(withHeader.json)).toEqual(strip(without.json));
  });

  it("MALFORMED headers never turn a working request into an error", async () => {
    // The route has always ignored what it did not recognise. A version
    // contract that 400s on junk would be a new way for a proxy or a bad
    // string to take the app down.
    for (const v of ["", "garbage", "web/1.0.0+1", "ios/1.0.0", "ios/1.0.0+abc",
                     "IOS/1.0.0+71", "ios/1.0.0+-1", "../../etc/passwd"]) {
      const r = await get({ "x-aforce-client": v });
      expect(r.status, `header=${JSON.stringify(v)}`).toBe(200);
      expect((r.json as Record<string, unknown>).userState, `header=${JSON.stringify(v)}`).toBeTruthy();
    }
  });

  it("the response carries no per-client verdict — evaluation belongs to the client", async () => {
    // The server publishes a POLICY, not a judgement. Shipping a verdict would
    // make a transient server state able to declare a good build unsupported.
    const body = (await get({ "x-aforce-client": "ios/1.0.0+71" })).json as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(["clientPolicy", "serverTime", "userState"]);
    expect(body).not.toHaveProperty("support");
    expect(body).not.toHaveProperty("supported");
  });
});
