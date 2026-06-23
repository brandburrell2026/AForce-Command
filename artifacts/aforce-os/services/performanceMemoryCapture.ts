/**
 * Performance Memory capture service.
 *
 * Owns the local AsyncStorage record of the three capture streams Performance
 * Memory was missing — travel days, caffeine intake, and the member's
 * self-reported daily priority — and exposes a synchronous read surface
 * (+ `useSyncExternalStore` hook) plus serialized, best-effort appenders.
 *
 * It lives OUTSIDE the hydration reducer / AppState (Score-Protection
 * isolation), exactly like `services/commandLedger.ts`: it only RECORDS real
 * behaviour and never dispatches a reducer action, so it can never touch a
 * hydration point, performance band, or recovery score. The unified
 * Performance Memory aggregator reads it through the pure helpers in
 * `utils/performanceMemorySignals.ts` (which own all merge / prune / cap /
 * validation), so the persisted shape and the unit-tested invariants stay in
 * lockstep.
 *
 * Persistence pattern mirrors `commandLedger.ts`:
 *   • `@aforce/*` key, async, best-effort (storage failures are non-fatal).
 *   • A single in-module write queue serializes every persist.
 *   • Boot hydration MERGES (never overwrites) so an early append before the
 *     first load resolves is preserved (boot-race fix).
 *   • A generation counter lets `clear()` abandon an in-flight hydrate so a
 *     reset / sign-out can never be undone by a late load.
 */
import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  buildTravelSignal,
  buildCaffeineSignal,
  buildUserPrioritySignal,
  mergeSignals,
  sanitizeCaptureState,
  emptyCaptureState,
  type PerformanceMemoryCaptureState,
} from '@/utils/performanceMemorySignals';

const STORAGE_KEY = '@aforce/performance-memory-capture';

// ─── In-memory store (synchronous read surface) ───────────────────────

let current: PerformanceMemoryCaptureState = emptyCaptureState();
const listeners = new Set<() => void>();

function notify(): void {
  for (const l of listeners) l();
}

function setState(next: PerformanceMemoryCaptureState): void {
  current = next;
  notify();
}

export function getPerformanceMemoryCaptureSnapshot(): PerformanceMemoryCaptureState {
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

function persist(): Promise<void> {
  const snapshot = {
    travel: current.travel,
    caffeine: current.caffeine,
    priorities: current.priorities,
  };
  return enqueue(async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } catch {
      /* non-fatal: in-memory state is still authoritative */
    }
  });
}

// ─── Hydration (idempotent, merge-on-load) ────────────────────────────

let hydrating: Promise<void> | null = null;
/**
 * Bumped by `clearPerformanceMemoryCapture()`. An in-flight hydrate captures
 * the value at start and abandons its result if it changed — so a reset can
 * never be undone by a late load resurrecting cleared signals.
 */
let generation = 0;

/**
 * Load persisted capture streams into memory. Idempotent. Any signals appended
 * during the hydration window are MERGED with the loaded set (existing-id wins
 * via `mergeSignals`), so a pre-hydration append can never clobber stored
 * history before it has been read. Appends persist only AFTER this resolves.
 */
export function hydratePerformanceMemoryCapture(): Promise<void> {
  if (current.hydrated) return Promise.resolve();
  if (hydrating) return hydrating;
  const gen = generation;
  hydrating = (async () => {
    let loaded: PerformanceMemoryCaptureState = emptyCaptureState();
    const now = Date.now();
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      loaded = sanitizeCaptureState(raw ? JSON.parse(raw) : null, now);
    } catch {
      loaded = emptyCaptureState();
    }
    // A clear() during the read abandons this result (no resurrection).
    if (gen !== generation) return;
    // Loaded first so persisted ids win; in-flight appends merge in after.
    setState({
      travel: mergeSignals(loaded.travel, current.travel, now),
      caffeine: mergeSignals(loaded.caffeine, current.caffeine, now),
      priorities: mergeSignals(loaded.priorities, current.priorities, now),
      hydrated: true,
    });
  })();
  return hydrating;
}

void hydratePerformanceMemoryCapture();

// ─── Mutations (observational only — NEVER score) ─────────────────────

/**
 * Record that today was a travel day. Idempotent per UTC day. In-memory state
 * updates first; persist runs only after hydration has merged stored history.
 */
export function recordTravelSignal(atMs: number = Date.now()): Promise<void> {
  const signal = buildTravelSignal(atMs);
  if (!signal) return Promise.resolve();
  const now = Date.now();
  setState({
    ...current,
    travel: mergeSignals(current.travel, [signal], now),
  });
  return hydratePerformanceMemoryCapture().then(() => persist());
}

/**
 * Record a caffeinated intake. Idempotent per intake event id, so re-deriving
 * the same drink never double-counts.
 */
export function recordCaffeineSignal(args: {
  intakeEventId: string;
  atMs?: number;
  categoryId?: string;
}): Promise<void> {
  const atMs = args.atMs ?? Date.now();
  const signal = buildCaffeineSignal({
    intakeEventId: args.intakeEventId,
    atMs,
    categoryId: args.categoryId,
  });
  if (!signal) return Promise.resolve();
  const now = Date.now();
  setState({
    ...current,
    caffeine: mergeSignals(current.caffeine, [signal], now),
  });
  return hydratePerformanceMemoryCapture().then(() => persist());
}

/**
 * Record the member's self-reported daily priority (check-in goal). A
 * same-day re-check-in is a distinct signal; the aggregator keeps the latest
 * per day. A missing goal records nothing.
 */
export function recordUserPrioritySignal(args: {
  goal: string;
  atMs?: number;
  dayIndex?: number;
}): Promise<void> {
  const atMs = args.atMs ?? Date.now();
  const signal = buildUserPrioritySignal({
    goal: args.goal,
    atMs,
    dayIndex: args.dayIndex,
  });
  if (!signal) return Promise.resolve();
  const now = Date.now();
  setState({
    ...current,
    priorities: mergeSignals(current.priorities, [signal], now),
  });
  return hydratePerformanceMemoryCapture().then(() => persist());
}

/** Clear all persisted capture streams (reset / sign-out / governance delete). */
export function clearPerformanceMemoryCapture(): Promise<void> {
  // Bump the generation so any in-flight hydrate abandons its result, drop the
  // cached promise, and mark hydrated so future hydrate() reads short-circuit.
  generation += 1;
  hydrating = null;
  setState({ travel: [], caffeine: [], priorities: [], hydrated: true });
  return enqueue(async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch {
      /* non-fatal */
    }
  });
}

// ─── Subscribe / hook ─────────────────────────────────────────────────

export function subscribePerformanceMemoryCapture(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function usePerformanceMemoryCaptureStore(): PerformanceMemoryCaptureState {
  return useSyncExternalStore(
    subscribePerformanceMemoryCapture,
    getPerformanceMemoryCaptureSnapshot,
    getPerformanceMemoryCaptureSnapshot,
  );
}
