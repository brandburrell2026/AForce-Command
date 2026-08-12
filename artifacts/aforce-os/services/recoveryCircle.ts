/**
 * Recovery Circle — focused recovery accountability cohort.
 *
 * Spec Rule #11: "Build hidden. No referral wording. Day 0 / Day 1 /
 * Day 3 / Day 7 / Day 30. Max: 3 people. No feed."
 *
 * This is a DIFFERENT concept from the visible Circles social
 * feature (`circleService.ts`, which has feed / challenges /
 * notifications). Recovery Circle is small (≤3 people), private (no
 * feed), and structured around 5 fixed checkpoint days anchored to a
 * per-user "recovery start" timestamp.
 *
 * No UI is wired this turn. The hidden hook `useHiddenRecoveryCircle`
 * is gated on the new `spec_recoveryCircle` flag (default false) and
 * returns null until the flag flips. Persistence is via AsyncStorage
 * under `@aforce/recoveryCircle`. No referral / invite / share copy
 * lives in this module by design — see spec "No referral wording."
 */
import { scopedStorage } from './scopedStorage';
import { useEffect, useState } from 'react';
import { useFeatureFlags } from '@/store/useAppStore';

/** Spec cap: at most three people in a user's Recovery Circle. */
export const CIRCLE_MAX = 3;

/** Spec checkpoint cadence in days since recovery start. */
export const CHECKPOINT_DAYS = [0, 1, 3, 7, 30] as const;
export type CheckpointDay = (typeof CHECKPOINT_DAYS)[number];

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const STORAGE_KEY = '@aforce/recoveryCircle';

export interface RecoveryCircleMember {
  /** Stable client-side id (uuid or similar). */
  id: string;
  /** Display name; no handle, no avatar — minimum surface. */
  name: string;
  /** Free-form role label, e.g. "partner", "coach". Optional. */
  role?: string;
}

export interface RecoveryCircleCheckpoint {
  day: CheckpointDay;
  /** Absolute ISO timestamp this checkpoint becomes due. */
  dueAt: string;
  /** ISO timestamp when marked complete; null until then. */
  completedAt: string | null;
}

export interface RecoveryCircleSnapshot {
  /** ISO timestamp of recovery start (Day 0 anchor). */
  startAt: string;
  members: RecoveryCircleMember[];
  checkpoints: RecoveryCircleCheckpoint[];
}

/**
 * Derive the five spec checkpoints from a recovery-start ISO
 * timestamp. Pure: no I/O, no clock reads.
 */
export function deriveCheckpoints(startAtIso: string): RecoveryCircleCheckpoint[] {
  const start = Date.parse(startAtIso);
  if (!Number.isFinite(start)) {
    return CHECKPOINT_DAYS.map((day) => ({ day, dueAt: startAtIso, completedAt: null }));
  }
  return CHECKPOINT_DAYS.map((day) => ({
    day,
    dueAt: new Date(start + day * MS_PER_DAY).toISOString(),
    completedAt: null,
  }));
}

/**
 * Enforces the spec member cap. Truncates extras from the tail so the
 * earliest-added members are preserved.
 */
export function clampMembers(members: ReadonlyArray<RecoveryCircleMember>): RecoveryCircleMember[] {
  return members.slice(0, CIRCLE_MAX);
}

/**
 * The active checkpoint right now: the latest checkpoint whose
 * `dueAt` has passed and which is not yet completed. Returns null if
 * no checkpoint is currently due or all due checkpoints are done.
 */
export function currentCheckpoint(
  checkpoints: ReadonlyArray<RecoveryCircleCheckpoint>,
  now: number,
): RecoveryCircleCheckpoint | null {
  let active: RecoveryCircleCheckpoint | null = null;
  for (const c of checkpoints) {
    if (Date.parse(c.dueAt) <= now && !c.completedAt) active = c;
  }
  return active;
}

/**
 * The next upcoming checkpoint: earliest checkpoint whose `dueAt`
 * is strictly in the future. Returns null if all have passed.
 */
export function nextCheckpoint(
  checkpoints: ReadonlyArray<RecoveryCircleCheckpoint>,
  now: number,
): RecoveryCircleCheckpoint | null {
  for (const c of checkpoints) {
    if (Date.parse(c.dueAt) > now) return c;
  }
  return null;
}

/**
 * A checkpoint is overdue when its dueAt has passed and it has not
 * been completed. Day 0 is never considered overdue at exactly its
 * start instant — strict less-than.
 */
export function isOverdue(checkpoint: RecoveryCircleCheckpoint, now: number): boolean {
  if (checkpoint.completedAt) return false;
  return Date.parse(checkpoint.dueAt) < now;
}

// ── Persistence ──────────────────────────────────────────────────────────────

function isSnapshot(v: unknown): v is RecoveryCircleSnapshot {
  if (!v || typeof v !== 'object') return false;
  const s = v as Record<string, unknown>;
  return (
    typeof s.startAt === 'string' &&
    Array.isArray(s.members) &&
    Array.isArray(s.checkpoints)
  );
}

export async function getRecoveryCircle(): Promise<RecoveryCircleSnapshot | null> {
  try {
    const raw = await scopedStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return isSnapshot(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function setRecoveryCircle(snapshot: RecoveryCircleSnapshot): Promise<void> {
  const clamped: RecoveryCircleSnapshot = {
    startAt: snapshot.startAt,
    members: clampMembers(snapshot.members),
    checkpoints: snapshot.checkpoints,
  };
  try {
    await scopedStorage.setItem(STORAGE_KEY, JSON.stringify(clamped));
  } catch {
    /* non-fatal */
  }
}

/**
 * Create-if-missing helper. If a snapshot already exists in storage,
 * returns it unchanged. Otherwise creates one anchored at `nowIso`
 * with no members and freshly derived checkpoints.
 */
export async function ensureRecoveryCircle(nowIso: string): Promise<RecoveryCircleSnapshot> {
  const existing = await getRecoveryCircle();
  if (existing) return existing;
  const fresh: RecoveryCircleSnapshot = {
    startAt: nowIso,
    members: [],
    checkpoints: deriveCheckpoints(nowIso),
  };
  await setRecoveryCircle(fresh);
  return fresh;
}

// ── Hidden hook ──────────────────────────────────────────────────────────────

/**
 * Returns the stored snapshot when `spec_recoveryCircle` is on;
 * returns null otherwise. Does NOT mount any UI; reserved for future
 * rules that wire the cadence into notifications / coach prompts.
 */
export function useHiddenRecoveryCircle(): RecoveryCircleSnapshot | null {
  const flags = useFeatureFlags();
  const [snapshot, setSnapshot] = useState<RecoveryCircleSnapshot | null>(null);

  useEffect(() => {
    if (!flags.spec_recoveryCircle) {
      setSnapshot(null);
      return;
    }
    let cancelled = false;
    void getRecoveryCircle().then((s) => {
      if (!cancelled) setSnapshot(s);
    });
    return () => {
      cancelled = true;
    };
  }, [flags.spec_recoveryCircle]);

  return snapshot;
}
