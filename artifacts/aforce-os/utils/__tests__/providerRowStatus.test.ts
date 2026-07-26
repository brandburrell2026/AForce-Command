import { describe, it, expect } from 'vitest';
import { deriveProviderRowStatus, whoopLinkState } from '../health/providerRowStatus';

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
