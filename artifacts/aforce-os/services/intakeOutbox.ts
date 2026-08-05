/**
 * Offline Intake Outbox persistence service.
 *
 * Owns the local, durable queue of intakes the user completed while the device
 * could not reach the server, in AsyncStorage, and exposes a synchronous read
 * surface (+ `useSyncExternalStore` hook) plus serialized mutators. All queue
 * math (merge / dedupe / status transitions / backoff / overlay / staleness) is
 * delegated to the pure `utils/intakeOutbox` core so the persisted shape and the
 * unit-tested invariants stay in lockstep.
 *
 * Mirrors `services/commandLedger.ts`:
 *   • `@aforce/*` key, async, best-effort (storage failures are non-fatal).
 *   • A single in-module write queue serializes every persist.
 *   • Boot hydration MERGES (never overwrites) so an enqueue that lands before
 *     the first load resolves is preserved.
 *   • A generation guard so a `clear()` (sign-out / reset) can never be undone
 *     by a late load resurrecting cleared items.
 *   • A module-level store + listener set powers `useSyncExternalStore`.
 *
 * Score-Protection / flag-off discipline: this module has NO top-level I/O. It
 * only defines functions and an empty in-memory store, so importing it is a
 * byte-identical no-op. Hydration is kicked EXPLICITLY by the flag-gated wiring
 * (logIntake enqueue, the AppState flush, the UI badge) and never at module
 * load — when `offline_intake_outbox_enabled` is OFF nothing calls in here, so
 * the queue is never touched. The queue only RECORDS completed behaviour and
 * carries frozen scores; it never recomputes or mutates a score.
 */
import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  mergeOutboxItems,
  markSyncing as applyMarkSyncing,
  markSynced as applyMarkSynced,
  markFailed as applyMarkFailed,
  pruneSynced as applyPruneSynced,
  dueItems,
  pendingOverlay,
  countPending,
  MAX_OUTBOX_ITEMS,
  type OutboxItem,
  type PreparedIntake,
  type PendingOverlay,
} from '@/utils/intakeOutbox';

const STORAGE_KEY_BASE = '@aforce/intake-outbox';

// The outbox is scoped to the authenticated user: each account's durable queue
// lives under its own per-user key so a queue built under one account can never
// be read or replayed under another on a shared device (replay posts under the
// CURRENT Clerk session). The flag-gated auth bridge sets this on sign-in and
// clears it (→ null) on sign-out / user switch. While null there is no user
// scope and ALL persistence/hydration is a no-op — nothing is safe to read or
// write yet. (Flag-off never sets a scope, so the service stays fully inert.)
let scopedUserId: string | null = null;

function storageKey(): string | null {
  return scopedUserId == null ? null : `${STORAGE_KEY_BASE}:${scopedUserId}`;
}

export interface IntakeOutboxState {
  /** The queue, oldest → newest (the pure merge owns ordering + cap). */
  items: OutboxItem[];
  /** False until AsyncStorage has been read at least once. */
  hydrated: boolean;
}

// ─── In-memory store (synchronous read surface) ───────────────────────

let current: IntakeOutboxState = { items: [], hydrated: false };
const listeners = new Set<() => void>();

function notify(): void {
  for (const l of listeners) l();
}

function setState(next: IntakeOutboxState): void {
  current = next;
  notify();
}

export function getIntakeOutboxState(): IntakeOutboxState {
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
  const key = storageKey();
  if (key == null) return Promise.resolve(); // no user scope → nothing to persist
  const snapshot = current.items;
  return enqueue(async () => {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(snapshot));
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
 * Bumped by `clearIntakeOutbox()`. An in-flight hydrate captures the value at
 * start and abandons its result if it changed — so a reset / sign-out can never
 * be undone by a late load resurrecting cleared items.
 */
let generation = 0;

/**
 * Load the persisted queue into memory. Idempotent — safe to call from the flag
 * gated wiring and from the hook. Resolves once the first read completes. Any
 * items enqueued during the hydration window are MERGED with the loaded set (the
 * late load can never clobber a just-enqueued item); the pure merge dedupes by
 * `clientEventId`, sorts, and caps. Persists run only AFTER this resolves (see
 * the mutators), so a pre-hydration enqueue can never overwrite stored history
 * before it has been read and merged.
 */
export function hydrateIntakeOutbox(): Promise<void> {
  if (current.hydrated) return Promise.resolve();
  if (hydrating) return hydrating;
  const key = storageKey();
  if (key == null) return Promise.resolve(); // no user scope yet → nothing to load
  const gen = generation;
  hydrating = (async () => {
    let loaded: unknown[] = [];
    try {
      loaded = parse(await AsyncStorage.getItem(key));
    } catch {
      loaded = [];
    }
    // A clear() during the read abandons this result (no resurrection).
    if (gen !== generation) return;
    // Loaded first so persisted ids win; in-flight enqueues merge in.
    const merged = mergeOutboxItems(loaded, current.items);
    setState({ items: merged, hydrated: true });
  })();
  return hydrating;
}

// ─── Mutations ────────────────────────────────────────────────────────

/**
 * Enqueue one prepared intake. In-memory state updates first (so reads reflect
 * it immediately) but `hydrated` is NOT flipped — hydration must still run and
 * merge in persisted history. Persist only after hydration has read storage so
 * a pre-hydration enqueue can never clobber stored history before it is merged.
 * Idempotent: an item whose `clientEventId` is already queued is ignored by the
 * merge (no double-enqueue). Returns once the persist is enqueued.
 */
export function enqueueIntake(
  prepared: PreparedIntake,
  nowMs: number = Date.now(),
): Promise<void> {
  const item: OutboxItem = {
    prepared,
    status: 'pending',
    attempts: 0,
    createdAtMs: nowMs,
    nextAttemptAtMs: nowMs,
  };
  setState({
    items: mergeOutboxItems(current.items, [item], { cap: MAX_OUTBOX_ITEMS }),
    hydrated: current.hydrated,
  });
  return hydrateIntakeOutbox().then(() => persist());
}

function applyTransition(fn: (items: OutboxItem[]) => OutboxItem[]): Promise<void> {
  setState({ items: fn(current.items), hydrated: current.hydrated });
  return hydrateIntakeOutbox().then(() => persist());
}

/** Flag a queued item as in-flight. */
export function markIntakeSyncing(clientEventId: string): Promise<void> {
  return applyTransition((items) => applyMarkSyncing(items, clientEventId));
}

/** Flag a queued item as confirmed landed on the server. */
export function markIntakeSynced(clientEventId: string): Promise<void> {
  return applyTransition((items) => applyMarkSynced(items, clientEventId));
}

/** Record a failed send: bump attempts + schedule the next backoff retry. */
export function markIntakeFailed(
  clientEventId: string,
  nowMs: number = Date.now(),
): Promise<void> {
  return applyTransition((items) => applyMarkFailed(items, clientEventId, nowMs));
}

/** Drop confirmed items to keep storage small (run after a successful reconcile). */
export function pruneSyncedIntakes(): Promise<void> {
  return applyTransition((items) => applyPruneSynced(items));
}

/** Clear the entire persisted queue (reset / sign-out). */
export function clearIntakeOutbox(): Promise<void> {
  // Bump the generation so any in-flight hydrate abandons its result, drop the
  // cached promise so a later hydrate can't re-apply stale loaded items, and
  // mark hydrated to short-circuit future reads after the clear. Removes the
  // CURRENT user's scoped key only (no-op when there is no active scope).
  generation += 1;
  hydrating = null;
  setState({ items: [], hydrated: true });
  const key = storageKey();
  if (key == null) return Promise.resolve();
  return enqueue(async () => {
    try {
      await AsyncStorage.removeItem(key);
    } catch {
      /* non-fatal */
    }
  });
}

/**
 * Scope the outbox to the authenticated user. Called by the flag-gated auth
 * bridge on sign-in (`userId`) and on sign-out / user switch (`null`).
 *
 * A change of user (including → null) is the security boundary: it bumps the
 * generation (abandoning any in-flight hydrate), drops the cached hydrate
 * promise, and resets the in-memory queue to empty + un-hydrated so the next
 * account can never see or replay the previous user's items. The previous
 * user's queue is left untouched under THEIR per-user key, so it still replays
 * if they sign back in. Same-user calls (e.g. a component remount) are a no-op,
 * so an in-flight enqueue is preserved.
 */
export function setIntakeOutboxUser(userId: string | null): void {
  if (userId === scopedUserId) return;
  generation += 1;
  hydrating = null;
  scopedUserId = userId;
  setState({ items: [], hydrated: false });
}

// ─── Selectors ────────────────────────────────────────────────────────

/** The full queue (oldest → newest). */
export function selectOutboxItems(state: IntakeOutboxState): OutboxItem[] {
  return state.items;
}

/** Unsynced items whose retry time has arrived, in Water-First log order. */
export function selectDueIntakes(state: IntakeOutboxState, nowMs: number = Date.now()): OutboxItem[] {
  return dueItems(state.items, nowMs);
}

/** Optimistic overlay (badge count + non-stale today deltas) for the UI. */
export function selectPendingOverlay(
  state: IntakeOutboxState,
  nowMs: number = Date.now(),
): PendingOverlay {
  return pendingOverlay(state.items, nowMs);
}

/** Count of unsynced items (UI badge value). */
export function selectPendingCount(state: IntakeOutboxState): number {
  return countPending(state.items);
}

/**
 * True when at least one queued item's most recent send attempt failed (it is
 * still queued — `markIntakeFailed` schedules a backoff retry, it never drops
 * the item). Drives `AFOfflineBanner`'s distinct "last attempt failed, still
 * retrying" copy vs. its plainer "queued, not yet synced" copy.
 */
export function selectHasFailedItem(state: IntakeOutboxState): boolean {
  return state.items.some((item) => item.status === 'failed');
}

// ─── Flush coordination (module-level, RC-1 W3P2 carried follow-up c) ──
// The flush LOOP itself (drain due items via the network layer) lives in
// `store/useAppStore.tsx`'s `flushOutbox` — this module intentionally has
// no network dependency (see the file header: no top-level I/O beyond
// AsyncStorage). Until now, "only one flush runs at a time" was enforced
// solely by a `useRef` INSIDE `AppProvider` — a per-component-instance
// guard that only protects concurrent calls that happen to originate from
// that one component instance. `runExclusiveFlush` moves the actual
// coalescing here, at the module level (mirroring `writeQueue` above for
// persists and `hydrating`/`generation` for hydration), so the guarantee
// holds regardless of how many call sites or `AppProvider` instances exist.
let flushInFlight: Promise<void> | null = null;

/**
 * Run `task` exclusively. If a flush is already in flight, this call
 * coalesces onto the SAME in-flight promise instead of starting a second,
 * overlapping pass — e.g. a 30s poll's foreground-return flush landing
 * while a still-draining flush from the previous trigger hasn't finished.
 * Callers should route every flush attempt through here rather than
 * guarding re-entrancy themselves.
 *
 * RC-1 W3 r2 hardening (#551 nit 3): the guard used to be assigned to
 * `flushInFlight` AFTER calling `task()` (`const run = task().finally(...);
 * flushInFlight = run;`) — so a task whose SYNCHRONOUS prefix (the code
 * before its first `await`) re-entrantly called `runExclusiveFlush` again
 * would still see `flushInFlight === null` at that point and start a
 * second, overlapping flush instead of coalescing onto this one. `gate`
 * claims the guard synchronously, before `task()` is ever invoked;
 * `task()`'s result is then fed into `gate` via `resolveGate`. Coalescing
 * semantics are identical to before (one shared promise, cleared via
 * `finally`, rejection propagates to every coalesced caller) — only the
 * ordering of "claim the guard" vs. "invoke task()" changed.
 */
export function runExclusiveFlush(task: () => Promise<void>): Promise<void> {
  if (flushInFlight) return flushInFlight;
  let resolveGate!: (value: Promise<void>) => void;
  const gate = new Promise<void>((resolve) => {
    resolveGate = resolve;
  });
  const run = gate.finally(() => {
    flushInFlight = null;
  });
  flushInFlight = run;
  // RC-1 closing follow-ups (#552 review item 4): if `task()` throws
  // SYNCHRONOUSLY (before returning a promise), that exception used to
  // propagate straight out of `runExclusiveFlush` itself, skipping
  // `resolveGate` entirely — `gate` never settles, so its `.finally` never
  // runs, so `flushInFlight` is never cleared. Every flush attempt after
  // that first synchronous throw sees a permanently-stuck `flushInFlight`
  // and coalesces onto a promise that will never resolve — the outbox is
  // wedged for the rest of the session. Catching the throw and feeding it
  // into `resolveGate` as a rejected promise keeps the exact same
  // coalescing/rejection-propagation semantics as the async-throw path
  // (every caller of `run` still sees the rejection) while guaranteeing the
  // guard clears so the next flush can run.
  try {
    resolveGate(task());
  } catch (err) {
    resolveGate(Promise.reject(err));
  }
  return run;
}

// ─── Subscribe / hook ─────────────────────────────────────────────────

export function subscribeIntakeOutbox(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function useIntakeOutboxStore(): IntakeOutboxState {
  return useSyncExternalStore(
    subscribeIntakeOutbox,
    getIntakeOutboxState,
    getIntakeOutboxState,
  );
}
