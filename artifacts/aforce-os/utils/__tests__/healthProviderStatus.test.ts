/**
 * Provider-neutral health connection-status resolver — honesty proofs + state machine.
 */
import { describe, it, expect } from 'vitest';
import {
  resolveHealthProviderStatus,
  isLiveHealthStatus,
  HEALTH_PROVIDER_CAPABILITY,
  HEALTH_STATUS_LABEL,
  type HealthProviderStatusInput,
  type HealthProviderUiStatus,
  type HealthPlatform,
  type HealthLinkState,
} from '../health/healthProviderStatus';
import type { HealthProviderId } from '../../data/healthProviders';

const PROVIDERS = Object.keys(HEALTH_PROVIDER_CAPABILITY) as HealthProviderId[];
const PLATFORMS: HealthPlatform[] = ['ios', 'android', 'web'];
const LINKS: HealthLinkState[] = ['none', 'authorizing', 'connected', 'partial', 'syncing', 'expired', 'error'];

function input(over: Partial<HealthProviderStatusInput> & { provider: HealthProviderId; platform: HealthPlatform }): HealthProviderStatusInput {
  return {
    enabled: false,
    integrationReady: false,
    approvalGranted: false,
    link: 'none',
    demoOptIn: false,
    ...over,
  };
}

describe('healthProviderStatus — honesty invariants (the whole point)', () => {
  it('NEVER reports connected/live without a real verified link', () => {
    // Sweep every provider × platform × every non-real-link, with the integration
    // maximally "available" and demo on — none of it may fabricate a connection.
    for (const provider of PROVIDERS) {
      for (const platform of PLATFORMS) {
        for (const link of ['none', 'authorizing', 'expired', 'error'] as HealthLinkState[]) {
          const r = resolveHealthProviderStatus(
            input({ provider, platform, enabled: true, integrationReady: true, approvalGranted: true, demoOptIn: true, link }),
          );
          expect(r.live, `${provider}/${platform}/${link} must not be live`).toBe(false);
          expect(r.status, `${provider}/${platform}/${link} must not read connected`).not.toBe('connected');
          expect(isLiveHealthStatus(r.status)).toBe(false);
        }
      }
    }
  });

  it('demo NEVER surfaces as a live connection, and is suppressed whenever a real link exists', () => {
    for (const provider of PROVIDERS) {
      for (const platform of PLATFORMS) {
        // demo on + a real connected link → live wins, demo card suppressed
        const live = resolveHealthProviderStatus(input({ provider, platform, demoOptIn: true, link: 'connected' }));
        if (live.live) {
          expect(live.showDemo, `${provider}/${platform}: demo must be hidden while live`).toBe(false);
        }
        // demo can never itself make something live
        const demoOnly = resolveHealthProviderStatus(input({ provider, platform, demoOptIn: true, link: 'none' }));
        expect(demoOnly.live).toBe(false);
      }
    }
  });

  it('default production posture (all flags off, nothing available) → no provider is connectable-as-connected', () => {
    for (const provider of PROVIDERS) {
      for (const platform of PLATFORMS) {
        const r = resolveHealthProviderStatus(input({ provider, platform }));
        expect(r.live).toBe(false);
        // status is one of the honest non-connected states
        expect([
          'coming_soon', 'approval_pending', 'available_through_health_connect', 'unsupported',
        ]).toContain(r.status);
      }
    }
  });

  it('offers an actionable Connect ONLY when enabled + integrationReady + approval + on-platform + not linked', () => {
    for (const provider of PROVIDERS) {
      const cap = HEALTH_PROVIDER_CAPABILITY[provider];
      for (const platform of PLATFORMS) {
        const onPlatform = platform !== 'web' && cap.platforms.includes(platform as 'ios' | 'android');
        const r = resolveHealthProviderStatus(
          input({ provider, platform, enabled: true, integrationReady: true, approvalGranted: true, link: 'none' }),
        );
        if (cap.method === 'via_health_connect') {
          expect(r.status).not.toBe('connect'); // Samsung never offers a direct connect
        } else if (onPlatform) {
          expect(r.status).toBe('connect');
          expect(r.connectable).toBe(true);
        } else {
          expect(r.status).toBe('unsupported');
        }
      }
    }
  });
});

describe('healthProviderStatus — platform gating', () => {
  it('Apple Health: iOS on-platform; Android + web unsupported', () => {
    expect(resolveHealthProviderStatus(input({ provider: 'apple_health', platform: 'android' })).status).toBe('unsupported');
    expect(resolveHealthProviderStatus(input({ provider: 'apple_health', platform: 'web' })).status).toBe('unsupported');
    expect(resolveHealthProviderStatus(input({ provider: 'apple_health', platform: 'ios', enabled: true, integrationReady: true })).status).toBe('connect');
  });

  it('Google Health Connect: Android on-platform; iOS + web unsupported', () => {
    expect(resolveHealthProviderStatus(input({ provider: 'google_health', platform: 'ios' })).status).toBe('unsupported');
    expect(resolveHealthProviderStatus(input({ provider: 'google_health', platform: 'android', enabled: true, integrationReady: true })).status).toBe('connect');
  });

  it('Samsung: Available Through Health Connect on Android, unsupported on iOS', () => {
    expect(resolveHealthProviderStatus(input({ provider: 'samsung_health', platform: 'android' })).status).toBe('available_through_health_connect');
    expect(resolveHealthProviderStatus(input({ provider: 'samsung_health', platform: 'ios' })).status).toBe('unsupported');
    // even with everything "on", Samsung never offers a direct connect
    expect(resolveHealthProviderStatus(input({ provider: 'samsung_health', platform: 'android', enabled: true, integrationReady: true, approvalGranted: true })).connectable).toBe(false);
  });

  it('Cloud OAuth providers work on both iOS and Android', () => {
    for (const provider of ['whoop', 'oura', 'strava', 'garmin'] as HealthProviderId[]) {
      for (const platform of ['ios', 'android'] as HealthPlatform[]) {
        const r = resolveHealthProviderStatus(input({ provider, platform }));
        expect(r.status).not.toBe('unsupported');
      }
    }
  });
});

describe('healthProviderStatus — real link state machine', () => {
  const p = { provider: 'whoop' as HealthProviderId, platform: 'ios' as HealthPlatform };

  it('connected / syncing / partial map to live states', () => {
    expect(resolveHealthProviderStatus(input({ ...p, link: 'connected' }))).toMatchObject({ status: 'connected', live: true });
    expect(resolveHealthProviderStatus(input({ ...p, link: 'syncing' }))).toMatchObject({ status: 'syncing', live: true });
    expect(resolveHealthProviderStatus(input({ ...p, link: 'partial' }))).toMatchObject({ status: 'partially_authorized', live: true });
  });

  it('expired / error → needs_attention (connectable, not live)', () => {
    expect(resolveHealthProviderStatus(input({ ...p, link: 'expired' }))).toMatchObject({ status: 'needs_attention', connectable: true, live: false });
    expect(resolveHealthProviderStatus(input({ ...p, link: 'error' }))).toMatchObject({ status: 'needs_attention', connectable: true, live: false });
  });

  it('authorizing → connecting (not yet connectable, not live)', () => {
    expect(resolveHealthProviderStatus(input({ ...p, link: 'authorizing' }))).toMatchObject({ status: 'connecting', connectable: false, live: false });
  });

  it('a real link wins even when the flag is off (never downgrade a live connection)', () => {
    const r = resolveHealthProviderStatus(input({ ...p, enabled: false, integrationReady: false, link: 'connected' }));
    expect(r).toMatchObject({ status: 'connected', live: true });
  });
});

describe('healthProviderStatus — external approval gating', () => {
  it('Garmin without approval → approval_pending even when enabled + ready', () => {
    const r = resolveHealthProviderStatus(input({ provider: 'garmin', platform: 'ios', enabled: true, integrationReady: true, approvalGranted: false }));
    expect(r.status).toBe('approval_pending');
    expect(r.connectable).toBe(false);
  });

  it('Garmin WITH approval + enabled + ready → connect', () => {
    const r = resolveHealthProviderStatus(input({ provider: 'garmin', platform: 'ios', enabled: true, integrationReady: true, approvalGranted: true }));
    expect(r.status).toBe('connect');
  });

  it('non-approval providers ignore approvalGranted', () => {
    const r = resolveHealthProviderStatus(input({ provider: 'oura', platform: 'ios', enabled: true, integrationReady: true, approvalGranted: false }));
    expect(r.status).toBe('connect');
  });
});

describe('healthProviderStatus — availability gating (Coming Soon)', () => {
  it('enabled but integration NOT ready → coming_soon (no failing Connect)', () => {
    const r = resolveHealthProviderStatus(input({ provider: 'oura', platform: 'ios', enabled: true, integrationReady: false }));
    expect(r).toMatchObject({ status: 'coming_soon', connectable: false });
  });

  it('integration ready but flag OFF → coming_soon', () => {
    const r = resolveHealthProviderStatus(input({ provider: 'oura', platform: 'ios', enabled: false, integrationReady: true }));
    expect(r.status).toBe('coming_soon');
  });
});

describe('healthProviderStatus — labeled demo overlay', () => {
  it('shows the demo card only in non-live, on-relevant-surface states', () => {
    // coming_soon + demo → labeled demo card, status still honest
    const comingSoon = resolveHealthProviderStatus(input({ provider: 'oura', platform: 'ios', demoOptIn: true }));
    expect(comingSoon).toMatchObject({ status: 'coming_soon', showDemo: true, live: false });
    // approval_pending + demo
    const approval = resolveHealthProviderStatus(input({ provider: 'garmin', platform: 'ios', demoOptIn: true }));
    expect(approval).toMatchObject({ status: 'approval_pending', showDemo: true });
    // unsupported off-platform → NO demo card
    const unsupported = resolveHealthProviderStatus(input({ provider: 'apple_health', platform: 'android', demoOptIn: true }));
    expect(unsupported.showDemo).toBe(false);
    // live → demo suppressed
    const live = resolveHealthProviderStatus(input({ provider: 'whoop', platform: 'ios', demoOptIn: true, link: 'connected' }));
    expect(live.showDemo).toBe(false);
  });
});

describe('healthProviderStatus — labels', () => {
  it('every status has a canonical label', () => {
    const statuses: HealthProviderUiStatus[] = [
      'connect', 'connecting', 'connected', 'partially_authorized', 'syncing',
      'needs_attention', 'available_through_health_connect', 'approval_pending', 'coming_soon', 'unsupported',
    ];
    for (const s of statuses) {
      expect(HEALTH_STATUS_LABEL[s]).toBeTruthy();
    }
  });
});
