/**
 * profileHydration — pure decision logic for restoring the Adaptive Profile
 * from the server (Lock §7 / RC-L11).
 *
 * PASS-3 found the app only ever POSTs profile versions and never reads them
 * back, so reinstall / device replacement / new-device login lost the
 * operational profile even though the server holds every minted snapshot.
 *
 * Decision table (deterministic — §7 "no silent overwrite"):
 *   - server has no version            → NOOP (nothing to restore)
 *   - local has a PENDING unsynced change → KEEP_LOCAL (local is newer by
 *     definition; the pending idempotent POST will reconcile the server)
 *   - local calibration is EMPTY (fresh install / new device) → HYDRATE
 *   - both present, no pending         → KEEP_LOCAL (local-first design: the
 *     server snapshot is the last CONFIRMED state — never newer than local)
 *
 * Only the major-variable snapshot is server-backed today; cosmetic identity
 * fields (display name, avatar, city…) remain local-only until the server
 * snapshot is extended — documented residual of RC-L11.
 */

import type { ProfileIdentity } from './profileIdentity';

/** The server's major-variable snapshot shape (mirror of ProfileSnapshot). */
export interface ServerProfileSnapshot {
  weightLbs?: number | null;
  heightCm?: number | null;
  birthYear?: number | null;
  sex?: string | null;
  activityLevel?: number | null;
  trainingLevel?: string | null;
  performanceGoal?: string | null;
  sweatClassification?: string | null;
}

export type HydrationDecision = 'hydrate' | 'keep_local' | 'noop';

/**
 * True when the local identity carries none of the server-backed calibration
 * variables — i.e. a fresh install / new device, safe to hydrate over.
 */
export function isCalibrationEmpty(identity: ProfileIdentity): boolean {
  return (
    identity.bodyWeightLbs == null &&
    identity.heightCm == null &&
    identity.birthYear == null &&
    identity.activityLevel == null &&
    identity.trainingLevel == null &&
    identity.primaryGoal == null &&
    identity.sweatClassification == null
  );
}

export function decideProfileHydration(args: {
  localIdentity: ProfileIdentity;
  hasPendingSync: boolean;
  serverSnapshot: ServerProfileSnapshot | null | undefined;
}): HydrationDecision {
  if (!args.serverSnapshot) return 'noop';
  if (args.hasPendingSync) return 'keep_local';
  if (isCalibrationEmpty(args.localIdentity)) return 'hydrate';
  return 'keep_local';
}

/**
 * Reverse of `profileSnapshotFromIdentity`: the identity PATCH restoring the
 * server-backed calibration variables. Only defined, non-null values are
 * included — a sparse server snapshot never nulls out a local field.
 */
export function identityPatchFromServerSnapshot(
  snapshot: ServerProfileSnapshot,
): Partial<ProfileIdentity> {
  const patch: Partial<ProfileIdentity> = {};
  if (snapshot.weightLbs != null) patch.bodyWeightLbs = snapshot.weightLbs;
  if (snapshot.heightCm != null) patch.heightCm = snapshot.heightCm;
  if (snapshot.birthYear != null) patch.birthYear = snapshot.birthYear;
  if (snapshot.sex != null) patch.biologicalSex = snapshot.sex as ProfileIdentity['biologicalSex'];
  if (snapshot.activityLevel != null) patch.activityLevel = snapshot.activityLevel;
  if (snapshot.trainingLevel != null) {
    patch.trainingLevel = snapshot.trainingLevel as ProfileIdentity['trainingLevel'];
  }
  if (snapshot.performanceGoal != null) {
    patch.primaryGoal = snapshot.performanceGoal as ProfileIdentity['primaryGoal'];
  }
  if (snapshot.sweatClassification != null) {
    patch.sweatClassification =
      snapshot.sweatClassification as ProfileIdentity['sweatClassification'];
  }
  return patch;
}
