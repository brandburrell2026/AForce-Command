/**
 * Provider disconnect + account-deletion cleanup — integration test
 * (Lane F5: privacy/disconnect/deletion enforcement).
 *
 * Proves EMPIRICALLY (not by inspection) against a REAL, ephemeral
 * Postgres via Testcontainers (Docker required) the two DB-level
 * contracts this lane depends on:
 *
 *   1. DISCONNECT (one provider): a provider's token row is deleted AND
 *      its key is removed from the shared `aforce_user_state.biometrics`
 *      jsonb blob via the Postgres `#-` (delete-path) operator, while
 *      every OTHER connected provider's token row and biometrics key
 *      for the SAME user survive untouched. Repeat-run idempotent.
 *
 *   2. ACCOUNT DELETION (all providers): every provider's token row,
 *      every provider's in-flight OAuth auth-state row, the entire
 *      `biometrics` column, and every canonical health record for the
 *      user are gone — a true zero, not just "the connected ones."
 *      Repeat-run idempotent.
 *
 * Division of labor with the unit suite: `providerKitDisconnect.test.ts`
 * (api-server) proves the ORCHESTRATION — revoke-then-clear-then-remove
 * ordering, revoker-failure-is-non-blocking, idempotency — against a
 * FAKE `ProviderUserStateDb`. This file proves the jsonb `#-` operator
 * and the account-wide cascade actually behave correctly against a REAL
 * Postgres, which a fake can't verify. The `removeProviderSnapshotEntry`
 * helper below is a byte-for-byte mirror of
 * `createDrizzleProviderUserStateDb` in
 * `artifacts/api-server/src/lib/providerKit/disconnect.ts` (same
 * operator, same parameterized `text[]` path, same COALESCE-against-
 * NULL guard) — duplicated here rather than imported because that file
 * lives in the api-server app package, not `@workspace/db`, and this
 * package must not depend on an application that depends on it.
 *
 * Mirrors `healthRecordsRepo.integration.test.ts`: real Postgres pinned
 * to the same image tag, hand-written DDL (this repo has no migration
 * files — `drizzle-kit push` applies the schema directly), fresh schema
 * per test via `beforeEach`, and a TEST-LOCAL pg.Pool + drizzle instance
 * — never the `@workspace/db` singleton (which reads
 * `process.env.DATABASE_URL`).
 *
 * NOT in the fast unit suite — runs only via `pnpm test:integration`
 * (separate config; Docker-gated). Requires Docker running. On this
 * Mac, Docker is provided by Colima (not Docker Desktop) — Testcontainers
 * needs `DOCKER_HOST` pointed at the Colima socket and Ryuk disabled
 * (Colima doesn't run the reaper container reliably), e.g.:
 *
 *   DOCKER_HOST=unix:///Users/brandonburrell/.colima/default/docker.sock \
 *   TESTCONTAINERS_RYUK_DISABLED=true \
 *   pnpm test:integration
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, eq, sql } from 'drizzle-orm';
import pg from 'pg';
import * as schema from '../schema';
import {
  aforceUserState,
  aforceWhoopAuthStates,
  aforceGarminAuthStates,
  aforceOuraAuthStates,
  aforceStravaAuthStates,
} from '../schema/aforce';
import { createDrizzleWhoopTokenStoreForUser } from '../whoopTokenStore';
import { createDrizzleGarminTokenStoreForUser } from '../garminTokenStore';
import { createDrizzleOuraTokenStoreForUser } from '../ouraTokenStore';
import { createDrizzleStravaTokenStoreForUser } from '../stravaTokenStore';
import { createHealthRecordsRepo, type HealthRecordsRepo } from '../healthRecordsRepo';
import type { CanonicalHealthRecord } from '@workspace/health-core';

const { Pool } = pg;

// DDL for exactly the tables this lane's cleanup paths touch. Mirrors
// lib/db/src/schema/aforce.ts. `aforce_user_state` is intentionally
// trimmed to the two columns these paths actually reference (user_id,
// biometrics) — every query under test here only touches those two;
// the dozens of other NOT NULL/defaulted columns on the real table are
// irrelevant to this test's SQL and would only add DDL drift risk.
const CREATE_SQL = `
CREATE TABLE "aforce_user_state" (
  "user_id" text PRIMARY KEY NOT NULL,
  "biometrics" jsonb
);

CREATE TABLE "aforce_whoop_tokens" (
  "user_id" text PRIMARY KEY NOT NULL,
  "access_token" text NOT NULL,
  "refresh_token" text NOT NULL,
  "access_token_enc" bytea,
  "refresh_token_enc" bytea,
  "expires_at" timestamp with time zone NOT NULL,
  "scope" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE "aforce_garmin_tokens" (
  "user_id" text PRIMARY KEY NOT NULL,
  "access_token" text NOT NULL,
  "refresh_token" text NOT NULL,
  "access_token_enc" bytea,
  "refresh_token_enc" bytea,
  "expires_at" timestamp with time zone NOT NULL,
  "scope" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE "aforce_oura_tokens" (
  "user_id" text PRIMARY KEY NOT NULL,
  "access_token" text NOT NULL,
  "refresh_token" text NOT NULL,
  "access_token_enc" bytea,
  "refresh_token_enc" bytea,
  "expires_at" timestamp with time zone NOT NULL,
  "scope" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE "aforce_strava_tokens" (
  "user_id" text PRIMARY KEY NOT NULL,
  "access_token" text NOT NULL,
  "refresh_token" text NOT NULL,
  "access_token_enc" bytea,
  "refresh_token_enc" bytea,
  "expires_at" timestamp with time zone NOT NULL,
  "scope" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "aforce_whoop_auth_states" (
  "state" text PRIMARY KEY NOT NULL,
  "code_verifier" text NOT NULL,
  "user_id" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE "aforce_garmin_auth_states" (
  "state" text PRIMARY KEY NOT NULL,
  "code_verifier" text NOT NULL,
  "user_id" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE "aforce_oura_auth_states" (
  "state" text PRIMARY KEY NOT NULL,
  "code_verifier" text NOT NULL,
  "user_id" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE "aforce_strava_auth_states" (
  "state" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "aforce_health_records" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "provider" text NOT NULL,
  "origin" text NOT NULL,
  "metric_type" text NOT NULL,
  "external_id" text,
  "schema_version" integer NOT NULL,
  "value" jsonb NOT NULL,
  "unit" text,
  "start_utc" timestamp with time zone,
  "end_utc" timestamp with time zone,
  "observed_at" timestamp with time zone NOT NULL,
  "synced_at" timestamp with time zone NOT NULL,
  "fetched_at" timestamp with time zone,
  "hrv_method" text,
  "score_kind" text,
  "confidence" text,
  "provenance_chain" jsonb NOT NULL,
  "original_source" text,
  "device" jsonb,
  "deleted_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
`;

const DROP_SQL = `
DROP TABLE IF EXISTS "aforce_health_records" CASCADE;
DROP TABLE IF EXISTS "aforce_whoop_auth_states" CASCADE;
DROP TABLE IF EXISTS "aforce_garmin_auth_states" CASCADE;
DROP TABLE IF EXISTS "aforce_oura_auth_states" CASCADE;
DROP TABLE IF EXISTS "aforce_strava_auth_states" CASCADE;
DROP TABLE IF EXISTS "aforce_whoop_tokens" CASCADE;
DROP TABLE IF EXISTS "aforce_garmin_tokens" CASCADE;
DROP TABLE IF EXISTS "aforce_oura_tokens" CASCADE;
DROP TABLE IF EXISTS "aforce_strava_tokens" CASCADE;
DROP TABLE IF EXISTS "aforce_user_state" CASCADE;
`;

const USER_A = 'user_cleanup_a';
const USER_B = 'user_cleanup_b';

let container: StartedPostgreSqlContainer;
let pool: InstanceType<typeof Pool>;
let db: NodePgDatabase<typeof schema>;
let healthRecordsRepo: HealthRecordsRepo;

/**
 * Byte-for-byte mirror of `createDrizzleProviderUserStateDb` in
 * `artifacts/api-server/src/lib/providerKit/disconnect.ts` — see this
 * file's module doc for why it's duplicated rather than imported.
 */
async function removeProviderSnapshotEntry(
  userId: string,
  providerKey: string,
): Promise<{ removed: boolean }> {
  const result = await db
    .update(aforceUserState)
    .set({
      biometrics: sql`(COALESCE(${aforceUserState.biometrics}, '{}'::jsonb) #- ARRAY[${providerKey}]::text[])` as never,
    })
    .where(
      and(
        eq(aforceUserState.userId, userId),
        sql`COALESCE(${aforceUserState.biometrics}, '{}'::jsonb) ? ${providerKey}`,
      ),
    )
    .returning({ id: aforceUserState.userId });
  return { removed: result.length > 0 };
}

async function seedBiometrics(
  userId: string,
  biometrics: Record<string, unknown>,
): Promise<void> {
  // Raw SQL, NOT `db.insert(aforceUserState).values(...)`: Drizzle's
  // insert builder emits the FULL production column list (36+ columns,
  // `default` for every key omitted from `.values()`) regardless of
  // which keys you actually pass — it does not trim to "just the
  // columns you mentioned" the way `.update().set()` does. This test's
  // `aforce_user_state` DDL is deliberately trimmed to the two columns
  // the code under test touches (user_id, biometrics), so a
  // Drizzle-builder insert against the real imported schema object
  // would reference dozens of columns that don't exist here. Raw SQL
  // sidesteps that entirely — it only ever references the two columns
  // this test cares about.
  await pool.query(
    `INSERT INTO "aforce_user_state" (user_id, biometrics) VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET biometrics = $2`,
    [userId, JSON.stringify(biometrics)],
  );
}

async function readBiometrics(userId: string): Promise<Record<string, unknown> | null> {
  const rows = await db
    .select({ biometrics: aforceUserState.biometrics })
    .from(aforceUserState)
    .where(eq(aforceUserState.userId, userId));
  return (rows[0]?.biometrics as Record<string, unknown> | null) ?? null;
}

async function countRows(table: string, userId: string): Promise<number> {
  const r = await pool.query(
    `SELECT count(*)::int AS n FROM "${table}" WHERE user_id = $1`,
    [userId],
  );
  return r.rows[0]?.n ?? 0;
}

let seq = 0;
function healthRecord(over: Partial<CanonicalHealthRecord> = {}): CanonicalHealthRecord {
  seq += 1;
  const userId = over.userId ?? USER_A;
  const provider = over.provider ?? 'oura';
  return {
    schemaVersion: 1,
    userId,
    provider,
    metricType: 'hrv',
    value: 55,
    unit: 'ms',
    observedAt: `2026-08-0${(seq % 9) + 1}T06:00:00.000Z`,
    syncedAt: '2026-08-03T12:00:00.000Z',
    hrvMethod: 'rmssd',
    provenanceChain: [{ provider, transport: 'cloud_api' }],
    deduplicationKey: `${userId}|hrv|${provider}|seq:${seq}`,
    ...over,
  };
}

beforeAll(async () => {
  try {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
  } catch (err) {
    throw new Error(
      'Docker is required for the provider-cleanup integration test (Testcontainers). ' +
        'Start Docker (Colima on this Mac) and re-run `pnpm test:integration`. Original error: ' +
        (err as Error).message,
    );
  }
  pool = new Pool({ connectionString: container.getConnectionUri() });
  db = drizzle(pool, { schema });
  healthRecordsRepo = createHealthRecordsRepo(db);
}, 120_000);

afterAll(async () => {
  await pool?.end();
  await container?.stop();
});

beforeEach(async () => {
  seq = 0;
  await pool.query(DROP_SQL);
  await pool.query(CREATE_SQL);
});

describe('provider disconnect — real-Postgres jsonb + token isolation', () => {
  it('removes ONE provider key + its token row while OTHER providers survive', async () => {
    // Seed two connected providers for the same user.
    await createDrizzleOuraTokenStoreForUser(db, USER_A).write({
      accessToken: 'oura_at',
      refreshToken: 'oura_rt',
      expiresAt: Date.now() + 3_600_000,
    });
    await createDrizzleStravaTokenStoreForUser(db, USER_A).write({
      accessToken: 'strava_at',
      refreshToken: 'strava_rt',
      expiresAt: Date.now() + 3_600_000,
    });
    await seedBiometrics(USER_A, {
      oura: { providerId: 'oura', readinessScore: 82, fetchedAt: 1 },
      strava: { providerId: 'strava', trainingLoad: 12, fetchedAt: 1 },
    });

    // Disconnect ONLY Oura: token clear (existing store.clear()) +
    // snapshot key removal (the new SQL under test).
    await createDrizzleOuraTokenStoreForUser(db, USER_A).clear();
    const removeResult = await removeProviderSnapshotEntry(USER_A, 'oura');
    expect(removeResult.removed).toBe(true);

    // Oura is gone: token row AND biometrics key.
    expect(await countRows('aforce_oura_tokens', USER_A)).toBe(0);
    const biometrics = await readBiometrics(USER_A);
    expect(biometrics).not.toBeNull();
    expect('oura' in (biometrics as Record<string, unknown>)).toBe(false);

    // Honesty check, at the SQL level: this is exactly what
    // `GET /api/aforce/state` reads from — the key is truly absent, not
    // just nulled out or stale.
    const raw = await pool.query(
      `SELECT biometrics ? 'oura' AS has_oura FROM "aforce_user_state" WHERE user_id = $1`,
      [USER_A],
    );
    expect(raw.rows[0]?.has_oura).toBe(false);

    // Strava — untouched by the Oura disconnect.
    expect(await countRows('aforce_strava_tokens', USER_A)).toBe(1);
    expect((biometrics as Record<string, unknown>)['strava']).toEqual({
      providerId: 'strava',
      trainingLoad: 12,
      fetchedAt: 1,
    });
  });

  it('is idempotent — a second disconnect for an already-disconnected provider is a clean no-op', async () => {
    await createDrizzleOuraTokenStoreForUser(db, USER_A).write({
      accessToken: 'oura_at',
      refreshToken: 'oura_rt',
      expiresAt: Date.now() + 3_600_000,
    });
    await seedBiometrics(USER_A, {
      oura: { providerId: 'oura', readinessScore: 82, fetchedAt: 1 },
    });

    await createDrizzleOuraTokenStoreForUser(db, USER_A).clear();
    const first = await removeProviderSnapshotEntry(USER_A, 'oura');
    expect(first.removed).toBe(true);

    // Repeat — token store clear on an empty row + `#-` on an absent key.
    await createDrizzleOuraTokenStoreForUser(db, USER_A).clear();
    const second = await removeProviderSnapshotEntry(USER_A, 'oura');
    expect(second.removed).toBe(false); // nothing left to remove, not an error

    expect(await countRows('aforce_oura_tokens', USER_A)).toBe(0);
    expect(await readBiometrics(USER_A)).toEqual({});
  });

  it('never touches another user\'s tokens or biometrics', async () => {
    await createDrizzleOuraTokenStoreForUser(db, USER_A).write({
      accessToken: 'a_at',
      refreshToken: 'a_rt',
      expiresAt: Date.now() + 3_600_000,
    });
    await createDrizzleOuraTokenStoreForUser(db, USER_B).write({
      accessToken: 'b_at',
      refreshToken: 'b_rt',
      expiresAt: Date.now() + 3_600_000,
    });
    await seedBiometrics(USER_A, { oura: { providerId: 'oura', fetchedAt: 1 } });
    await seedBiometrics(USER_B, { oura: { providerId: 'oura', fetchedAt: 1 } });

    await createDrizzleOuraTokenStoreForUser(db, USER_A).clear();
    await removeProviderSnapshotEntry(USER_A, 'oura');

    expect(await countRows('aforce_oura_tokens', USER_A)).toBe(0);
    expect(await countRows('aforce_oura_tokens', USER_B)).toBe(1);
    expect(await readBiometrics(USER_B)).toEqual({
      oura: { providerId: 'oura', fetchedAt: 1 },
    });
  });
});

describe('account deletion — real-Postgres cross-provider cascade', () => {
  async function seedFullAccount(userId: string): Promise<void> {
    await createDrizzleWhoopTokenStoreForUser(db, userId).write({
      accessToken: 'w_at',
      refreshToken: 'w_rt',
      expiresAt: Date.now() + 3_600_000,
    });
    await createDrizzleGarminTokenStoreForUser(db, userId).write({
      accessToken: 'g_at',
      refreshToken: 'g_rt',
      expiresAt: Date.now() + 3_600_000,
    });
    await createDrizzleOuraTokenStoreForUser(db, userId).write({
      accessToken: 'o_at',
      refreshToken: 'o_rt',
      expiresAt: Date.now() + 3_600_000,
    });
    await createDrizzleStravaTokenStoreForUser(db, userId).write({
      accessToken: 's_at',
      refreshToken: 's_rt',
      expiresAt: Date.now() + 3_600_000,
    });
    await db.insert(aforceWhoopAuthStates).values({
      state: `${userId}_whoop_state`,
      codeVerifier: 'v',
      userId,
    });
    await db.insert(aforceGarminAuthStates).values({
      state: `${userId}_garmin_state`,
      codeVerifier: 'v',
      userId,
    });
    await db.insert(aforceOuraAuthStates).values({
      state: `${userId}_oura_state`,
      codeVerifier: 'v',
      userId,
    });
    await db.insert(aforceStravaAuthStates).values({
      state: `${userId}_strava_state`,
      userId,
    });
    await seedBiometrics(userId, {
      whoop: { providerId: 'whoop', fetchedAt: 1 },
      garmin: { providerId: 'garmin', fetchedAt: 1 },
      oura: { providerId: 'oura', fetchedAt: 1 },
      strava: { providerId: 'strava', fetchedAt: 1 },
    });
    await healthRecordsRepo.upsertRecords([
      healthRecord({ userId, provider: 'whoop' }),
      healthRecord({ userId, provider: 'oura' }),
    ]);
    // One already-tombstoned record too — purgeUser must remove it too
    // (hard delete, unlike a provider disconnect's soft tombstone).
    const [alreadyTombstoned] = [healthRecord({ userId, provider: 'garmin' })];
    await healthRecordsRepo.upsertRecords([alreadyTombstoned!]);
    await healthRecordsRepo.tombstoneProvider(userId, 'garmin');
  }

  /** Mirrors `accountDeletion.ts`'s cascade exactly, against the
   *  test-local db/pool instead of the `@workspace/db` singleton. */
  async function deleteHealthData(userId: string): Promise<{ purged: number }> {
    await createDrizzleWhoopTokenStoreForUser(db, userId).clear();
    await createDrizzleGarminTokenStoreForUser(db, userId).clear();
    await createDrizzleOuraTokenStoreForUser(db, userId).clear();
    await createDrizzleStravaTokenStoreForUser(db, userId).clear();

    await db.delete(aforceWhoopAuthStates).where(eq(aforceWhoopAuthStates.userId, userId));
    await db.delete(aforceGarminAuthStates).where(eq(aforceGarminAuthStates.userId, userId));
    await db.delete(aforceOuraAuthStates).where(eq(aforceOuraAuthStates.userId, userId));
    await db.delete(aforceStravaAuthStates).where(eq(aforceStravaAuthStates.userId, userId));

    await db
      .update(aforceUserState)
      .set({ biometrics: null })
      .where(eq(aforceUserState.userId, userId));

    return healthRecordsRepo.purgeUser(userId);
  }

  it('leaves zero token rows, zero auth-state rows, null biometrics, and zero health records', async () => {
    await seedFullAccount(USER_A);
    // Sanity: seeding actually landed before we assert it's all gone.
    expect(await countRows('aforce_whoop_tokens', USER_A)).toBe(1);
    expect(await countRows('aforce_garmin_auth_states', USER_A)).toBe(1);

    const result = await deleteHealthData(USER_A);
    expect(result.purged).toBe(3); // whoop + oura + the already-tombstoned garmin record

    for (const table of [
      'aforce_whoop_tokens',
      'aforce_garmin_tokens',
      'aforce_oura_tokens',
      'aforce_strava_tokens',
      'aforce_whoop_auth_states',
      'aforce_garmin_auth_states',
      'aforce_oura_auth_states',
      'aforce_strava_auth_states',
      'aforce_health_records',
    ]) {
      expect(await countRows(table, USER_A)).toBe(0);
    }
    expect(await readBiometrics(USER_A)).toBeNull();

    // Includes tombstoned rows — a HARD delete, not the disconnect-level
    // soft tombstone.
    const counts = await healthRecordsRepo.counts(USER_A);
    expect(counts).toEqual({ total: 0, live: 0, tombstoned: 0 });
  });

  it('is idempotent — running the cascade twice is a safe no-op the second time', async () => {
    await seedFullAccount(USER_A);
    const first = await deleteHealthData(USER_A);
    expect(first.purged).toBe(3);

    const second = await deleteHealthData(USER_A);
    expect(second.purged).toBe(0);

    expect(await countRows('aforce_whoop_tokens', USER_A)).toBe(0);
    expect(await readBiometrics(USER_A)).toBeNull();
  });

  it('never touches another user\'s data', async () => {
    await seedFullAccount(USER_A);
    await seedFullAccount(USER_B);

    await deleteHealthData(USER_A);

    expect(await countRows('aforce_whoop_tokens', USER_A)).toBe(0);
    expect(await countRows('aforce_whoop_tokens', USER_B)).toBe(1);
    expect(await readBiometrics(USER_B)).not.toBeNull();
    const bCounts = await healthRecordsRepo.counts(USER_B);
    expect(bCounts.total).toBeGreaterThan(0);
  });

  /**
   * Cascade-completeness, asked of the DATABASE rather than of the
   * cascade's own source. Enumerates every table in the live schema that
   * carries a `user_id` column and asserts the deleted user has zero
   * rows in ALL of them. A future per-user provider table — a sync
   * cursor, a webhook-subscription row, a fetch watermark — starts
   * failing this the moment it holds a row for a deleted user, without
   * anyone remembering to extend the assertion list.
   *
   * `aforce_user_state` is excluded: account health-data deletion NULLs
   * its `biometrics` column (asserted separately above) but deliberately
   * keeps the row — this endpoint deletes health data, not the account.
   */
  it('leaves zero user-scoped rows in EVERY table carrying a user_id (cascade-completeness)', async () => {
    await seedFullAccount(USER_A);
    await deleteHealthData(USER_A);

    const tables = await pool.query<{ table_name: string }>(`
      SELECT table_name
        FROM information_schema.columns
       WHERE table_schema = 'public'
         AND column_name  = 'user_id'
         AND table_name  <> 'aforce_user_state'
       GROUP BY table_name
       ORDER BY table_name
    `);
    // Sanity: the query found the tables it is supposed to police.
    expect(tables.rows.length).toBeGreaterThanOrEqual(9);

    const leftovers: Array<{ table: string; rows: number }> = [];
    for (const { table_name } of tables.rows) {
      const n = await countRows(table_name, USER_A);
      if (n > 0) leftovers.push({ table: table_name, rows: n });
    }
    expect(leftovers).toEqual([]);
  });
});

/**
 * WHOOP adoption of the shared disconnect path (F5 security pass).
 *
 * WHOOP was the last provider still on clear()-only disconnect, and the
 * only one whose live grant also keeps INBOUND webhooks flowing. These
 * cases prove the same jsonb + token isolation contract holds for the
 * `whoop` key specifically, against a real Postgres — the route-level
 * behavior is covered in
 * `artifacts/api-server/src/routes/__tests__/destructiveEndpointSecurity.test.ts`.
 */
describe('WHOOP disconnect — real-Postgres parity with the other three providers', () => {
  it('removes the whoop token row + whoop snapshot key while all three siblings survive', async () => {
    for (const [store, at] of [
      [createDrizzleWhoopTokenStoreForUser(db, USER_A), 'w'],
      [createDrizzleGarminTokenStoreForUser(db, USER_A), 'g'],
      [createDrizzleOuraTokenStoreForUser(db, USER_A), 'o'],
      [createDrizzleStravaTokenStoreForUser(db, USER_A), 's'],
    ] as const) {
      await store.write({
        accessToken: `${at}_at`,
        refreshToken: `${at}_rt`,
        expiresAt: Date.now() + 3_600_000,
      });
    }
    await seedBiometrics(USER_A, {
      whoop: { providerId: 'whoop', recoveryScore: 61, fetchedAt: 1 },
      garmin: { providerId: 'garmin', bodyBattery: 44, fetchedAt: 1 },
      oura: { providerId: 'oura', readinessScore: 82, fetchedAt: 1 },
      strava: { providerId: 'strava', trainingLoad: 12, fetchedAt: 1 },
    });

    await createDrizzleWhoopTokenStoreForUser(db, USER_A).clear();
    expect((await removeProviderSnapshotEntry(USER_A, 'whoop')).removed).toBe(true);

    expect(await countRows('aforce_whoop_tokens', USER_A)).toBe(0);
    // Stale-snapshot-absent, asked of the column GET /api/aforce/state
    // actually reads.
    const raw = await pool.query(
      `SELECT biometrics ? 'whoop' AS has_whoop FROM "aforce_user_state" WHERE user_id = $1`,
      [USER_A],
    );
    expect(raw.rows[0]?.has_whoop).toBe(false);

    // Every sibling intact — tokens AND snapshot.
    for (const t of [
      'aforce_garmin_tokens',
      'aforce_oura_tokens',
      'aforce_strava_tokens',
    ]) {
      expect(await countRows(t, USER_A)).toBe(1);
    }
    expect(await readBiometrics(USER_A)).toEqual({
      garmin: { providerId: 'garmin', bodyBattery: 44, fetchedAt: 1 },
      oura: { providerId: 'oura', readinessScore: 82, fetchedAt: 1 },
      strava: { providerId: 'strava', trainingLoad: 12, fetchedAt: 1 },
    });
  });

  it('is idempotent and never reaches across users', async () => {
    await createDrizzleWhoopTokenStoreForUser(db, USER_A).write({
      accessToken: 'a_at',
      refreshToken: 'a_rt',
      expiresAt: Date.now() + 3_600_000,
    });
    await createDrizzleWhoopTokenStoreForUser(db, USER_B).write({
      accessToken: 'b_at',
      refreshToken: 'b_rt',
      expiresAt: Date.now() + 3_600_000,
    });
    await seedBiometrics(USER_A, { whoop: { providerId: 'whoop', fetchedAt: 1 } });
    await seedBiometrics(USER_B, { whoop: { providerId: 'whoop', fetchedAt: 1 } });

    await createDrizzleWhoopTokenStoreForUser(db, USER_A).clear();
    expect((await removeProviderSnapshotEntry(USER_A, 'whoop')).removed).toBe(true);

    // Repeat — the second call must be a clean no-op, which is what the
    // route reports as revocation: 'skipped_no_tokens'.
    await createDrizzleWhoopTokenStoreForUser(db, USER_A).clear();
    expect((await removeProviderSnapshotEntry(USER_A, 'whoop')).removed).toBe(false);

    expect(await countRows('aforce_whoop_tokens', USER_A)).toBe(0);
    expect(await readBiometrics(USER_A)).toEqual({});
    expect(await countRows('aforce_whoop_tokens', USER_B)).toBe(1);
    expect(await readBiometrics(USER_B)).toEqual({
      whoop: { providerId: 'whoop', fetchedAt: 1 },
    });
  });
});
