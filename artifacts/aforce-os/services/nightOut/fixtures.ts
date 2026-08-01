/**
 * Night Out Protocol — deterministic session-state fixtures (NO-a).
 *
 * One self-describing fixture per canonical `NightOutSessionState`, each anchored
 * to an injected base clock so it resolves deterministically. These are DEV/test
 * fixtures — they must never be presented as real connected data in production.
 * They reuse the existing `SocialModeState` shape (no parallel model).
 */

import type { SocialModeState } from '@/types';
import {
  resolveNightOutSessionState,
  type NightOutSessionState,
  type ResolveNightOutOptions,
} from './sessionState';

/** Fixed evening anchor (UTC) so fixtures are reproducible without a live clock. */
export const NIGHT_OUT_FIXTURE_BASE_MS = Date.UTC(2026, 0, 1, 22, 0, 0);

const MIN = 60 * 1000;
const HOUR = 60 * MIN;

export interface NightOutSessionFixture {
  state: NightOutSessionState;
  label: string;
  social: SocialModeState | undefined;
  opts: ResolveNightOutOptions;
}

/**
 * Build the full set of canonical-state fixtures for a given base clock. Every
 * fixture is constructed so `resolveNightOutSessionState(social, opts) === state`
 * (asserted by the test suite).
 */
export function nightOutSessionFixtures(
  base: number = NIGHT_OUT_FIXTURE_BASE_MS,
): NightOutSessionFixture[] {
  const activeSocial: SocialModeState = {
    active: true,
    startedAt: new Date(base - 30 * MIN),
    drinks: [],
  };
  return [
    {
      state: 'OFF',
      label: 'No session on record',
      social: undefined,
      opts: { now: base },
    },
    {
      state: 'PREPARING',
      label: 'Opened Night Out, session not yet started',
      social: undefined,
      opts: { now: base, phaseHint: 'preparing' },
    },
    {
      state: 'ACTIVE',
      label: 'Session running (started 30 min ago)',
      social: activeSocial,
      opts: { now: base },
    },
    {
      state: 'WINDING_DOWN',
      label: 'Session active, user signalled winding down',
      social: activeSocial,
      opts: { now: base, phaseHint: 'winding_down' },
    },
    {
      state: 'RECOVERY_HANDOFF',
      label: 'Ended 1h ago, inside the 8h recovery window',
      social: {
        active: false,
        startedAt: new Date(base - 4 * HOUR),
        endedAt: new Date(base - 1 * HOUR),
        drinks: [],
      },
      opts: { now: base },
    },
    {
      state: 'CLOSED',
      label: 'Ended 9h ago, past the 8h recovery window',
      social: {
        active: false,
        startedAt: new Date(base - 12 * HOUR),
        endedAt: new Date(base - 9 * HOUR),
        drinks: [],
      },
      opts: { now: base },
    },
  ];
}

/** Convenience: resolve a fixture to its canonical state (for gallery wiring). */
export function resolveFixture(f: NightOutSessionFixture): NightOutSessionState {
  return resolveNightOutSessionState(f.social, f.opts);
}
