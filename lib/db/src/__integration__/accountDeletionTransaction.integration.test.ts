/**
 * Account-deletion cascade atomicity — integration test (Squad-F
 * LOW-MED finding: `artifacts/api-server/src/routes/accountDeletion.ts`
 * used to run its ~10-step health-data deletion cascade as sequential
 * awaits with no `db.transaction`. A mid-cascade failure left a partial
 * deletion: some providers' tokens/auth-states cleared, others (and the
 * health-records purge) not, with nothing to retry or alert on it. The
 * fix wraps the whole cascade in a single `db.transaction`; this file
 * proves EMPIRICALLY (not by inspection) against a REAL, ephemeral
 * Postgres via Testcontainers that the fix is atomic:
 *
 *   1. A step failing partway through the cascade rolls back every
 *      step already run in the SAME call — nothing partial survives.
 *   2. A clean retry afterward completes the entire cascade and leaves
 *      zero rows.
 *
 * #506 review finding: this test used to exercise
 * `deleteHealthDataTransactional`, a byte-for-byte structural COPY of
 * `runCascadeInTransaction` inside `buildDefaultAccountDeletionDeps` in
 * `artifacts/api-server/src/routes/accountDeletion.ts` — duplicated
 * because that file used to live in the api-server app package with
 * the cascade body inlined there, and this package must not depend on
 * an application that depends on it. That meant the ONLY code path
 * that runs the cascade atomically in production had ZERO direct test
 * coverage; this file only ever proved its own copy was correct, and
 * the two could silently drift. The cascade body now lives once, in
 * this package, as `runAccountDeletionCascade`
 * (`./accountDeletionCascade`) — `accountDeletion.ts` imports it for
 * both its transactional and fallback paths, and this test below now
 * wraps THAT SAME function in `db.transaction` directly, so this test
 * proves the real production code path, not a copy of it. The fault is
 * a REAL SQL failure (the target table is dropped before the call),
 * not a mocked throw, matching the technique in
 * `profileRepo.rollback.integration.test.ts`.
 *
 * NOT in the fast unit suite — runs only via `pnpm test:integration`
 * (separate config; Docker-gated). Requires Docker running. On this
 * Mac, Docker is provided by Colima (not Docker Desktop):
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
import { eq } from 'drizzle-orm';
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
import { createHealthRecordsRepo } from '../healthRecordsRepo';
import {
  runAccountDeletionCascade,
  createAccountDeletionAuthStateDb,
} from '../accountDeletionCascade';
import type { CanonicalHealthRecord } from '@workspace/health-core';

const { Pool } = pg;

// Same DDL subset as providerCleanup.integration.test.ts — exactly the
// tables the account-deletion cascade touches. Mirrors
// lib/db/src/schema/aforce.ts.
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

// Just the health-records table, so it can be dropped mid-test to force
// a real SQL failure on the cascade's LAST step and recreated afterward
// for the clean-retry half of the same test.
const CREATE_HEALTH_RECORDS_SQL = `
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

const USER_A = 'user_txn_cascade_a';

let container: StartedPostgreSqlContainer;
let pool: InstanceType<typeof Pool>;
let db: NodePgDatabase<typeof schema>;

async function countRows(table: string, userId: string): Promise<number> {
  const r = await pool.query(
    `SELECT count(*)::int AS n FROM "${table}" WHERE user_id = $1`,
    [userId],
  );
  return r.rows[0]?.n ?? 0;
}

async function readBiometrics(
  userId: string,
): Promise<Record<string, unknown> | null> {
  const rows = await db
    .select({ biometrics: aforceUserState.biometrics })
    .from(aforceUserState)
    .where(eq(aforceUserState.userId, userId));
  return (rows[0]?.biometrics as Record<string, unknown> | null) ?? null;
}

function healthRecord(
  over: Partial<CanonicalHealthRecord> = {},
): CanonicalHealthRecord {
  const userId = over.userId ?? USER_A;
  const provider = over.provider ?? 'oura';
  return {
    schemaVersion: 1,
    userId,
    provider,
    metricType: 'hrv',
    value: 55,
    unit: 'ms',
    observedAt: '2026-08-01T06:00:00.000Z',
    syncedAt: '2026-08-03T12:00:00.000Z',
    hrvMethod: 'rmssd',
    provenanceChain: [{ provider, transport: 'cloud_api' }],
    deduplicationKey: `${userId}|hrv|${provider}|txn-fixture`,
    ...over,
  };
}

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
  // Raw SQL, not the Drizzle insert builder — see providerCleanup
  // .integration.test.ts's `seedBiometrics` for why (the builder emits
  // the full production column list regardless of which keys are set,
  // and this test's DDL is trimmed to user_id + biometrics).
  await pool.query(
    `INSERT INTO "aforce_user_state" (user_id, biometrics) VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET biometrics = $2`,
    [
      userId,
      JSON.stringify({
        whoop: { providerId: 'whoop', fetchedAt: 1 },
        garmin: { providerId: 'garmin', fetchedAt: 1 },
        oura: { providerId: 'oura', fetchedAt: 1 },
        strava: { providerId: 'strava', fetchedAt: 1 },
      }),
    ],
  );
  await createHealthRecordsRepo(db).upsertRecords([
    healthRecord({ userId, provider: 'oura' }),
  ]);
}

/**
 * Thin wrapper around the REAL `runAccountDeletionCascade`
 * (`../accountDeletionCascade`) — the same function
 * `artifacts/api-server/src/routes/accountDeletion.ts` imports for
 * both its transactional and fallback paths. This is no longer a
 * hand-maintained structural copy (see this file's module doc): the
 * only thing this wrapper does is bind the cascade's dependencies to
 * `tx`, so all four steps enroll in the same transaction and a
 * failure in the last one (the health-records purge) rolls back the
 * first three too.
 */
async function deleteHealthDataTransactional(
  dbx: NodePgDatabase<typeof schema>,
  userId: string,
): Promise<{ purged: number }> {
  return dbx.transaction((tx) =>
    runAccountDeletionCascade(
      {
        whoopTokenStoreFor: (u) => createDrizzleWhoopTokenStoreForUser(tx, u),
        garminTokenStoreFor: (u) =>
          createDrizzleGarminTokenStoreForUser(tx, u),
        ouraTokenStoreFor: (u) => createDrizzleOuraTokenStoreForUser(tx, u),
        stravaTokenStoreFor: (u) =>
          createDrizzleStravaTokenStoreForUser(tx, u),
        authStateDb: createAccountDeletionAuthStateDb(tx),
        healthRecordsRepo: createHealthRecordsRepo(tx),
      },
      userId,
    ),
  );
}

beforeAll(async () => {
  try {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
  } catch (err) {
    throw new Error(
      'Docker is required for the account-deletion transaction integration test ' +
        '(Testcontainers). Start Docker (Colima on this Mac) and re-run ' +
        '`pnpm test:integration`. Original error: ' +
        (err as Error).message,
    );
  }
  pool = new Pool({ connectionString: container.getConnectionUri() });
  db = drizzle(pool, { schema });
}, 120_000);

afterAll(async () => {
  await pool?.end();
  await container?.stop();
});

beforeEach(async () => {
  await pool.query(DROP_SQL);
  await pool.query(CREATE_SQL);
});

describe('account-deletion cascade — transactional atomicity (real Postgres)', () => {
  it('a step failing mid-cascade rolls back EVERY step already run, and a clean retry then leaves zero rows', async () => {
    await seedFullAccount(USER_A);
    // Sanity: seeding landed before we force a failure.
    expect(await countRows('aforce_whoop_tokens', USER_A)).toBe(1);
    expect(await countRows('aforce_garmin_auth_states', USER_A)).toBe(1);
    expect(await readBiometrics(USER_A)).not.toBeNull();

    // Force the LAST step (health-records purge) to fail with a REAL SQL
    // error by dropping its table out from under the cascade. Steps 1-3
    // (all four token clears, all four auth-state deletes, the
    // biometrics NULL) run first, inside the same transaction.
    await pool.query('DROP TABLE "aforce_health_records" CASCADE');

    await expect(
      deleteHealthDataTransactional(db, USER_A),
    ).rejects.toThrow();

    // THE ATOMICITY PROOF: none of steps 1-3 survived, even though their
    // individual statements executed without error before the failure.
    for (const table of [
      'aforce_whoop_tokens',
      'aforce_garmin_tokens',
      'aforce_oura_tokens',
      'aforce_strava_tokens',
      'aforce_whoop_auth_states',
      'aforce_garmin_auth_states',
      'aforce_oura_auth_states',
      'aforce_strava_auth_states',
    ]) {
      expect(await countRows(table, USER_A)).toBe(1);
    }
    expect(await readBiometrics(USER_A)).toEqual({
      whoop: { providerId: 'whoop', fetchedAt: 1 },
      garmin: { providerId: 'garmin', fetchedAt: 1 },
      oura: { providerId: 'oura', fetchedAt: 1 },
      strava: { providerId: 'strava', fetchedAt: 1 },
    });

    // Restore the table (the caller's retry hits a healthy DB — the
    // outage that caused step 4 to fail is transient in the real world:
    // pool exhaustion, a deploy blip, etc.) and retry the SAME cascade.
    await pool.query(CREATE_HEALTH_RECORDS_SQL);
    await createHealthRecordsRepo(db).upsertRecords([
      healthRecord({ userId: USER_A, provider: 'oura' }),
    ]);

    const retry = await deleteHealthDataTransactional(db, USER_A);
    expect(retry.purged).toBe(1);

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
  });

  it('never touches another user while the fault is in effect', async () => {
    const USER_B = 'user_txn_cascade_b';
    await seedFullAccount(USER_A);
    await seedFullAccount(USER_B);

    await pool.query('DROP TABLE "aforce_health_records" CASCADE');
    await expect(
      deleteHealthDataTransactional(db, USER_A),
    ).rejects.toThrow();

    // A rolled back for user A...
    expect(await countRows('aforce_whoop_tokens', USER_A)).toBe(1);
    // ...and B was never touched by A's (failed) cascade.
    expect(await countRows('aforce_whoop_tokens', USER_B)).toBe(1);
    expect(await readBiometrics(USER_B)).not.toBeNull();
  });
});
