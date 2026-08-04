import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  deriveProviderRowStatus,
  whoopLinkState,
  providerRowA11yKind,
  PROVIDER_ROW_A11Y_I18N_KEY,
  type ProviderRowA11yKind,
  type ProviderRowFacts,
} from '../health/providerRowStatus';
import { HEALTH_PROVIDER_CAPABILITY, type HealthProviderUiStatus } from '../health/healthProviderStatus';
import type { HealthProviderId } from '../../data/healthProviders';

const EN_LOCALE = JSON.parse(readFileSync(join(__dirname, '..', '..', 'locales', 'en.json'), 'utf8'));

function resolveI18nKey(key: string): string | undefined {
  return key.split('.').reduce<unknown>((node, part) => {
    if (node && typeof node === 'object' && part in (node as Record<string, unknown>)) {
      return (node as Record<string, unknown>)[part];
    }
    return undefined;
  }, EN_LOCALE) as string | undefined;
}

const NOW = 1_800_000_000_000;

describe('whoopLinkState', () => {
  it('is none when not connected', () => {
    expect(whoopLinkState('not_connected', null, NOW)).toBe('none');
    expect(whoopLinkState('credentials_missing', null, NOW)).toBe('none');
    expect(whoopLinkState(undefined, null, NOW)).toBe('none');
  });
  it('is connected while the token is unexpired (or expiry unknown)', () => {
    expect(whoopLinkState('connected', NOW + 60_000, NOW)).toBe('connected');
    expect(whoopLinkState('connected', null, NOW)).toBe('connected');
  });
  it('is expired once the token expiry passes — never live (§26)', () => {
    expect(whoopLinkState('connected', NOW - 1, NOW)).toBe('expired');
  });
});

describe('deriveProviderRowStatus — §26 truthfulness', () => {
  it('WHOOP: OAuth success + valid token → connected (live)', () => {
    const s = deriveProviderRowStatus({
      provider: 'whoop', platform: 'ios',
      whoopState: 'connected', whoopExpiresAt: NOW + 60_000, nowMs: NOW,
    });
    expect(s.status).toBe('connected');
    expect(s.live).toBe(true);
  });

  it('WHOOP: expired token → needs_attention, NOT live', () => {
    const s = deriveProviderRowStatus({
      provider: 'whoop', platform: 'ios',
      whoopState: 'connected', whoopExpiresAt: NOW - 1, nowMs: NOW,
    });
    expect(s.status).toBe('needs_attention');
    expect(s.live).toBe(false);
  });

  it('Oura/Strava: no client wiring exists → can NEVER be live, even when locally toggled', () => {
    for (const provider of ['oura', 'strava'] as const) {
      const s = deriveProviderRowStatus({
        provider, platform: 'ios', locallyLinked: true, nowMs: NOW,
      });
      expect(s.live).toBe(false);
      expect(s.status).toBe('coming_soon');
      expect(s.showDemo).toBe(true); // labeled demo, never a green LIVE
    }
  });

  it('Oura/Strava untoggled → coming_soon with no demo', () => {
    const s = deriveProviderRowStatus({ provider: 'oura', platform: 'android', nowMs: NOW });
    expect(s).toMatchObject({ status: 'coming_soon', live: false, showDemo: false });
  });

  it('Garmin: real link always wins', () => {
    const s = deriveProviderRowStatus({
      provider: 'garmin', platform: 'ios', garminLive: true, nowMs: NOW,
    });
    expect(s.status).toBe('connected');
    expect(s.live).toBe(true);
  });

  it('Garmin: credentials missing + no link → approval_pending (never a bare Connect)', () => {
    const s = deriveProviderRowStatus({
      provider: 'garmin', platform: 'ios', garminCredentialsMissing: true, nowMs: NOW,
    });
    expect(s.status).toBe('approval_pending');
    expect(s.live).toBe(false);
  });

  it('Garmin demo opt-in → labeled demo, not live', () => {
    const s = deriveProviderRowStatus({
      provider: 'garmin', platform: 'ios', garminDemo: true, garminCredentialsMissing: true, nowMs: NOW,
    });
    expect(s.live).toBe(false);
    expect(s.showDemo).toBe(true);
  });

  it('Samsung: routed through Health Connect on Android, unsupported elsewhere', () => {
    expect(deriveProviderRowStatus({ provider: 'samsung_health', platform: 'android', nowMs: NOW }).status)
      .toBe('available_through_health_connect');
    expect(deriveProviderRowStatus({ provider: 'samsung_health', platform: 'ios', nowMs: NOW }).status)
      .toBe('unsupported');
  });

  it('Apple Health: native module unavailable + unlinked → coming_soon (honest about the stub)', () => {
    const s = deriveProviderRowStatus({
      provider: 'apple_health', platform: 'ios', appleNativeReady: false, nowMs: NOW,
    });
    expect(s.status).toBe('coming_soon');
    expect(s.live).toBe(false);
  });

  it('Apple Health: real permission grant → connected', () => {
    const s = deriveProviderRowStatus({
      provider: 'apple_health', platform: 'ios', appleNativeReady: true, locallyLinked: true, nowMs: NOW,
    });
    expect(s.status).toBe('connected');
    expect(s.live).toBe(true);
  });
});

// Squad-F HIGH #3: the Profile row's accessibilityLabel used to be a blind
// `linked ? Disconnect : Connect`, so a screen reader could announce
// "Connect WHOOP" on a row where Approval Pending / Coming Soon / Unsupported
// made connecting impossible. `providerRowA11yKind` is the pure function that
// now drives that label — it mirrors ProfileScreenV2's render branch order
// (demo → live → needs_attention → approval_pending → coming_soon →
// via_health_connect → unsupported → connect) so "Connect"/"Disconnect" are
// announced ONLY when that tap is the one the row actually performs.
//
// NOTE: `resolveHealthProviderStatus` (healthProviderStatus.ts) also defines
// 'syncing' and 'partially_authorized' UI statuses, but at this function's
// only call site (ProfileScreenV2, via `deriveProviderRowStatus`) those two
// are unreachable — see the reachability lock below — so there is no
// dedicated branch for them here. A bare `live` connection is the only
// reachable "real connection" shape today.
describe('providerRowA11yKind — announced affordance never claims an unavailable action', () => {
  const kindFor = (status: HealthProviderUiStatus, live: boolean, demoLinked = false) =>
    providerRowA11yKind({ demoLinked, live, status });

  it('demo (not live) → "demo", never Connect/Disconnect', () => {
    expect(kindFor('connect', false, true)).toBe('demo');
  });

  it('a real connected link → "live" (Disconnect is genuinely available)', () => {
    expect(kindFor('connected', true)).toBe('live');
  });

  it('needs_attention → "needs_attention", never a bare "Connect"', () => {
    expect(kindFor('needs_attention', false)).toBe('needs_attention');
  });

  it('approval_pending → "approval_pending", no Connect verb (connecting is impossible)', () => {
    expect(kindFor('approval_pending', false)).toBe('approval_pending');
  });

  it('coming_soon → "coming_soon", no Connect verb', () => {
    expect(kindFor('coming_soon', false)).toBe('coming_soon');
  });

  it('available_through_health_connect → "via_health_connect", no Connect verb', () => {
    expect(kindFor('available_through_health_connect', false)).toBe('via_health_connect');
  });

  it('unsupported → "unsupported", no Connect verb', () => {
    expect(kindFor('unsupported', false)).toBe('unsupported');
  });

  it('the genuinely connectable state → "connect" (the only state where "Connect" is honest)', () => {
    expect(kindFor('connect', false)).toBe('connect');
  });

  it('a real live link always wins over a stale demo flag', () => {
    // demoLinked=true but live=true → the real connection must win, never "demo".
    expect(kindFor('connected', true, true)).toBe('live');
  });

  it('every ProviderRowA11yKind has an i18n key registered', () => {
    const kinds: ProviderRowA11yKind[] = [
      'demo', 'live', 'needs_attention',
      'approval_pending', 'coming_soon', 'via_health_connect', 'unsupported', 'connect',
    ];
    for (const kind of kinds) {
      expect(typeof PROVIDER_ROW_A11Y_I18N_KEY[kind]).toBe('string');
      expect(PROVIDER_ROW_A11Y_I18N_KEY[kind].length).toBeGreaterThan(0);
    }
  });

  it('every registered i18n key actually resolves to a real en.json string', () => {
    const kinds: ProviderRowA11yKind[] = [
      'demo', 'live', 'needs_attention',
      'approval_pending', 'coming_soon', 'via_health_connect', 'unsupported', 'connect',
    ];
    for (const kind of kinds) {
      const copy = resolveI18nKey(PROVIDER_ROW_A11Y_I18N_KEY[kind]);
      expect(copy, `missing en.json copy for kind "${kind}" (${PROVIDER_ROW_A11Y_I18N_KEY[kind]})`).toEqual(expect.any(String));
    }
  });

  it('only "connect" and "live" reuse the pre-existing Connect/Disconnect copy keys', () => {
    expect(PROVIDER_ROW_A11Y_I18N_KEY.connect).toBe('profile.v2.connect_a11y');
    // "live" gets its OWN key (row_a11y_connected) — not the old blind
    // disconnect_a11y — because the mutation check below must be able to
    // fail independently of the demo/needs_attention/etc. keys.
    expect(PROVIDER_ROW_A11Y_I18N_KEY.live).not.toBe('profile.v2.connect_a11y');
    for (const kind of ['demo', 'needs_attention', 'approval_pending', 'coming_soon', 'via_health_connect', 'unsupported'] as const) {
      expect(PROVIDER_ROW_A11Y_I18N_KEY[kind]).not.toBe('profile.v2.connect_a11y');
    }
  });
});

// Reachability lock (fix/a11y-dead-branches): `providerRowA11yKind` only has
// ONE real call site — ProfileScreenV2, where `row.status`/`row.live` are
// sourced directly from `deriveProviderRowStatus` (above), never synthesized.
// `deriveProviderRowStatus` only ever assigns its internal `link` variable
// 'none' | 'connected' | (via `whoopLinkState`) 'expired' — so
// `resolveHealthProviderStatus`'s 'syncing', 'partially_authorized', and
// 'connecting' statuses can never actually be produced for this caller, even
// though the resolver's type signature allows them.
//
// This test derives status through the REAL `deriveProviderRowStatus` across
// its full input space (every provider × platform × flag/link-affecting
// field) instead of asserting reachability by hand, then proves
// `providerRowA11yKind` is exhaustive over exactly that reachable set. If a
// future change (e.g. a real sync-in-progress or partial-scopes signal) ever
// makes 'syncing' or 'partially_authorized' reachable, this test's exact-set
// assertion fails — which is the intended signal to add a dedicated a11y
// branch (and en.json copy) for the newly-real status THEN, instead of
// carrying speculative dead branches ahead of real behavior.
describe('deriveProviderRowStatus × providerRowA11yKind reachability lock', () => {
  const PROVIDERS = Object.keys(HEALTH_PROVIDER_CAPABILITY) as HealthProviderId[];
  const PLATFORMS = ['ios', 'android', 'web'] as const;
  const BOOL = [true, false] as const;
  const WHOOP_STATES = [undefined, 'not_connected', 'credentials_missing', 'connected'] as const;
  const WHOOP_EXPIRIES = [null, NOW - 1, NOW + 60_000] as const;

  function allFacts(): ProviderRowFacts[] {
    const facts: ProviderRowFacts[] = [];
    for (const provider of PROVIDERS) {
      for (const platform of PLATFORMS) {
        for (const flagsOn of BOOL) {
          const healthFlags: Partial<Record<HealthProviderId, boolean>> = {
            apple_health: flagsOn, google_health: flagsOn, whoop: flagsOn,
            oura: flagsOn, strava: flagsOn, garmin: flagsOn, samsung_health: flagsOn,
          };
          for (const whoopState of WHOOP_STATES) {
            for (const whoopExpiresAt of WHOOP_EXPIRIES) {
              for (const garminLive of BOOL) {
                for (const garminDemo of BOOL) {
                  for (const garminCredentialsMissing of BOOL) {
                    for (const locallyLinked of BOOL) {
                      for (const appleNativeReady of BOOL) {
                        facts.push({
                          provider, platform, healthFlags,
                          whoopState, whoopExpiresAt,
                          garminLive, garminDemo, garminCredentialsMissing,
                          locallyLinked, appleNativeReady,
                          nowMs: NOW,
                        });
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    return facts;
  }

  // The known-reachable set, as of this fix — every `HealthProviderUiStatus`
  // that a real combination of screen-side facts can actually produce.
  const REACHABLE_STATUSES: readonly HealthProviderUiStatus[] = [
    'connected', 'needs_attention', 'connect', 'approval_pending',
    'coming_soon', 'available_through_health_connect', 'unsupported',
  ];
  const UNREACHABLE_STATUSES: readonly HealthProviderUiStatus[] = [
    'syncing', 'partially_authorized', 'connecting',
  ];

  it('the real input space produces exactly the known-reachable status set (no more, no less)', () => {
    const seen = new Set<HealthProviderUiStatus>();
    for (const facts of allFacts()) {
      seen.add(deriveProviderRowStatus(facts).status);
    }
    expect(seen.size).toBeGreaterThan(0);
    for (const status of UNREACHABLE_STATUSES) {
      expect(seen.has(status), `expected "${status}" to remain unreachable from deriveProviderRowStatus`).toBe(false);
    }
    expect([...seen].sort()).toEqual([...REACHABLE_STATUSES].sort());
  });

  it('providerRowA11yKind is exhaustive (total, non-throwing) over the real input space', () => {
    // `ProviderRowA11yKind` no longer has 'syncing' / 'partially_authorized'
    // members at all (see the type above), so `providerRowA11yKind`'s return
    // type already makes those outcomes impossible at compile time — a
    // stronger guarantee than a runtime `.has()` check could give. What this
    // loop verifies is totality: for every status/live combo the real
    // resolver can produce, the function resolves to a real, registered kind
    // with real copy, never an unhandled fallthrough.
    const kindsSeen = new Set<ProviderRowA11yKind>();
    for (const facts of allFacts()) {
      const row = deriveProviderRowStatus(facts);
      for (const demoLinked of BOOL) {
        const kind = providerRowA11yKind({ demoLinked, live: row.live, status: row.status });
        expect(PROVIDER_ROW_A11Y_I18N_KEY[kind]).toBeTruthy();
        kindsSeen.add(kind);
      }
    }
    // Sanity: the brute-force sweep actually exercised more than one kind
    // (guards against a vacuously-passing loop over an empty/degenerate space).
    expect(kindsSeen.size).toBeGreaterThan(1);
  });
});
