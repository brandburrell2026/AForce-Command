import { describe, it, expect } from 'vitest';
import {
  DEFAULT_FLAGS,
  DEMO_ALL_ON_FLAGS,
  demoUnlockAllFlags,
  INTERNAL_PREVIEW_RESTRICTED_FLAGS,
  LEGAL_GATED_FLAGS,
  INTERNAL_TIER_FLAGS,
} from '@/featureFlags/flags';
import {
  isNightOutEnabled,
  nightOutInternalPreviewContext,
  enableNightOutForInternalPreview,
} from '../access';
import type { FeatureFlags } from '@/types';

describe('NO-a.1 — Night Out internal flag isolation', () => {
  it('default production flags keep Night Out OFF', () => {
    expect(DEFAULT_FLAGS.night_out_enabled).toBe(false);
  });

  it('the generic demo set does not include Night Out', () => {
    expect(DEMO_ALL_ON_FLAGS.night_out_enabled).toBe(false);
    expect(INTERNAL_PREVIEW_RESTRICTED_FLAGS).toContain('night_out_enabled');
  });

  it('generic "unlock all" cannot enable Night Out — even against a base that sets it true', () => {
    // Real demo set:
    expect(demoUnlockAllFlags().night_out_enabled).toBe(false);
    // Robustness: even if DEMO_ALL_ON_FLAGS were later edited to true, the clamp holds.
    const tampered = { ...DEMO_ALL_ON_FLAGS, night_out_enabled: true } as FeatureFlags;
    expect(demoUnlockAllFlags(tampered).night_out_enabled).toBe(false);
  });

  it('the unlock payload preserves every other demo flag; restricted flags stay false', () => {
    // Wave-1 P0 hardening widened the clamp: the unlock payload now also
    // clamps Legal-gated and internal-tier flags for ordinary production
    // users (see featureFlags/__tests__/productionRestrictedFlags.test.ts).
    const payload = demoUnlockAllFlags(DEMO_ALL_ON_FLAGS, { dev: false, internalTestflight: false });
    const restricted = new Set<string>([
      ...INTERNAL_PREVIEW_RESTRICTED_FLAGS,
      ...LEGAL_GATED_FLAGS,
      ...INTERNAL_TIER_FLAGS,
    ]);
    for (const k of Object.keys(DEMO_ALL_ON_FLAGS) as (keyof FeatureFlags)[]) {
      if (restricted.has(k as string)) {
        expect(payload[k]).toBe(false);
      } else {
        // every non-restricted demo flag is preserved exactly
        expect(payload[k]).toBe(DEMO_ALL_ON_FLAGS[k]);
      }
    }
  });

  it('flag alone is not sufficient — access requires an approved internal context', () => {
    const flags = { night_out_enabled: true } as FeatureFlags;
    // No context (normal production): denied even though the flag is on.
    expect(isNightOutEnabled(flags, {})).toBe(false);
    expect(isNightOutEnabled(flags, { internalPreview: false })).toBe(false);
    // Approved internal-preview context: granted.
    expect(isNightOutEnabled(flags, { internalPreview: true })).toBe(true);
  });

  it('context alone is not sufficient — the flag must also be on', () => {
    const flags = { night_out_enabled: false } as FeatureFlags;
    expect(isNightOutEnabled(flags, { internalPreview: true })).toBe(false);
  });

  it('a client-flipped / persisted flag override cannot grant access without the context', () => {
    // Simulate any client path (unlock-all bug, a persisted override) setting the
    // flag true at runtime. Production context has internalPreview=false.
    const override = { ...DEFAULT_FLAGS, night_out_enabled: true };
    const prodContext = nightOutInternalPreviewContext(/* demoMode */ false);
    expect(prodContext.internalPreview).toBe(false);
    expect(isNightOutEnabled(override, prodContext)).toBe(false);
  });

  it('an approved internal/demo context enables it where intended', () => {
    const internalContext = nightOutInternalPreviewContext(/* demoMode */ true);
    expect(internalContext.internalPreview).toBe(true);
    const enabled = enableNightOutForInternalPreview(DEFAULT_FLAGS);
    expect(enabled.night_out_enabled).toBe(true);
    expect(isNightOutEnabled(enabled, internalContext)).toBe(true);
    // and the sanctioned enabler does not mutate the source
    expect(DEFAULT_FLAGS.night_out_enabled).toBe(false);
  });
});
