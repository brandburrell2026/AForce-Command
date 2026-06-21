/**
 * Intent Capture™ persistence service.
 *
 * Owns the persisted per-day intent selections (Ready / Recovering / Not Today)
 * in AsyncStorage and exposes a synchronous read surface (+ a
 * `useSyncExternalStore` subscribe hook) plus a serialized recorder. Like the
 * Voice Check-In service it lives OUTSIDE the hydration reducer / AppState
 * (Score-Protection isolation): recording an intent persists a row here and
 * never dispatches a reducer action, so it can never touch a hydration point,
 * performance band, or recovery score. Downstream surfaces read the captured
 * intent only to vary display-only / spoken coaching copy via the pure
 * `coachingPostureForIntent` helper.
 *
 * Mirrors services/voiceCheckIn.ts: `@aforce/*` key, a single in-module write
 * queue that serializes every persist, and a module-level store + listener set
 * powering `useSyncExternalStore`. One deliberate difference: hydration MERGES
 * by `dayKey` (newest `recordedAtMs` wins) rather than overwriting, so an
 * intent recorded before the first disk read completes is never clobbered.
 */
import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { localDayIndex, localDayKey } from '@/utils/voiceCheckIn';
import {
  isIntentId,
  isIntentSource,
  type IntentId,
  type IntentRecord,
  type IntentSource,
} from '@/utils/intentCapture';

const STORAGE_KEY = '@aforce/intent-capture';
/** Keep the history bounded — retain the most recent N days. */
const MAX_RECORDS = 120;

export interface IntentCaptureState {
  /** Captured intents, ascending by day. */
  records: IntentRecord[];
  /** False until AsyncStorage has been read at least once. */
  hydrated: boolean;
}

// ─── In-memory store (synchronous read surface) ───────────────────────

let current: IntentCaptureState = { records: [], hydrated: false };
const listeners = new Set<() => void>();

function notify(): void {
  for (const l of listeners) l();
}

function setState(next: IntentCaptureState): void {
  current = next;
  notify();
}

export function getIntentCaptureState(): IntentCaptureState {
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
  records: IntentRecord[];
}

function isRecord(v: unknown): v is IntentRecord {
  if (!v || typeof v !== 'object') return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.dayKey === 'string' &&
    typeof r.dayIndex === 'number' &&
    Number.isFinite(r.dayIndex) &&
    typeof r.recordedAtMs === 'number' &&
    isIntentId(r.intent) &&
    isIntentSource(r.source)
  );
}

function parse(raw: string | null): PersistedShape | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const p = parsed as Record<string, unknown>;
    const records = Array.isArray(p.records) ? p.records.filter(isRecord) : [];
    return { records };
  } catch {
    return null;
  }
}

function sortAndCap(records: IntentRecord[]): IntentRecord[] {
  return [...records].sort((a, b) => a.dayIndex - b.dayIndex).slice(-MAX_RECORDS);
}

/**
 * Merge two record lists by `dayKey`, keeping the row with the newest
 * `recordedAtMs` for each day. Used on hydration so an intent written before
 * the first disk read is preserved rather than clobbered by the load.
 */
function mergeByDay(a: IntentRecord[], b: IntentRecord[]): IntentRecord[] {
  const byDay = new Map<string, IntentRecord>();
  for (const r of [...a, ...b]) {
    const existing = byDay.get(r.dayKey);
    if (!existing || r.recordedAtMs >= existing.recordedAtMs) {
      byDay.set(r.dayKey, r);
    }
  }
  return sortAndCap([...byDay.values()]);
}

function persist(): Promise<void> {
  const snapshot: PersistedShape = { records: current.records };
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
 * Load persisted intents into memory. Idempotent — safe to call from app boot
 * and from the hook. Resolves once the first read completes.
 */
export function hydrateIntentCapture(): Promise<void> {
  if (current.hydrated) return Promise.resolve();
  if (hydrating) return hydrating;
  hydrating = (async () => {
    let loaded: PersistedShape | null = null;
    try {
      loaded = parse(await AsyncStorage.getItem(STORAGE_KEY));
    } catch {
      loaded = null;
    }
    // Merge by day (not overwrite) so an intent recorded before this first
    // disk read is preserved (newest recordedAtMs wins).
    setState({
      records: mergeByDay(current.records, loaded?.records ?? []),
      hydrated: true,
    });
  })();
  return hydrating;
}

void hydrateIntentCapture();

// ─── Mutations ────────────────────────────────────────────────────────

/**
 * Record (or overwrite) today's intent selection. Persists asynchronously;
 * in-memory state updates first so the UI reflects it immediately.
 */
export function recordIntent(
  intent: IntentId,
  source: IntentSource = 'voiceCheckIn',
  now: Date = new Date(),
): Promise<void> {
  if (!isIntentId(intent)) return Promise.resolve();
  const record: IntentRecord = {
    dayKey: localDayKey(now),
    dayIndex: localDayIndex(now),
    recordedAtMs: now.getTime(),
    intent,
    source: isIntentSource(source) ? source : 'voiceCheckIn',
  };
  const withoutToday = current.records.filter((r) => r.dayKey !== record.dayKey);
  setState({
    records: sortAndCap([...withoutToday, record]),
    hydrated: true,
  });
  return persist();
}

/** Clear all persisted intent state (reset / sign-out). */
export function clearIntentCapture(): Promise<void> {
  setState({ records: [], hydrated: true });
  return enqueue(async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch {
      /* non-fatal */
    }
  });
}

// ─── Selectors ────────────────────────────────────────────────────────

/** The most recent captured intent across all days, or null. */
export function selectLatestIntentRecord(
  state: IntentCaptureState,
): IntentRecord | null {
  return state.records.length > 0
    ? state.records[state.records.length - 1]
    : null;
}

/** Today's captured intent record, or null when none today. */
export function selectTodayIntentRecord(
  state: IntentCaptureState,
  now: Date = new Date(),
): IntentRecord | null {
  const key = localDayKey(now);
  for (let i = state.records.length - 1; i >= 0; i--) {
    if (state.records[i].dayKey === key) return state.records[i];
  }
  return null;
}

// ─── Subscribe / hook ─────────────────────────────────────────────────

export function subscribeIntentCapture(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function useIntentCaptureStore(): IntentCaptureState {
  return useSyncExternalStore(
    subscribeIntentCapture,
    getIntentCaptureState,
    getIntentCaptureState,
  );
}
