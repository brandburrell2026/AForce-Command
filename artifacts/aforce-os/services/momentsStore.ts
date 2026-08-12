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

import { scopedStorage } from './scopedStorage';
import { subscribeUserScope } from './userScope';
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

function notify(): void {
  for (const l of listeners) l();
}

function persist(): void {
  const snapshot = state.moments;
  const gen = generation;
  persistQueue = persistQueue.then(async () => {
    if (gen !== generation) return; // cleared since this write was queued
    try {
      await scopedStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } catch {
      // Best-effort: storage failures are non-fatal (commandLedger precedent).
    }
  });
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
  return m as unknown as Moment;
}

export function getMomentsState(): MomentsState {
  return state;
}

export async function hydrateMoments(): Promise<void> {
  const gen = generation;
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
    ...loaded.filter((m) => !inFlight.has(m.id)),
    ...state.moments,
  ];
  state = { moments: merged, hydrated: true };
  notify();
  persist();
}

export function addMoment(moment: Moment): void {
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
  const moments = state.moments.filter((m) => m.id !== id);
  if (moments.length === state.moments.length) return;
  state = { ...state, moments };
  notify();
  if (state.hydrated) persist();
}

/** Sign-out clear — generation-guarded so a late hydrate can't resurrect. */
export function clearMoments(): void {
  generation += 1;
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
  state = { moments: [], hydrated: false };
  notify();
});
