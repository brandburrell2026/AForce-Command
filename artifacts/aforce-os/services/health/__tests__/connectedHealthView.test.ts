/**
 * CONNECTED HEALTH — resolver unit tests.
 *
 * Covers: row ordering (connected → connectable → gated), per-state copy KEY /
 * tone / troubleshoot affordances across all 13 ProviderPresentationStates,
 * and the honesty invariants that make this surface trustworthy:
 *   - stale / no_recent_data NEVER get the "live" green tone.
 *   - `lastSyncAtMs === null` always keys "never_synced" — no fabricated time.
 *   - the Score-Protection sentence lives at an exact, stable locale key and
 *     its EN value is the exact required sentence.
 *   - no denied pull chip is ever reported as granted.
 *   - gated rows (dormant / requires_external_approval / unavailable) never
 *     carry pull chips — there is no real link to have pulled anything from.
 *
 * The resolver emits translation KEYS (`I18nText = { key, params? }`), never
 * resolved strings — see connectedHealthView.ts's file header for why. These
 * tests assert on keys/params, which is exactly what makes them fast and
 * i18n-runtime-free; the render harness (components/health/__tests__/
 * connectedHealthView.render.test.tsx) is where the actual translated text
 * is asserted.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ProviderPresentationState } from '@workspace/health-core';
import {
  resolveConnectedHealthView,
  SCORE_PROTECTION_LINE,
  CONNECTED_HEALTH_GROUP_BY_STATE,
  type ConnectedHealthInput,
  type TroubleshootKind,
} from '../connectedHealthView';
import { PROVIDER_ROW_FIXTURES, CONNECTED_HEALTH_FIXTURES } from '../connectedHealthFixtures';

const ALL_STATES = Object.keys(PROVIDER_ROW_FIXTURES) as ProviderPresentationState[];

const EN_LOCALE = JSON.parse(
  readFileSync(join(__dirname, '..', '..', '..', 'locales', 'en.json'), 'utf8'),
);

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

describe('status label — every state resolves to its own locale key', () => {
  it('dormant keys to the factual "Awaiting Access" label, not a promissory one', () => {
    const view = resolveConnectedHealthView(screenWith(['dormant']));
    expect(view.rows[0].statusPill.label).toEqual({ key: 'connected_health.state_label.dormant' });
    expect(EN_LOCALE.connected_health.state_label.dormant).toBe('Awaiting Access');
    expect(EN_LOCALE.connected_health.state_label.dormant).not.toMatch(/coming soon/i);
  });

  it('requires_external_approval keeps its own distinct label from dormant', () => {
    const dormant = resolveConnectedHealthView(screenWith(['dormant'])).rows[0].statusPill.label.key;
    const approval = resolveConnectedHealthView(screenWith(['requires_external_approval'])).rows[0].statusPill.label.key;
    expect(dormant).not.toBe(approval);
    expect(EN_LOCALE.connected_health.state_label.requires_external_approval).toBe('Approval Pending');
  });

  it('every state has a unique, present locale key + non-empty EN value', () => {
    for (const state of ALL_STATES) {
      const view = resolveConnectedHealthView(screenWith([state]));
      const key = view.rows[0].statusPill.label.key;
      expect(key).toBe(`connected_health.state_label.${state}`);
      const suffix = key.split('.').pop() as string;
      expect(EN_LOCALE.connected_health.state_label[suffix]).toBeTruthy();
    }
  });
});

describe('per-state sub-copy — exact required locale keys', () => {
  const cases: [ProviderPresentationState, string][] = [
    ['dormant', 'connected_health.sub_copy.dormant'],
    ['via_health_connect', 'connected_health.sub_copy.via_health_connect'],
    ['stale', 'connected_health.sub_copy.stale'],
    ['no_recent_data', 'connected_health.sub_copy.no_recent_data'],
    ['connected_limited', 'connected_health.sub_copy.connected_limited'],
  ];
  for (const [state, expectedKey] of cases) {
    it(`${state} → "${expectedKey}"`, () => {
      const view = resolveConnectedHealthView(screenWith([state]));
      expect(view.rows[0].subCopy).toEqual({ key: expectedKey });
    });
  }

  it('no_recent_data sub-copy EN text explains why no action is offered', () => {
    expect(EN_LOCALE.connected_health.sub_copy.no_recent_data).toMatch(/nothing to sync/i);
  });

  it('error sub-copy keys by the closed errorKind, never a raw string', () => {
    const view = resolveConnectedHealthView(screenWith(['error']));
    // PROVIDER_ROW_FIXTURES.error is fixtured with errorKind: 'auth_expired'.
    expect(view.rows[0].subCopy).toEqual({ key: 'connected_health.sub_copy.error.auth_expired' });
    expect(EN_LOCALE.connected_health.sub_copy.error.auth_expired).toBeTruthy();
  });

  it('an error row with no errorKind falls back to the generic "unknown" key, never a blank/raw string', () => {
    const input = screenWith(['error']);
    const withoutKind: ConnectedHealthInput = {
      ...input,
      providers: [{ ...input.providers[0], errorKind: null }],
    };
    const view = resolveConnectedHealthView(withoutKind);
    expect(view.rows[0].subCopy).toEqual({ key: 'connected_health.sub_copy.error.unknown' });
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
  it('lastSyncAtMs === null keys "never_synced" for every gated/connectable state', () => {
    for (const state of ['dormant', 'requires_external_approval', 'unavailable', 'disconnected', 'connecting'] as const) {
      const view = resolveConnectedHealthView(screenWith([state]));
      expect(view.rows[0].freshness).toEqual({ key: 'connected_health.freshness.never_synced' });
    }
  });

  it('a real lastSyncAtMs produces a non-fabricated, age-derived key (minutes bucket)', () => {
    const view = resolveConnectedHealthView(screenWith(['connected']));
    // PROVIDER_ROW_FIXTURES.connected is 5 minutes old.
    expect(view.rows[0].freshness).toEqual({ key: 'connected_health.freshness.minutes_ago', params: { count: 5 } });
  });

  it('a caller-supplied ageLabel is honored verbatim via the literal key (pre-formatted freshness)', () => {
    const input = screenWith(['connected']);
    const withLabel: ConnectedHealthInput = {
      ...input,
      providers: [{ ...input.providers[0], ageLabel: 'Synced 2h ago' }],
    };
    const view = resolveConnectedHealthView(withLabel);
    expect(view.rows[0].freshness).toEqual({
      key: 'connected_health.freshness.literal',
      params: { text: 'Synced 2h ago' },
    });
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

describe('honesty — gated rows never render pull chips (review #460 item 6)', () => {
  it('dormant / requires_external_approval / unavailable carry zero pull chips', () => {
    for (const state of ['dormant', 'requires_external_approval', 'unavailable'] as const) {
      const view = resolveConnectedHealthView(screenWith([state]));
      expect(view.rows[0].group).toBe('gated');
      expect(view.rows[0].pulls).toEqual([]);
    }
  });

  it('a non-gated state with the same provider capability still renders its pulls', () => {
    const view = resolveConnectedHealthView(screenWith(['connected']));
    expect(view.rows[0].pulls.length).toBeGreaterThan(0);
  });
});

describe('troubleshoot + disconnect affordances — all 13 states (review #460 item 2)', () => {
  const EXPECTED: Record<ProviderPresentationState, { kind: TroubleshootKind; canDisconnect: boolean }> = {
    connected: { kind: 'none', canDisconnect: true },
    connected_limited: { kind: 'manage_permissions', canDisconnect: true },
    syncing: { kind: 'none', canDisconnect: true },
    // SWAPPED from the shipped #460 build: a real link with stale data IS
    // actionable — reconnect is offered.
    stale: { kind: 'reconnect', canDisconnect: true },
    // SWAPPED: the link is fine, the user simply hasn't generated anything —
    // nothing to reconnect.
    no_recent_data: { kind: 'none', canDisconnect: true },
    action_required: { kind: 'reconnect', canDisconnect: true },
    error: { kind: 'reconnect', canDisconnect: true },
    via_health_connect: { kind: 'none', canDisconnect: false },
    connecting: { kind: 'none', canDisconnect: false },
    disconnected: { kind: 'connect', canDisconnect: false },
    dormant: { kind: 'none', canDisconnect: false },
    requires_external_approval: { kind: 'none', canDisconnect: false },
    unavailable: { kind: 'none', canDisconnect: false },
  };

  for (const state of ALL_STATES) {
    it(`${state} → troubleshoot=${EXPECTED[state].kind}, canDisconnect=${EXPECTED[state].canDisconnect}`, () => {
      const view = resolveConnectedHealthView(screenWith([state]));
      expect(view.rows[0].troubleshoot.kind).toBe(EXPECTED[state].kind);
      expect(view.rows[0].canDisconnect).toBe(EXPECTED[state].canDisconnect);
      if (EXPECTED[state].kind === 'none') {
        expect(view.rows[0].troubleshoot.label).toBeNull();
      } else {
        expect(view.rows[0].troubleshoot.label).not.toBeNull();
      }
    });
  }

  it('manage_permissions label is platform-aware (iOS vs Android vs web)', () => {
    const iosView = resolveConnectedHealthView({ ...screenWith(['connected_limited']), platform: 'ios' });
    const androidView = resolveConnectedHealthView({ ...screenWith(['connected_limited']), platform: 'android' });
    const webView = resolveConnectedHealthView({ ...screenWith(['connected_limited']), platform: 'web' });
    expect(iosView.rows[0].troubleshoot.label).toEqual({ key: 'connected_health.troubleshoot.manage_permissions_ios' });
    expect(androidView.rows[0].troubleshoot.label).toEqual({ key: 'connected_health.troubleshoot.manage_permissions_android' });
    expect(webView.rows[0].troubleshoot.label).toEqual({ key: 'connected_health.troubleshoot.manage_permissions_web' });
  });
});

describe('provenance', () => {
  it('via_health_connect providers key to the "via Health Connect" attribution with the provider name as a param', () => {
    const view = resolveConnectedHealthView(screenWith(['via_health_connect']));
    expect(view.rows[0].provenance).toEqual({
      key: 'connected_health.provenance.via_health_connect',
      params: { name: 'Samsung Health' },
    });
  });
  it('direct providers key to "Direct"', () => {
    const view = resolveConnectedHealthView(screenWith(['connected']));
    expect(view.rows[0].provenance).toEqual({
      key: 'connected_health.provenance.direct',
      params: { name: 'WHOOP' },
    });
  });
});

describe('Score-Protection footer — exact key + EN value always present', () => {
  it('carries the exact required locale key', () => {
    const view = resolveConnectedHealthView(screenWith(['connected']));
    expect(view.footer.scoreProtectionLine).toEqual({ key: 'connected_health.footer.score_protection' });
  });
  it('the EN value at that key is the exact required sentence', () => {
    expect(EN_LOCALE.connected_health.footer.score_protection).toBe(SCORE_PROTECTION_LINE);
    expect(SCORE_PROTECTION_LINE).toBe('Health data informs Readiness only. It never changes your Hydration Score.');
  });
  it('is present even with zero rows', () => {
    const view = resolveConnectedHealthView(screenWith([]));
    expect(view.footer.scoreProtectionLine).toEqual({ key: 'connected_health.footer.score_protection' });
  });
  it('never contains the prohibited "feeding the score" claim', () => {
    expect(EN_LOCALE.connected_health.footer.score_protection).not.toMatch(/FEEDING.*HYDRATION SCORE/i);
  });
});

describe('screen modes', () => {
  it('loading has no offline notice and no empty copy', () => {
    const view = resolveConnectedHealthView({ ...screenWith(['connected']), mode: 'loading' });
    expect(view.offlineNotice).toBeNull();
  });
  it('offline surfaces the honest offline notice key while keeping last-known rows', () => {
    const view = resolveConnectedHealthView({ ...screenWith(['connected']), mode: 'offline' });
    expect(view.offlineNotice).toEqual({ key: 'connected_health.offline_notice' });
    // #491 review B2: a cold-start probe failure has no "last known" status to
    // show, so the copy no longer claims "Offline" — it honestly says the
    // check failed and the list may be stale.
    expect(EN_LOCALE.connected_health.offline_notice).toMatch(/couldn't check|out of date/i);
    expect(view.rows.length).toBe(1);
  });
  it('ready + zero providers → honest empty copy key, not a blank screen', () => {
    const view = resolveConnectedHealthView({ ...screenWith([]), mode: 'ready' });
    expect(view.emptyCopy).toEqual({ key: 'connected_health.empty' });
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

  it('all-connected never includes Garmin (no honest connected-group state exists for it — review #460 item 8)', () => {
    const view = resolveConnectedHealthView(CONNECTED_HEALTH_FIXTURES['all-connected']);
    expect(view.rows.some((r) => r.providerId === 'garmin')).toBe(false);
  });

  it('all-connected presents Samsung as via_health_connect, never a fabricated direct connection', () => {
    const view = resolveConnectedHealthView(CONNECTED_HEALTH_FIXTURES['all-connected']);
    const samsung = view.rows.find((r) => r.providerId === 'samsung_health');
    expect(samsung?.statusPill.state).toBe('via_health_connect');
  });
});
