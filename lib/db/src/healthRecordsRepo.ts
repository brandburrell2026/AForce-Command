/**
 * Canonical health-record repository (Lane F3) — pure persistence layer.
 *
 * Framework-free: no Express, no auth, no provider-fetch code. Normalization
 * and dedup live in `@workspace/health-core`; providerKit (F6) is the future
 * caller that turns provider payloads into `CanonicalHealthRecord[]` and
 * hands them to `upsertRecords`. This module only persists the result.
 *
 * Idempotency contract: `upsertRecords` keys on `id` (= the record's
 * `deduplicationKey`, see health-core's `buildDeduplicationKey`). A row is
 * only overwritten when the incoming `syncedAt` is strictly newer than the
 * stored one — an older or equal-age replay is a no-op against an existing
 * row (`ON CONFLICT ... DO UPDATE ... WHERE stored.synced_at < excluded.synced_at`).
 * This makes re-ingestion (retries, re-syncs, out-of-order delivery) safe by
 * construction: the same batch submitted twice never duplicates rows and
 * never lets a stale payload clobber a fresher one.
 *
 * Deletion has two tiers, matching the DeletionStatus vocabulary in
 * health-core/contracts.ts:
 *   - `tombstoneProvider` (disconnect) — SOFT delete. Sets `deletedAt`;
 *     rows survive for historical readiness/recovery context and are
 *     excluded from `listRecords` by default. Re-connecting the same
 *     provider does NOT auto-resurrect tombstoned rows — a fresh sync only
 *     lands new/updated rows via `upsertRecords`, which never touches
 *     `deletedAt`.
 *   - `purgeUser` (account deletion) — HARD delete. Removes every row for
 *     the user, tombstoned or not. Idempotent: purging twice is a no-op the
 *     second time.
 *
 * Architecture lock: DORMANT / hidden-infra. No provider-fetch route writes
 * here yet (F6 lands the ingestion path); this repo is the persistence
 * contract it will call into.
 */

import { and, desc, eq, gte, isNull, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type {
  CanonicalHealthMetricType,
  CanonicalHealthRecord,
  CanonicalHealthValue,
  HealthConfidence,
  HealthProviderId,
  HrvMethod,
  ProviderScoreKind,
  ProvenanceHop,
} from "@workspace/health-core";
import { originOf } from "@workspace/health-core";
import {
  aforceHealthRecords,
  type AforceHealthRecordRow,
  type InsertAforceHealthRecord,
} from "./schema/aforce";

export interface ListRecordsOptions {
  metricType?: CanonicalHealthMetricType;
  /** ISO-8601 lower bound (inclusive) on `observedAt`. */
  since?: string;
  /** When false/omitted (default), tombstoned rows are excluded. */
  includeTombstoned?: boolean;
}

export interface HealthRecordCounts {
  total: number;
  live: number;
  tombstoned: number;
}

export interface UpsertRecordsResult {
  /** Rows actually inserted or updated. A replay that loses the
   *  newer-synced-wins check contributes 0, even though the record
   *  "already exists" — see the module doc for why that's correct. */
  upserted: number;
}

export interface TombstoneProviderResult {
  /** Rows newly tombstoned by this call (already-tombstoned rows are not
   *  re-counted — see the WHERE deletedAt IS NULL guard). */
  tombstoned: number;
}

export interface PurgeUserResult {
  /** Rows hard-deleted by this call. 0 on a repeat purge. */
  purged: number;
}

export interface HealthRecordsRepo {
  /** Idempotent bulk upsert, keyed on `deduplicationKey`. Newer `syncedAt`
   *  wins; ties and older replays are no-ops against the stored row. */
  upsertRecords(records: CanonicalHealthRecord[]): Promise<UpsertRecordsResult>;
  /** Newest-first by `observedAt`. Excludes tombstoned rows unless
   *  `includeTombstoned` is set. */
  listRecords(
    userId: string,
    opts?: ListRecordsOptions,
  ): Promise<CanonicalHealthRecord[]>;
  /** Disconnect semantics — soft delete (tombstone), scoped to one provider. */
  tombstoneProvider(
    userId: string,
    provider: HealthProviderId,
  ): Promise<TombstoneProviderResult>;
  /** Account-deletion hook — hard delete, ALL of a user's rows regardless
   *  of tombstone state. */
  purgeUser(userId: string): Promise<PurgeUserResult>;
  counts(userId: string): Promise<HealthRecordCounts>;
}

function toRow(r: CanonicalHealthRecord): InsertAforceHealthRecord {
  return {
    id: r.deduplicationKey,
    userId: r.userId,
    provider: r.provider,
    origin: originOf(r),
    metricType: r.metricType,
    externalId: r.externalId ?? null,
    schemaVersion: r.schemaVersion,
    value: r.value,
    unit: r.unit ?? null,
    startUtc: r.startTime ? new Date(r.startTime) : null,
    endUtc: r.endTime ? new Date(r.endTime) : null,
    observedAt: new Date(r.observedAt),
    syncedAt: new Date(r.syncedAt),
    fetchedAt: r.fetchedAt ? new Date(r.fetchedAt) : null,
    hrvMethod: r.hrvMethod ?? null,
    scoreKind: r.scoreKind ?? null,
    confidence: r.confidence ?? null,
    provenanceChain: r.provenanceChain,
    originalSource: r.originalSource ?? null,
    device: r.device ?? null,
  };
}

function fromRow(row: AforceHealthRecordRow): CanonicalHealthRecord {
  return {
    schemaVersion: row.schemaVersion,
    userId: row.userId,
    provider: row.provider as HealthProviderId,
    originalSource: row.originalSource ?? undefined,
    device: row.device ?? undefined,
    externalId: row.externalId ?? undefined,
    metricType: row.metricType as CanonicalHealthMetricType,
    value: row.value as CanonicalHealthValue,
    unit: row.unit ?? undefined,
    startTime: row.startUtc ? row.startUtc.toISOString() : undefined,
    endTime: row.endUtc ? row.endUtc.toISOString() : undefined,
    observedAt: row.observedAt.toISOString(),
    syncedAt: row.syncedAt.toISOString(),
    fetchedAt: row.fetchedAt ? row.fetchedAt.toISOString() : undefined,
    hrvMethod: (row.hrvMethod as HrvMethod | null) ?? undefined,
    scoreKind: (row.scoreKind as ProviderScoreKind | null) ?? undefined,
    confidence: (row.confidence as HealthConfidence | null) ?? undefined,
    provenanceChain: row.provenanceChain as ProvenanceHop[],
    deduplicationKey: row.id,
  };
}

export function createHealthRecordsRepo(
  db: NodePgDatabase<Record<string, unknown>>,
): HealthRecordsRepo {
  return {
    async upsertRecords(records) {
      if (records.length === 0) return { upserted: 0 };

      // Collapse duplicate ids WITHIN the batch itself before the single
      // multi-row INSERT: Postgres rejects an INSERT ... ON CONFLICT DO
      // UPDATE that targets the same conflict row twice in one statement
      // ("ON CONFLICT DO UPDATE command cannot affect row a second time").
      // Keep the freshest by syncedAt — the same newer-wins policy the
      // per-row DB guard enforces against the EXISTING row below.
      const byId = new Map<string, CanonicalHealthRecord>();
      for (const r of records) {
        const existing = byId.get(r.deduplicationKey);
        if (!existing || existing.syncedAt < r.syncedAt) {
          byId.set(r.deduplicationKey, r);
        }
      }
      const rows = Array.from(byId.values()).map(toRow);

      const result = await db
        .insert(aforceHealthRecords)
        .values(rows)
        .onConflictDoUpdate({
          target: aforceHealthRecords.id,
          set: {
            userId: sql`excluded.user_id`,
            provider: sql`excluded.provider`,
            origin: sql`excluded.origin`,
            metricType: sql`excluded.metric_type`,
            externalId: sql`excluded.external_id`,
            schemaVersion: sql`excluded.schema_version`,
            value: sql`excluded.value`,
            unit: sql`excluded.unit`,
            startUtc: sql`excluded.start_utc`,
            endUtc: sql`excluded.end_utc`,
            observedAt: sql`excluded.observed_at`,
            syncedAt: sql`excluded.synced_at`,
            fetchedAt: sql`excluded.fetched_at`,
            hrvMethod: sql`excluded.hrv_method`,
            scoreKind: sql`excluded.score_kind`,
            confidence: sql`excluded.confidence`,
            provenanceChain: sql`excluded.provenance_chain`,
            originalSource: sql`excluded.original_source`,
            device: sql`excluded.device`,
            // deletedAt is deliberately NOT in this set list — a provider
            // sync must never resurrect a tombstoned row (see module doc).
            updatedAt: sql`now()`,
          },
          // Newer-wins: if the stored row is already at or ahead of the
          // incoming syncedAt, this predicate is false and Postgres treats
          // the conflict as a no-op (no update, no RETURNING row) — the
          // idempotent-replay case.
          setWhere: sql`${aforceHealthRecords.syncedAt} < excluded.synced_at`,
        })
        .returning({ id: aforceHealthRecords.id });

      return { upserted: result.length };
    },

    async listRecords(userId, opts = {}) {
      const conditions = [eq(aforceHealthRecords.userId, userId)];
      if (opts.metricType) {
        conditions.push(eq(aforceHealthRecords.metricType, opts.metricType));
      }
      if (opts.since) {
        conditions.push(gte(aforceHealthRecords.observedAt, new Date(opts.since)));
      }
      if (!opts.includeTombstoned) {
        conditions.push(isNull(aforceHealthRecords.deletedAt));
      }
      const rows = await db
        .select()
        .from(aforceHealthRecords)
        .where(and(...conditions))
        .orderBy(desc(aforceHealthRecords.observedAt));
      return rows.map(fromRow);
    },

    async tombstoneProvider(userId, provider) {
      const result = await db
        .update(aforceHealthRecords)
        .set({ deletedAt: sql`now()`, updatedAt: sql`now()` })
        .where(
          and(
            eq(aforceHealthRecords.userId, userId),
            eq(aforceHealthRecords.provider, provider),
            isNull(aforceHealthRecords.deletedAt),
          ),
        )
        .returning({ id: aforceHealthRecords.id });
      return { tombstoned: result.length };
    },

    async purgeUser(userId) {
      const result = await db
        .delete(aforceHealthRecords)
        .where(eq(aforceHealthRecords.userId, userId))
        .returning({ id: aforceHealthRecords.id });
      return { purged: result.length };
    },

    async counts(userId) {
      const rows = await db
        .select({
          total: sql<number>`count(*)::int`,
          live: sql<number>`count(*) filter (where ${aforceHealthRecords.deletedAt} is null)::int`,
        })
        .from(aforceHealthRecords)
        .where(eq(aforceHealthRecords.userId, userId));
      const total = rows[0]?.total ?? 0;
      const live = rows[0]?.live ?? 0;
      return { total, live, tombstoned: total - live };
    },
  };
}
