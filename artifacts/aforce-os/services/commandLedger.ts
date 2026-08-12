/**
 * Command-Event Ledger persistence service (Tier-1 Intelligence Core).
 *
 * Owns the local, append-only Command-Event Ledger in AsyncStorage and
 * exposes a synchronous read surface (+ `useSyncExternalStore` hook) plus a
 * serialized appender. It lives OUTSIDE the hydration reducer / AppState
 * (Score-Protection isolation): the ledger only RECORDS real completed
 * behaviour and context provenance, and never dispatches a reducer action,
 * so it can never touch a hydration point, performance band, or recovery
 * score. The three engines read it through the pure adapters in
 * `utils/intelligence/commandEventAdapters.ts`.
 *
 * Mirrors the persistence pattern in `services/hydroScanHistory.ts`:
 *   • `@aforce/*` key, async, best-effort (storage failures are non-fatal).
 *   • A single in-module write queue serializes every persist so concurrent
 *     appenders cannot clobber each other.
 *   • Boot hydration MERGES (never overwrites) so an early append before the
 *     first load resolves is preserved.
 *   • A module-level store + listener set powers `useSyncExternalStore`
 *     without pulling in a global store.
 *
 * All merging / sorting / capping / validation is delegated to the pure
 * `mergeCommandEvents` so the persisted shape and the unit-tested invariants
 * stay in lockstep. This service deliberately does NO live wiring into the
 * reducer or screens — population is driven by callers passing already-built
 * events (via the adapters), in a later, separately-approved step.
 */
import { useSyncExternalStore } from 'react';
import { scopedStorage } from './scopedStorage';
import { subscribeUserScope } from './userScope';

import {
  mergeCommandEvents,
  MAX_LEDGER_EVENTS,
  type CommandEvent,
} from '@/utils/intelligence/commandEvents';
import type { IntakeEvent } from '@/types';
import type { VoiceCheckInRecord } from '@/utils/voiceCheckIn';
import type { PerformanceAgeDailySnapshot } from '@/utils/performanceAge';
import {
  collectIntakeCommandEvents,
  collectVoiceCheckInCommandEvents,
  collectPerformanceAgeSnapshotEvents,
  collectConfirmationCommandEvents,
  collectContextSnapshotCommandEvents,
  type ConfirmationSource,
  type ContextSnapshotSource,
} from '@/utils/intelligence/commandEventAdapters';

const STORAGE_KEY = '@aforce/command-ledger';

export interface CommandLedgerState {
  /** The ledger, oldest → newest (the pure merge owns ordering + cap). */
  events: CommandEvent[];
  /** False until AsyncStorage has been read at least once. */
  hydrated: boolean;
}

/** Sources the ledger can ingest in one pass (all optional). */
export interface CommandLedgerSources {
  intakeEvents?: readonly IntakeEvent[] | null;
  voiceCheckIns?: readonly VoiceCheckInRecord[] | null;
  performanceAgeSnapshots?: readonly PerformanceAgeDailySnapshot[] | null;
  commandConfirmations?: readonly ConfirmationSource[] | null;
  contextSnapshots?: readonly ContextSnapshotSource[] | null;
}

// ─── In-memory store (synchronous read surface) ───────────────────────

let current: CommandLedgerState = { events: [], hydrated: false };
const listeners = new Set<() => void>();

function notify(): void {
  for (const l of listeners) l();
}

function setState(next: CommandLedgerState): void {
  current = next;
  notify();
}

export function getCommandLedgerState(): CommandLedgerState {
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
  const snapshot = current.events;
  return enqueue(async () => {
    try {
      await scopedStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } catch {
      /* non-fatal: in-memory state is still authoritative */
    }
  });
}

function parse(raw: string | null): unknown[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

let hydrating: Promise<void> | null = null;
/**
 * Bumped by `clearCommandLedger()`. An in-flight hydrate captures the value
 * at start and abandons its result if it changed — so a reset / sign-out can
 * never be undone by a late load resurrecting cleared events.
 */
let generation = 0;

/**
 * Load the persisted ledger into memory. Idempotent — safe to call from app
 * boot and from the hook. Resolves once the first read completes. Any events
 * appended during the hydration window are MERGED with the loaded set (the
 * late load can never clobber a just-appended event); `mergeCommandEvents`
 * dedupes by id, sorts, and caps. Appends persist only AFTER this resolves
 * (see `appendCommandEvents`), so a pre-hydration append can never overwrite
 * stored history before it has been read and merged.
 */
export function hydrateCommandLedger(): Promise<void> {
  if (current.hydrated) return Promise.resolve();
  if (hydrating) return hydrating;
  const gen = generation;
  hydrating = (async () => {
    let loaded: unknown[] = [];
    try {
      loaded = parse(await scopedStorage.getItem(STORAGE_KEY));
    } catch {
      loaded = [];
    }
    // A clear() during the read abandons this result (no resurrection).
    if (gen !== generation) return;
    // Existing (loaded) first so persisted ids win; in-flight appends merge in.
    const merged = mergeCommandEvents(loaded, current.events);
    setState({ events: merged, hydrated: true });
  })();
  return hydrating;
}

void hydrateCommandLedger();

// ─── Mutations ────────────────────────────────────────────────────────

/**
 * Append already-built `CommandEvent`s to the ledger. Pass events produced
 * by the adapter mappers. In-memory state updates first (so reads reflect it
 * immediately), then it persists asynchronously. Idempotent: events with an
 * id already present are ignored by the merge (no double-count). Returns once
 * the persist is enqueued.
 *
 * NEVER mutates score — the ledger is an advisory record only.
 */
export function appendCommandEvents(incoming: readonly CommandEvent[]): Promise<void> {
  if (!incoming || incoming.length === 0) return Promise.resolve();
  // Update memory immediately so synchronous reads reflect the append, but do
  // NOT flip `hydrated` — hydration must still run and merge in persisted
  // history. Persist only after hydration has read storage, so a pre-hydration
  // append can never clobber stored history before it is merged.
  setState({
    events: mergeCommandEvents(current.events, incoming, { cap: MAX_LEDGER_EVENTS }),
    hydrated: current.hydrated,
  });
  return hydrateCommandLedger().then(() => persist());
}

/**
 * Convenience: build events from the scattered sources via the pure
 * collectors and append them in one merge. Lets a caller re-derive the
 * ledger from current app state without double-counting (stable ids).
 */
export function ingestCommandLedgerSources(sources: CommandLedgerSources): Promise<void> {
  const incoming: CommandEvent[] = [
    ...collectIntakeCommandEvents(sources.intakeEvents),
    ...collectVoiceCheckInCommandEvents(sources.voiceCheckIns),
    ...collectPerformanceAgeSnapshotEvents(sources.performanceAgeSnapshots),
    ...collectConfirmationCommandEvents(sources.commandConfirmations),
    ...collectContextSnapshotCommandEvents(sources.contextSnapshots),
  ];
  return appendCommandEvents(incoming);
}

/** Clear the entire persisted ledger (reset / sign-out). */
export function clearCommandLedger(): Promise<void> {
  // Bump the generation so any in-flight hydrate abandons its result, and drop
  // the cached promise so a later hydrate can't re-apply stale loaded events.
  // Marking hydrated short-circuits future hydrate() reads after the clear.
  generation += 1;
  hydrating = null;
  setState({ events: [], hydrated: true });
  return enqueue(async () => {
    try {
      await scopedStorage.removeItem(STORAGE_KEY);
    } catch {
      /* non-fatal */
    }
  });
}

// ─── Selectors ────────────────────────────────────────────────────────

/** The full ledger (oldest → newest). */
export function selectCommandEvents(state: CommandLedgerState): CommandEvent[] {
  return state.events;
}

// ─── Subscribe / hook ─────────────────────────────────────────────────

export function subscribeCommandLedger(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function useCommandLedgerStore(): CommandLedgerState {
  return useSyncExternalStore(
    subscribeCommandLedger,
    getCommandLedgerState,
    getCommandLedgerState,
  );
}

// Wave-2 PR6: a user-scope change is a security boundary — abandon any
// in-flight hydrate and reset to UN-hydrated (disk untouched: the prior
// account's ledger stays under its own scoped key).
subscribeUserScope(() => {
  generation += 1;
  hydrating = null;
  setState({ events: [], hydrated: false });
});
