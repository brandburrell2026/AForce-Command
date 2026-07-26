/**
 * HydroState score-snapshot repository — pure persistence layer.
 *
 * Framework-free: no Express, no auth, no scoring-engine code, no Prediction
 * Engine code. Mirrors the `demandSnapshotRepo.ts` / `scanRepo.ts` contract:
 *
 *   - `createInMemoryScoreSnapshotRepo(modelVersion)` — tests, local dev.
 *   - `createDrizzleScoreSnapshotRepo(db, modelVersion)` — production binding
 *     over the `aforce_score_snapshots` table.
 *
 * WHY THIS EXISTS (D-08 / DR-009, founder Decision 4):
 * `aforce_score_snapshots` previously had two independent insert sites
 * (`routes/aforce/journal.ts`, `routes/aforce/sensors.ts`) and no shared
 * abstraction. The HydroState scoring-model version must be stamped on EVERY
 * new snapshot, and founder Decision 5 explicitly REJECTED stamping it
 * independently in each route. This repository is the single persistence
 * boundary where the stamp is applied.
 *
 * THE STAMP IS NOT OPTIONAL AND NOT CALLER-SUPPLIED:
 *   - `modelVersion` is a REQUIRED constructor argument — a binding cannot be
 *     built without it.
 *   - `NewScoreSnapshot` OMITS `hydroStateModelVersion`, so ordinary callers
 *     cannot supply it, cannot forget it, and cannot override it.
 *
 * SCOPE LOCK (founder Decision 4): create snapshots, stamp the version, and
 * accept an existing db-or-transaction handle so the `sensors.ts` transaction
 * stays atomic. This must NOT grow into a general HydroState service.
 *
 * SCORE PROTECTION: this module persists values it is given. It never computes,
 * awards, mutates, or fabricates a score, and it never changes HydroState.
 */

import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  aforceScoreSnapshots,
  type AforceScoreSnapshotRow,
  type InsertAforceScoreSnapshot,
} from "./schema/aforce";

/**
 * What a caller may supply. `hydroStateModelVersion` is deliberately absent —
 * the repository owns it. This is the type-level guarantee behind Decision 5.
 */
export type NewScoreSnapshot = Omit<InsertAforceScoreSnapshot, "hydroStateModelVersion">;

/**
 * Minimal surface accepted for the write handle so a caller can pass either the
 * root `db` or an open transaction (`tx`) — the `sensors.ts` batch insert runs
 * inside `db.transaction(...)` and must remain atomic.
 */
export type ScoreSnapshotWriter = Pick<NodePgDatabase<Record<string, never>>, "insert">;

export interface ScoreSnapshotRepo {
  /** The model version this binding stamps. Exposed for assertions/audit only. */
  readonly modelVersion: string;
  /** Insert one snapshot; returns the persisted row. */
  create(snapshot: NewScoreSnapshot): Promise<AforceScoreSnapshotRow>;
  /** Insert many snapshots atomically within the caller's handle. */
  createMany(snapshots: readonly NewScoreSnapshot[]): Promise<number>;
}

/* ─── Drizzle binding ─────────────────────────────────────────────────────── */

/**
 * @param writer  `db` or an open transaction handle — the caller controls
 *                atomicity; this repository never opens its own transaction.
 * @param modelVersion  REQUIRED. The authoritative HydroState scoring-model
 *                version. Supplied by the composition root so `lib/db` keeps no
 *                dependency on the app package.
 */
export function createDrizzleScoreSnapshotRepo(
  writer: ScoreSnapshotWriter,
  modelVersion: string,
): ScoreSnapshotRepo {
  if (!modelVersion) {
    // Fail loudly at construction rather than silently writing null, which
    // would be indistinguishable from a legitimate historical "not recorded".
    throw new Error("scoreSnapshotRepo: modelVersion is required");
  }

  const stamp = (s: NewScoreSnapshot): InsertAforceScoreSnapshot => ({
    ...s,
    hydroStateModelVersion: modelVersion,
  });

  return {
    modelVersion,

    async create(snapshot) {
      const [row] = await writer
        .insert(aforceScoreSnapshots)
        .values(stamp(snapshot))
        .returning();
      return row as AforceScoreSnapshotRow;
    },

    async createMany(snapshots) {
      if (snapshots.length === 0) return 0;
      await writer.insert(aforceScoreSnapshots).values(snapshots.map(stamp));
      return snapshots.length;
    },
  };
}

/* ─── In-memory binding ───────────────────────────────────────────────────── */

/** Test / local-dev binding honouring the same stamping contract. */
export function createInMemoryScoreSnapshotRepo(modelVersion: string): ScoreSnapshotRepo & {
  readonly rows: readonly AforceScoreSnapshotRow[];
} {
  if (!modelVersion) {
    throw new Error("scoreSnapshotRepo: modelVersion is required");
  }

  const rows: AforceScoreSnapshotRow[] = [];
  let nextId = 1;

  const stamp = (s: NewScoreSnapshot): AforceScoreSnapshotRow =>
    ({
      ...(s as Record<string, unknown>),
      id: nextId++,
      hydroStateModelVersion: modelVersion,
      capturedAt: (s as { capturedAt?: Date }).capturedAt ?? new Date(),
    }) as unknown as AforceScoreSnapshotRow;

  return {
    modelVersion,
    get rows() {
      return rows;
    },
    async create(snapshot) {
      const row = stamp(snapshot);
      rows.push(row);
      return row;
    },
    async createMany(snapshots) {
      for (const s of snapshots) rows.push(stamp(s));
      return snapshots.length;
    },
  };
}
