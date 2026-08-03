/**
 * CONNECTED HEALTH — resolver unit tests.
 *
 * Covers: row ordering (connected → connectable → gated), per-state copy /
 * tone / troubleshoot affordances across all 13 ProviderPresentationStates,
 * and the honesty invariants that make this surface trustworthy:
 *   - stale / no_recent_data NEVER get the "live" green tone.
 *   - `lastSyncAtMs === null` always reads "Never synced" — no fabricated time.
 *   - the Score-Protection sentence is exact and always present.
 *   - no denied pull chip is ever reported as granted.
 */
import { describe, it, expect } from 'vitest';
import type { ProviderPresentationState } from '@workspace/health-core';
import {
  resolveConnectedHealthView,
  SCORE_PROTECTION_LINE,
  CONNECTED_HEALTH_GROUP_BY_STATE,
  type ConnectedHealthInput,
} from '../connectedHealthView';
import { PROVIDER_ROW_FIXTURES, CONNECTED_HEALTH_FIXTURES } from '../connectedHealthFixtures';

const ALL_STATES = Object.keys(PROVIDER_ROW_FIXTURES) as ProviderPresentationState[];

function screenWith(states: ProviderPresentationState[]): ConnectedHealthInput {
  return {
    now: CONNECTED_HEALTH_FIXTURES.mixed.now,
    mode: 'ready',
    platform: 'ios',
    providers: states.map((s) => PROVIDER_ROW_FIXTURES[s]),
  };
}

describe('coverage — every ProviderPresentationState has a fixture', () => {
  it('all 13 states are represented', () => {
    expect(ALL_STATES.length).toBe(13);
  });
});

describe('ordering — connected first, then connectable, then gated', () => {
  it('sorts rows by group regardless of input order', () => {
    const input = screenWith(['dormant', 'connected', 'disconnected', 'unavailable', 'stale', 'via_health_connect']);
    const view = resolveConnectedHealthView(input);
    const groups = view.rows.map((r) => r.group);
    // connected-group rows precede connectable, which precede gated.
    const firstConnectable = groups.indexOf('connectable');
    const firstGated = groups.indexOf('gated');
    const lastConnected = groups.lastIndexOf('connected');
    expect(lastConnected).toBeLessThan(firstConnectable === -1 ? Infinity : firstConnectable);
    expect(firstConnectable).toBeLessThan(firstGated === -1 ? Infinity : firstGated);
  });

  it('is stable within a group (preserves relative input order)', () => {
    // Both 'connected' and 'syncing' land in the 'connected' group.
    const input = screenWith(['syncing', 'connected']);
    const view = resolveConnectedHealthView(input);
    expect(view.rows.map((r) => r.statusPill.state)).toEqual(['syncing', 'connected']);
  });

  it('every state maps into exactly one of the three honest groups', () => {
    for (const state of ALL_STATES) {
      expect(['connected', 'connectable', 'gated']).toContain(CONNECTED_HEALTH_GROUP_BY_STATE[state]);
    }
  });
});

describe('per-state sub-copy — exact required strings', () => {
  const cases: [ProviderPresentationState, string][] = [
    ['dormant', 'Awaiting partner access'],
    ['via_health_connect', 'Arrives through Health Connect'],
    ['stale', 'Connected — data is stale'],
    ['no_recent_data', 'Connected — no recent data'],
    ['connected_limited', 'Limited permissions granted'],
  ];
  for (const [state, expected] of cases) {
    it(`${state} → "${expected}"`, () => {
      const view = resolveConnectedHealthView(screenWith([state]));
      expect(view.rows[0].subCopy).toBe(expected);
    });
  }

  it('error sub-copy surfaces the real errorNote, never a generic swallow', () => {
    const view = resolveConnectedHealthView(screenWith(['error']));
    expect(view.rows[0].subCopy).toContain('Last sync failed — token expired.');
  });
});

describe('honesty — tone never lies about liveness', () => {
  it('stale is never green', () => {
    const view = resolveConnectedHealthView(screenWith(['stale']));
    expect(view.rows[0].statusPill.tone).not.toBe('green');
  });
  it('no_recent_data is never green', () => {
    const view = resolveConnectedHealthView(screenWith(['no_recent_data']));
    expect(view.rows[0].statusPill.tone).not.toBe('green');
  });
  it('only a genuinely fresh, real connected state is green', () => {
    const view = resolveConnectedHealthView(screenWith(['connected']));
    expect(view.rows[0].statusPill.tone).toBe('green');
  });
  it('the status pill state is always the true presentation state (never upgraded)', () => {
    for (const state of ALL_STATES) {
      const view = resolveConnectedHealthView(screenWith([state]));
      expect(view.rows[0].statusPill.state).toBe(state);
    }
  });
});

describe('honesty — never-synced never fabricates a time', () => {
  it('lastSyncAtMs === null renders "Never synced" for every gated/connectable state', () => {
    for (const state of ['dormant', 'requires_external_approval', 'unavailable', 'disconnected', 'connecting'] as const) {
      const view = resolveConnectedHealthView(screenWith([state]));
      expect(view.rows[0].freshnessLine).toBe('Never synced');
    }
  });

  it('a real lastSyncAtMs produces a non-fabricated, age-derived label', () => {
    const view = resolveConnectedHealthView(screenWith(['connected']));
    expect(view.rows[0].freshnessLine).toMatch(/^Synced /);
    expect(view.rows[0].freshnessLine).not.toBe('Never synced');
  });

  it('a caller-supplied ageLabel is honored verbatim (pre-formatted freshness)', () => {
    const input = screenWith(['connected']);
    const withLabel: ConnectedHealthInput = {
      ...input,
      providers: [{ ...input.providers[0], ageLabel: 'Synced 2h ago' }],
    };
    const view = resolveConnectedHealthView(withLabel);
    expect(view.rows[0].freshnessLine).toBe('Synced 2h ago');
  });
});

describe('honesty — pull chips never claim a denied grant', () => {
  it('connected_limited (Apple, sleep denied) marks sleep as denied, others granted', () => {
    const view = resolveConnectedHealthView(screenWith(['connected_limited']));
    const sleepChip = view.rows[0].pulls.find((c) => c.type === 'sleep_session');
    expect(sleepChip?.status).toBe('denied');
    const hrChip = view.rows[0].pulls.find((c) => c.type === 'resting_heart_rate');
    expect(hrChip?.status).toBe('granted');
  });

  it('a state with no link at all reports every pull as unknown (never assumed granted)', () => {
    const view = resolveConnectedHealthView(screenWith(['disconnected']));
    expect(view.rows[0].pulls.every((c) => c.status === 'unknown')).toBe(true);
  });
});

describe('troubleshoot + disconnect affordances', () => {
  it('disconnected → connect affordance, no disconnect option', () => {
    const view = resolveConnectedHealthView(screenWith(['disconnected']));
    expect(view.rows[0].troubleshoot.kind).toBe('connect');
    expect(view.rows[0].canDisconnect).toBe(false);
  });
  it('connected_limited → manage_permissions affordance, can disconnect', () => {
    const view = resolveConnectedHealthView(screenWith(['connected_limited']));
    expect(view.rows[0].troubleshoot.kind).toBe('manage_permissions');
    expect(view.rows[0].canDisconnect).toBe(true);
  });
  it('action_required and error → reconnect affordance', () => {
    for (const state of ['action_required', 'error'] as const) {
      const view = resolveConnectedHealthView(screenWith([state]));
      expect(view.rows[0].troubleshoot.kind).toBe('reconnect');
    }
  });
  it('dormant / requires_external_approval / unavailable → no affordance, no disconnect', () => {
    for (const state of ['dormant', 'requires_external_approval', 'unavailable'] as const) {
      const view = resolveConnectedHealthView(screenWith([state]));
      expect(view.rows[0].troubleshoot.kind).toBe('none');
      expect(view.rows[0].troubleshoot.label).toBeNull();
      expect(view.rows[0].canDisconnect).toBe(false);
    }
  });
  it('manage_permissions label is platform-aware (iOS vs Android)', () => {
    const iosView = resolveConnectedHealthView({ ...screenWith(['connected_limited']), platform: 'ios' });
    const androidView = resolveConnectedHealthView({ ...screenWith(['connected_limited']), platform: 'android' });
    expect(iosView.rows[0].troubleshoot.label).toBe('Manage in Health app');
    expect(androidView.rows[0].troubleshoot.label).toBe('Manage in Health Connect');
  });
});

describe('provenance line', () => {
  it('via_health_connect providers show the "via Health Connect" attribution', () => {
    const view = resolveConnectedHealthView(screenWith(['via_health_connect']));
    expect(view.rows[0].provenanceLine).toBe('Samsung Health · via Health Connect');
  });
  it('direct providers show "Direct"', () => {
    const view = resolveConnectedHealthView(screenWith(['connected']));
    expect(view.rows[0].provenanceLine).toBe('WHOOP · Direct');
  });
});

describe('Score-Protection footer — exact + always present', () => {
  it('carries the exact required sentence', () => {
    const view = resolveConnectedHealthView(screenWith(['connected']));
    expect(view.footer.scoreProtectionLine).toBe(SCORE_PROTECTION_LINE);
    expect(SCORE_PROTECTION_LINE).toBe('Health data informs Readiness only. It never changes your Hydration Score.');
  });
  it('is present even with zero rows', () => {
    const view = resolveConnectedHealthView(screenWith([]));
    expect(view.footer.scoreProtectionLine).toBe(SCORE_PROTECTION_LINE);
  });
  it('never contains the prohibited "feeding the score" claim', () => {
    const view = resolveConnectedHealthView(screenWith(['connected']));
    const text = `${view.footer.title} ${view.footer.scoreProtectionLine} ${view.footer.body}`;
    expect(text).not.toMatch(/FEEDING.*HYDRATION SCORE/i);
  });
});

describe('screen modes', () => {
  it('loading has no offline notice and no empty copy', () => {
    const view = resolveConnectedHealthView({ ...screenWith(['connected']), mode: 'loading' });
    expect(view.offlineNotice).toBeNull();
  });
  it('offline surfaces the honest offline notice while keeping last-known rows', () => {
    const view = resolveConnectedHealthView({ ...screenWith(['connected']), mode: 'offline' });
    expect(view.offlineNotice).toMatch(/Offline/);
    expect(view.rows.length).toBe(1);
  });
  it('ready + zero providers → honest empty copy, not a blank screen', () => {
    const view = resolveConnectedHealthView({ ...screenWith([]), mode: 'ready' });
    expect(view.emptyCopy).toBe('No health sources configured yet.');
  });
  it('ready + providers present → no empty copy', () => {
    const view = resolveConnectedHealthView(screenWith(['connected']));
    expect(view.emptyCopy).toBeNull();
  });
});

describe('fixtures sanity', () => {
  it('every named full-screen fixture resolves without throwing', () => {
    for (const key of Object.keys(CONNECTED_HEALTH_FIXTURES)) {
      expect(() => resolveConnectedHealthView(CONNECTED_HEALTH_FIXTURES[key])).not.toThrow();
    }
  });
});
