/**
 * Voice Check-In™ persistence service.
 *
 * Owns the persisted morning-calibration history in AsyncStorage and exposes
 * a synchronous read surface (+ `useSyncExternalStore` subscribe hook) plus
 * serialized recorders. It deliberately lives OUTSIDE the hydration reducer /
 * AppState (Score-Protection isolation): completing a check-in records a
 * self-report row here and never dispatches a reducer action, so it can never
 * touch a hydration point, performance band, or recovery score. Downstream
 * surfaces read this history only to drive display-only projections.
 *
 * Mirrors the persistence patterns already in the app:
 *   • `@aforce/*` key, async, best-effort (storage failures are non-fatal),
 *     like `services/analytics.ts` / `services/devMode.ts`.
 *   • A single in-module write queue serializes every persist so concurrent
 *     recorders cannot clobber each other (analytics pattern).
 *   • A module-level store + listener set powers `useSyncExternalStore`
 *     without pulling in a global store (devMode pattern).
 */
import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  clampScale,
  isCheckInDue,
  isCheckInGoal,
  localDayIndex,
  localDayKey,
  type CheckInGoalId,
  type VoiceCheckInAnswers,
  type VoiceCheckInRecord,
} from '@/utils/voiceCheckIn';

const STORAGE_KEY = '@aforce/voice-checkin';
/** Keep the history bounded — retain the most recent N days. */
const MAX_RECORDS = 120;
/** Default snooze length when the user dismisses the ritual (minutes). */
export const DEFAULT_SNOOZE_MINUTES = 60;

export interface VoiceCheckInState {
  /** Completed check-ins, ascending by day. */
  records: VoiceCheckInRecord[];
  /** Snooze expiry epoch ms, or null when not snoozed. */
  snoozedUntilMs: number | null;
  /** False until AsyncStorage has been read at least once. */
  hydrated: boolean;
}

// ─── In-memory store (synchronous read surface) ───────────────────────

let current: VoiceCheckInState = {
  records: [],
  snoozedUntilMs: null,
  hydrated: false,
};
const listeners = new Set<() => void>();

function notify(): void {
  for (const l of listeners) l();
}

function setState(next: VoiceCheckInState): void {
  current = next;
  notify();
}

export function getVoiceCheckInState(): VoiceCheckInState {
  return current;
}

// ─── Persistence (serialized writes, best-effort) ─────────────────────

let writeQueue: Promise<unknown> = Promise.resolve();
function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = writeQueue.then(task, task);
  writeQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

interface PersistedShape {
  records: VoiceCheckInRecord[];
  snoozedUntilMs: number | null;
}

function isRecord(v: unknown): v is VoiceCheckInRecord {
  if (!v || typeof v !== 'object') return false;
  const r = v as Record<string, unknown>;
  if (typeof r.dayKey !== 'string') return false;
  if (typeof r.dayIndex !== 'number' || !Number.isFinite(r.dayIndex)) return false;
  if (typeof r.completedAtMs !== 'number') return false;
  const a = r.answers as Record<string, unknown> | undefined;
  if (!a || typeof a !== 'object') return false;
  return (
    typeof a.energy === 'number' &&
    typeof a.stress === 'number' &&
    isCheckInGoal(a.goal)
  );
}

function parse(raw: string | null): PersistedShape | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const p = parsed as Record<string, unknown>;
    const records = Array.isArray(p.records) ? p.records.filter(isRecord) : [];
    const snoozedUntilMs =
      typeof p.snoozedUntilMs === 'number' ? p.snoozedUntilMs : null;
    return { records, snoozedUntilMs };
  } catch {
    return null;
  }
}

function persist(): Promise<void> {
  const snapshot: PersistedShape = {
    records: current.records,
    snoozedUntilMs: current.snoozedUntilMs,
  };
  return enqueue(async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } catch {
      /* non-fatal: in-memory state is still authoritative */
    }
  });
}

let hydrating: Promise<void> | null = null;

/**
 * Load persisted check-ins into memory. Idempotent — safe to call from app
 * boot and from the hook. Resolves once the first read completes.
 */
export function hydrateVoiceCheckIn(): Promise<void> {
  if (current.hydrated) return Promise.resolve();
  if (hydrating) return hydrating;
  hydrating = (async () => {
    let loaded: PersistedShape | null = null;
    try {
      loaded = parse(await AsyncStorage.getItem(STORAGE_KEY));
    } catch {
      loaded = null;
    }
    setState({
      records: loaded ? sortAndCap(loaded.records) : [],
      snoozedUntilMs: loaded?.snoozedUntilMs ?? null,
      hydrated: true,
    });
  })();
  return hydrating;
}

void hydrateVoiceCheckIn();

// ─── Mutations ────────────────────────────────────────────────────────

function sortAndCap(records: VoiceCheckInRecord[]): VoiceCheckInRecord[] {
  return [...records].sort((a, b) => a.dayIndex - b.dayIndex).slice(-MAX_RECORDS);
}

/**
 * Record (or overwrite) today's morning check-in. Completing clears any
 * active snooze. Persists asynchronously; in-memory state updates first so
 * the UI reflects it immediately.
 */
export function recordCheckIn(
  answers: VoiceCheckInAnswers,
  now: Date = new Date(),
): Promise<void> {
  const goal: CheckInGoalId = isCheckInGoal(answers.goal) ? answers.goal : 'train';
  const record: VoiceCheckInRecord = {
    dayKey: localDayKey(now),
    dayIndex: localDayIndex(now),
    completedAtMs: now.getTime(),
    answers: {
      energy: clampScale(answers.energy),
      stress: clampScale(answers.stress),
      goal,
    },
  };
  const withoutToday = current.records.filter((r) => r.dayKey !== record.dayKey);
  setState({
    records: sortAndCap([...withoutToday, record]),
    snoozedUntilMs: null,
    hydrated: true,
  });
  return persist();
}

/** Snooze the ritual until `untilMs` epoch ms. */
export function snoozeCheckIn(untilMs: number): Promise<void> {
  setState({ ...current, snoozedUntilMs: untilMs, hydrated: true });
  return persist();
}

/** Clear all persisted check-in state (reset / sign-out). */
export function clearVoiceCheckIn(): Promise<void> {
  setState({ records: [], snoozedUntilMs: null, hydrated: true });
  return enqueue(async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch {
      /* non-fatal */
    }
  });
}

// ─── Selectors ────────────────────────────────────────────────────────

/** The most recent completed check-in, or null. */
export function selectLatestRecord(
  state: VoiceCheckInState,
): VoiceCheckInRecord | null {
  return state.records.length > 0 ? state.records[state.records.length - 1] : null;
}

/** Local day key of the last completed check-in, or null. */
export function selectLastCompletedDayKey(state: VoiceCheckInState): string | null {
  return selectLatestRecord(state)?.dayKey ?? null;
}

/**
 * Is the morning check-in due right now? Always false until storage has
 * hydrated, so the overlay never flashes before we know the real history.
 */
export function selectIsCheckInDue(
  state: VoiceCheckInState,
  now: Date = new Date(),
): boolean {
  if (!state.hydrated) return false;
  return isCheckInDue({
    lastCompletedDayKey: selectLastCompletedDayKey(state),
    snoozedUntilMs: state.snoozedUntilMs,
    now,
  });
}

// ─── Subscribe / hook ─────────────────────────────────────────────────

export function subscribeVoiceCheckIn(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function useVoiceCheckInStore(): VoiceCheckInState {
  return useSyncExternalStore(
    subscribeVoiceCheckIn,
    getVoiceCheckInState,
    getVoiceCheckInState,
  );
}
