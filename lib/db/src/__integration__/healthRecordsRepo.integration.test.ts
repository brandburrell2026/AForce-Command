/**
 * Canonical health-record repository — integration test (Lane F3).
 *
 * Proves EMPIRICALLY (not by inspection) against a REAL, ephemeral Postgres
 * via Testcontainers (Docker required) that `healthRecordsRepo.ts` upholds
 * its stated contract:
 *   - idempotent upsert keyed on `deduplicationKey`, newer `syncedAt` wins
 *   - user/provider isolation (an op scoped to one user/provider never
 *     touches another)
 *   - disconnect tombstone semantics (soft delete, excluded by default,
 *     retrievable with `includeTombstoned`)
 *   - account-deletion purge (hard delete, idempotent)
 *   - atomicity of a multi-record upsert batch — one bad record in the batch
 *     must roll back the WHOLE batch, never a partial write
 *
 * Mirrors `profileRepo.rollback.integration.test.ts`: real Postgres pinned to
 * the same image tag, hand-written DDL (this repo has no migration files —
 * `drizzle-kit push` applies the schema directly), fresh schema per test via
 * `beforeEach`, and a TEST-LOCAL pg.Pool + drizzle instance — never the
 * `@workspace/db` singleton (which reads `process.env.DATABASE_URL`).
 *
 * NOT in the fast unit suite — runs only via `pnpm test:integration`
 * (separate config; Docker-gated). Requires Docker running.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from '../schema';
import { createHealthRecordsRepo, type HealthRecordsRepo } from '../healthRecordsRepo';
import type { CanonicalHealthRecord } from '@workspace/health-core';

const { Pool } = pg;

// DDL for just aforce_health_records + its indexes (drizzle-kit is kept out
// of the test loop). Mirrors lib/db/src/schema/aforce.ts.
const CREATE_SQL = `
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
CREATE INDEX "aforce_health_records_user_metric_observed_idx" ON "aforce_health_records" ("user_id","metric_type","observed_at" DESC);
CREATE INDEX "aforce_health_records_user_provider_idx" ON "aforce_health_records" ("user_id","provider");
CREATE INDEX "aforce_health_records_live_only_idx" ON "aforce_health_records" ("user_id","metric_type","observed_at") WHERE "deleted_at" IS NULL;
`;

const DROP_SQL = `DROP TABLE IF EXISTS "aforce_health_records" CASCADE;`;

const USER_A = 'user_health_a';
const USER_B = 'user_health_b';

let seq = 0;
function record(over: Partial<CanonicalHealthRecord> = {}): CanonicalHealthRecord {
  seq += 1;
  const userId = over.userId ?? USER_A;
  const provider = over.provider ?? 'whoop';
  const metricType = over.metricType ?? 'hrv';
  const observedAt = over.observedAt ?? `2026-08-0${(seq % 9) + 1}T06:00:00.000Z`;
  return {
    schemaVersion: 1,
    userId,
    provider,
    metricType,
    value: 55,
    unit: 'ms',
    observedAt,
    syncedAt: '2026-08-03T12:00:00.000Z',
    hrvMethod: 'rmssd',
    provenanceChain: [{ provider, transport: 'cloud_api' }],
    deduplicationKey: `${userId}|${metricType}|${provider}|seq:${seq}`,
    ...over,
  };
}

let container: StartedPostgreSqlContainer;
let pool: InstanceType<typeof Pool>;
let db: NodePgDatabase<typeof schema>;
let repo: HealthRecordsRepo;

async function rawCount(userId: string): Promise<number> {
  const r = await pool.query(
    'SELECT count(*)::int AS n FROM "aforce_health_records" WHERE user_id = $1',
    [userId],
  );
  return r.rows[0]?.n ?? 0;
}

beforeAll(async () => {
  try {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
  } catch (err) {
    throw new Error(
      'Docker is required for the health-records integration test (Testcontainers). ' +
        'Start Docker and re-run `pnpm test:integration`. Original error: ' +
        (err as Error).message,
    );
  }
  pool = new Pool({ connectionString: container.getConnectionUri() });
  db = drizzle(pool, { schema });
  repo = createHealthRecordsRepo(db);
}, 120_000);

afterAll(async () => {
  await pool?.end();
  await container?.stop();
});

beforeEach(async () => {
  seq = 0;
  // Fresh schema per test so cases can't leak into each other.
  await pool.query(DROP_SQL);
  await pool.query(CREATE_SQL);
});

describe('healthRecordsRepo — forward create+read roundtrip', () => {
  it('upserts a record and reads it back with equivalent fields', async () => {
    const rec = record({
      metricType: 'hrv',
      value: 62,
      unit: 'ms',
      startTime: '2026-08-03T05:00:00.000Z',
      endTime: '2026-08-03T05:05:00.000Z',
    });

    const result = await repo.upsertRecords([rec]);
    expect(result.upserted).toBe(1);

    const rows = await repo.listRecords(rec.userId);
    expect(rows).toHaveLength(1);
    const got = rows[0]!;
    expect(got.deduplicationKey).toBe(rec.deduplicationKey);
    expect(got.userId).toBe(rec.userId);
    expect(got.provider).toBe(rec.provider);
    expect(got.metricType).toBe(rec.metricType);
    expect(got.value).toBe(rec.value);
    expect(got.unit).toBe(rec.unit);
    expect(got.hrvMethod).toBe(rec.hrvMethod);
    expect(got.observedAt).toBe(rec.observedAt);
    expect(got.syncedAt).toBe(rec.syncedAt);
    expect(got.startTime).toBe(rec.startTime);
    expect(got.endTime).toBe(rec.endTime);
    expect(got.provenanceChain).toEqual(rec.provenanceChain);
  });
});

describe('healthRecordsRepo — duplicate-ingestion idempotency', () => {
  it('the same batch submitted twice leaves the row count unchanged', async () => {
    const rec = record();

    const first = await repo.upsertRecords([rec]);
    expect(first.upserted).toBe(1);

    // Exact replay — same syncedAt. Per the newer-wins contract this must
    // be a no-op against the existing row: upserted count is 0, and the
    // table still holds exactly one row.
    const second = await repo.upsertRecords([rec]);
    expect(second.upserted).toBe(0);
    expect(await rawCount(rec.userId)).toBe(1);
  });

  it('a newer syncedAt updates the existing row in place (no duplicate)', async () => {
    const rec = record({ value: 55 });
    await repo.upsertRecords([rec]);

    const newer: CanonicalHealthRecord = {
      ...rec,
      value: 71,
      syncedAt: '2026-08-03T13:00:00.000Z', // strictly newer
    };
    const result = await repo.upsertRecords([newer]);
    expect(result.upserted).toBe(1);
    expect(await rawCount(rec.userId)).toBe(1);

    const rows = await repo.listRecords(rec.userId);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.value).toBe(71);
    expect(rows[0]!.syncedAt).toBe('2026-08-03T13:00:00.000Z');
  });

  it('an OLDER syncedAt replay never clobbers the fresher stored row', async () => {
    const rec = record({ value: 55, syncedAt: '2026-08-03T13:00:00.000Z' });
    await repo.upsertRecords([rec]);

    const stale: CanonicalHealthRecord = {
      ...rec,
      value: 999,
      syncedAt: '2026-08-03T09:00:00.000Z', // older than stored
    };
    const result = await repo.upsertRecords([stale]);
    expect(result.upserted).toBe(0);

    const rows = await repo.listRecords(rec.userId);
    expect(rows[0]!.value).toBe(55);
  });
});

describe('healthRecordsRepo — provider/user isolation', () => {
  it('an op scoped to one user never touches another user\'s rows', async () => {
    const a1 = record({ userId: USER_A, provider: 'whoop' });
    const b1 = record({ userId: USER_B, provider: 'whoop' });
    await repo.upsertRecords([a1, b1]);

    await repo.tombstoneProvider(USER_A, 'whoop');

    const aRows = await repo.listRecords(USER_A);
    const bRows = await repo.listRecords(USER_B);
    expect(aRows).toHaveLength(0); // tombstoned, excluded by default
    expect(bRows).toHaveLength(1); // untouched

    await repo.purgeUser(USER_A);
    expect(await rawCount(USER_A)).toBe(0);
    expect(await rawCount(USER_B)).toBe(1); // purge never crosses users
  });

  it('a provider tombstone is scoped to that provider only', async () => {
    const whoopRec = record({ userId: USER_A, provider: 'whoop' });
    const ouraRec = record({ userId: USER_A, provider: 'oura' });
    await repo.upsertRecords([whoopRec, ouraRec]);

    await repo.tombstoneProvider(USER_A, 'whoop');

    const rows = await repo.listRecords(USER_A);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.provider).toBe('oura');
  });
});

describe('healthRecordsRepo — disconnect tombstone semantics', () => {
  it('tombstoned rows are excluded by default and retrievable with the flag', async () => {
    const rec = record();
    await repo.upsertRecords([rec]);

    const tombstoneResult = await repo.tombstoneProvider(rec.userId, rec.provider);
    expect(tombstoneResult.tombstoned).toBe(1);

    const defaultRows = await repo.listRecords(rec.userId);
    expect(defaultRows).toHaveLength(0);

    const allRows = await repo.listRecords(rec.userId, { includeTombstoned: true });
    expect(allRows).toHaveLength(1);
    expect(allRows[0]!.deduplicationKey).toBe(rec.deduplicationKey);

    const counts = await repo.counts(rec.userId);
    expect(counts).toEqual({ total: 1, live: 0, tombstoned: 1 });

    // Re-tombstoning an already-tombstoned provider is a no-op (guarded by
    // the deletedAt IS NULL predicate) — not double-counted.
    const again = await repo.tombstoneProvider(rec.userId, rec.provider);
    expect(again.tombstoned).toBe(0);
  });
});

describe('healthRecordsRepo — account-deletion purge', () => {
  it('removes every row for the user and is idempotent on repeat', async () => {
    const recs = [
      record({ userId: USER_A, provider: 'whoop' }),
      record({ userId: USER_A, provider: 'oura' }),
    ];
    await repo.upsertRecords(recs);
    expect(await rawCount(USER_A)).toBe(2);

    const first = await repo.purgeUser(USER_A);
    expect(first.purged).toBe(2);
    expect(await rawCount(USER_A)).toBe(0);

    const second = await repo.purgeUser(USER_A);
    expect(second.purged).toBe(0);

    const counts = await repo.counts(USER_A);
    expect(counts).toEqual({ total: 0, live: 0, tombstoned: 0 });
  });
});

describe('healthRecordsRepo — rollback validation (batch atomicity)', () => {
  it('one invalid record in a batch rolls back the WHOLE batch — no partial write', async () => {
    const good1 = record({ userId: USER_A });
    const good2 = record({ userId: USER_A });
    // Force a NOT NULL violation on schema_version at the DB level. The
    // batch is a single multi-row INSERT statement, so Postgres wraps it in
    // an implicit transaction: either every row lands, or none do. This is
    // the same "no split-brain write" contract profileRepo's Contract A
    // proves for its 5-write transaction, applied here to a 1-statement
    // batch upsert.
    const bad = record({
      userId: USER_A,
      schemaVersion: null as unknown as number,
    });

    await expect(repo.upsertRecords([good1, good2, bad])).rejects.toThrow();

    // Neither of the two otherwise-valid records in the same batch was
    // persisted — the failure rolled back the entire statement.
    expect(await rawCount(USER_A)).toBe(0);
  });
});
