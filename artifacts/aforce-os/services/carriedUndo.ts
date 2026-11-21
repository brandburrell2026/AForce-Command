/**
 * Carried Undo — an Undo that outlives the screen it started on.
 *
 * When One Breath closes with a logged drink still inside its six seconds,
 * the log stays and its Undo moves to whatever screen comes next, for the
 * time that is left (founder decision, 2026-11-20). One at a time: a newer
 * one replaces an older one, whose log simply stands.
 *
 * It holds no drink data and decides nothing. `undo` is the hydration log's
 * own undo, handed over by the screen that made the log.
 */
import React from "react";

export interface CarriedUndo {
  label: string;
  /** Wall-clock time the Undo stops being offered. */
  expiresAt: number;
  undo: () => Promise<boolean>;
}

/** What the bar shows: the offer, the outcome of using it, or nothing. */
export type CarriedUndoState =
  | { kind: "none" }
  | { kind: "offer"; label: string; expiresAt: number }
  | { kind: "working"; label: string }
  | { kind: "undone"; label: string }
  | { kind: "kept"; label: string };

const NONE: CarriedUndoState = { kind: "none" };
/** How long the outcome line stays before the bar goes. */
export const CARRIED_UNDO_RESULT_MS = 2_500;

let state: CarriedUndoState = NONE;
let current: CarriedUndo | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

const set = (next: CarriedUndoState, clearAfterMs?: number) => {
  if (timer) clearTimeout(timer);
  timer = null;
  state = next;
  if (clearAfterMs !== undefined) {
    timer = setTimeout(() => {
      timer = null;
      current = null;
      state = NONE;
      listeners.forEach((l) => l());
    }, Math.max(0, clearAfterMs));
  }
  listeners.forEach((l) => l());
};

export function carryUndo(entry: { label: string; msLeft: number; undo: () => Promise<boolean> }, now: number = Date.now()): void {
  if (entry.msLeft <= 0) return;
  current = { label: entry.label, expiresAt: now + entry.msLeft, undo: entry.undo };
  set({ kind: "offer", label: entry.label, expiresAt: current.expiresAt }, entry.msLeft);
}

/** The member tapped Undo. Runs once; a second tap while it is working does nothing. */
export async function takeCarriedUndo(now: number = Date.now()): Promise<void> {
  const entry = current;
  if (!entry || state.kind !== "offer" || now >= entry.expiresAt) return;
  current = null;
  set({ kind: "working", label: entry.label });
  let ok = false;
  try {
    ok = await entry.undo();
  } catch {
    ok = false;
  }
  set(ok ? { kind: "undone", label: entry.label } : { kind: "kept", label: entry.label }, CARRIED_UNDO_RESULT_MS);
}

export function clearCarriedUndo(): void {
  current = null;
  set(NONE);
}

export const getCarriedUndo = (): CarriedUndoState => state;
export function subscribeCarriedUndo(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function useCarriedUndo(): CarriedUndoState {
  return React.useSyncExternalStore(subscribeCarriedUndo, getCarriedUndo, getCarriedUndo);
}
