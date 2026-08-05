/**
 * Internal Cohort PR 1 — contract module tests.
 *
 * Covers `docs/health/rollout/INTERNAL-COHORT-DESIGN.md` §6.1.1 (reference
 * identity, normative), §6.2 (allow-list + restricted-flag interaction pin),
 * §6.3 (version), the pure-function half of §6.4/§6.4.1 (TTL fail-closed —
 * the timer + foreground re-check that TRIGGER a recomputation are client
 * hook responsibilities, PR 6, out of scope here), §7.1 (default-empty
 * guarantee), and §4.5/§4.5.1/§4.5.2 (stage clamp predicate).
 */
import { describe, it, expect } from 'vitest';
import type { FeatureFlags } from '../../types';
import {
  DEFAULT_FLAGS,
  INTERNAL_PREVIEW_RESTRICTED_FLAGS,
  demoUnlockAllFlags,
} from '../flags';
import {
  applyInternalPreviewOverlay,
  isProviderGrantHonoured,
  INTERNAL_PREVIEW_OVERLAYABLE_FLAGS,
  OVERLAY_CONTRACT_VERSION,
  type InternalPreviewOverlay,
  type OverlayableFlagKey,
} from '../internalPreviewOverlay';

const NOW = 1_754_240_531_482; // arbitrary fixed instant

function freshBase(overrides: Partial<FeatureFlags> = {}): FeatureFlags {
  return { ...DEFAULT_FLAGS, ...overrides };
}

function overlay(
  grants: readonly OverlayableFlagKey[],
  overrides: Partial<InternalPreviewOverlay> = {},
): InternalPreviewOverlay {
  return {
    contractVersion: OVERLAY_CONTRACT_VERSION,
    receivedAtMs: NOW,
    expiresAtMs: NOW + 15 * 60 * 1000,
    cohorts: ['health-providers-internal'],
    grants,
    ...overrides,
  };
}

describe('INTERNAL_PREVIEW_OVERLAYABLE_FLAGS (§6.2)', () => {
  it('does not include health_canonical_consumers — pending D-5 (§13)', () => {
    expect(INTERNAL_PREVIEW_OVERLAYABLE_FLAGS).not.toContain('health_canonical_consumers');
  });

  it('includes night_out_enabled so PR 7 needs no contract change, per §6.2', () => {
    expect(INTERNAL_PREVIEW_OVERLAYABLE_FLAGS).toContain('night_out_enabled');
  });

  it('includes exactly the seven health-provider flags plus night_out_enabled', () => {
    expect([...INTERNAL_PREVIEW_OVERLAYABLE_FLAGS].sort()).toEqual(
      [
        'health_apple_enabled',
        'health_google_connect_enabled',
        'health_whoop_enabled',
        'health_oura_enabled',
        'health_strava_enabled',
        'health_garmin_enabled',
        'health_samsung_direct_enabled',
        'night_out_enabled',
      ].sort(),
    );
  });
});

describe('applyInternalPreviewOverlay — reference-identity contract (§6.1.1, normative)', () => {
  it('returns base BY REFERENCE when there is nothing to apply', () => {
    const base = freshBase();
    const expiredOverlay = overlay(['health_apple_enabled'], { expiresAtMs: NOW - 1 });
    const wrongVersionOverlayHigh = overlay(['health_apple_enabled'], { contractVersion: 2 });
    const wrongVersionOverlayLow = overlay(['health_apple_enabled'], { contractVersion: 0 });
    const emptyGrantsOverlay = overlay([]);
    const onlyUnknownKeysOverlay = overlay([
      // @ts-expect-error — deliberately not on the allow-list, proving the
      // client-side leg of the three-times-enforced allow-list (§6.2).
      'demo_mode_enabled',
    ]);

    expect(applyInternalPreviewOverlay(base, null, NOW)).toBe(base);
    expect(applyInternalPreviewOverlay(base, expiredOverlay, NOW)).toBe(base);
    expect(applyInternalPreviewOverlay(base, wrongVersionOverlayHigh, NOW)).toBe(base);
    expect(applyInternalPreviewOverlay(base, wrongVersionOverlayLow, NOW)).toBe(base);
    expect(applyInternalPreviewOverlay(base, emptyGrantsOverlay, NOW)).toBe(base);
    expect(applyInternalPreviewOverlay(base, onlyUnknownKeysOverlay, NOW)).toBe(base);
  });

  it('returns base by reference when every surviving granted key is already true', () => {
    const alreadyOn = freshBase({ health_apple_enabled: true });
    const grantsSameKeyOverlay = overlay(['health_apple_enabled']);

    expect(applyInternalPreviewOverlay(alreadyOn, grantsSameKeyOverlay, NOW)).toBe(alreadyOn);
  });

  it('allocates a new object only on a real flip, and never mutates base', () => {
    const base = freshBase();
    const liveGrantOverlay = overlay(['health_apple_enabled']);

    const result = applyInternalPreviewOverlay(base, liveGrantOverlay, NOW);

    expect(result).not.toBe(base);
    expect(result.health_apple_enabled).toBe(true);
    expect(base.health_apple_enabled).toBe(false); // input untouched
  });

  it('is a union, not a merge: an already-true field elsewhere in base is left exactly as-is', () => {
    const base = freshBase({ spec_home: true, cruise_mode_enabled: true });
    const result = applyInternalPreviewOverlay(base, overlay(['health_garmin_enabled']), NOW);

    expect(result).not.toBe(base);
    expect(result.health_garmin_enabled).toBe(true);
    expect(result.spec_home).toBe(true);
    expect(result.cruise_mode_enabled).toBe(true);
  });

  it('flips multiple surviving keys in one call', () => {
    const base = freshBase();
    const result = applyInternalPreviewOverlay(
      base,
      overlay(['health_garmin_enabled', 'health_oura_enabled']),
      NOW,
    );

    expect(result).not.toBe(base);
    expect(result.health_garmin_enabled).toBe(true);
    expect(result.health_oura_enabled).toBe(true);
  });

  it('filters non-allow-listed keys out of a mixed grants list without discarding the valid ones', () => {
    const base = freshBase();
    const mixed = overlay([
      'health_garmin_enabled',
      // @ts-expect-error — not on the allow-list; must be dropped, not honoured.
      'scoreFromLedgerHybrid',
    ]);

    const result = applyInternalPreviewOverlay(base, mixed, NOW);

    expect(result).not.toBe(base);
    expect(result.health_garmin_enabled).toBe(true);
    expect(result.scoreFromLedgerHybrid).toBe(false);
  });

  it('never sets a flag to false — there is no path from true to false through this function', () => {
    const base = freshBase({ health_apple_enabled: true });
    // A malformed/rolled-back server sending an empty grants list must not be
    // read as "revoke health_apple_enabled" — ON-only means there is no wire
    // representation of "turn this off" (§5.1, §6.1).
    const result = applyInternalPreviewOverlay(base, overlay([]), NOW);

    expect(result).toBe(base);
    expect(result.health_apple_enabled).toBe(true);
  });
});

describe('applyInternalPreviewOverlay — TTL, pure-function half (§6.4, §6.4.1)', () => {
  it('honours a grant one millisecond before expiry', () => {
    const base = freshBase();
    const almostExpired = overlay(['health_apple_enabled'], { expiresAtMs: NOW + 1 });

    const result = applyInternalPreviewOverlay(base, almostExpired, NOW);
    expect(result.health_apple_enabled).toBe(true);
  });

  it('treats nowMs === expiresAtMs as already expired (>=, not >)', () => {
    const base = freshBase();
    const boundary = overlay(['health_apple_enabled'], { expiresAtMs: NOW });

    expect(applyInternalPreviewOverlay(base, boundary, NOW)).toBe(base);
  });

  it('is fail-closed on a clock-skewed / already-expired-on-arrival overlay', () => {
    const base = freshBase();
    const skewed = overlay(['health_apple_enabled'], { expiresAtMs: NOW - 60_000 });

    expect(applyInternalPreviewOverlay(base, skewed, NOW)).toBe(base);
  });

  it('never extends a TTL on repeated calls — same expired overlay stays expired', () => {
    const base = freshBase();
    const expired = overlay(['health_apple_enabled'], { expiresAtMs: NOW - 1 });

    expect(applyInternalPreviewOverlay(base, expired, NOW)).toBe(base);
    expect(applyInternalPreviewOverlay(base, expired, NOW + 10)).toBe(base);
  });
});

describe('applyInternalPreviewOverlay — default-empty guarantee (§7.1)', () => {
  it('is reference-identical to base across at least two poll cycles for a non-member (overlay: null)', () => {
    const base = freshBase();

    const pollOne = applyInternalPreviewOverlay(base, null, NOW);
    const pollTwo = applyInternalPreviewOverlay(base, null, NOW + 5 * 60 * 1000);

    expect(pollOne).toBe(base);
    expect(pollTwo).toBe(base);
  });

  it('is reference-identical to base across at least two poll cycles for grants: []', () => {
    const base = freshBase();
    const noGrants = overlay([]);

    expect(applyInternalPreviewOverlay(base, noGrants, NOW)).toBe(base);
    expect(applyInternalPreviewOverlay(base, noGrants, NOW + 5 * 60 * 1000)).toBe(base);
  });
});

describe('INTERNAL_PREVIEW_RESTRICTED_FLAGS interaction pin (§6.2)', () => {
  it('demoUnlockAllFlags() force-clamps every restricted flag to false', () => {
    for (const k of INTERNAL_PREVIEW_RESTRICTED_FLAGS) {
      expect(demoUnlockAllFlags()[k]).toBe(false);
    }
  });

  it('a restricted flag is settable ONLY via applyInternalPreviewOverlay, never via the generic demo unlock', () => {
    for (const k of INTERNAL_PREVIEW_RESTRICTED_FLAGS) {
      // The generic client "unlock all" can never set it, regardless of what
      // the underlying demo profile contains (demoUnlockAllFlags's own clamp
      // test above already proves this against DEMO_ALL_ON_FLAGS).
      expect(demoUnlockAllFlags()[k]).toBe(false);

      // The overlay — and only the overlay — can, because a live server grant
      // is the authoritative boundary NO-a.1 anticipated.
      expect(INTERNAL_PREVIEW_OVERLAYABLE_FLAGS).toContain(k);
      const base = freshBase();
      const granted = overlay([k as OverlayableFlagKey]);
      const result = applyInternalPreviewOverlay(base, granted, NOW);
      expect(result[k]).toBe(true);
    }
  });
});

describe('isProviderGrantHonoured — stage clamp predicate (§4.5, §4.5.1, §4.5.2)', () => {
  it('blocked is never honoured, regardless of grant', () => {
    expect(isProviderGrantHonoured('blocked', true)).toBe(false);
    expect(isProviderGrantHonoured('blocked', false)).toBe(false);
  });

  it('internal is honoured only with a live grant', () => {
    expect(isProviderGrantHonoured('internal', true)).toBe(true);
    expect(isProviderGrantHonoured('internal', false)).toBe(false);
  });

  it('beta is honoured only with a live grant (reserved; no percentage mechanism exists — §12)', () => {
    expect(isProviderGrantHonoured('beta', true)).toBe(true);
    expect(isProviderGrantHonoured('beta', false)).toBe(false);
  });

  it('ga is always honoured — a grant is moot once the provider is generally available', () => {
    expect(isProviderGrantHonoured('ga', true)).toBe(true);
    expect(isProviderGrantHonoured('ga', false)).toBe(true);
  });
});

// Verdict S2 (#558 review): malformed / out-of-contract overlays must fail
// CLOSED — every case below previously either threw or failed OPEN (probes
// P1-P3, P8-P10). All must return base BY REFERENCE.
describe('malformed overlays fail closed (verdict S1/S2)', () => {
  const base = { ...DEFAULT_FLAGS };
  const NOW = 1_754_000_000_000;
  const valid: InternalPreviewOverlay = {
    contractVersion: OVERLAY_CONTRACT_VERSION,
    grants: ['health_oura_enabled'],
    expiresAtMs: NOW + 60_000,
    receivedAtMs: NOW - 1_000,
    cohorts: [],
  };

  it('missing expiresAtMs (P1) → base by reference', () => {
    const { expiresAtMs: _omit, ...noTtl } = valid;
    expect(applyInternalPreviewOverlay(base, noTtl as never, NOW)).toBe(base);
  });
  it('NaN expiresAtMs (P2) → base by reference', () => {
    expect(applyInternalPreviewOverlay(base, { ...valid, expiresAtMs: Number.NaN }, NOW)).toBe(base);
  });
  it('raw ISO-string expiresAtMs (P3 — the anticipated parser mistake) → base', () => {
    expect(
      applyInternalPreviewOverlay(base, { ...valid, expiresAtMs: '2026-08-05T12:00:00Z' as never }, NOW),
    ).toBe(base);
  });
  it('NaN nowMs (P10) → base by reference', () => {
    expect(applyInternalPreviewOverlay(base, valid, Number.NaN)).toBe(base);
  });
  it('undefined overlay (P8, out-of-contract) → base, never throws', () => {
    expect(applyInternalPreviewOverlay(base, undefined as never, NOW)).toBe(base);
  });
  it('non-array grants (P9) → base, never throws', () => {
    expect(applyInternalPreviewOverlay(base, { ...valid, grants: 'health_oura_enabled' as never }, NOW)).toBe(base);
  });
});
