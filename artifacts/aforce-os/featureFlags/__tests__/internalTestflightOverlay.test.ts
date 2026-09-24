/**
 * RC-2 Ruling A — internal-TestFlight elite-flag overlay tests.
 *
 * Covers: identity-when-off (production/App-Store builds get the exact
 * `DEFAULT_FLAGS` object back, `toBe` reference equality, mutation-verified),
 * exactly-the-granted-keys-when-on (a snapshot diff enumerating every key that
 * changed — proving nothing besides the ten granted keys ever flips), the
 * premise that every granted key is OFF in production defaults (the overlay
 * grants only what production does not — A4, 2026-09-23), and the
 * restricted-flag interaction check (none of the ten overlay keys may ever
 * appear in `INTERNAL_PREVIEW_RESTRICTED_FLAGS`).
 */
import { describe, it, expect } from 'vitest';
import type { FeatureFlags } from '../../types';
import { DEFAULT_FLAGS, DEMO_ALL_ON_FLAGS, INTERNAL_PREVIEW_RESTRICTED_FLAGS } from '../flags';
import {
  applyInternalTestflightOverlay,
  resolveInitialFeatureFlags,
  INTERNAL_TESTFLIGHT_OVERLAY_FLAGS,
  RC2_OVERLAY_FLAGS,
  EDITORIAL_PARTNER_OVERLAY_FLAGS,
  ENVIRONMENTAL_INTERNAL_OVERLAY_FLAGS,
  SKINIA_INTERNAL_TESTFLIGHT_OVERLAY_FLAGS,
} from '../internalTestflightOverlay';

const RC2_FIVE = [
  'elite_motion_enabled',
  'elite_home_experience_enabled',
  'elite_weekly_report_enabled',
  'elite_voice_coach_enabled',
  'offline_intake_outbox_enabled',
] as const;

/**
 * The Editorial partner grant (founder ruling 2026-09-05) as it stands after
 * founder decision A4 (2026-09-23): the ruling granted five surfaces, but Home,
 * Moments and Weekly graduated to production defaults by the founder direction
 * of 2026-09-16 (#1031), so the overlay now lists only the two surfaces
 * production does not already ship. Held as its OWN list, mirroring the
 * source, so each ruling stays separately traceable — and so adding a key to
 * either set is a visible, reviewable diff here.
 */
const EDITORIAL_PARTNER_TWO = [
  'editorial_protocol_enabled',
  'editorial_scan_enabled',
] as const;

/**
 * A4 graduation record (2026-09-23). These three were part of the 2026-09-05
 * partner grant and are now production defaults (`DEFAULT_FLAGS` ships them
 * `true`). They must appear in NO overlay list: an ON-only union has nothing
 * to grant for a key production already ships, and listing one would break
 * the OFF-in-defaults premise below. No further graduation is authorised.
 */
const GRADUATED_EDITORIAL_THREE = [
  'editorial_home_enabled',
  'editorial_moments_enabled',
  'editorial_weekly_enabled',
] as const;

/**
 * Environmental Intelligence v1 (founder ruling 2026-09-07). Its own list for
 * the same reason as the two above: each ruling stays separately traceable.
 *
 * BOTH flags are granted deliberately. They are independent precisely so one
 * can move without the other, and the device smoke needs both — presentation
 * alone is a surface with nothing to read, acquisition alone is evidence
 * nobody can see.
 */
const ENVIRONMENTAL_TWO = [
  'environmental_acquisition_enabled',
  'environmental_surface_enabled',
] as const;

const SKINIA_ONE = ['advanced_visual_intelligence_enabled'] as const;

/** What the internal build actually flips: the union (ten keys), in ruling order. */
const ALL_GRANTED = [...RC2_FIVE, ...EDITORIAL_PARTNER_TWO, ...ENVIRONMENTAL_TWO, ...SKINIA_ONE] as const;

/** Every key that differs between two flag objects, sorted for a stable diff. */
function changedKeys(before: FeatureFlags, after: FeatureFlags): string[] {
  const keys = new Set<string>([...Object.keys(before), ...Object.keys(after)]);
  const out: string[] = [];
  for (const key of keys) {
    if (before[key as keyof FeatureFlags] !== after[key as keyof FeatureFlags]) {
      out.push(key);
    }
  }
  return out.sort();
}

describe('INTERNAL_TESTFLIGHT_OVERLAY_FLAGS (RC-2 Ruling A)', () => {
  it('is exactly the four grants’ keys, each set intact, in ruling order', () => {
    // Pinned as FOUR sets plus their union, not one flat list: the module's
    // contract is that each ruling stays founder-traceable, and a merged array
    // would hide which ruling granted what.
    expect([...RC2_OVERLAY_FLAGS]).toEqual([...RC2_FIVE]);
    expect([...EDITORIAL_PARTNER_OVERLAY_FLAGS]).toEqual([...EDITORIAL_PARTNER_TWO]);
    expect([...ENVIRONMENTAL_INTERNAL_OVERLAY_FLAGS]).toEqual([...ENVIRONMENTAL_TWO]);
    expect([...SKINIA_INTERNAL_TESTFLIGHT_OVERLAY_FLAGS]).toEqual([...SKINIA_ONE]);
    expect([...INTERNAL_TESTFLIGHT_OVERLAY_FLAGS]).toEqual([...ALL_GRANTED]);
  });

  it('THE SETS ARE DISJOINT — no key is granted twice or silently moved', () => {
    const sets = [RC2_OVERLAY_FLAGS, EDITORIAL_PARTNER_OVERLAY_FLAGS,
      ENVIRONMENTAL_INTERNAL_OVERLAY_FLAGS, SKINIA_INTERNAL_TESTFLIGHT_OVERLAY_FLAGS];
    const seen = new Set<string>();
    for (const set of sets) {
      for (const key of set) {
        expect(seen.has(key), `${key} appears in more than one ruling`).toBe(false);
        seen.add(key);
      }
    }
    expect(INTERNAL_TESTFLIGHT_OVERLAY_FLAGS.length)
      .toBe(sets.reduce((n, set) => n + set.length, 0));
  });

  it('THE CALENDAR GATE IS NOT IN THE OVERLAY — Legal/Privacy stays closed', () => {
    // moments_calendar_enabled awaits Legal + Privacy sign-off. Granting the
    // editorial Moments surface must never drag it along.
    expect([...INTERNAL_TESTFLIGHT_OVERLAY_FLAGS]).not.toContain('moments_calendar_enabled');
    expect(DEFAULT_FLAGS.moments_calendar_enabled).toBe(false);
  });

  it('every ruling key is OFF in DEFAULT_FLAGS today (nothing to no-op flip)', () => {
    for (const key of ALL_GRANTED) {
      expect(DEFAULT_FLAGS[key]).toBe(false);
    }
  });

  it('keys granted only by the overlay remain OFF in production defaults', () => {
    // The module's premise, stated against the SOURCE export rather than this
    // file's mirror: the overlay grants only what production does not. A key
    // that graduates to `true` in DEFAULT_FLAGS must leave the overlay in the
    // same change (A4, 2026-09-23) — this is what catches the next graduation.
    expect(INTERNAL_TESTFLIGHT_OVERLAY_FLAGS.length).toBeGreaterThan(0);
    for (const key of INTERNAL_TESTFLIGHT_OVERLAY_FLAGS) {
      expect(DEFAULT_FLAGS[key], `${key} is granted by the overlay but already true in DEFAULT_FLAGS`).toBe(false);
    }
  });

  it('A4 graduation record (2026-09-23): Home, Moments and Weekly are production defaults and appear in no overlay list', () => {
    // Founder direction 2026-09-16 (#1031) shipped these three in
    // DEFAULT_FLAGS; A4 recognised the graduations for the limited purpose of
    // correcting this overlay contract. Pinned on both sides so a revert of
    // either half (the default or the overlay list) is a visible failure here.
    for (const key of GRADUATED_EDITORIAL_THREE) {
      expect(DEFAULT_FLAGS[key], `${key} should be a production default`).toBe(true);
      expect([...INTERNAL_TESTFLIGHT_OVERLAY_FLAGS] as readonly string[]).not.toContain(key);
      expect([...EDITORIAL_PARTNER_OVERLAY_FLAGS] as readonly string[]).not.toContain(key);
    }
  });

  it('none of the ten ruling keys are in INTERNAL_PREVIEW_RESTRICTED_FLAGS', () => {
    // Founder decision NO-10 restricts flags like night_out_enabled from ANY
    // generic client-side unlock. This overlay is a distinct, build-time-only
    // mechanism — but it must never become a side-door around that restriction.
    for (const key of ALL_GRANTED) {
      expect(INTERNAL_PREVIEW_RESTRICTED_FLAGS as readonly string[]).not.toContain(key);
    }
  });
});

describe('applyInternalTestflightOverlay — identity when off (production/App-Store default)', () => {
  it('returns `base` BY REFERENCE when engaged=false', () => {
    const result = applyInternalTestflightOverlay(DEFAULT_FLAGS, false);
    expect(result).toBe(DEFAULT_FLAGS);
  });

  it('is a true no-op: DEFAULT_FLAGS is not mutated by the call', () => {
    const snapshot = { ...DEFAULT_FLAGS };
    applyInternalTestflightOverlay(DEFAULT_FLAGS, false);
    expect(DEFAULT_FLAGS).toEqual(snapshot);
  });

  it('defaults `engaged` to the env-derived constant, which is false in this test run (no EXPO_PUBLIC_INTERNAL_TESTFLIGHT set)', () => {
    const result = applyInternalTestflightOverlay(DEFAULT_FLAGS);
    expect(result).toBe(DEFAULT_FLAGS);
  });

  it('resolveInitialFeatureFlags(DEFAULT_FLAGS) is byte-identical to DEFAULT_FLAGS off the ruling', () => {
    const resolved = resolveInitialFeatureFlags(DEFAULT_FLAGS);
    expect(resolved).toBe(DEFAULT_FLAGS);
    expect(changedKeys(DEFAULT_FLAGS, resolved)).toEqual([]);
  });
});

describe('applyInternalTestflightOverlay — exactly the granted keys when on (internal TestFlight)', () => {
  it('flips exactly the granted ruling keys to true and nothing else, per a full key diff', () => {
    const before = DEFAULT_FLAGS;
    const after = applyInternalTestflightOverlay(before, true);

    expect(changedKeys(before, after)).toEqual([...ALL_GRANTED].sort());
    for (const key of ALL_GRANTED) {
      expect(after[key]).toBe(true);
    }
  });

  it('allocates a new object when engaged (never mutates base)', () => {
    const before = DEFAULT_FLAGS;
    const after = applyInternalTestflightOverlay(before, true);
    expect(after).not.toBe(before);
    expect(before.elite_motion_enabled).toBe(false); // base untouched
  });

  it('is a union, never a merge: a base with an already-true unrelated flag keeps it true, untouched', () => {
    const base: FeatureFlags = { ...DEFAULT_FLAGS, sleep_mode_enabled: true, city_competition_enabled: true };
    const after = applyInternalTestflightOverlay(base, true);
    expect(after.sleep_mode_enabled).toBe(true);
    expect(after.city_competition_enabled).toBe(true);
    expect(changedKeys(base, after)).toEqual([...ALL_GRANTED].sort());
  });

  it('is idempotent: applying twice produces the same ten-key diff as applying once', () => {
    const once = applyInternalTestflightOverlay(DEFAULT_FLAGS, true);
    const twice = applyInternalTestflightOverlay(once, true);
    expect(changedKeys(DEFAULT_FLAGS, twice)).toEqual([...ALL_GRANTED].sort());
  });

  it('does not touch DEMO_ALL_ON_FLAGS — this overlay only patches the value passed in as `base`', () => {
    const snapshot = { ...DEMO_ALL_ON_FLAGS };
    applyInternalTestflightOverlay(DEFAULT_FLAGS, true);
    expect(DEMO_ALL_ON_FLAGS).toEqual(snapshot);
  });
});

// #563 verdict SF-3: the single-env gate's real defense is that the
// PRODUCTION eas profile never sets the key. Pin it here so a mistaken
// prod-profile env addition fails a test instead of shipping the overlay
// to the App Store build.
describe('eas.json production profile never sets the overlay env (SF-3 guard)', () => {
  it('production profile lacks EXPO_PUBLIC_INTERNAL_TESTFLIGHT', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { readFileSync } = require('node:fs');
    const { join } = require('node:path');
    const eas = JSON.parse(
      readFileSync(join(__dirname, '..', '..', 'eas.json'), 'utf8'),
    );
    const prodEnv = eas.build?.production?.env ?? {};
    expect(Object.keys(prodEnv)).not.toContain('EXPO_PUBLIC_INTERNAL_TESTFLIGHT');
  });
});
