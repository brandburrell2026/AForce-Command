/**
 * Pure UI-state derivation for the Garmin Connect integration.
 *
 * Garmin is the first provider with a REAL backend OAuth flow (the rest
 * are mocked). This helper keeps the one rule that matters honest and
 * testable, separate from the giant Profile component:
 *
 *   - A real, server-confirmed connection ALWAYS wins. Demo data can
 *     never masquerade as a live connection, and a live connection is
 *     never silently downgraded to demo.
 *   - Demo is only ever entered through an EXPLICIT opt-in and is always
 *     surfaced as its own labeled "demo" state — never "connected"/LIVE.
 *
 * Score-Protection note: these are display-gating predicates only.
 * Nothing here awards, mutates, or fabricates a performance score, and
 * `garminScoreSnapshot` actively enforces that demo data can never reach
 * the score.
 */

import type { GarminConnectionState } from '../services/garmin';
import type { ProviderSnapshot } from '../types/biometrics';

export type GarminUiState =
  | 'credentials_missing'
  | 'not_connected'
  | 'connected'
  | 'demo';

/**
 * Map the server-reported connection state + whether the user explicitly
 * opted into demo data onto the UI state.
 *
 * Precedence is deliberate: a real `connected` server state overrides a
 * demo opt-in, so demo can never present as a real connection.
 */
export function deriveGarminUiState(args: {
  serverState: GarminConnectionState;
  demoOptIn: boolean;
}): GarminUiState {
  if (args.serverState === 'connected') return 'connected';
  if (args.demoOptIn) return 'demo';
  return args.serverState; // 'credentials_missing' | 'not_connected'
}

/** True only for a real, server-confirmed connection. Demo is NEVER live. */
export function isLiveGarminState(s: GarminUiState): boolean {
  return s === 'connected';
}

/**
 * Whether a labeled, DISPLAY-ONLY demo snapshot should be shown for this
 * state. Only the explicit `demo` state shows one. The returned snapshot
 * is purely cosmetic — it is rendered in a clearly-labeled "demo" card and
 * is NEVER written into the score-consumed biometrics (see
 * `garminScoreSnapshot`).
 */
export function shouldShowGarminDemoSnapshot(s: GarminUiState): boolean {
  return s === 'demo';
}

/**
 * Score-Protection gate for Garmin. Returns the snapshot that may
 * contribute to the performance score for a given UI state.
 *
 * Only a real, server-confirmed `connected` state may contribute measured
 * biometrics. Every other state — including the explicit `demo` preview —
 * yields `null`, so demo data can never award, mutate, or fabricate the
 * score, no matter what snapshot is passed in.
 */
export function garminScoreSnapshot(
  s: GarminUiState,
  measured: ProviderSnapshot | null,
): ProviderSnapshot | null {
  return s === 'connected' ? measured : null;
}
