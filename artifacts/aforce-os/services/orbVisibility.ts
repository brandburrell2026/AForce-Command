/**
 * Whether the tab-bar One Breath orb is shown.
 *
 * Screen Upgrade v1.1 §1: the orb is "hidden on full-screen moments
 * (HydroScan camera, Seal, Quiet)". Seal matters most. Sealing is approved by
 * a press-and-hold a short distance above the bar, so a second large pressable
 * object must not sit under the member's thumb while a plan is being approved.
 *
 * A screen asks for the orb to be hidden while it is in such a state, and the
 * request is dropped when the screen leaves that state or unmounts. Requests
 * are counted, so two screens asking at once cannot un-hide each other.
 *
 * The HydroScan camera needs no request: it opens as a modal above the bar.
 */
import React from 'react';

let requests = 0;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** True while at least one screen has asked for the orb to be hidden. */
export function isOrbHidden(): boolean {
  return requests > 0;
}

/** Ask for the orb to be hidden. Returns the function that withdraws the request. */
export function requestOrbHidden(): () => void {
  let active = true;
  requests += 1;
  emit();
  return () => {
    if (!active) return;
    active = false;
    requests = Math.max(0, requests - 1);
    emit();
  };
}

/** Test seam: drop every outstanding request. */
export function resetOrbVisibility(): void {
  requests = 0;
  emit();
}

/** Subscribe a component to the orb's hidden state. */
export function useOrbHidden(): boolean {
  return React.useSyncExternalStore(subscribe, isOrbHidden, isOrbHidden);
}

/** Hide the orb for as long as `condition` holds and the caller is mounted. */
export function useHideOrbWhile(condition: boolean): void {
  React.useEffect(() => {
    if (!condition) return undefined;
    return requestOrbHidden();
  }, [condition]);
}

/** The states of the One Breath flow on which the orb must not appear. */
export const ORB_HIDDEN_PREPARATION_SCREENS: readonly string[] = ['seal', 'quiet'];
