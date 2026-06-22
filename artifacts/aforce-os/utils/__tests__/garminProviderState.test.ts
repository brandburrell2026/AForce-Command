import { describe, it, expect } from 'vitest';

import {
  deriveGarminUiState,
  isLiveGarminState,
  shouldShowGarminDemoSnapshot,
  garminScoreSnapshot,
  type GarminUiState,
} from '../garminProviderState';
import type { ProviderSnapshot } from '../../types/biometrics';

const ALL_STATES: GarminUiState[] = [
  'credentials_missing',
  'not_connected',
  'connected',
  'demo',
];

const SNAP: ProviderSnapshot = {
  providerId: 'garmin',
  hrvSdnn: 52,
  stressScore: 38,
  workoutMinutesToday: 45,
  fetchedAt: 1_700_000_000_000,
};

describe('deriveGarminUiState', () => {
  it('a real connection always wins — demo opt-in cannot override it', () => {
    expect(
      deriveGarminUiState({ serverState: 'connected', demoOptIn: true }),
    ).toBe('connected');
    expect(
      deriveGarminUiState({ serverState: 'connected', demoOptIn: false }),
    ).toBe('connected');
  });

  it('explicit demo opt-in yields demo when not truly connected', () => {
    expect(
      deriveGarminUiState({ serverState: 'credentials_missing', demoOptIn: true }),
    ).toBe('demo');
    expect(
      deriveGarminUiState({ serverState: 'not_connected', demoOptIn: true }),
    ).toBe('demo');
  });

  it('without demo opt-in, the server state passes through unchanged', () => {
    expect(
      deriveGarminUiState({ serverState: 'credentials_missing', demoOptIn: false }),
    ).toBe('credentials_missing');
    expect(
      deriveGarminUiState({ serverState: 'not_connected', demoOptIn: false }),
    ).toBe('not_connected');
  });
});

describe('isLiveGarminState', () => {
  it('only a real connection is live', () => {
    expect(isLiveGarminState('connected')).toBe(true);
    expect(isLiveGarminState('demo')).toBe(false);
    expect(isLiveGarminState('not_connected')).toBe(false);
    expect(isLiveGarminState('credentials_missing')).toBe(false);
  });
});

describe('shouldShowGarminDemoSnapshot', () => {
  it('only the explicit demo state shows a (display-only) snapshot', () => {
    expect(shouldShowGarminDemoSnapshot('demo')).toBe(true);
    expect(shouldShowGarminDemoSnapshot('connected')).toBe(false);
    expect(shouldShowGarminDemoSnapshot('not_connected')).toBe(false);
    expect(shouldShowGarminDemoSnapshot('credentials_missing')).toBe(false);
  });
});

describe('garminScoreSnapshot (Score-Protection)', () => {
  it('demo data can NEVER reach the score, even when a snapshot is passed', () => {
    // The whole point: a labeled demo preview must not move the orb.
    expect(garminScoreSnapshot('demo', SNAP)).toBeNull();
  });

  it('only a real, server-confirmed connection contributes measured biometrics', () => {
    expect(garminScoreSnapshot('connected', SNAP)).toBe(SNAP);
  });

  it('no non-connected state contributes to the score', () => {
    expect(garminScoreSnapshot('credentials_missing', SNAP)).toBeNull();
    expect(garminScoreSnapshot('not_connected', SNAP)).toBeNull();
  });

  it('connected with no measured data contributes nothing (never fabricates)', () => {
    expect(garminScoreSnapshot('connected', null)).toBeNull();
  });
});

describe('demo / live are mutually exclusive (Score-Protection invariant)', () => {
  it('no state is both live and demo-showing, and demo never reaches the score', () => {
    for (const s of ALL_STATES) {
      // A state can never simultaneously be "live" and show demo data.
      expect(isLiveGarminState(s) && shouldShowGarminDemoSnapshot(s)).toBe(false);
      // And whenever a state shows a demo snapshot, that snapshot is
      // structurally barred from the score.
      if (shouldShowGarminDemoSnapshot(s)) {
        expect(garminScoreSnapshot(s, SNAP)).toBeNull();
      }
    }
    // Explicitly: the real connected state must not show a demo snapshot.
    expect(shouldShowGarminDemoSnapshot('connected')).toBe(false);
    // And the demo state is never reported as live.
    expect(isLiveGarminState('demo')).toBe(false);
  });
});
