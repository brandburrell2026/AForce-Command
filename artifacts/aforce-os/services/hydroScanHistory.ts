/**
 * HydroScan History™ persistence service.
 *
 * Owns the local, advisory log of HydroScan 2.0 scans in AsyncStorage and
 * exposes a synchronous read surface (+ `useSyncExternalStore` subscribe
 * hook) plus a serialized recorder. It lives OUTSIDE the hydration reducer /
 * AppState (Score-Protection isolation): recording a scan writes an advisory
 * row here and NEVER dispatches a reducer action, so it can never touch a
 * hydration point, performance band, or recovery score — not even when the
 * user answered "Consumed: Yes". Only an explicit "Log Intake" mutates score.
 *
 * Mirrors the persistence pattern in `services/voiceCheckIn.ts`:
 *   • `@aforce/*` key, async, best-effort (storage failures are non-fatal).
 *   • A single in-module write queue serializes every persist so concurrent
 *     recorders cannot clobber each other.
 *   • A module-level store + listener set powers `useSyncExternalStore`
 *     without pulling in a global store.
 */
import { useSyncExternalStore } from 'react';
import { scopedStorage } from './scopedStorage';
import { subscribeUserScope } from './userScope';

import type {
  ConsumptionStatus,
  HydrationImpactLevel,
  HydroScanHistoryEntry,
  TimingGuidanceLevel,
  UnknownProductType,
} from '@/types/scan';

const STORAGE_KEY = '@aforce/hydroscan-history';
/** Keep the history bounded — retain the most recent N scans. */
export const MAX_ENTRIES = 100;

export interface HydroScanHistoryState {
  /** Recorded scans, most recent first. */
  entries: HydroScanHistoryEntry[];
  /** False until AsyncStorage has been read at least once. */
  hydrated: boolean;
}

/** A scan to record — everything except the generated id. */
export type HydroScanHistoryInput = Omit<HydroScanHistoryEntry, 'id'> & { id?: string };

// ─── In-memory store (synchronous read surface) ───────────────────────

let current: HydroScanHistoryState = { entries: [], hydrated: false };
const listeners = new Set<() => void>();

function notify(): void {
  for (const l of listeners) l();
}

function setState(next: HydroScanHistoryState): void {
  current = next;
  notify();
}

export function getHydroScanHistoryState(): HydroScanHistoryState {
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

const CONSUMPTION: readonly ConsumptionStatus[] = ['consumed', 'not_yet', 'just_curious'];
const IMPACT_LEVELS: readonly HydrationImpactLevel[] = [
  'HIGH_SUPPORT',
  'NEUTRAL',
  'MODERATE_IMPACT',
  'HIGH_IMPACT',
];
const TIMING_LEVELS: readonly TimingGuidanceLevel[] = [
  'GOOD_TIMING',
  'HYDRATE_FIRST',
  'BEST_AFTER_NEXT_WATER_CYCLE',
];
const UNKNOWN_TYPES: readonly UnknownProductType[] = [
  'water',
  'protein',
  'energy',
  'supplement',
  'other',
];

function isEntry(v: unknown): v is HydroScanHistoryEntry {
  if (!v || typeof v !== 'object') return false;
  const r = v as Record<string, unknown>;
  if (typeof r.id !== 'string') return false;
  if (typeof r.scannedAt !== 'string') return false;
  if (typeof r.productName !== 'string') return false;
  if (typeof r.isAForce !== 'boolean') return false;
  if (!CONSUMPTION.includes(r.consumption as ConsumptionStatus)) return false;
  if (!IMPACT_LEVELS.includes(r.impactLevel as HydrationImpactLevel)) return false;
  if (!TIMING_LEVELS.includes(r.timingLevel as TimingGuidanceLevel)) return false;
  if (
    r.unknownType !== undefined &&
    !UNKNOWN_TYPES.includes(r.unknownType as UnknownProductType)
  )
    return false;
  return true;
}

function parse(raw: string | null): HydroScanHistoryEntry[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed.filter(isEntry);
  } catch {
    return null;
  }
}

function persist(): Promise<void> {
  const snapshot = current.entries;
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
 * Load persisted scans into memory. Idempotent — safe to call from app boot
 * and from the hook. Resolves once the first read completes.
 */
export function hydrateHydroScanHistory(): Promise<void> {
  if (current.hydrated) return Promise.resolve();
  if (hydrating) return hydrating;
  hydrating = (async () => {
    let loaded: HydroScanHistoryEntry[] | null = null;
    try {
      loaded = parse(await scopedStorage.getItem(STORAGE_KEY));
    } catch {
      loaded = null;
    }
    // Merge any entries recorded during the hydration window (an early
    // recordScan() before this load resolved) so the late load can never
    // clobber a just-recorded scan. Dedupe by id; newest-first via sortAndCap.
    const merged = mergeById(loaded ?? [], current.entries);
    setState({ entries: sortAndCap(merged), hydrated: true });
  })();
  return hydrating;
}

/** Union two entry lists, keeping the first occurrence of each id. */
function mergeById(
  a: HydroScanHistoryEntry[],
  b: HydroScanHistoryEntry[],
): HydroScanHistoryEntry[] {
  const seen = new Set<string>();
  const out: HydroScanHistoryEntry[] = [];
  for (const e of [...a, ...b]) {
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    out.push(e);
  }
  return out;
}

void hydrateHydroScanHistory();

// ─── Mutations ────────────────────────────────────────────────────────

/** Most recent first, bounded to MAX_ENTRIES. */
function sortAndCap(entries: HydroScanHistoryEntry[]): HydroScanHistoryEntry[] {
  return [...entries]
    .sort((a, b) => timeOf(b.scannedAt) - timeOf(a.scannedAt))
    .slice(0, MAX_ENTRIES);
}

function timeOf(iso: string): number {
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : 0;
}

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Record an advisory HydroScan row. Persists asynchronously; in-memory state
 * updates first so the UI reflects it immediately. Returns the generated id.
 * NEVER mutates score — advisory history only.
 */
export function recordScan(input: HydroScanHistoryInput): Promise<void> {
  const entry: HydroScanHistoryEntry = { ...input, id: input.id ?? makeId() };
  setState({
    entries: sortAndCap([entry, ...current.entries]),
    hydrated: true,
  });
  return persist();
}

/** Clear all persisted HydroScan history (reset / sign-out). */
export function clearHydroScanHistory(): Promise<void> {
  setState({ entries: [], hydrated: true });
  return enqueue(async () => {
    try {
      await scopedStorage.removeItem(STORAGE_KEY);
    } catch {
      /* non-fatal */
    }
  });
}

// ─── Selectors ────────────────────────────────────────────────────────

/** All recorded scans, most recent first. */
export function selectEntries(state: HydroScanHistoryState): HydroScanHistoryEntry[] {
  return state.entries;
}

/** The most recent scan, or null. */
export function selectLatestScan(
  state: HydroScanHistoryState,
): HydroScanHistoryEntry | null {
  return state.entries.length > 0 ? state.entries[0] : null;
}

// ─── Subscribe / hook ─────────────────────────────────────────────────

export function subscribeHydroScanHistory(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function useHydroScanHistoryStore(): HydroScanHistoryState {
  return useSyncExternalStore(
    subscribeHydroScanHistory,
    getHydroScanHistoryState,
    getHydroScanHistoryState,
  );
}

// Wave-2 PR6: user-scope change → reset to un-hydrated (disk untouched).
subscribeUserScope(() => {
  hydrating = null;
  setState({ entries: [], hydrated: false });
});
