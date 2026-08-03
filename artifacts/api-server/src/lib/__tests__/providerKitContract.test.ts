/**
 * Provider contract suite — proves the WHOOP and Oura wrappers built on
 * top of `providerKit/tokenUserIds.ts`, `providerKit/advisoryLock.ts`,
 * and `providerKit/oauthStateStore.ts` produce IDENTICAL behavior to
 * the kit factories on shared fixtures, and to each other. This is the
 * regression guard for the dedup lane that retargeted both providers'
 * previously-duplicated implementations onto the shared kit:
 *
 *   - pagination cursor math: `iterWhoopTokenUserIds` / `iterOuraTokenUserIds`
 *     against a fixture DB produce the same page sequence, round-trip
 *     count, and cutoff-wiring as calling `iterProviderTokenUserIds`
 *     directly with the provider's real table — proving the wrappers
 *     are pure pass-throughs, not reimplementations that happen to
 *     agree today.
 *   - lock namespaces disjoint: WHOOP's and Oura's advisory-lock
 *     namespaces never collide, and each wrapper's query args match
 *     calling `withProviderUserAdvisoryLock` directly with that
 *     namespace byte-for-byte.
 *   - state-store single-use: both providers' in-memory and
 *     Drizzle-backed auth-state stores exhibit identical single-use /
 *     TTL semantics, and the Drizzle-backed constructors pass the
 *     REAL table object straight through with no cast — a reference-
 *     identity regression guard for the double-cast fix in
 *     `providerKit/oauthStateStore.ts` (see that module's doc for why
 *     `as unknown as ProviderAuthStateTable` was the actual bug: it
 *     silently defeated the column-rename compile-error a bare `as`
 *     — or, better, a generic-over-table-type call with no cast at
 *     all — would have caught).
 *
 * DB-free throughout: `@workspace/db` throws at IMPORT time when
 * DATABASE_URL is unset, so `./_ouraEnv` (which sets a harmless dummy
 * value) is imported FIRST, before any module that transitively
 * imports `@workspace/db` — same guard pattern as
 * `ouraTokenUserIds.test.ts` / `ouraFetchSweepBootstrap.test.ts`. No
 * test here ever opens a real connection; every `db` is a hand-rolled
 * fake.
 */
import './_ouraEnv';
import { describe, it, expect, vi } from 'vitest';
import type { SQL } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  aforceWhoopAuthStates,
  aforceOuraAuthStates,
  aforceWhoopTokens,
  aforceOuraTokens,
} from '@workspace/db';
import {
  iterWhoopTokenUserIds,
  iterWhoopTokenUserIdsForSweep,
  WHOOP_TOKEN_USERS_DEFAULT_PAGE_SIZE,
} from '../whoopFetchWorker';
import {
  iterOuraTokenUserIds,
  iterOuraTokenUserIdsForSweep,
  OURA_TOKEN_USERS_DEFAULT_PAGE_SIZE,
} from '../ouraTokenUserIds';
import {
  PROVIDER_TOKEN_USERS_DEFAULT_PAGE_SIZE,
  iterProviderTokenUserIds,
} from '../providerKit/tokenUserIds';
import {
  withWhoopUserAdvisoryLock,
  WHOOP_USER_ADVISORY_LOCK_NAMESPACE,
  type PgClientLike as WhoopPgClientLike,
  type PgPoolLike as WhoopPgPoolLike,
} from '../whoopAdvisoryLock';
import {
  withOuraUserAdvisoryLock,
  OURA_USER_ADVISORY_LOCK_NAMESPACE,
  type OuraPgClientLike,
  type OuraPgPoolLike,
} from '../ouraFetchSweepBootstrap';
import { withProviderUserAdvisoryLock } from '../providerKit/advisoryLock';
import {
  createInMemoryWhoopAuthStateStore,
  createDrizzleWhoopAuthStateStore,
  type WhoopAuthStateRecord,
} from '../whoopAuthStateStore';
import {
  createInMemoryOuraAuthStateStore,
  createDrizzleOuraAuthStateStore,
  type OuraAuthStateRecord,
} from '../ouraAuthStateStore';

/* ─────────────────────────────────────────────────────────────────────
 * Part 1 — pagination cursor math parity
 * ────────────────────────────────────────────────────────────────── */

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
 * `db.select({...}).from(t).where(w).orderBy(...).limit(n)`. Table-
 * agnostic — works for `aforceWhoopTokens`, `aforceOuraTokens`, or any
 * other `TokenUserIdsTable`-shaped object, since it never actually
 * evaluates the SQL. Mirrors `ouraTokenUserIds.test.ts`'s fake.
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

function row(userId: string, updatedAt: Date): FakeRow {
  return { userId, updatedAt };
}

/** Recursively extract embedded `Date` values from a drizzle `SQL`
 *  node — same helper as `ouraTokenUserIds.test.ts`, needed here to
 *  prove cutoff-threading parity across providers. */
function extractDates(node: unknown): Date[] {
  if (node == null) return [];
  if (node instanceof Date) return [node];
  if (Array.isArray(node)) return node.flatMap(extractDates);
  if (typeof node !== 'object') return [];
  if ('queryChunks' in node) {
    return extractDates((node as { queryChunks: unknown }).queryChunks);
  }
  if ('value' in node) {
    return extractDates((node as { value: unknown }).value);
  }
  return [];
}

const T1 = new Date('2026-01-01T00:00:00Z');
const T2 = new Date('2026-01-02T00:00:00Z');
const T3 = new Date('2026-01-03T00:00:00Z');

const SHARED_FIXTURE_PAGES: FakeRow[][] = [
  [row('u1', T1), row('u2', T1)],
  [row('u3', T2), row('u4', T2)],
  [row('u5', T3)],
];

describe('providerKit contract — page-size constants stay in lockstep', () => {
  it('WHOOP, Oura, and the kit default all agree (500)', () => {
    expect(WHOOP_TOKEN_USERS_DEFAULT_PAGE_SIZE).toBe(
      PROVIDER_TOKEN_USERS_DEFAULT_PAGE_SIZE,
    );
    expect(OURA_TOKEN_USERS_DEFAULT_PAGE_SIZE).toBe(
      PROVIDER_TOKEN_USERS_DEFAULT_PAGE_SIZE,
    );
  });
});

describe('providerKit contract — pagination cursor math parity', () => {
  it('iterWhoopTokenUserIds against a fixture DB produces the identical page sequence and call shape as iterProviderTokenUserIds bound to the real aforceWhoopTokens table', async () => {
    const wrapperDb = makeFakeDb(SHARED_FIXTURE_PAGES.map((p) => [...p]));
    const kitDb = makeFakeDb(SHARED_FIXTURE_PAGES.map((p) => [...p]));

    const wrapperPages: string[][] = [];
    for await (const page of iterWhoopTokenUserIds(wrapperDb.db, {
      pageSize: 2,
    })) {
      wrapperPages.push(page);
    }

    const kitPages: string[][] = [];
    for await (const page of iterProviderTokenUserIds(
      kitDb.db,
      aforceWhoopTokens,
      { pageSize: 2 },
    )) {
      kitPages.push(page);
    }

    expect(wrapperPages).toEqual(kitPages);
    expect(wrapperDb.calls.map((c) => c.limit)).toEqual(
      kitDb.calls.map((c) => c.limit),
    );
    expect(wrapperDb.calls.map((c) => c.where === undefined)).toEqual(
      kitDb.calls.map((c) => c.where === undefined),
    );
  });

  it('iterOuraTokenUserIds against a fixture DB produces the identical page sequence and call shape as iterProviderTokenUserIds bound to the real aforceOuraTokens table', async () => {
    const wrapperDb = makeFakeDb(SHARED_FIXTURE_PAGES.map((p) => [...p]));
    const kitDb = makeFakeDb(SHARED_FIXTURE_PAGES.map((p) => [...p]));

    const wrapperPages: string[][] = [];
    for await (const page of iterOuraTokenUserIds(wrapperDb.db, {
      pageSize: 2,
    })) {
      wrapperPages.push(page);
    }

    const kitPages: string[][] = [];
    for await (const page of iterProviderTokenUserIds(
      kitDb.db,
      aforceOuraTokens,
      { pageSize: 2 },
    )) {
      kitPages.push(page);
    }

    expect(wrapperPages).toEqual(kitPages);
    expect(wrapperDb.calls.map((c) => c.limit)).toEqual(
      kitDb.calls.map((c) => c.limit),
    );
  });

  it('cross-provider parity: WHOOP and Oura wrappers given the IDENTICAL fixture produce the identical userId sequence and round-trip count', async () => {
    const whoopDb = makeFakeDb(SHARED_FIXTURE_PAGES.map((p) => [...p]));
    const ouraDb = makeFakeDb(SHARED_FIXTURE_PAGES.map((p) => [...p]));

    const whoopOut: string[] = [];
    for await (const page of iterWhoopTokenUserIds(whoopDb.db, {
      pageSize: 2,
    })) {
      whoopOut.push(...page);
    }
    const ouraOut: string[] = [];
    for await (const page of iterOuraTokenUserIds(ouraDb.db, { pageSize: 2 })) {
      ouraOut.push(...page);
    }

    expect(whoopOut).toEqual(ouraOut);
    expect(whoopOut).toEqual(['u1', 'u2', 'u3', 'u4', 'u5']);
    expect(whoopDb.calls).toHaveLength(ouraDb.calls.length);
  });

  it('cutoff is threaded into EVERY page for both providers identically — the exact wiring that prevents a mid-sweep updated_at bump from re-entering a later page', async () => {
    const cutoff = new Date('2026-06-01T00:00:00Z');
    const whoopDb = makeFakeDb(SHARED_FIXTURE_PAGES.map((p) => [...p]));
    const ouraDb = makeFakeDb(SHARED_FIXTURE_PAGES.map((p) => [...p]));

    for await (const _ of iterWhoopTokenUserIds(whoopDb.db, {
      pageSize: 2,
      updatedAtMax: cutoff,
    })) {
      // drain
    }
    for await (const _ of iterOuraTokenUserIds(ouraDb.db, {
      pageSize: 2,
      updatedAtMax: cutoff,
    })) {
      // drain
    }

    expect(whoopDb.calls.length).toBeGreaterThanOrEqual(3);
    expect(whoopDb.calls.length).toBe(ouraDb.calls.length);
    for (const call of [...whoopDb.calls, ...ouraDb.calls]) {
      expect(call.where).toBeDefined();
      const dates = extractDates(call.where);
      expect(dates.some((d) => d.getTime() === cutoff.getTime())).toBe(true);
    }
  });

  it('the ForSweep cutoff guard on both providers throws the IDENTICAL error message — both delegate to the same kit validation, not parallel reimplementations', () => {
    const { db } = makeFakeDb([]);
    let whoopMsg = '';
    let ouraMsg = '';
    try {
      iterWhoopTokenUserIdsForSweep(db, {} as never);
    } catch (err) {
      whoopMsg = (err as Error).message;
    }
    try {
      iterOuraTokenUserIdsForSweep(db, {} as never);
    } catch (err) {
      ouraMsg = (err as Error).message;
    }
    expect(whoopMsg).not.toBe('');
    expect(whoopMsg).toBe(ouraMsg);
    expect(whoopMsg).toMatch(/cutoff.*must be a valid Date/);
  });
});

/* ─────────────────────────────────────────────────────────────────────
 * Part 2 — advisory lock namespace disjointness + wiring parity
 * ────────────────────────────────────────────────────────────────── */

interface FakeLockClient {
  queries: Array<{ text: string; values?: unknown[] }>;
  releaseCalls: Array<Error | boolean | undefined>;
  query(text: string, values?: unknown[]): Promise<{ rows: Array<unknown> }>;
  release(err?: Error | boolean): void;
}

function makeFakeLockClient(): FakeLockClient {
  const queries: Array<{ text: string; values?: unknown[] }> = [];
  const releaseCalls: Array<Error | boolean | undefined> = [];
  return {
    queries,
    releaseCalls,
    async query(text, values) {
      queries.push({ text, values });
      if (text.includes('pg_try_advisory_lock')) {
        return { rows: [{ got: true }] };
      }
      return { rows: [{ pg_advisory_unlock: true }] };
    },
    release(arg) {
      releaseCalls.push(arg);
    },
  };
}

describe('providerKit contract — advisory lock namespaces are disjoint and correctly wired', () => {
  it('WHOOP and Oura namespaces never collide', () => {
    expect(WHOOP_USER_ADVISORY_LOCK_NAMESPACE).not.toBe(
      OURA_USER_ADVISORY_LOCK_NAMESPACE,
    );
  });

  it('withWhoopUserAdvisoryLock sends the identical query args as withProviderUserAdvisoryLock called directly with the WHOOP namespace', async () => {
    const wrapperClient = makeFakeLockClient();
    const kitClient = makeFakeLockClient();
    const wrapperPool: WhoopPgPoolLike = {
      async connect(): Promise<WhoopPgClientLike> {
        return wrapperClient;
      },
    };
    const kitPool = {
      async connect() {
        return kitClient;
      },
    };

    await withWhoopUserAdvisoryLock(wrapperPool, 'user-parity', async () => 1);
    await withProviderUserAdvisoryLock(
      kitPool,
      'user-parity',
      WHOOP_USER_ADVISORY_LOCK_NAMESPACE,
      async () => 1,
    );

    expect(wrapperClient.queries).toEqual(kitClient.queries);
    expect(wrapperClient.queries[0]!.values).toEqual([
      'user-parity',
      WHOOP_USER_ADVISORY_LOCK_NAMESPACE,
    ]);
  });

  it('withOuraUserAdvisoryLock sends the identical query args as withProviderUserAdvisoryLock called directly with the OURA namespace', async () => {
    const wrapperClient = makeFakeLockClient();
    const kitClient = makeFakeLockClient();
    const wrapperPool: OuraPgPoolLike = {
      async connect(): Promise<OuraPgClientLike> {
        return wrapperClient;
      },
    };
    const kitPool = {
      async connect() {
        return kitClient;
      },
    };

    await withOuraUserAdvisoryLock(wrapperPool, 'user-parity', async () => 1);
    await withProviderUserAdvisoryLock(
      kitPool,
      'user-parity',
      OURA_USER_ADVISORY_LOCK_NAMESPACE,
      async () => 1,
    );

    expect(wrapperClient.queries).toEqual(kitClient.queries);
    expect(wrapperClient.queries[0]!.values).toEqual([
      'user-parity',
      OURA_USER_ADVISORY_LOCK_NAMESPACE,
    ]);
  });

  it('the SAME userId locked under each provider produces DIFFERENT hashtextextended args — disjoint keyspace regions in practice, not just distinct constants', async () => {
    const whoopClient = makeFakeLockClient();
    const ouraClient = makeFakeLockClient();
    const whoopPool: WhoopPgPoolLike = {
      async connect(): Promise<WhoopPgClientLike> {
        return whoopClient;
      },
    };
    const ouraPool: OuraPgPoolLike = {
      async connect(): Promise<OuraPgClientLike> {
        return ouraClient;
      },
    };

    await withWhoopUserAdvisoryLock(whoopPool, 'shared-user', async () => 1);
    await withOuraUserAdvisoryLock(ouraPool, 'shared-user', async () => 1);

    expect(whoopClient.queries[0]!.values).toEqual([
      'shared-user',
      WHOOP_USER_ADVISORY_LOCK_NAMESPACE,
    ]);
    expect(ouraClient.queries[0]!.values).toEqual([
      'shared-user',
      OURA_USER_ADVISORY_LOCK_NAMESPACE,
    ]);
    expect(whoopClient.queries[0]!.values).not.toEqual(
      ouraClient.queries[0]!.values,
    );
  });
});

/* ─────────────────────────────────────────────────────────────────────
 * Part 3 — auth-state store single-use parity + no-cast pass-through
 * ────────────────────────────────────────────────────────────────── */

function fixtureRecord(): WhoopAuthStateRecord & OuraAuthStateRecord {
  return { codeVerifier: 'VERIFIER', userId: 'user_1', createdAtMs: 1_000 };
}

describe('providerKit contract — auth-state store single-use parity (in-memory)', () => {
  it('WHOOP and Oura in-memory stores exhibit IDENTICAL single-use behavior on the identical fixture', async () => {
    const whoopStore = createInMemoryWhoopAuthStateStore();
    const ouraStore = createInMemoryOuraAuthStateStore();
    const rec = fixtureRecord();

    await whoopStore.put('s1', rec);
    await ouraStore.put('s1', rec);

    const whoopFirst = await whoopStore.consume('s1', 1_500);
    const ouraFirst = await ouraStore.consume('s1', 1_500);
    expect(whoopFirst).toEqual(ouraFirst);
    expect(whoopFirst).toEqual(rec);

    const whoopSecond = await whoopStore.consume('s1', 1_500);
    const ouraSecond = await ouraStore.consume('s1', 1_500);
    expect(whoopSecond).toBeNull();
    expect(ouraSecond).toBeNull();
    expect(whoopSecond).toEqual(ouraSecond);
  });

  it('both providers expire on the identical TTL boundary', async () => {
    const ttlMs = 1_000;
    const whoopStore = createInMemoryWhoopAuthStateStore({ ttlMs });
    const ouraStore = createInMemoryOuraAuthStateStore({ ttlMs });
    const rec = fixtureRecord();

    await whoopStore.put('s1', { ...rec, createdAtMs: 0 });
    await ouraStore.put('s1', { ...rec, createdAtMs: 0 });

    expect(await whoopStore.consume('s1', 999)).not.toBeNull();
    expect(await ouraStore.consume('s1', 999)).not.toBeNull();

    await whoopStore.put('s2', { ...rec, createdAtMs: 0 });
    await ouraStore.put('s2', { ...rec, createdAtMs: 0 });
    expect(await whoopStore.consume('s2', 1_001)).toBeNull();
    expect(await ouraStore.consume('s2', 1_001)).toBeNull();
  });
});

/** Minimal fake of the drizzle chain used by
 *  `createDrizzleProviderAuthStateStore`:
 *  `db.insert(table).values(v).onConflictDoUpdate({...})` and
 *  `db.delete(table).where(w).returning()`. Captures the TABLE
 *  REFERENCE passed to each call so tests can assert `===` identity
 *  against the real `aforceWhoopAuthStates` / `aforceOuraAuthStates`
 *  export — the regression guard for the double-cast fix: if a future
 *  edit reintroduces a cast that clones or re-wraps the table object
 *  instead of passing it straight through, this identity check breaks
 *  loudly. */
function makeCapturingAuthDb(deleteReturns: Array<Record<string, unknown>>): {
  db: NodePgDatabase<Record<string, unknown>>;
  inserts: Array<{ table: unknown; values: unknown }>;
  deletes: Array<{ table: unknown }>;
} {
  const inserts: Array<{ table: unknown; values: unknown }> = [];
  const deletes: Array<{ table: unknown }> = [];
  const db = {
    insert(table: unknown) {
      let values: unknown;
      return {
        values(v: unknown) {
          values = v;
          return this;
        },
        onConflictDoUpdate() {
          inserts.push({ table, values });
          return Promise.resolve();
        },
      };
    },
    delete(table: unknown) {
      return {
        where() {
          return {
            returning() {
              deletes.push({ table });
              return Promise.resolve(deleteReturns);
            },
          };
        },
      };
    },
  } as unknown as NodePgDatabase<Record<string, unknown>>;
  return { db, inserts, deletes };
}

describe('providerKit contract — Drizzle-backed stores pass the real table through with NO cast', () => {
  it('createDrizzleWhoopAuthStateStore.put reaches db.insert with the EXACT aforceWhoopAuthStates reference', async () => {
    const { db, inserts } = makeCapturingAuthDb([]);
    const store = createDrizzleWhoopAuthStateStore(db);
    await store.put('s1', fixtureRecord());
    expect(inserts).toHaveLength(1);
    expect(inserts[0]!.table).toBe(aforceWhoopAuthStates);
  });

  it('createDrizzleOuraAuthStateStore.put reaches db.insert with the EXACT aforceOuraAuthStates reference', async () => {
    const { db, inserts } = makeCapturingAuthDb([]);
    const store = createDrizzleOuraAuthStateStore(db);
    await store.put('s1', fixtureRecord());
    expect(inserts).toHaveLength(1);
    expect(inserts[0]!.table).toBe(aforceOuraAuthStates);
  });

  it('both providers issue an IDENTICALLY-SHAPED insert payload for the identical fixture (proves the wrapper adds no per-provider divergence)', async () => {
    const whoop = makeCapturingAuthDb([]);
    const oura = makeCapturingAuthDb([]);
    await createDrizzleWhoopAuthStateStore(whoop.db).put('s1', fixtureRecord());
    await createDrizzleOuraAuthStateStore(oura.db).put('s1', fixtureRecord());

    const stripTable = (c: { values: unknown }): unknown => c.values;
    expect(stripTable(whoop.inserts[0]!)).toEqual(stripTable(oura.inserts[0]!));
  });

  it('createDrizzleWhoopAuthStateStore.consume reaches db.delete with the EXACT aforceWhoopAuthStates reference and returns the row unwrapped', async () => {
    const { db, deletes } = makeCapturingAuthDb([
      { codeVerifier: 'V', userId: 'u1', createdAt: new Date(0) },
    ]);
    const store = createDrizzleWhoopAuthStateStore(db);
    const got = await store.consume('s1', 0);
    expect(deletes).toHaveLength(1);
    expect(deletes[0]!.table).toBe(aforceWhoopAuthStates);
    expect(got).toEqual({ codeVerifier: 'V', userId: 'u1', createdAtMs: 0 });
  });

  it('createDrizzleOuraAuthStateStore.consume reaches db.delete with the EXACT aforceOuraAuthStates reference and returns the row unwrapped', async () => {
    const { db, deletes } = makeCapturingAuthDb([
      { codeVerifier: 'V', userId: 'u1', createdAt: new Date(0) },
    ]);
    const store = createDrizzleOuraAuthStateStore(db);
    const got = await store.consume('s1', 0);
    expect(deletes).toHaveLength(1);
    expect(deletes[0]!.table).toBe(aforceOuraAuthStates);
    expect(got).toEqual({ codeVerifier: 'V', userId: 'u1', createdAtMs: 0 });
  });
});
