/**
 * Performance Statements™ persistence service.
 *
 * Owns the once-per-local-day delivery bookkeeping for the voice-only
 * Performance Statement: the day key it was last spoken, and a small bounded
 * list of recently-spoken statement ids (for de-duplication only). It stores
 * IDS ONLY — never the spoken text — so there is no archive of statements
 * (the feature is "if you miss it, you miss it").
 *
 * Like services/intentCapture.ts and services/voiceCheckIn.ts it lives OUTSIDE
 * the hydration reducer / AppState (Score-Protection isolation): recording a
 * delivery persists here and NEVER dispatches a reducer action, so it can never
 * touch a hydration point, performance band, or recovery score.
 *
 * Mirrors the intent service: `@aforce/*` key, a single in-module write queue
 * that serializes every persist, and a module-level store + listener set
 * powering `useSyncExternalStore`. Hydration MERGES (later dayKey wins, ids
 * unioned) rather than overwriting, so a delivery recorded before the first
 * disk read completes is never clobbered.
 */
import { useSyncExternalStore } from 'react';
import { scopedStorage } from './scopedStorage';
import { subscribeUserScope } from './userScope';

import { localDayKey } from '@/utils/voiceCheckIn';
import {
  dedupeIds,
  laterDayKey,
  mergeRecentlyUsed,
  RECENT_USED_CAP,
} from '@/utils/performanceStatements';

const STORAGE_KEY = '@aforce/performance-statements';

export interface PerformanceStatementState {
  /** Local day key 'YYYY-MM-DD' a statement was last spoken, or null. */
  lastSpokenDayKey: string | null;
  /** Recently-spoken statement ids, MOST-RECENT FIRST (bounded). */
  recentlyUsedIds: string[];
  /** False until AsyncStorage has been read at least once. */
  hydrated: boolean;
}

// ─── In-memory store (synchronous read surface) ───────────────────────

let current: PerformanceStatementState = {
  lastSpokenDayKey: null,
  recentlyUsedIds: [],
  hydrated: false,
};
const listeners = new Set<() => void>();

function notify(): void {
  for (const l of listeners) l();
}

function setState(next: PerformanceStatementState): void {
  current = next;
  notify();
}

export function getPerformanceStatementState(): PerformanceStatementState {
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
  lastSpokenDayKey: string | null;
  recentlyUsedIds: string[];
}

function parse(raw: string | null): PersistedShape | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const p = parsed as Record<string, unknown>;
    const lastSpokenDayKey =
      typeof p.lastSpokenDayKey === 'string' ? p.lastSpokenDayKey : null;
    const recentlyUsedIds = Array.isArray(p.recentlyUsedIds)
      ? dedupeIds(p.recentlyUsedIds.filter((x): x is string => typeof x === 'string'))
      : [];
    return { lastSpokenDayKey, recentlyUsedIds };
  } catch {
    return null;
  }
}

function persist(): Promise<void> {
  const snapshot: PersistedShape = {
    lastSpokenDayKey: current.lastSpokenDayKey,
    recentlyUsedIds: current.recentlyUsedIds,
  };
  return enqueue(async () => {
    try {
      await scopedStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } catch {
      /* non-fatal: in-memory state is still authoritative */
    }
  });
}

let hydrating: Promise<void> | null = null;

/**
 * Load persisted state into memory. Idempotent — resolves once the first read
 * completes. Merges (does not overwrite) so a delivery recorded before this
 * first disk read is preserved.
 *
 * Deliberately NOT called at module import (unlike some sibling services): this
 * feature is flag-gated and nothing outside the gated mount reads the store, so
 * hydration runs only from the hook's mount effect — which itself only mounts
 * when `performance_statements_enabled` is on. With the flag off this module
 * performs zero AsyncStorage work (flag-off inert lock).
 */
export function hydratePerformanceStatements(): Promise<void> {
  if (current.hydrated) return Promise.resolve();
  if (hydrating) return hydrating;
  hydrating = (async () => {
    let loaded: PersistedShape | null = null;
    try {
      loaded = parse(await scopedStorage.getItem(STORAGE_KEY));
    } catch {
      loaded = null;
    }
    setState({
      lastSpokenDayKey: laterDayKey(
        current.lastSpokenDayKey,
        loaded?.lastSpokenDayKey ?? null,
      ),
      recentlyUsedIds: mergeRecentlyUsed(
        current.recentlyUsedIds,
        loaded?.recentlyUsedIds ?? [],
      ),
      hydrated: true,
    });
  })();
  return hydrating;
}

// ─── Mutations ────────────────────────────────────────────────────────

/**
 * Record that statement `id` was spoken now. Updates the last-spoken day key and
 * prepends the id to the bounded recent list. Persists asynchronously; in-memory
 * state updates first. Stores the id only — never the spoken text.
 */
export function recordStatementDelivered(
  id: string,
  now: Date = new Date(),
): Promise<void> {
  if (typeof id !== 'string' || id.length === 0) return Promise.resolve();
  setState({
    lastSpokenDayKey: localDayKey(now),
    recentlyUsedIds: mergeRecentlyUsed([id], current.recentlyUsedIds),
    hydrated: true,
  });
  return persist();
}

/** Clear all persisted state (reset / sign-out). */
export function clearPerformanceStatements(): Promise<void> {
  setState({ lastSpokenDayKey: null, recentlyUsedIds: [], hydrated: true });
  return enqueue(async () => {
    try {
      await scopedStorage.removeItem(STORAGE_KEY);
    } catch {
      /* non-fatal */
    }
  });
}

// ─── Selectors ────────────────────────────────────────────────────────

/** True when a statement has already been spoken for today's local day. */
export function selectAlreadySpokenToday(
  state: PerformanceStatementState,
  now: Date = new Date(),
): boolean {
  return state.lastSpokenDayKey != null && state.lastSpokenDayKey === localDayKey(now);
}

/** Recently-spoken ids, most-recent first. */
export function selectRecentlyUsedIds(
  state: PerformanceStatementState,
): readonly string[] {
  return state.recentlyUsedIds;
}

// ─── Subscribe / hook ─────────────────────────────────────────────────

export function subscribePerformanceStatements(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function usePerformanceStatementStore(): PerformanceStatementState {
  return useSyncExternalStore(
    subscribePerformanceStatements,
    getPerformanceStatementState,
    getPerformanceStatementState,
  );
}

export const RECENT_STATEMENT_CAP = RECENT_USED_CAP;

// Wave-2 PR6: user-scope change → reset to un-hydrated (disk untouched).
subscribeUserScope(() => {
  hydrating = null;
  setState({ lastSpokenDayKey: null, recentlyUsedIds: [], hydrated: false });
});
