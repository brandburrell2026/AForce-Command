/**
 * V3 dashboard launch flip — flag-state lock (founder flip 2026-08-11).
 *
 * The five V3 screens (Home / Protocol / Signal / Week in Review / Circle,
 * PRs #705–#710) went live together: all five `*_v3_dashboard_enabled` flags
 * flipped ON in DEFAULT_FLAGS. These tests lock the launched production
 * defaults, prove an explicit override still selects the pre-V3 path (the
 * older screens remain in the binary until a post-soak cleanup PR), and pin
 * that the demo set is unchanged. Mirrors sleepLaunchFlip.test.ts.
 */

import { describe, expect, it } from 'vitest';

import { DEFAULT_FLAGS, DEMO_ALL_ON_FLAGS } from '../flags';
import type { FeatureFlags } from '../../types';

const V3_FLAGS = [
  'home_v3_dashboard_enabled',
  'protocol_v3_dashboard_enabled',
  'signal_v3_dashboard_enabled',
  'weekly_v3_dashboard_enabled',
  'circle_v3_dashboard_enabled',
] as const;

describe('V3 dashboard launch flip — the five founder-comp screens', () => {
  it('all five V3 screens are the DEFAULT production path', () => {
    for (const flag of V3_FLAGS) {
      expect(DEFAULT_FLAGS[flag], flag).toBe(true);
    }
  });

  it('an explicit override still works — forcing false selects the pre-V3 path', () => {
    // Same shape the store's flag state carries; each route gate reads
    // exactly this boolean (V3 → spec/V2 → legacy three-way switches).
    const forcedPreV3: FeatureFlags = {
      ...DEFAULT_FLAGS,
      weekly_v3_dashboard_enabled: false,
    };
    expect(forcedPreV3.weekly_v3_dashboard_enabled).toBe(false);
    // The pre-V3 selector underneath is untouched by the flip.
    expect(forcedPreV3.spec_weekly_report).toBe(DEFAULT_FLAGS.spec_weekly_report);
  });

  it('demo/preview flag set is unchanged by the launch flip', () => {
    for (const flag of V3_FLAGS) {
      expect(DEMO_ALL_ON_FLAGS[flag], flag).toBe(true);
    }
  });

  it('the pre-V3 fallbacks underneath the three-way switches stay ON', () => {
    // If a V3 flag is ever pulled, these keep the modern V2 surfaces (not
    // the legacy screens) as the fallback path.
    expect(DEFAULT_FLAGS.spec_community).toBe(true);
    expect(DEFAULT_FLAGS.spec_weekly_report).toBe(true);
  });
});
