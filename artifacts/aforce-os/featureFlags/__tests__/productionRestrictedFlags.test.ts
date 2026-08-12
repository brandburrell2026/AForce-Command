/**
 * Wave-1 P0 hardening invariants (founder authorization 2026-08-12):
 * the client "unlock all" control is NOT an authorization boundary.
 *
 *  1. Legal/Privacy-gated capabilities (Moments calendar, PR-002 Appendix A)
 *     can never be enabled by any client toggle in ANY distributed build.
 *  2. Internal-tier capabilities (Guardian, Clutch, Phantom, enterprise)
 *     can never be enabled by an ordinary production user.
 *  3. Internal-preview flags (NO-10) stay clamped everywhere, unchanged.
 *  4. Developer controls are unavailable to ordinary production users.
 *  5. Production DEFAULTS never ship a restricted flag ON.
 */
import { describe, it, expect } from 'vitest';

import {
  DEFAULT_FLAGS,
  DEMO_ALL_ON_FLAGS,
  demoUnlockAllFlags,
  developerControlsAvailable,
  LEGAL_GATED_FLAGS,
  INTERNAL_TIER_FLAGS,
  INTERNAL_PREVIEW_RESTRICTED_FLAGS,
} from '../flags';
import type { FeatureFlags } from '../../types';

const PROD = { dev: false, internalTestflight: false };
const INTERNAL_TF = { dev: false, internalTestflight: true };
const LOCAL_DEV = { dev: true, internalTestflight: false };

/** Adversarial base: every restricted flag incorrectly forced true. */
function hostileBase(): FeatureFlags {
  const base: FeatureFlags = { ...DEMO_ALL_ON_FLAGS };
  for (const k of [
    ...LEGAL_GATED_FLAGS,
    ...INTERNAL_TIER_FLAGS,
    ...INTERNAL_PREVIEW_RESTRICTED_FLAGS,
  ]) {
    base[k] = true;
  }
  return base;
}

describe('unlock-all clamp — ordinary production user', () => {
  const unlocked = demoUnlockAllFlags(hostileBase(), PROD);

  it('never enables a Legal/Privacy-gated capability (calendar)', () => {
    for (const k of LEGAL_GATED_FLAGS) {
      expect(unlocked[k], k).toBe(false);
    }
  });

  it('never enables an internal-tier capability (Guardian/Clutch/Phantom/enterprise)', () => {
    for (const k of INTERNAL_TIER_FLAGS) {
      expect(unlocked[k], k).toBe(false);
    }
  });

  it('never enables an internal-preview flag (NO-10, unchanged)', () => {
    for (const k of INTERNAL_PREVIEW_RESTRICTED_FLAGS) {
      expect(unlocked[k], k).toBe(false);
    }
  });
});

describe('unlock-all clamp — internal TestFlight build', () => {
  const unlocked = demoUnlockAllFlags(hostileBase(), INTERNAL_TF);

  it('the Legal/Privacy gate holds even for internal builds — it is never a client toggle', () => {
    for (const k of LEGAL_GATED_FLAGS) {
      expect(unlocked[k], k).toBe(false);
    }
  });

  it('internal-tier capabilities are reachable (founder-distributed builds only)', () => {
    for (const k of INTERNAL_TIER_FLAGS) {
      expect(unlocked[k], k).toBe(true);
    }
  });
});

describe('unlock-all clamp — local dev (Metro) is the only Legal-gate escape', () => {
  it('dev context may enable the calendar flag for engineering evidence', () => {
    const unlocked = demoUnlockAllFlags(hostileBase(), LOCAL_DEV);
    for (const k of LEGAL_GATED_FLAGS) {
      expect(unlocked[k], k).toBe(true);
    }
  });
});

describe('developer controls availability', () => {
  it('unavailable to ordinary production users', () => {
    expect(developerControlsAvailable(PROD, false)).toBe(false);
  });
  it('available in local dev, demo builds, and internal TestFlight only', () => {
    expect(developerControlsAvailable(LOCAL_DEV, false)).toBe(true);
    expect(developerControlsAvailable(PROD, true)).toBe(true); // env-gated demo build
    expect(developerControlsAvailable(INTERNAL_TF, false)).toBe(true);
  });
});

describe('production defaults never ship a restricted flag ON', () => {
  it('every restricted flag is false in DEFAULT_FLAGS', () => {
    for (const k of [
      ...LEGAL_GATED_FLAGS,
      ...INTERNAL_TIER_FLAGS,
      ...INTERNAL_PREVIEW_RESTRICTED_FLAGS,
    ]) {
      expect(DEFAULT_FLAGS[k], k).toBe(false);
    }
  });
});
