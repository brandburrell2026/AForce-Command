/**
 * Contract A rollback — integration test (Section 18, tracked in TESTING_TODO.md).
 *
 * Proves EMPIRICALLY (not by inspection) that `recordMajorChange`'s mint is
 * atomic: when the final write fails, the whole transaction rolls back and the
 * profile-versioning tables are left exactly as they were.
 *
 * Setup: a REAL, ephemeral Postgres via Testcontainers (Docker required). The
 * five writes are version → archive-prior-baseline → new-baseline → pointer →
 * change-log; we force WRITE 5 to fail by DROPPING `aforce_profile_change_log`
 * before the mint, then assert WRITES 1–4 left no trace.
 *
 * This is NOT in the fast unit suite — it runs only via `pnpm test:integration`
 * (separate config; Docker-gated). Requires Docker running.
 *
 * Uses a TEST-LOCAL pg.Pool + drizzle pointed at the container — never the
 * `@workspace/db` singleton (which reads process.env.DATABASE_URL).
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from '../schema';
import { createDrizzleProfileRepo, type ProfileRepo } from '../profileRepo';

const { Pool } = pg;

// DDL for just the four profile tables + their indexes (drizzle-kit is kept
// out of the test loop). Mirrors lib/db/src/schema/aforce.ts.
const CREATE_SQL = `
CREATE TABLE "aforce_user_profiles" (
  "user_id" text PRIMARY KEY NOT NULL,
  "current_profile_version_id" integer,
  "current_baseline_version_id" integer,
  "last_calibration_at" timestamp with time zone,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE "aforce_profile_versions" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "version_number" integer NOT NULL,
  "snapshot" jsonb NOT NULL,
  "changed_fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "client_change_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX "aforce_profile_versions_user_version_idx" ON "aforce_profile_versions" ("user_id","version_number");
CREATE UNIQUE INDEX "aforce_profile_versions_user_client_uq" ON "aforce_profile_versions" ("user_id","client_change_id");
CREATE TABLE "aforce_baseline_versions" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "profile_version_id" integer NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "confidence" real NOT NULL,
  "observation_count" integer DEFAULT 0 NOT NULL,
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "archived_at" timestamp with time zone,
  "targets" jsonb
);
CREATE INDEX "aforce_baseline_versions_user_status_idx" ON "aforce_baseline_versions" ("user_id","status");
CREATE TABLE "aforce_profile_change_log" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "profile_version_id" integer,
  "baseline_version_id" integer,
  "change_type" text NOT NULL,
  "changed_fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "explanation" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX "aforce_profile_change_log_user_time_idx" ON "aforce_profile_change_log" ("user_id","created_at");
`;

const DROP_SQL = `
DROP TABLE IF EXISTS "aforce_profile_change_log" CASCADE;
DROP TABLE IF EXISTS "aforce_baseline_versions" CASCADE;
DROP TABLE IF EXISTS "aforce_profile_versions" CASCADE;
DROP TABLE IF EXISTS "aforce_user_profiles" CASCADE;
`;

const USER = 'user_rollback_test';

function majorInput(over: Partial<Parameters<ProfileRepo['recordMajorChange']>[0]> = {}) {
  return {
    userId: USER,
    snapshot: { weightLbs: 200 },
    changedFields: ['weightLbs'],
    explanation: 'recalibrated',
    initialConfidence: 0.5,
    ...over,
  };
}

let container: StartedPostgreSqlContainer;
let pool: InstanceType<typeof Pool>;
let db: NodePgDatabase<typeof schema>;
let repo: ProfileRepo;

async function count(table: string): Promise<number> {
  const r = await pool.query(`SELECT count(*)::int AS n FROM "${table}" WHERE user_id = $1`, [USER]);
  return r.rows[0]?.n ?? 0;
}

beforeAll(async () => {
  try {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
  } catch (err) {
    throw new Error(
      'Docker is required for the rollback integration test (Testcontainers). ' +
        'Start Docker and re-run `pnpm test:integration`. Original error: ' +
        (err as Error).message,
    );
  }
  pool = new Pool({ connectionString: container.getConnectionUri() });
  db = drizzle(pool, { schema });
  repo = createDrizzleProfileRepo(db);
}, 120_000);

afterAll(async () => {
  await pool?.end();
  await container?.stop();
});

beforeEach(async () => {
  // Fresh schema per test so cases can't leak into each other.
  await pool.query(DROP_SQL);
  await pool.query(CREATE_SQL);
});

describe('Contract A — recordMajorChange rolls back atomically when WRITE 5 fails', () => {
  it('Case 1 — first-mint rollback leaves zero rows in all four tables', async () => {
    // Force WRITE 5 (change-log insert) to fail.
    await pool.query('DROP TABLE "aforce_profile_change_log" CASCADE');

    await expect(repo.recordMajorChange(majorInput())).rejects.toThrow();

    // WRITES 1–4 must have rolled back: nothing persisted.
    expect(await count('aforce_profile_versions')).toBe(0);
    expect(await count('aforce_baseline_versions')).toBe(0);
    expect(await count('aforce_user_profiles')).toBe(0);
  });

  it('Case 2 — failed recalibration leaves v1 baseline ACTIVE and the pointer unchanged', async () => {
    // Seed a complete v1: version + active baseline + pointer (change-log present).
    const v1 = await repo.recordMajorChange(majorInput({ initialConfidence: 0.5 }));
    expect(v1.minted).toBe(true);
    expect(v1.pointers.versionNumber).toBe(1);

    // Now force the v2 mint's WRITE 5 to fail.
    await pool.query('DROP TABLE "aforce_profile_change_log" CASCADE');

    await expect(
      repo.recordMajorChange(
        majorInput({ snapshot: { weightLbs: 185 }, initialConfidence: 0.35 }),
      ),
    ).rejects.toThrow();

    // The critical integrity proof — WRITES 1–4 of the v2 mint all rolled back:
    //  • no v2 version row (still exactly one version)
    expect(await count('aforce_profile_versions')).toBe(1);
    //  • no new baseline row (still exactly one baseline)
    expect(await count('aforce_baseline_versions')).toBe(1);
    //  • WRITE 2's archive was undone — v1's baseline is still active
    const baseline = await pool.query(
      'SELECT id, status FROM "aforce_baseline_versions" WHERE user_id = $1',
      [USER],
    );
    expect(baseline.rows[0].id).toBe(v1.pointers.baselineVersionId);
    expect(baseline.rows[0].status).toBe('active');
    //  • the pointer still points at v1's baseline — user never left with no active baseline
    const profile = await pool.query(
      'SELECT current_baseline_version_id, current_profile_version_id FROM "aforce_user_profiles" WHERE user_id = $1',
      [USER],
    );
    expect(profile.rows[0].current_baseline_version_id).toBe(v1.pointers.baselineVersionId);
    expect(profile.rows[0].current_profile_version_id).toBe(v1.pointers.profileVersionId);
  });
});
