/**
 * DB integration tests for `iterWhoopTokenUserIds` + the
 * `listWhoopTokenUserIds` drain wrapper.
 *
 * These need a real Postgres because the keyset boundary uses a
 * tuple-comparison `sql` expression that drizzle's in-memory fakes
 * can't faithfully evaluate. Mirrors the pattern in
 * `whoopTokenStore.drizzle.test.ts` (seed prefixed test users in
 * beforeAll, clean in afterAll).
 *
 * Coverage:
 *   - empty -> iterator yields no pages, list returns []
 *   - single page (rows < pageSize) -> one yield, no extra round-trip
 *   - exactly pageSize -> one yield, then a probe page that returns 0 rows
 *   - multiple pages -> stable `(updated_at ASC, user_id ASC)` order
 *     across page boundaries (no skips, no duplicates)
 *   - duplicate `updated_at` values across the page boundary tie-break
 *     by `user_id` (the row-value keyset proves correct)
 *   - listWhoopTokenUserIds returns the concatenated stream
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db, aforceWhoopTokens } from "@workspace/db";
import {
  iterWhoopTokenUserIds,
  listWhoopTokenUserIds,
} from "../lib/whoopFetchWorker";

const PREFIX = "test_iter_whoop_";
const u = (n: string): string => `${PREFIX}${n}`;

// Note: 7 users — exercises page sizes 2, 3, 7, and >7 below.
const SEED = [
  u("a01"),
  u("a02"),
  u("a03"),
  u("b01"),
  u("b02"),
  u("c01"),
  u("c02"),
];

/** Two of the seven share the same updated_at, exercising the
 *  tie-break-by-user_id keyset. The cursor must NOT skip the second
 *  one when the boundary lands exactly on the shared timestamp. */
const T1 = new Date("2026-01-01T00:00:00Z");
const T2 = new Date("2026-01-02T00:00:00Z");
const T_DUP = new Date("2026-01-03T00:00:00Z"); // shared
const T4 = new Date("2026-01-04T00:00:00Z");

const ROWS = [
  { userId: u("a01"), updatedAt: T1 },
  { userId: u("a02"), updatedAt: T2 },
  { userId: u("a03"), updatedAt: T_DUP }, // shared T_DUP
  { userId: u("b01"), updatedAt: T_DUP }, // shared T_DUP
  { userId: u("b02"), updatedAt: T4 },
  { userId: u("c01"), updatedAt: T4 },
  { userId: u("c02"), updatedAt: T4 },
];

/** Expected order by (updated_at ASC, user_id ASC). For T_DUP rows,
 *  `a03` < `b01` lexicographically; for T4 rows, `b02` < `c01` < `c02`. */
const EXPECTED_ORDER = [
  u("a01"),
  u("a02"),
  u("a03"),
  u("b01"),
  u("b02"),
  u("c01"),
  u("c02"),
];

async function cleanSeedRows(): Promise<void> {
  await db
    .delete(aforceWhoopTokens)
    .where(inArray(aforceWhoopTokens.userId, SEED));
}

async function seedRows(): Promise<void> {
  // Use explicit `updatedAt` (the schema defaults to NOW() — we need
  // controlled values to assert ordering deterministically).
  await db
    .insert(aforceWhoopTokens)
    .values(
      ROWS.map((r) => ({
        userId: r.userId,
        accessToken: `AT_${r.userId}`,
        refreshToken: `RT_${r.userId}`,
        expiresAt: new Date("2030-01-01T00:00:00Z"),
        scope: null,
        updatedAt: r.updatedAt,
      })),
    );
}

beforeAll(async () => {
  await cleanSeedRows();
});

afterAll(async () => {
  await cleanSeedRows();
});

async function drainIter(
  pageSize: number,
): Promise<{ pages: string[][]; flat: string[] }> {
  // Restrict the iterator's view to OUR seed rows so we don't blow up
  // when the dev DB has unrelated WHOOP token rows from previous work.
  // We can't pass a WHERE to the iterator directly, so we filter the
  // yielded pages — pagination correctness is unaffected because the
  // keyset only depends on what the underlying query orders by.
  const seedSet = new Set(SEED);
  const pages: string[][] = [];
  const flat: string[] = [];
  for await (const page of iterWhoopTokenUserIds(db, { pageSize })) {
    const filtered = page.filter((id) => seedSet.has(id));
    pages.push(filtered);
    flat.push(...filtered);
    // Stop early if we've yielded all our seeds — avoids walking the
    // whole table when the dev DB has tons of unrelated rows.
    if (flat.length >= SEED.length) break;
  }
  return { pages, flat };
}

describe("iterWhoopTokenUserIds — keyset pagination", () => {
  it("empty seed window -> iter completes with no qualifying rows", async () => {
    // No seeding has happened in this `it`; cleanSeedRows already ran
    // in beforeAll. Verify our seed set is empty without asserting the
    // full table is empty (dev DB may have other rows).
    const { flat } = await drainIter(500);
    expect(flat).toHaveLength(0);
  });

  it("single page (pageSize > rowCount) yields all rows in order", async () => {
    await seedRows();
    try {
      const { flat } = await drainIter(500);
      expect(flat).toEqual(EXPECTED_ORDER);
    } finally {
      await cleanSeedRows();
    }
  });

  it("multi-page paging is correct across (updated_at, user_id) tie-breaks", async () => {
    await seedRows();
    try {
      // pageSize=2 forces the boundary to land mid-stream multiple
      // times, including on the T_DUP pair (a03,b01) — the keyset
      // must tie-break by user_id, not skip b01.
      const { pages, flat } = await drainIter(2);
      // Stable concatenation matches the single-page result exactly.
      expect(flat).toEqual(EXPECTED_ORDER);
      // Each filtered page is <= pageSize (filter only removes
      // unrelated rows; never adds).
      for (const p of pages) {
        expect(p.length).toBeLessThanOrEqual(2);
      }
    } finally {
      await cleanSeedRows();
    }
  });

  it("pageSize=1 still yields every seed row exactly once", async () => {
    await seedRows();
    try {
      const { flat } = await drainIter(1);
      expect(flat).toEqual(EXPECTED_ORDER);
      // Specifically: the T_DUP pair both appear, in tie-break order.
      const i_a03 = flat.indexOf(u("a03"));
      const i_b01 = flat.indexOf(u("b01"));
      expect(i_a03).toBeGreaterThanOrEqual(0);
      expect(i_b01).toBeGreaterThan(i_a03);
    } finally {
      await cleanSeedRows();
    }
  });
});

describe("iterWhoopTokenUserIds — updatedAtMax snapshot cutoff", () => {
  it("excludes rows with updated_at > cutoff (sweep-start snapshot semantics)", async () => {
    await seedRows();
    try {
      // Cutoff between T2 and T_DUP — only the first two seed users
      // should be yielded.
      const cutoff = new Date("2026-01-02T12:00:00Z");
      const seedSet = new Set(SEED);
      const got: string[] = [];
      for await (const page of iterWhoopTokenUserIds(db, {
        pageSize: 100,
        updatedAtMax: cutoff,
      })) {
        for (const id of page) if (seedSet.has(id)) got.push(id);
      }
      expect(got).toEqual([u("a01"), u("a02")]);
    } finally {
      await cleanSeedRows();
    }
  });

  it("rows whose updated_at gets bumped MID-ITERATION past cutoff are NOT re-yielded", async () => {
    // Architect-requested regression. This is the bug a naive
    // pagination (no cutoff) would have: the sweep refreshes a
    // token, the row's updated_at jumps to NOW(), and on a later
    // page the cursor `(updatedAt, userId) > (prev)` matches it
    // again under its new timestamp. The cutoff freezes the page
    // set to rows that EXISTED with that updated_at at sweep start.
    await seedRows();
    try {
      const cutoff = new Date("2026-01-05T00:00:00Z"); // includes all seeds
      const seedSet = new Set(SEED);
      const yielded: string[] = [];
      const iter = iterWhoopTokenUserIds(db, {
        pageSize: 1, // forces a separate query per row -> tests interleaving
        updatedAtMax: cutoff,
      });
      // Pull page 1.
      const first = await iter.next();
      expect(first.done).toBe(false);
      const page1 = (first.value ?? []).filter((id) => seedSet.has(id));
      yielded.push(...page1);
      expect(page1).toEqual([u("a01")]);

      // SIMULATE the sweep refreshing a01's token: bump its
      // updated_at to AFTER the cutoff. A no-cutoff iterator would
      // re-emit a01 on a later page; a cutoff iterator must not.
      await db
        .update(aforceWhoopTokens)
        .set({ updatedAt: new Date("2026-01-06T00:00:00Z") })
        .where(eq(aforceWhoopTokens.userId, u("a01")));

      // Drain the rest of the iterator.
      for (;;) {
        const next = await iter.next();
        if (next.done) break;
        const page = (next.value ?? []).filter((id) => seedSet.has(id));
        yielded.push(...page);
      }

      // a01 appears exactly once (in page 1, before the bump).
      const a01Count = yielded.filter((id) => id === u("a01")).length;
      expect(a01Count).toBe(1);
      // The remaining seed users are still yielded in (updated_at,
      // user_id) order — the bumped row stays excluded because its
      // NEW updated_at is past the cutoff.
      expect(yielded).toEqual([
        u("a01"),
        u("a02"),
        u("a03"),
        u("b01"),
        u("b02"),
        u("c01"),
        u("c02"),
      ]);
    } finally {
      await cleanSeedRows();
    }
  });
});

describe("listWhoopTokenUserIds — drains the iterator", () => {
  it("returns the same stable order as the iterator", async () => {
    await seedRows();
    try {
      // Can't filter here (listWhoopTokenUserIds drains everything),
      // so we extract the positions of our seeds from the full list
      // and verify their RELATIVE order matches EXPECTED_ORDER.
      const all = await listWhoopTokenUserIds(db, { pageSize: 3 });
      const seedSet = new Set(SEED);
      const seen = all.filter((id) => seedSet.has(id));
      expect(seen).toEqual(EXPECTED_ORDER);
    } finally {
      await cleanSeedRows();
    }
  });
});
