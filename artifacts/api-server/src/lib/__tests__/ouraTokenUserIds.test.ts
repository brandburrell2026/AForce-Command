/**
 * DB-free tests for `ouraTokenUserIds.ts`'s keyset paginator.
 *
 * Scope note: the row-value tuple-comparison SQL (`(updated_at,
 * user_id) > (...)`) can only be PROVEN correct against a real
 * Postgres — drizzle's query builder doesn't evaluate SQL locally, and
 * WHOOP's own sibling iterator is likewise only behaviorally verified
 * against real Postgres, in `src/__tests__/whoopTokenUserIds.drizzle.test.ts`
 * (tuple tie-breaks, cutoff exclusion, mid-drain update_at bumps).
 * `iterOuraTokenUserIds` reuses that exact proven SQL shape unchanged
 * (see the module doc), just retargeted at `aforce_oura_tokens`, which
 * already carries the required `(updated_at, user_id)` composite index
 * (`aforce_oura_tokens_updated_user_idx` in
 * `lib/db/src/schema/aforce.ts`).
 *
 * This lane's test scope is restricted to `src/lib/__tests__/` (DB-free
 * only — no DATABASE_URL available in the required CI invocation), so
 * what we verify HERE with a fully in-memory fake `db` is the part
 * that's actually ours to break in JS:
 *   - the generator's loop/termination contract (keeps paging while a
 *     full page comes back, stops on a short or empty page, default +
 *     clamped page sizes reach `.limit()` correctly)
 *   - the WIRING contract that prevents the exact bug class this
 *     pagination exists to avoid: cutoff must be threaded into EVERY
 *     page's query, not just the first, or a token refreshed mid-sweep
 *     (bumping `updated_at`) could re-enter a later page and be
 *     double-processed within one pass. We verify this by walking the
 *     actual `SQL` object's `queryChunks` (drizzle-orm's own internal
 *     representation) to confirm the same cutoff `Date` value is
 *     embedded in the WHERE clause of every call once a cutoff is
 *     supplied — not just recording that "some" condition was passed.
 *   - `iterOuraTokenUserIdsForSweep`'s synchronous cutoff guard (no DB
 *     touched at all on the throw paths).
 *
 * A follow-up DB-integration test mirroring
 * `whoopTokenUserIds.drizzle.test.ts` exactly
 * (`src/__tests__/ouraTokenUserIds.drizzle.test.ts`) is recommended
 * before Oura's sweep is activated at meaningful scale, to prove the
 * real tuple tie-break + cutoff-exclusion semantics the way WHOOP's
 * are proven — out of scope for this lane (new tests restricted to
 * `src/lib/__tests__/`).
 */
import './_ouraEnv';
import { describe, it, expect } from "vitest";
import type { SQL } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  OURA_TOKEN_USERS_DEFAULT_PAGE_SIZE,
  getDbNow,
  iterOuraTokenUserIds,
  iterOuraTokenUserIdsForSweep,
  listOuraTokenUserIds,
} from "../ouraTokenUserIds";

interface FakeRow {
  userId: string;
  updatedAt: Date;
}

interface RecordedCall {
  where: SQL | undefined;
  limit: number;
}

/**
 * Minimal fake of the drizzle chain
 * `db.select({...}).from(t).where(w).orderBy(...).limit(n)`.
 * `pages` is consumed one array per call; once exhausted, every
 * further call returns an empty page (matching a real "no more rows"
 * response instead of throwing, since some tests intentionally drain
 * past the seeded pages).
 */
function makeFakeDb(pages: FakeRow[][]): {
  db: NodePgDatabase<Record<string, unknown>>;
  calls: RecordedCall[];
} {
  const calls: RecordedCall[] = [];
  let callIndex = 0;
  const builder = {
    select: () => builder,
    from: () => builder,
    where(this: void, where: SQL | undefined) {
      (builder as unknown as { __pendingWhere: SQL | undefined }).__pendingWhere =
        where;
      return builder;
    },
    orderBy: () => builder,
    limit(n: number) {
      const where = (builder as unknown as { __pendingWhere: SQL | undefined })
        .__pendingWhere;
      calls.push({ where, limit: n });
      const idx = callIndex;
      callIndex += 1;
      const rows = pages[idx] ?? [];
      return Promise.resolve(rows);
    },
  } as unknown as { __pendingWhere: SQL | undefined } & Record<
    string,
    (...args: never[]) => unknown
  >;
  const db = { select: () => builder } as unknown as NodePgDatabase<
    Record<string, unknown>
  >;
  return { db, calls };
}

/** Recursively walk a drizzle `SQL` node's `queryChunks` (and any
 *  nested SQL nodes produced by `and(...)` / `lte(...)`) collecting
 *  every embedded `Date` value. `lte(column, date)` wraps its bound
 *  value in an internal `Param { value, brand, encoder }` object
 *  rather than embedding the `Date` directly (unlike a raw ``sql`...`
 *  ``` template, which does) — so besides recursing into
 *  `queryChunks`, we also unwrap any object exposing a `.value`
 *  property (covers `Param` AND `StringChunk`, both harmless to
 *  recurse into). We deliberately do NOT do a fully generic object
 *  walk: drizzle `PgColumn` nodes carry a circular `table` back-
 *  reference, and neither `queryChunks` nor `value` appears on them,
 *  so this stays safe without an explicit exclusion list. Couples to
 *  drizzle-orm's internal `SQL`/`Param` shape; if that shape changes
 *  this helper breaks loudly (test failure), not silently. */
function extractDates(node: unknown): Date[] {
  if (node == null) return [];
  if (node instanceof Date) return [node];
  if (Array.isArray(node)) return node.flatMap(extractDates);
  if (typeof node !== "object") return [];
  if ("queryChunks" in node) {
    return extractDates((node as { queryChunks: unknown }).queryChunks);
  }
  if ("value" in node) {
    return extractDates((node as { value: unknown }).value);
  }
  return [];
}

function row(userId: string, updatedAt: Date): FakeRow {
  return { userId, updatedAt };
}

const T1 = new Date("2026-01-01T00:00:00Z");
const T2 = new Date("2026-01-02T00:00:00Z");
const T3 = new Date("2026-01-03T00:00:00Z");

describe("iterOuraTokenUserIdsForSweep — synchronous cutoff guard", () => {
  it("throws when opts is entirely omitted (no DB touched)", () => {
    const { db, calls } = makeFakeDb([]);
    expect(() =>
      // @ts-expect-error — exercising the undefined-opts branch.
      iterOuraTokenUserIdsForSweep(db),
    ).toThrow(/cutoff.*must be a valid Date/);
    expect(calls).toHaveLength(0);
  });

  it("throws when cutoff is missing", () => {
    const { db, calls } = makeFakeDb([]);
    expect(() =>
      // @ts-expect-error — exercising the missing-cutoff branch.
      iterOuraTokenUserIdsForSweep(db, {}),
    ).toThrow(/cutoff.*must be a valid Date/);
    expect(calls).toHaveLength(0);
  });

  it("throws when cutoff is not a Date", () => {
    const { db } = makeFakeDb([]);
    expect(() =>
      iterOuraTokenUserIdsForSweep(db, {
        // @ts-expect-error — runtime guard.
        cutoff: "2026-01-01T00:00:00Z",
      }),
    ).toThrow(/cutoff.*must be a valid Date/);
  });

  it("throws on Invalid Date (NaN time)", () => {
    const { db } = makeFakeDb([]);
    expect(() =>
      iterOuraTokenUserIdsForSweep(db, { cutoff: new Date("not-a-date") }),
    ).toThrow(/cutoff.*must be a valid Date/);
  });

  it("accepts a valid Date and delegates to the base iterator", async () => {
    const { db, calls } = makeFakeDb([[row("u1", T1)]]);
    const out: string[] = [];
    for await (const page of iterOuraTokenUserIdsForSweep(db, {
      cutoff: T2,
    })) {
      out.push(...page);
    }
    expect(out).toEqual(["u1"]);
    expect(calls).toHaveLength(1);
  });
});

describe("iterOuraTokenUserIds — pagination loop contract", () => {
  it("empty result -> zero pages yielded, exactly one round trip", async () => {
    const { db, calls } = makeFakeDb([[]]);
    const pages: string[][] = [];
    for await (const page of iterOuraTokenUserIds(db, { pageSize: 10 })) {
      pages.push(page);
    }
    expect(pages).toHaveLength(0);
    expect(calls).toHaveLength(1);
  });

  it("single short page (rows < pageSize) -> one yield, no second round trip", async () => {
    const { db, calls } = makeFakeDb([[row("u1", T1), row("u2", T2)]]);
    const pages: string[][] = [];
    for await (const page of iterOuraTokenUserIds(db, { pageSize: 10 })) {
      pages.push(page);
    }
    expect(pages).toEqual([["u1", "u2"]]);
    expect(calls).toHaveLength(1);
  });

  it("exactly pageSize rows -> yields the page, then probes once more and stops on the empty page", async () => {
    const { db, calls } = makeFakeDb([[row("u1", T1), row("u2", T2)], []]);
    const pages: string[][] = [];
    for await (const page of iterOuraTokenUserIds(db, { pageSize: 2 })) {
      pages.push(page);
    }
    expect(pages).toEqual([["u1", "u2"]]);
    expect(calls).toHaveLength(2);
  });

  it("multiple full pages then a short page -> concatenates in call order", async () => {
    const { db, calls } = makeFakeDb([
      [row("u1", T1), row("u2", T1)],
      [row("u3", T2), row("u4", T2)],
      [row("u5", T3)],
    ]);
    const flat: string[] = [];
    for await (const page of iterOuraTokenUserIds(db, { pageSize: 2 })) {
      flat.push(...page);
    }
    expect(flat).toEqual(["u1", "u2", "u3", "u4", "u5"]);
    expect(calls).toHaveLength(3);
  });

  it("defaults to OURA_TOKEN_USERS_DEFAULT_PAGE_SIZE when pageSize is omitted", async () => {
    const { db, calls } = makeFakeDb([[]]);
    for await (const _ of iterOuraTokenUserIds(db)) {
      // drain
    }
    expect(calls[0]!.limit).toBe(OURA_TOKEN_USERS_DEFAULT_PAGE_SIZE);
  });

  it("clamps a non-positive pageSize up to 1", async () => {
    const { db, calls } = makeFakeDb([[]]);
    for await (const _ of iterOuraTokenUserIds(db, { pageSize: 0 })) {
      // drain
    }
    expect(calls[0]!.limit).toBe(1);
  });

  it("first call has no WHERE (no cursor yet, no cutoff); a later call gets a defined cursor condition", async () => {
    const { db, calls } = makeFakeDb([
      [row("u1", T1), row("u2", T2)],
      [],
    ]);
    for await (const _ of iterOuraTokenUserIds(db, { pageSize: 2 })) {
      // drain
    }
    expect(calls).toHaveLength(2);
    expect(calls[0]!.where).toBeUndefined();
    expect(calls[1]!.where).toBeDefined();
  });

  it("cutoff is threaded into EVERY page's WHERE clause, not just the first — the exact wiring that prevents a mid-sweep updated_at bump from re-entering a later page", async () => {
    // Regression guard for the WHOOP round-1 PR-21 bug class: if a
    // future refactor only applied the cutoff on page 1 (e.g. folded
    // it into the cursor instead of re-adding it every iteration), a
    // token refreshed mid-sweep would bump past the cutoff and could
    // slip back in on a later page under a cutoff-less cursor
    // condition. We can't evaluate the real tuple SQL here (see file
    // doc), but we CAN prove the cutoff Date is embedded in the WHERE
    // clause's SQL structure on every single call.
    const cutoff = new Date("2026-06-01T00:00:00Z");
    const { db, calls } = makeFakeDb([
      [row("u1", T1), row("u2", T2)],
      [row("u3", T3), row("u4", T3)],
      [row("u5", T3)],
    ]);
    for await (const _ of iterOuraTokenUserIds(db, {
      pageSize: 2,
      updatedAtMax: cutoff,
    })) {
      // drain
    }
    expect(calls.length).toBeGreaterThanOrEqual(3);
    for (const call of calls) {
      expect(call.where).toBeDefined();
      const dates = extractDates(call.where);
      expect(
        dates.some((d) => d.getTime() === cutoff.getTime()),
      ).toBe(true);
    }
  });
});

describe("getDbNow — DB-clock cutoff source", () => {
  function fakeExecuteDb(
    row: { now?: Date | string | null } | undefined,
  ): NodePgDatabase<Record<string, unknown>> {
    return {
      execute: async () => ({ rows: row ? [row] : [] }),
    } as unknown as NodePgDatabase<Record<string, unknown>>;
  }

  it("passes a real Date through unchanged", async () => {
    const d = new Date("2026-04-01T12:00:00.000Z");
    const result = await getDbNow(fakeExecuteDb({ now: d }));
    expect(result).toBe(d);
  });

  it("normalizes an ISO-string `now` from a driver without a Date parser", async () => {
    const result = await getDbNow(
      fakeExecuteDb({ now: "2026-04-01T12:00:00.000Z" }),
    );
    expect(result).toBeInstanceOf(Date);
    expect(result.toISOString()).toBe("2026-04-01T12:00:00.000Z");
  });

  it("throws when the query returns no row", async () => {
    await expect(getDbNow(fakeExecuteDb(undefined))).rejects.toThrow(
      /returned no usable row/,
    );
  });

  it("throws when `now` is null", async () => {
    await expect(getDbNow(fakeExecuteDb({ now: null }))).rejects.toThrow(
      /returned no usable row/,
    );
  });
});

describe("listOuraTokenUserIds — drains the iterator", () => {
  it("returns the concatenated stream in stable order", async () => {
    const { db } = makeFakeDb([
      [row("u1", T1), row("u2", T1)],
      [row("u3", T2)],
    ]);
    const all = await listOuraTokenUserIds(db, { pageSize: 2 });
    expect(all).toEqual(["u1", "u2", "u3"]);
  });

  it("empty table -> empty array", async () => {
    const { db } = makeFakeDb([[]]);
    const all = await listOuraTokenUserIds(db);
    expect(all).toEqual([]);
  });
});
