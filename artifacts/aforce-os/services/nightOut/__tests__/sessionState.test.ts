import { describe, it, expect } from 'vitest';
import {
  resolveNightOutSessionState,
  isNightOutSessionEngaged,
  isNightOutInRecovery,
  NIGHT_OUT_SESSION_STATES,
  NIGHT_OUT_LEGACY_ALIAS,
  RECOVERY_WINDOW_MS,
  CRUISE_RECOVERY_WINDOW_MS,
  type NightOutSessionState,
} from '../sessionState';
import {
  nightOutSessionFixtures,
  resolveFixture,
  NIGHT_OUT_FIXTURE_BASE_MS,
} from '../fixtures';
import type { SocialModeState } from '@/types';
import { DEFAULT_FLAGS, DEMO_ALL_ON_FLAGS } from '@/featureFlags/flags';

const BASE = NIGHT_OUT_FIXTURE_BASE_MS;
const MIN = 60 * 1000;
const HOUR = 60 * MIN;

describe('resolveNightOutSessionState — reconciled with existing SocialModeState', () => {
  it('OFF when there is no session record', () => {
    expect(resolveNightOutSessionState(undefined, { now: BASE })).toBe('OFF');
    expect(resolveNightOutSessionState(null, { now: BASE })).toBe('OFF');
  });

  it('OFF when a record exists but is inactive and never ended (legacy idle)', () => {
    const s = { active: false, startedAt: new Date(BASE - HOUR), drinks: [] } as SocialModeState;
    expect(resolveNightOutSessionState(s, { now: BASE })).toBe('OFF');
  });

  it('ACTIVE when the session is active and not ended', () => {
    const s = { active: true, startedAt: new Date(BASE - 30 * MIN), drinks: [] } as SocialModeState;
    expect(resolveNightOutSessionState(s, { now: BASE })).toBe('ACTIVE');
  });

  it('RECOVERY_HANDOFF while inside the 8h window after endedAt', () => {
    const s = {
      active: false, startedAt: new Date(BASE - 4 * HOUR),
      endedAt: new Date(BASE - 1 * HOUR), drinks: [],
    } as SocialModeState;
    expect(resolveNightOutSessionState(s, { now: BASE })).toBe('RECOVERY_HANDOFF');
  });

  it('CLOSED once the 8h recovery window has elapsed', () => {
    const s = {
      active: false, startedAt: new Date(BASE - 12 * HOUR),
      endedAt: new Date(BASE - 9 * HOUR), drinks: [],
    } as SocialModeState;
    expect(resolveNightOutSessionState(s, { now: BASE })).toBe('CLOSED');
  });

  it('extends the recovery window to 24h while Cruise is engaged', () => {
    const endedAt = new Date(BASE - 9 * HOUR);
    const withoutCruise = { active: false, startedAt: new Date(BASE - 12 * HOUR), endedAt, drinks: [] } as SocialModeState;
    const withCruise = { ...withoutCruise, cruiseUntil: new Date(BASE + 2 * HOUR) };
    expect(resolveNightOutSessionState(withoutCruise, { now: BASE })).toBe('CLOSED');
    // 9h < 24h → still in recovery when Cruise is engaged
    expect(resolveNightOutSessionState(withCruise, { now: BASE })).toBe('RECOVERY_HANDOFF');
  });

  it('exposes the recovery-window constants used above', () => {
    expect(RECOVERY_WINDOW_MS).toBe(8 * HOUR);
    expect(CRUISE_RECOVERY_WINDOW_MS).toBe(24 * HOUR);
  });
});

describe('clock safety', () => {
  it('treats a future endedAt (clock skew) as still ACTIVE, never CLOSED early', () => {
    const s = {
      active: true, startedAt: new Date(BASE - 30 * MIN),
      endedAt: new Date(BASE + 10 * MIN), drinks: [],
    } as SocialModeState;
    expect(resolveNightOutSessionState(s, { now: BASE })).toBe('ACTIVE');
  });

  it('ignores a malformed endedAt without throwing', () => {
    const s = { active: true, startedAt: new Date(BASE), endedAt: new Date('nonsense'), drinks: [] } as unknown as SocialModeState;
    expect(resolveNightOutSessionState(s, { now: BASE })).toBe('ACTIVE');
  });
});

describe('reserved states via explicit phaseHint (not derivable from stored shape yet)', () => {
  it('PREPARING only before the session is active', () => {
    expect(resolveNightOutSessionState(undefined, { now: BASE, phaseHint: 'preparing' })).toBe('PREPARING');
  });

  it('preparing hint is ignored once the session is active', () => {
    const s = { active: true, startedAt: new Date(BASE - MIN), drinks: [] } as SocialModeState;
    expect(resolveNightOutSessionState(s, { now: BASE, phaseHint: 'preparing' })).toBe('ACTIVE');
  });

  it('WINDING_DOWN only while active', () => {
    const s = { active: true, startedAt: new Date(BASE - MIN), drinks: [] } as SocialModeState;
    expect(resolveNightOutSessionState(s, { now: BASE, phaseHint: 'winding_down' })).toBe('WINDING_DOWN');
    // not active → hint does not fabricate a winding-down state
    expect(resolveNightOutSessionState(undefined, { now: BASE, phaseHint: 'winding_down' })).toBe('OFF');
  });
});

describe('helpers + fixtures', () => {
  it('classifies engaged vs recovery states', () => {
    (['PREPARING', 'ACTIVE', 'WINDING_DOWN'] as NightOutSessionState[]).forEach((s) =>
      expect(isNightOutSessionEngaged(s)).toBe(true));
    (['OFF', 'RECOVERY_HANDOFF', 'CLOSED'] as NightOutSessionState[]).forEach((s) =>
      expect(isNightOutSessionEngaged(s)).toBe(false));
    expect(isNightOutInRecovery('RECOVERY_HANDOFF')).toBe(true);
    expect(isNightOutInRecovery('ACTIVE')).toBe(false);
  });

  it('every fixture resolves to its declared canonical state', () => {
    for (const f of nightOutSessionFixtures()) {
      expect(resolveFixture(f)).toBe(f.state);
    }
  });

  it('fixtures cover all six canonical states exactly once', () => {
    const states = nightOutSessionFixtures().map((f) => f.state).sort();
    expect(states).toEqual([...NIGHT_OUT_SESSION_STATES].sort());
  });

  it('documents the internal legacy alias (never rendered publicly)', () => {
    expect(NIGHT_OUT_LEGACY_ALIAS).toBe('social_mode');
  });
});

describe('night_out_enabled flag scaffold (founder decision NO-10)', () => {
  it('defaults OFF in production DEFAULT_FLAGS', () => {
    expect(DEFAULT_FLAGS.night_out_enabled).toBe(false);
  });

  it('is a RESTRICTED flag — OFF even in the generic demo set (NO-a.1 isolation)', () => {
    // Restricted internal-preview flag: the generic client "unlock all" must not
    // enable it. Enablement + authorization is governed by services/nightOut/access.ts.
    expect(DEMO_ALL_ON_FLAGS.night_out_enabled).toBe(false);
  });
});
