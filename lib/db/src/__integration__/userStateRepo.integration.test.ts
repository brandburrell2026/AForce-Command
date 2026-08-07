/**
 * `UserStateRepo.readProviderEntry` — integration test (Founder Ruling C,
 * RC-2 arbitration freshness, 2026-08-06).
 *
 * Proves EMPIRICALLY (not by inspection) against a REAL, ephemeral
 * Postgres via Testcontainers (Docker required) the read-before-write
 * contract `providerKit/fetchWorker.ts`'s `runOnce` now performs on
 * EVERY sweep: read the stored provider entry via jsonb `->`, decide
 * whether the newly fetched content is unchanged, then write with
 * either the preserved or the fresh `fetchedAt`.
 *
 * `writeProviderEntry` (jsonb_set) already had real-Postgres coverage
 * in `artifacts/api-server/src/__tests__/whoopFetchWorker.drizzle.test.ts`
 * — but that file lives under `__tests__`, not `__integration__`, so it
 * is NOT part of this Docker-gated suite; it only runs against whatever
 * `DATABASE_URL` the fast unit config happens to have (unset locally and
 * in CI's `tests-baseline` job, by design — see that file's own header).
 * `readProviderEntry` is new in this PR and had no real-Postgres exercise
 * anywhere until this file. This is the one place in CI that actually
 * dials a real Postgres for it.
 *
 * `createDrizzleUserStateRepo` itself lives in
 * `artifacts/api-server/src/lib/providerKit/userStateRepo.ts`, not
 * `@workspace/db` — this package must not depend on an application that
 * depends on it (same constraint `providerCleanup.integration.test.ts`
 * documents for `removeProviderSnapshotEntry`). The two local helpers
 * below are byte-for-byte mirrors of that file's `writeProviderEntry` /
 * `readProviderEntry` (same `jsonb_set` / `->` operators, same
 * parameterized `text[]` / `::text` casts).
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
import { eq, sql } from 'drizzle-orm';
import pg from 'pg';
import * as schema from '../schema';
import { aforceUserState } from '../schema/aforce';

const { Pool } = pg;

// Trimmed to the two columns `writeProviderEntry`/`readProviderEntry`
// actually touch (user_id, biometrics) — same rationale as
// `providerCleanup.integration.test.ts`'s DDL.
const CREATE_SQL = `
CREATE TABLE "aforce_user_state" (
  "user_id" text PRIMARY KEY NOT NULL,
  "biometrics" jsonb
);
`;

const DROP_SQL = `DROP TABLE IF EXISTS "aforce_user_state" CASCADE;`;

let container: StartedPostgreSqlContainer;
let pool: InstanceType<typeof Pool>;
let db: NodePgDatabase<typeof schema>;

/**
 * Byte-for-byte mirror of `createDrizzleUserStateRepo` in
 * `artifacts/api-server/src/lib/providerKit/userStateRepo.ts` — see this
 * file's module doc for why it's duplicated rather than imported.
 */
async function writeProviderEntry(
  userId: string,
  providerKey: string,
  entry: Record<string, unknown>,
): Promise<boolean> {
  const updated = await db
    .update(aforceUserState)
    .set({
      biometrics: sql`jsonb_set(
        COALESCE(${aforceUserState.biometrics}, '{}'::jsonb),
        ARRAY[${providerKey}]::text[],
        ${JSON.stringify(entry)}::jsonb,
        true
      )` as never,
    })
    .where(eq(aforceUserState.userId, userId))
    .returning({ id: aforceUserState.userId });
  return updated.length > 0;
}

async function readProviderEntry(
  userId: string,
  providerKey: string,
): Promise<Record<string, unknown> | null> {
  const rows = await db
    .select({
      entry: sql<Record<
        string,
        unknown
      > | null>`${aforceUserState.biometrics} -> ${providerKey}::text`,
    })
    .from(aforceUserState)
    .where(eq(aforceUserState.userId, userId))
    .limit(1);
  return rows[0]?.entry ?? null;
}

beforeAll(async () => {
  try {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
  } catch (err) {
    throw new Error(
      'Docker is required for the userStateRepo integration test (Testcontainers). ' +
        'Start Docker (Colima on this Mac) and re-run `pnpm test:integration`. Original error: ' +
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

describe('createDrizzleUserStateRepo.readProviderEntry — real Postgres jsonb `->`', () => {
  it('returns null when no state row exists for the user', async () => {
    const entry = await readProviderEntry('user_read_none', 'whoop');
    expect(entry).toBeNull();
  });

  it('returns null when the row exists but biometrics is NULL', async () => {
    await pool.query(
      `INSERT INTO "aforce_user_state" (user_id, biometrics) VALUES ($1, NULL)`,
      ['user_read_null_blob'],
    );
    const entry = await readProviderEntry('user_read_null_blob', 'whoop');
    expect(entry).toBeNull();
  });

  it('returns null when biometrics exists but has no entry for this provider key', async () => {
    await pool.query(
      `INSERT INTO "aforce_user_state" (user_id, biometrics) VALUES ($1, $2)`,
      [
        'user_read_other_only',
        JSON.stringify({
          samsung_health: { providerId: 'samsung_health', fetchedAt: 1 },
        }),
      ],
    );
    const entry = await readProviderEntry('user_read_other_only', 'whoop');
    expect(entry).toBeNull();
  });

  it('returns the exact stored entry once one exists, and reflects the LATEST write (the exact read-before-write sequence runOnce performs every sweep)', async () => {
    const userId = 'user_read_roundtrip';
    await pool.query(`INSERT INTO "aforce_user_state" (user_id) VALUES ($1)`, [
      userId,
    ]);

    const beforeWrite = await readProviderEntry(userId, 'whoop');
    expect(beforeWrite).toBeNull();

    const ok1 = await writeProviderEntry(userId, 'whoop', {
      providerId: 'whoop',
      fetchedAt: 1_000,
      recoveryPct: 80,
    });
    expect(ok1).toBe(true);
    const afterFirstWrite = await readProviderEntry(userId, 'whoop');
    expect(afterFirstWrite).toEqual({
      providerId: 'whoop',
      fetchedAt: 1_000,
      recoveryPct: 80,
    });

    // This is Founder Ruling C's core sequence: `runOnce` reads the
    // stored entry, decides the new content is unchanged, and (in this
    // repo's real code) would write back with the SAME fetchedAt rather
    // than a fresh one. Proving here that a second write with a
    // DIFFERENT fetchedAt is visible on the next read confirms the read
    // side of that contract is not stale/cached against real Postgres.
    const ok2 = await writeProviderEntry(userId, 'whoop', {
      providerId: 'whoop',
      fetchedAt: 1_000, // preserved, as `resolveProviderFetchedAt` would do
      recoveryPct: 80, // unchanged content
    });
    expect(ok2).toBe(true);
    const afterPreservedWrite = await readProviderEntry(userId, 'whoop');
    expect(afterPreservedWrite).toEqual({
      providerId: 'whoop',
      fetchedAt: 1_000,
      recoveryPct: 80,
    });

    const ok3 = await writeProviderEntry(userId, 'whoop', {
      providerId: 'whoop',
      fetchedAt: 2_000, // advanced — content genuinely changed
      recoveryPct: 55,
    });
    expect(ok3).toBe(true);
    const afterChangedWrite = await readProviderEntry(userId, 'whoop');
    expect(afterChangedWrite).toEqual({
      providerId: 'whoop',
      fetchedAt: 2_000,
      recoveryPct: 55,
    });
  });

  it('reads only the targeted provider key — a sibling key in the same blob is invisible to it', async () => {
    const userId = 'user_read_sibling';
    await pool.query(
      `INSERT INTO "aforce_user_state" (user_id, biometrics) VALUES ($1, $2)`,
      [
        userId,
        JSON.stringify({
          whoop: { providerId: 'whoop', fetchedAt: 1_000, recoveryPct: 80 },
          oura: { providerId: 'oura', fetchedAt: 2_000, readinessScore: 90 },
        }),
      ],
    );
    const whoopEntry = await readProviderEntry(userId, 'whoop');
    const ouraEntry = await readProviderEntry(userId, 'oura');
    const garminEntry = await readProviderEntry(userId, 'garmin');
    expect(whoopEntry).toEqual({
      providerId: 'whoop',
      fetchedAt: 1_000,
      recoveryPct: 80,
    });
    expect(ouraEntry).toEqual({
      providerId: 'oura',
      fetchedAt: 2_000,
      readinessScore: 90,
    });
    expect(garminEntry).toBeNull();
  });
});
