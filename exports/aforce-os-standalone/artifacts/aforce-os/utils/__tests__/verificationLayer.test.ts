import { describe, it, expect } from 'vitest';

import {
  resolveVerification,
  confidenceForTier,
  TIER_CONFIDENCE,
} from '../verification/verificationLayer';

describe('verificationLayer', () => {
  it('resolves to phantom (highest tier) when a Phantom is connected', () => {
    const r = resolveVerification({
      phantomConnected: true,
      wearableSources: ['oura', 'whoop'],
    });
    expect(r.tier).toBe('phantom');
    expect(r.confidence).toBe(TIER_CONFIDENCE.phantom);
    expect(r.available).toEqual(['phantom', 'wearable', 'phone']);
  });

  it('falls back to wearables when no Phantom is present', () => {
    const r = resolveVerification({
      phantomConnected: false,
      wearableSources: ['garmin'],
    });
    expect(r.tier).toBe('wearable');
    expect(r.confidence).toBe(TIER_CONFIDENCE.wearable);
    expect(r.available).toEqual(['wearable', 'phone']);
  });

  it('keeps phone as the always-present floor (full functionality, no Phantom)', () => {
    const r = resolveVerification({
      phantomConnected: false,
      wearableSources: [],
    });
    expect(r.tier).toBe('phone');
    expect(r.confidence).toBe(TIER_CONFIDENCE.phone);
    expect(r.available).toEqual(['phone']);
    // Loop still functions — confidence is non-zero at the floor.
    expect(r.confidence).toBeGreaterThan(0);
  });

  it('raises confidence as more wearables corroborate, capped below phantom', () => {
    const one = resolveVerification({
      phantomConnected: false,
      wearableSources: ['oura'],
    });
    const three = resolveVerification({
      phantomConnected: false,
      wearableSources: ['oura', 'whoop', 'garmin'],
    });
    const many = resolveVerification({
      phantomConnected: false,
      wearableSources: ['oura', 'whoop', 'garmin', 'strava', 'apple_health', 'samsung_health'],
    });
    expect(three.confidence).toBeGreaterThan(one.confidence);
    expect(many.confidence).toBeGreaterThan(three.confidence);
    // Corroboration can never reach the phantom tier.
    expect(many.confidence).toBeLessThan(TIER_CONFIDENCE.phantom);
    expect(many.confidence).toBe(0.9);
  });

  it('Phantom increases confidence but is never a dependency', () => {
    const withoutPhantom = resolveVerification({
      phantomConnected: false,
      wearableSources: ['whoop'],
    });
    const withPhantom = resolveVerification({
      phantomConnected: true,
      wearableSources: ['whoop'],
    });
    expect(withPhantom.confidence).toBeGreaterThan(withoutPhantom.confidence);
    // Same wearables still resolve fully without Phantom.
    expect(withoutPhantom.tier).toBe('wearable');
    expect(withoutPhantom.available).toContain('phone');
  });

  it('phone is always the floor and the loop never goes dark', () => {
    const empty = resolveVerification({
      phantomConnected: false,
      wearableSources: [],
    });
    expect(empty.available).toContain('phone');
    expect(empty.tier).toBe('phone');
    expect(empty.confidence).toBeGreaterThan(0);
  });

  it('does not inflate corroboration from duplicate wearable IDs', () => {
    const deduped = resolveVerification({
      phantomConnected: false,
      wearableSources: ['oura', 'oura', 'oura'],
    });
    const single = resolveVerification({
      phantomConnected: false,
      wearableSources: ['oura'],
    });
    expect(deduped.confidence).toBe(single.confidence);
  });

  it('confidenceForTier mirrors the resolved confidence', () => {
    expect(confidenceForTier('phantom')).toBe(1);
    expect(confidenceForTier('wearable', 1)).toBe(0.7);
    expect(confidenceForTier('wearable', 5)).toBe(0.9);
    expect(confidenceForTier('phone')).toBe(0.4);
  });
});
