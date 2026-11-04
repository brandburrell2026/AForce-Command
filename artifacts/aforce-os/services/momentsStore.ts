/**
 * momentsStore — persisted store for AForce Moments (Phases 1–2, founder
 * approval 2026-08-12). Holds the member's MANUAL moments plus (dev/demo
 * only) seeded demo moments. No calendar ingestion in these phases — that is
 * Phase 3, gated on an explicit founder decision
 * (governance/proposals/PR-002-aforce-moments.md).
 *
 * Pattern copied from services/commandLedger.ts (the canonical service-store
 * recipe): module state + listener set + useSyncExternalStore hook,
 * serialized best-effort persistence, MERGE-on-hydrate so in-flight adds are
 * never overwritten by a late load, and a generation counter so a sign-out
 * clear can't be resurrected.
 *
 * Score Protection: this store never touches the hydration reducer, the
 * score engine, or any scoring surface. Moments state is Moments-internal.
 */

import { withoutExpiredSafetyContext } from './momentSafetyContext';
import { scopedStorage } from './scopedStorage';
import { getScopeState, subscribeUserScope } from './userScope';
import { captureScope, commitIfCurrent, isScopeCurrent } from './scopedWriteQueue';
import { useSyncExternalStore } from 'react';

import type { Moment } from '@/types/moments';

const STORAGE_KEY = '@aforce/moments';

export interface MomentsState {
  moments: Moment[];
  hydrated: boolean;
}

let state: MomentsState = { moments: [], hydrated: false };
let generation = 0;
let persistQueue: Promise<void> = Promise.resolve();
const listeners = new Set<() => void>();
const deletedIds = new Set<string>();

function notify(): void {
  for (const l of listeners) l();
}

function persist(): void {
  const gen = generation;
  // W1 — the scope is captured when the write is DECIDED, not when the queued
  // lambda drains and binds its key.
  const token = captureScope();
  persistQueue = persistQueue.then(async () => {
    if (gen !== generation) return; // cleared since this write was queued
    if (!isScopeCurrent(token)) return; // account switched since it was queued
    try {
      await scopedStorage.setItem(STORAGE_KEY, JSON.stringify(state.moments.map(m => withoutExpiredSafetyContext(m))));
    } catch {
      // Best-effort: storage failures are non-fatal (commandLedger precedent).
    }
  });
}

/** Acknowledged shared commit. No RAM publication on failed persistence.
 * Uses the same storage key/queue as manual, calendar and travel Moments.
 * Optimistic concurrency rejects a review whose existing Moment changed.
 */
export function commitReviewedMoment(moment: Moment, expected?: Moment): Promise<Moment> {
  const token = captureScope();
  const gen = generation;
  const run = async (): Promise<Moment> => {
    if (!state.hydrated || deletedIds.has(moment.id) || getScopeState().status !== 'AUTHENTICATED' || !isScopeCurrent(token) || gen !== generation) throw new Error('Review expired. Review your moment again.');
    const current = state.moments.find(m => m.id === moment.id);
    if (moment.preparation?.transactionId && current?.preparation?.transactionId === moment.preparation.transactionId) return current;
    if (JSON.stringify(current) !== JSON.stringify(expected)) throw new Error('Your moment changed. Review it again.');
    // Concurrent unrelated edits are merged before publishing. Pending legacy
    // writes read the live state at drain, so they cannot erase this commit.
    let next: Moment[];
    for (;;) {
      const before = state;
      next = [...state.moments.filter(m => m.id !== moment.id), moment];
      await scopedStorage.setItem(STORAGE_KEY, JSON.stringify(next.map(m => withoutExpiredSafetyContext(m))));
      if (!isScopeCurrent(token) || gen !== generation) throw new Error('Your account or plan changed. Review again.');
      if (state === before) break;
      if (JSON.stringify(state.moments.find(m => m.id === moment.id)) !== JSON.stringify(expected)) throw new Error('Your moment changed. Review it again.');
    }
    state = { ...state, moments: next };
    notify();
    return moment;
  };
  const result = persistQueue.then(run);
  persistQueue = result.then(() => undefined, () => undefined);
  return result;
}

function sanitizeMoment(raw: unknown): Moment | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const m = raw as Record<string, unknown>;
  if (
    typeof m['id'] !== 'string' ||
    typeof m['title'] !== 'string' ||
    typeof m['startAtIso'] !== 'string' ||
    !Number.isFinite(Date.parse(m['startAtIso'] as string))
  ) {
    return null;
  }
  return withoutExpiredSafetyContext(m as unknown as Moment);
}

/** Expiry is privacy cleanup, never a driving-clearance signal. */
export function pruneMomentSafetyContext(nowMs = Date.now()): void {
  const moments = state.moments.map(m => withoutExpiredSafetyContext(m, nowMs));
  if (moments.every((m, i) => m === state.moments[i])) return;
  state = { ...state, moments };
  notify();
  if (state.hydrated) persist();
}

export function getMomentsState(): MomentsState {
  return state;
}

export async function hydrateMoments(): Promise<void> {
  if (state.hydrated) return;
  const gen = generation;
  const token = captureScope(); // W4 — captured before the first await
  let loaded: Moment[] = [];
  try {
    const raw = await scopedStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        loaded = parsed.map(sanitizeMoment).filter((m): m is Moment => m !== null);
      }
    }
  } catch {
    // Corrupt/unreadable → start empty rather than crash (honest fallback).
  }
  if (gen !== generation) return; // cleared while loading
  // MERGE: in-flight adds (made before hydration resolved) win by id.
  const inFlight = new Map(state.moments.map((m) => [m.id, m]));
  const merged = [
    ...loaded.filter((m) => !inFlight.has(m.id) && !deletedIds.has(m.id)),
    ...state.moments,
  ];
  // W4 — publish only if the scope that issued the read is still current.
  // Independent of the `gen !== generation` guard above: that one protects
  // clear/delete semantics, this one protects member isolation.
  const published = commitIfCurrent(token, () => {
    state = { moments: merged, hydrated: true };
    notify();
  });
  if (!published) return;
  persist();
}

export function addMoment(moment: Moment): void {
  if (deletedIds.has(moment.id)) return;
  if (state.moments.some((m) => m.id === moment.id)) return;
  state = { ...state, moments: [...state.moments, moment] };
  notify();
  if (state.hydrated) persist();
}

export function updateMoment(id: string, patch: Partial<Moment>): void {
  let changed = false;
  const moments = state.moments.map((m) => {
    if (m.id !== id) return m;
    changed = true;
    return { ...m, ...patch, id: m.id };
  });
  if (!changed) return;
  state = { ...state, moments };
  notify();
  if (state.hydrated) persist();
}

export function removeMoment(id: string): void {
  deletedIds.add(id);
  generation += 1;
  const moments = state.moments.filter((m) => m.id !== id);
  if (moments.length === state.moments.length) return;
  state = { ...state, moments };
  notify();
  if (state.hydrated) persist();
}

/** Sign-out clear — generation-guarded so a late hydrate can't resurrect. */
export function clearMoments(): void {
  generation += 1;
  deletedIds.clear();
  state = { moments: [], hydrated: true };
  notify();
  persistQueue = persistQueue.then(async () => {
    try {
      await scopedStorage.removeItem(STORAGE_KEY);
    } catch {
      // best-effort
    }
  });
}

export function subscribeMoments(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useMomentsStore(): MomentsState {
  return useSyncExternalStore(subscribeMoments, getMomentsState, getMomentsState);
}

// Wave-2 PR6: user-scope change → reset to un-hydrated (disk untouched).
subscribeUserScope(() => {
  generation += 1;
  deletedIds.clear();
  state = { moments: [], hydrated: false };
  notify();
});
