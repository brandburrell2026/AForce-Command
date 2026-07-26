/**
 * Adaptive Profile Engine™ repository (Section 18) — pure persistence layer.
 *
 * Framework-free: no Express, no auth, no engine code. The DECISION logic
 * (major vs minor, confidence formula, Evidence Engine™ copy) lives in the
 * app's `services/adaptiveProfileEngine.ts` + `config/hydroStateModel.ts`;
 * this module only persists the result. Confidence values are computed by the
 * engine and PASSED IN — the formula never leaks into the DB layer (brief #4).
 *
 * Mirrors the scanRepo / demandSnapshotRepo contract:
 *   - `createInMemoryProfileRepo()` — tests, local dev, DB-down fallback.
 *   - `createDrizzleProfileRepo(db)` — production binding over the four
 *     aforce_*profile* tables.
 *
 * CONTRACT A (atomicity): `recordMajorChange` mints the version + appends the
 * change-log + archives the prior active baseline + opens a new baseline +
 * advances the user-profile pointer in ONE transaction. A partial write can
 * never split-brain the layer. The mint is idempotent on
 * (userId, clientChangeId): a replay returns the existing ids instead of
 * double-minting. See services/adaptiveProfileEngine.ts for the full contract.
 *
 * Historical-preservation (brief #5): versions, baselines, and change-log rows
 * are APPEND-ONLY here — the only UPDATEs are (a) flipping a prior baseline to
 * 'archived' and (b) the user-profile pointer / baseline progress. No version
 * or change-log row is ever mutated or deleted.
 */

import { and, desc, eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  aforceUserProfiles,
  aforceProfileVersions,
  aforceBaselineVersions,
  aforceProfileChangeLog,
  type AforceUserProfileRow,
  type AforceProfileVersionRow,
  type AforceBaselineVersionRow,
} from "./schema/aforce";

/**
 * Body Recalibration Engine™ (Section 20) targets, computed client-side and
 * stored verbatim on the new baseline. Shape mirrors the `targets` column on
 * aforce_baseline_versions; the repo persists it without interpreting it (the
 * recalc math lives in the app, not the DB layer).
 */
export interface BaselineTargets {
  dailyHydrationTargetOz: number | null;
  electrolyteSodiumMg: number;
  recoveryWindowMin: number | null;
  recheckIntervalMin: number;
  envPressureSensitivity: number | null;
}

export interface MajorChangeInput {
  userId: string;
  /** Full major-variable snapshot to persist as the new version. */
  snapshot: Record<string, unknown>;
  /** Which major variables triggered this version. */
  changedFields: string[];
  /** Evidence Engine™ string for the change-log. */
  explanation: string;
  /** Confidence the new baseline opens at — computed by the engine. */
  initialConfidence: number;
  /** Recalibrated go-forward targets owned by the new baseline (§20). */
  targets?: BaselineTargets | null;
  /** Idempotency key (contract A). When omitted the mint always creates. */
  clientChangeId?: string;
}

export interface MinorChangeInput {
  userId: string;
  changedFields: string[];
  explanation: string;
}

/** The active version + baseline ids after a save, for HydroState stamping. */
export interface ProfilePointers {
  profileVersionId: number;
  baselineVersionId: number;
  versionNumber: number;
}

export interface MajorChangeResult {
  pointers: ProfilePointers;
  /** false when this was an idempotent replay of an existing clientChangeId. */
  minted: boolean;
}

export interface ProfileRepo {
  /** Atomic mint + recalibration. Idempotent on (userId, clientChangeId). */
  recordMajorChange(input: MajorChangeInput): Promise<MajorChangeResult>;
  /** Append a change-log row only — no version, no baseline change. */
  recordMinorChange(input: MinorChangeInput): Promise<void>;
  /** Current pointer row, or null if the user has no profile yet. */
  getCurrentProfile(userId: string): Promise<AforceUserProfileRow | null>;
  /**
   * The user's latest Profile Version™ row (carries the major-variable
   * `snapshot`), or null before the first mint. Powers client rehydration
   * after reinstall / device replacement (Lock §7 / RC-L11).
   */
  getCurrentVersion(userId: string): Promise<AforceProfileVersionRow | null>;
  /** The single active baseline for a user, or null. */
  getActiveBaseline(userId: string): Promise<AforceBaselineVersionRow | null>;
  /**
   * Update the active baseline's observation count + confidence. Both values
   * are computed by the engine and passed in (no formula in the DB layer).
   */
  updateBaselineProgress(
    baselineVersionId: number,
    observationCount: number,
    confidence: number,
  ): Promise<void>;
}

export function createInMemoryProfileRepo(): ProfileRepo {
  let nextVersionId = 1;
  let nextBaselineId = 1;
  let nextLogId = 1;
  const profiles = new Map<string, AforceUserProfileRow>();
  const versions: AforceProfileVersionRow[] = [];
  const baselines: AforceBaselineVersionRow[] = [];
  const changeLog: { id: number }[] = [];

  return {
    async recordMajorChange(input) {
      // Idempotent replay: a version already exists for this client key.
      if (input.clientChangeId != null) {
        const existing = versions.find(
          (v) =>
            v.userId === input.userId &&
            v.clientChangeId === input.clientChangeId,
        );
        if (existing) {
          const baseline = baselines.find(
            (b) =>
              b.profileVersionId === existing.id && b.userId === input.userId,
          );
          return {
            pointers: {
              profileVersionId: existing.id,
              baselineVersionId: baseline?.id ?? -1,
              versionNumber: existing.versionNumber,
            },
            minted: false,
          };
        }
      }

      const now = new Date();
      const versionNumber =
        versions
          .filter((v) => v.userId === input.userId)
          .reduce((max, v) => Math.max(max, v.versionNumber), 0) + 1;
      const isFirst = versionNumber === 1;

      const version: AforceProfileVersionRow = {
        id: nextVersionId++,
        userId: input.userId,
        versionNumber,
        snapshot: input.snapshot,
        changedFields: input.changedFields,
        clientChangeId: input.clientChangeId ?? null,
        createdAt: now,
      };
      versions.push(version);

      // Archive the prior active baseline (never delete).
      const prior = baselines.find(
        (b) => b.userId === input.userId && b.status === "active",
      );
      if (prior) {
        prior.status = "archived";
        prior.archivedAt = now;
      }

      const baseline: AforceBaselineVersionRow = {
        id: nextBaselineId++,
        userId: input.userId,
        profileVersionId: version.id,
        status: "active",
        confidence: input.initialConfidence,
        observationCount: 0,
        startedAt: now,
        archivedAt: null,
        targets: input.targets ?? null,
      };
      baselines.push(baseline);

      profiles.set(input.userId, {
        userId: input.userId,
        currentProfileVersionId: version.id,
        currentBaselineVersionId: baseline.id,
        lastCalibrationAt: now,
        updatedAt: now,
      });

      changeLog.push({ id: nextLogId++ });
      void isFirst; // (kept for parity with the Drizzle path's intent)

      return {
        pointers: {
          profileVersionId: version.id,
          baselineVersionId: baseline.id,
          versionNumber,
        },
        minted: true,
      };
    },

    async recordMinorChange() {
      changeLog.push({ id: nextLogId++ });
    },

    async getCurrentProfile(userId) {
      return profiles.get(userId) ?? null;
    },

    async getCurrentVersion(userId) {
      const mine = versions.filter((v) => v.userId === userId);
      if (mine.length === 0) return null;
      return mine.reduce((a, b) => (b.versionNumber > a.versionNumber ? b : a));
    },

    async getActiveBaseline(userId) {
      return (
        baselines.find((b) => b.userId === userId && b.status === "active") ??
        null
      );
    },

    async updateBaselineProgress(baselineVersionId, observationCount, confidence) {
      const b = baselines.find((x) => x.id === baselineVersionId);
      if (b) {
        b.observationCount = observationCount;
        b.confidence = confidence;
      }
    },
  };
}

export function createDrizzleProfileRepo(
  db: NodePgDatabase<Record<string, unknown>>,
): ProfileRepo {
  return {
    async recordMajorChange(input) {
      return db.transaction(async (tx) => {
        // Idempotent replay guard — return the existing version's pointers
        // without minting a second one (contract A).
        if (input.clientChangeId != null) {
          const existing = await tx
            .select()
            .from(aforceProfileVersions)
            .where(
              and(
                eq(aforceProfileVersions.userId, input.userId),
                eq(aforceProfileVersions.clientChangeId, input.clientChangeId),
              ),
            )
            .limit(1);
          if (existing[0]) {
            const baseline = await tx
              .select()
              .from(aforceBaselineVersions)
              .where(
                and(
                  eq(aforceBaselineVersions.userId, input.userId),
                  eq(
                    aforceBaselineVersions.profileVersionId,
                    existing[0].id,
                  ),
                ),
              )
              .limit(1);
            return {
              pointers: {
                profileVersionId: existing[0].id,
                baselineVersionId: baseline[0]?.id ?? -1,
                versionNumber: existing[0].versionNumber,
              },
              minted: false,
            };
          }
        }

        // Next human-facing version number for this user (v1, v2, v3…).
        const maxRow = await tx
          .select({
            max: sql<number>`coalesce(max(${aforceProfileVersions.versionNumber}), 0)::int`,
          })
          .from(aforceProfileVersions)
          .where(eq(aforceProfileVersions.userId, input.userId));
        const versionNumber = (maxRow[0]?.max ?? 0) + 1;

        const versionRows = await tx
          .insert(aforceProfileVersions)
          .values({
            userId: input.userId,
            versionNumber,
            snapshot: input.snapshot,
            changedFields: input.changedFields,
            clientChangeId: input.clientChangeId ?? null,
          })
          .returning();
        const version = versionRows[0];
        if (!version) {
          throw new Error("profileRepo.recordMajorChange: version insert failed");
        }

        // Archive the prior active baseline (status flip only — never delete).
        await tx
          .update(aforceBaselineVersions)
          .set({ status: "archived", archivedAt: new Date() })
          .where(
            and(
              eq(aforceBaselineVersions.userId, input.userId),
              eq(aforceBaselineVersions.status, "active"),
            ),
          );

        const baselineRows = await tx
          .insert(aforceBaselineVersions)
          .values({
            userId: input.userId,
            profileVersionId: version.id,
            status: "active",
            confidence: input.initialConfidence,
            observationCount: 0,
            targets: input.targets ?? null,
          })
          .returning();
        const baseline = baselineRows[0];
        if (!baseline) {
          throw new Error("profileRepo.recordMajorChange: baseline insert failed");
        }

        // Advance the (mutable) pointer row — upsert so a first-time user is
        // created and a returning user is moved forward.
        await tx
          .insert(aforceUserProfiles)
          .values({
            userId: input.userId,
            currentProfileVersionId: version.id,
            currentBaselineVersionId: baseline.id,
            lastCalibrationAt: new Date(),
          })
          .onConflictDoUpdate({
            target: aforceUserProfiles.userId,
            set: {
              currentProfileVersionId: version.id,
              currentBaselineVersionId: baseline.id,
              lastCalibrationAt: new Date(),
              updatedAt: new Date(),
            },
          });

        await tx.insert(aforceProfileChangeLog).values({
          userId: input.userId,
          profileVersionId: version.id,
          baselineVersionId: baseline.id,
          changeType: "major",
          changedFields: input.changedFields,
          explanation: input.explanation,
        });

        return {
          pointers: {
            profileVersionId: version.id,
            baselineVersionId: baseline.id,
            versionNumber,
          },
          minted: true,
        };
      });
    },

    async recordMinorChange(input) {
      await db.insert(aforceProfileChangeLog).values({
        userId: input.userId,
        profileVersionId: null,
        baselineVersionId: null,
        changeType: "minor",
        changedFields: input.changedFields,
        explanation: input.explanation,
      });
    },

    async getCurrentProfile(userId) {
      const rows = await db
        .select()
        .from(aforceUserProfiles)
        .where(eq(aforceUserProfiles.userId, userId))
        .limit(1);
      return rows[0] ?? null;
    },

    async getCurrentVersion(userId) {
      const rows = await db
        .select()
        .from(aforceProfileVersions)
        .where(eq(aforceProfileVersions.userId, userId))
        .orderBy(desc(aforceProfileVersions.versionNumber))
        .limit(1);
      return rows[0] ?? null;
    },

    async getActiveBaseline(userId) {
      const rows = await db
        .select()
        .from(aforceBaselineVersions)
        .where(
          and(
            eq(aforceBaselineVersions.userId, userId),
            eq(aforceBaselineVersions.status, "active"),
          ),
        )
        .orderBy(desc(aforceBaselineVersions.startedAt))
        .limit(1);
      return rows[0] ?? null;
    },

    async updateBaselineProgress(baselineVersionId, observationCount, confidence) {
      await db
        .update(aforceBaselineVersions)
        .set({ observationCount, confidence })
        .where(eq(aforceBaselineVersions.id, baselineVersionId));
    },
  };
}
