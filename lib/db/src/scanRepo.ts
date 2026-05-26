/**
 * HydroScan history repository — pure persistence layer.
 *
 * This module is intentionally framework-free: no Express, no
 * request/response shapes, no auth. It defines a `HydroScanRepo`
 * contract and two implementations:
 *
 *   - `createInMemoryHydroScanRepo()` — for tests, local dev, and as
 *     a fallback when the DB is unreachable.
 *   - `createDrizzleHydroScanRepo(db)` — production binding over the
 *     `aforce_hydro_scans` table.
 *
 * Both honor the same contract:
 *   - `insert` is idempotent on `(userId, clientScanId)` — replaying
 *     the same payload returns the existing row instead of inserting
 *     a duplicate. This lets the mobile client retry on flaky
 *     network without contaminating history.
 *   - `listForUser` returns rows sorted by `scannedAt` DESC, capped
 *     at the caller's `limit` (default 50, max 500 — matching the
 *     existing `/api/scans` route convention).
 *   - `countForUser` returns the total row count for a user without
 *     materializing the rows themselves.
 *
 * Architecture lock: Build only. No route imports this module today.
 */

import { and, desc, eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  aforceHydroScans,
  type AforceHydroScanRow,
  type InsertAforceHydroScan,
} from "./schema/aforce";

export interface HydroScanInsert {
  userId: string;
  clientScanId: string;
  scannedAt: Date;
  sourceKind: string;
  rawValue: string;
  productId: string | null;
  productName: string;
  brand: string | null;
  category: string | null;
  isAForce: boolean;
  verdict: string;
  currentFitScore: number;
  efficiency: number;
  efficiencyLabel: string;
  evaluatedAgainstState: string;
  aforceEquivalentId: string | null;
  /** Full ScanResult payload — preserved verbatim. */
  payload: unknown;
}

export interface HydroScanRecord extends HydroScanInsert {
  id: number;
  createdAt: Date;
}

export interface ListOptions {
  /** Defaults to 50. Hard-capped at 500 (matches the legacy
   *  in-memory store's per-device retention ceiling). */
  limit?: number;
}

export interface HydroScanRepo {
  insert(rec: HydroScanInsert): Promise<HydroScanRecord>;
  listForUser(userId: string, opts?: ListOptions): Promise<HydroScanRecord[]>;
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

/** Lossless in-memory repo. Same contract as the Drizzle binding. */
export function createInMemoryHydroScanRepo(): HydroScanRepo {
  let nextId = 1;
  const rows = new Map<string, HydroScanRecord>(); // key = `${userId}::${clientScanId}`

  const key = (userId: string, clientScanId: string) =>
    `${userId}::${clientScanId}`;

  return {
    async insert(rec) {
      const k = key(rec.userId, rec.clientScanId);
      const existing = rows.get(k);
      if (existing) return existing;
      const stored: HydroScanRecord = {
        ...rec,
        id: nextId++,
        createdAt: new Date(),
      };
      rows.set(k, stored);
      return stored;
    },
    async listForUser(userId, opts) {
      const limit = clampLimit(opts?.limit);
      const all = Array.from(rows.values()).filter((r) => r.userId === userId);
      all.sort((a, b) => b.scannedAt.getTime() - a.scannedAt.getTime());
      return all.slice(0, limit);
    },
    async countForUser(userId) {
      let n = 0;
      for (const r of rows.values()) if (r.userId === userId) n += 1;
      return n;
    },
  };
}

/** Production binding over the `aforce_hydro_scans` table. */
export function createDrizzleHydroScanRepo(
  db: NodePgDatabase<Record<string, unknown>>,
): HydroScanRepo {
  function rowToRecord(r: AforceHydroScanRow): HydroScanRecord {
    return {
      id: r.id,
      userId: r.userId,
      clientScanId: r.clientScanId,
      scannedAt: r.scannedAt,
      sourceKind: r.sourceKind,
      rawValue: r.rawValue,
      productId: r.productId,
      productName: r.productName,
      brand: r.brand,
      category: r.category,
      isAForce: r.isAForce,
      verdict: r.verdict,
      currentFitScore: r.currentFitScore,
      efficiency: r.efficiency,
      efficiencyLabel: r.efficiencyLabel,
      evaluatedAgainstState: r.evaluatedAgainstState,
      aforceEquivalentId: r.aforceEquivalentId,
      payload: r.payload,
      createdAt: r.createdAt,
    };
  }

  return {
    async insert(rec) {
      const insertRow: InsertAforceHydroScan = {
        userId: rec.userId,
        clientScanId: rec.clientScanId,
        scannedAt: rec.scannedAt,
        sourceKind: rec.sourceKind,
        rawValue: rec.rawValue,
        productId: rec.productId,
        productName: rec.productName,
        brand: rec.brand,
        category: rec.category,
        isAForce: rec.isAForce,
        verdict: rec.verdict,
        currentFitScore: rec.currentFitScore,
        efficiency: rec.efficiency,
        efficiencyLabel: rec.efficiencyLabel,
        evaluatedAgainstState: rec.evaluatedAgainstState,
        aforceEquivalentId: rec.aforceEquivalentId,
        payload: rec.payload,
      };
      // ON CONFLICT DO NOTHING on (user_id, client_scan_id) for
      // idempotency. We then read back the canonical row so the
      // caller always sees the persisted id + createdAt.
      await db
        .insert(aforceHydroScans)
        .values(insertRow)
        .onConflictDoNothing({
          target: [aforceHydroScans.userId, aforceHydroScans.clientScanId],
        });
      const existing = await db
        .select()
        .from(aforceHydroScans)
        .where(
          and(
            eq(aforceHydroScans.userId, rec.userId),
            eq(aforceHydroScans.clientScanId, rec.clientScanId),
          ),
        )
        .limit(1);
      const row = existing[0];
      if (!row) {
        throw new Error("hydroScanRepo.insert: row missing after upsert");
      }
      return rowToRecord(row);
    },
    async listForUser(userId, opts) {
      const limit = clampLimit(opts?.limit);
      const rows = await db
        .select()
        .from(aforceHydroScans)
        .where(eq(aforceHydroScans.userId, userId))
        .orderBy(desc(aforceHydroScans.scannedAt))
        .limit(limit);
      return rows.map(rowToRecord);
    },
    async countForUser(userId) {
      const rows = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(aforceHydroScans)
        .where(eq(aforceHydroScans.userId, userId));
      return rows[0]?.n ?? 0;
    },
  };
}

export const HYDRO_SCAN_LIST_DEFAULT_LIMIT = DEFAULT_LIMIT;
export const HYDRO_SCAN_LIST_MAX_LIMIT = MAX_LIMIT;
