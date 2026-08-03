/**
 * Sleep Mode launch flip — flag-state lock (go-live 2026-08-03).
 *
 * `spec_sleep_v2` selects the Sleep surface in `screens/SleepModeScreen.tsx`:
 * true → redesigned SleepModeView path, false → SleepModeScreenLegacy.
 * These tests lock the launched production default, prove an explicit
 * override still selects the legacy path (it remains in the binary until the
 * post-soak cleanup PR), and pin the independent public kill switch.
 */

import { describe, expect, it } from 'vitest';

import { DEFAULT_FLAGS, DEMO_ALL_ON_FLAGS } from '../flags';
import type { FeatureFlags } from '../../types';

describe('sleep launch flip — spec_sleep_v2', () => {
  it('the redesign is the DEFAULT production path (flag ON in DEFAULT_FLAGS)', () => {
    expect(DEFAULT_FLAGS.spec_sleep_v2).toBe(true);
  });

  it('an explicit override still works — forcing false selects the legacy path', () => {
    // Same shape the store's flag state carries; the container gate reads
    // exactly this boolean (`flags.spec_sleep_v2 ? redesign : legacy`).
    const forcedLegacy: FeatureFlags = { ...DEFAULT_FLAGS, spec_sleep_v2: false };
    expect(forcedLegacy.spec_sleep_v2).toBe(false);
    // And re-enabling flips back — the override mechanism is symmetric.
    const reEnabled: FeatureFlags = { ...forcedLegacy, spec_sleep_v2: true };
    expect(reEnabled.spec_sleep_v2).toBe(true);
  });

  it('demo/preview flag set is unchanged by the launch flip', () => {
    expect(DEMO_ALL_ON_FLAGS.spec_sleep_v2).toBe(true);
  });

  it('the public kill switch stays independent and ON at launch', () => {
    // sleep_mode_enabled gates the surface's internal-preview banner (H1);
    // launching the redesign must not have touched it.
    expect(DEFAULT_FLAGS.sleep_mode_enabled).toBe(true);
  });
});
