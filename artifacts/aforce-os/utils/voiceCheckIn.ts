/**
 * Voice Check-In™ — pure timing + answer model.
 *
 * The morning calibration runs once per LOCAL morning. This module owns the
 * dependency-free timing math (which local day are we in, are we inside the
 * morning window, is a check-in due) and the answer/record types every other
 * Voice Check-In layer reads.
 *
 * Strictly READ-ONLY / pure: imports nothing from services, stores, React, or
 * I/O. Nothing here awards or mutates score (Score-Protection); the check-in
 * only ever feeds display-only projections downstream.
 */

// ─── Answer model ─────────────────────────────────────────────────────

/** The 4 selectable "main goal" answers for question 3. */
export type CheckInGoalId = 'train' | 'compete' | 'recover' | 'focus';

export const CHECKIN_GOAL_IDS: readonly CheckInGoalId[] = [
  'train',
  'compete',
  'recover',
  'focus',
] as const;

/** The 1–5 self-report scale used for Energy and Stress. */
export const CHECKIN_SCALE_MIN = 1;
export const CHECKIN_SCALE_MAX = 5;

export interface VoiceCheckInAnswers {
  /** Reported morning energy, 1 (low) – 5 (high). */
  energy: number;
  /** Reported morning stress, 1 (calm) – 5 (high). */
  stress: number;
  /** Selected main goal for the day. */
  goal: CheckInGoalId;
}

/** One persisted morning check-in. The unit Performance Memory rolls up. */
export interface VoiceCheckInRecord {
  /** Local calendar day, 'YYYY-MM-DD'. */
  dayKey: string;
  /** Local day number (integer) — ordering + streak gap detection. */
  dayIndex: number;
  /** Epoch ms the check-in completed. */
  completedAtMs: number;
  answers: VoiceCheckInAnswers;
}

// ─── Timing (local, pure) ─────────────────────────────────────────────

/** Morning window bounds (local hours): 04:00 inclusive – 12:00 exclusive. */
export const MORNING_START_HOUR = 4;
export const MORNING_END_HOUR = 12;

/** Local calendar day key 'YYYY-MM-DD' for a Date. */
export function localDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Local day number (integer days since the Unix epoch, date-only). Stable
 * and timezone-consistent for a given local date, so it supports ordering
 * and "consecutive day" streak detection without any clock dependency.
 */
export function localDayIndex(date: Date): number {
  return Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000,
  );
}

/** True when the local time-of-day is inside the morning window. */
export function isMorningWindow(date: Date): boolean {
  const h = date.getHours();
  return h >= MORNING_START_HOUR && h < MORNING_END_HOUR;
}

export interface CheckInDueInput {
  /** Local day key of the last completed check-in, or null if none. */
  lastCompletedDayKey: string | null;
  /** Snooze expiry epoch ms, or null when not snoozed. */
  snoozedUntilMs: number | null;
  /** Current time. */
  now: Date;
}

/**
 * Is the morning check-in due right now? Pure and deterministic.
 *
 * Due ⇔ we are inside the morning window AND not currently snoozed AND no
 * check-in has been completed for today's local day. Outside the morning
 * window it is never due (the ritual is a morning calibration), so a missed
 * morning simply rolls to the next day rather than nagging all afternoon.
 */
export function isCheckInDue(input: CheckInDueInput): boolean {
  const { now, snoozedUntilMs, lastCompletedDayKey } = input;
  if (!isMorningWindow(now)) return false;
  if (snoozedUntilMs != null && now.getTime() < snoozedUntilMs) return false;
  return lastCompletedDayKey !== localDayKey(now);
}

/**
 * Delay in ms until a future snooze expires, or null when there is nothing to
 * wait on (no snooze, or it has already passed). The overlay uses this to
 * schedule a SINGLE re-check timer so the ritual can re-open when a snooze ends;
 * an already-expired snooze returns null because the ordinary `isCheckInDue`
 * computation on the next render already accounts for it (avoiding a redundant
 * state update / re-render loop).
 */
export function snoozeRevalidationDelay(
  snoozedUntilMs: number | null,
  now: Date = new Date(),
): number | null {
  if (snoozedUntilMs == null) return null;
  const delay = snoozedUntilMs - now.getTime();
  return delay > 0 ? delay : null;
}

// ─── Validation helpers (pure) ────────────────────────────────────────

/** Clamp + round a raw value onto the 1–5 self-report scale. */
export function clampScale(n: number): number {
  if (!Number.isFinite(n)) return CHECKIN_SCALE_MIN;
  return Math.min(CHECKIN_SCALE_MAX, Math.max(CHECKIN_SCALE_MIN, Math.round(n)));
}

/** Type guard for a known goal id. */
export function isCheckInGoal(value: unknown): value is CheckInGoalId {
  return (
    typeof value === 'string' &&
    (CHECKIN_GOAL_IDS as readonly string[]).includes(value)
  );
}
