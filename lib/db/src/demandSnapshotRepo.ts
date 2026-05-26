/**
 * Hydration Demand snapshot repository — pure persistence layer.
 *
 * Framework-free: no Express, no auth, no engine code. The engine
 * lives in `@workspace/demand-engine`; this module only persists
 * its inputs + outputs.
 *
 * Mirrors the `scanRepo.ts` contract:
 *
 *   - `createInMemoryDemandSnapshotRepo()` — tests, local dev, DB-down
 *     fallback.
 *   - `createDrizzleDemandSnapshotRepo(db)` — production binding over
 *     the `aforce_demand_snapshots` table.
 *
 * Both honor the same contract:
 *   - `insert` is idempotent on `(userId, clientSnapshotId)` — replay
 *     returns the existing row instead of duplicating. First write
 *     wins; the conflict path NEVER mutates the canonical row.
 *   - `listForUser` returns rows sorted by `computedAt` DESC, capped
 *     at the caller's `limit` (default 50, max 500).
 *   - `countForUser` returns the row count for a user.
 *
 * Architecture lock: hidden-infra. No UI consumes this module today.
 */

import { and, desc, eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  aforceDemandSnapshots,
  type AforceDemandSnapshotRow,
  type InsertAforceDemandSnapshot,
} from "./schema/aforce";

export interface DemandSnapshotInsert {
  userId: string;
  clientSnapshotId: string;
  source: string;
  computedAt: Date;
  /** Full HydrationDemandInputs — authoritative. */
  inputs: unknown;
  /** Full HydrationDemandOutputs — authoritative. */
  outputs: unknown;
  // Denormalized read accelerators (copies of fields in outputs).
  targetOz: number;
  remainingOz: number;
  load: string;
  command: string;
}

export interface DemandSnapshotRecord extends DemandSnapshotInsert {
  id: number;
  createdAt: Date;
}

export interface DemandSnapshotListOptions {
  /** Defaults to 50. Hard-capped at 500. */
  limit?: number;
}

/**
 * Result of an `insert` call.
 *
 *   `inserted: true`  — the caller's row was written and is the
 *                       canonical row.
 *   `inserted: false` — a row already existed for
 *                       `(userId, clientSnapshotId)`; `record` is
 *                       that pre-existing canonical row. The
 *                       caller's payload was NOT written.
 *
 * Callers that surface the row to clients (e.g. the admin route)
 * must read inputs/outputs from `record` — not from the request —
 * on the replay path, or they will mislead consumers by mixing the
 * stored snapshot with the (discarded) new attempt.
 */
export interface DemandSnapshotInsertResult {
  record: DemandSnapshotRecord;
  inserted: boolean;
}

export interface DemandSnapshotRepo {
  insert(rec: DemandSnapshotInsert): Promise<DemandSnapshotInsertResult>;
  listForUser(
    userId: string,
    opts?: DemandSnapshotListOptions,
  ): Promise<DemandSnapshotRecord[]>;
  countForUser(userId: string): Promise<number>;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 500;

function clampLimit(limit?: number): number {
  if (!Number.isFinite(limit ?? NaN)) return DEFAULT_LIMIT;
  const n = Math.floor(limit as number);
  if (n <= 0) return DEFAULT_LIMIT;
  if (n > MAX_LIMIT) return MAX_LIMIT;
  return n;
}

export function createInMemoryDemandSnapshotRepo(): DemandSnapshotRepo {
  let nextId = 1;
  const rows = new Map<string, DemandSnapshotRecord>();
  const key = (userId: string, clientSnapshotId: string) =>
    `${userId}::${clientSnapshotId}`;

  return {
    async insert(rec) {
      const k = key(rec.userId, rec.clientSnapshotId);
      const existing = rows.get(k);
      if (existing) return { record: existing, inserted: false };
      const stored: DemandSnapshotRecord = {
        ...rec,
        id: nextId++,
        createdAt: new Date(),
      };
      rows.set(k, stored);
      return { record: stored, inserted: true };
    },
    async listForUser(userId, opts) {
      const limit = clampLimit(opts?.limit);
      const all = Array.from(rows.values()).filter(
        (r) => r.userId === userId,
      );
      all.sort((a, b) => b.computedAt.getTime() - a.computedAt.getTime());
      return all.slice(0, limit);
    },
    async countForUser(userId) {
      let n = 0;
      for (const r of rows.values()) if (r.userId === userId) n += 1;
      return n;
    },
  };
}

export function createDrizzleDemandSnapshotRepo(
  db: NodePgDatabase<Record<string, unknown>>,
): DemandSnapshotRepo {
  function rowToRecord(r: AforceDemandSnapshotRow): DemandSnapshotRecord {
    return {
      id: r.id,
      userId: r.userId,
      clientSnapshotId: r.clientSnapshotId,
      source: r.source,
      computedAt: r.computedAt,
      inputs: r.inputs,
      outputs: r.outputs,
      targetOz: r.targetOz,
      remainingOz: r.remainingOz,
      load: r.load,
      command: r.command,
      createdAt: r.createdAt,
    };
  }

  return {
    async insert(rec) {
      const insertRow: InsertAforceDemandSnapshot = {
        userId: rec.userId,
        clientSnapshotId: rec.clientSnapshotId,
        source: rec.source,
        computedAt: rec.computedAt,
        inputs: rec.inputs,
        outputs: rec.outputs,
        targetOz: rec.targetOz,
        remainingOz: rec.remainingOz,
        load: rec.load,
        command: rec.command,
      };
      // ON CONFLICT DO NOTHING on (user_id, client_snapshot_id) for
      // idempotency. `returning()` yields the freshly-inserted row;
      // an empty result means the row already existed (replay path),
      // so we read back the canonical row from the table.
      const inserted = await db
        .insert(aforceDemandSnapshots)
        .values(insertRow)
        .onConflictDoNothing({
          target: [
            aforceDemandSnapshots.userId,
            aforceDemandSnapshots.clientSnapshotId,
          ],
        })
        .returning();
      if (inserted[0]) {
        return { record: rowToRecord(inserted[0]), inserted: true };
      }
      const existing = await db
        .select()
        .from(aforceDemandSnapshots)
        .where(
          and(
            eq(aforceDemandSnapshots.userId, rec.userId),
            eq(aforceDemandSnapshots.clientSnapshotId, rec.clientSnapshotId),
          ),
        )
        .limit(1);
      const row = existing[0];
      if (!row) {
        throw new Error(
          "demandSnapshotRepo.insert: row missing after upsert",
        );
      }
      return { record: rowToRecord(row), inserted: false };
    },
    async listForUser(userId, opts) {
      const limit = clampLimit(opts?.limit);
      const rows = await db
        .select()
        .from(aforceDemandSnapshots)
        .where(eq(aforceDemandSnapshots.userId, userId))
        .orderBy(desc(aforceDemandSnapshots.computedAt))
        .limit(limit);
      return rows.map(rowToRecord);
    },
    async countForUser(userId) {
      const rows = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(aforceDemandSnapshots)
        .where(eq(aforceDemandSnapshots.userId, userId));
      return rows[0]?.n ?? 0;
    },
  };
}

export const DEMAND_SNAPSHOT_LIST_DEFAULT_LIMIT = DEFAULT_LIMIT;
export const DEMAND_SNAPSHOT_LIST_MAX_LIMIT = MAX_LIMIT;
