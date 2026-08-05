/**
 * RC-2 Ruling A — internal-TestFlight elite-flag overlay tests.
 *
 * Covers: identity-when-off (production/App-Store builds get the exact
 * `DEFAULT_FLAGS` object back, `toBe` reference equality, mutation-verified),
 * exactly-five-when-on (a snapshot diff enumerating every key that changed —
 * proving nothing besides the five ruling keys ever flips), and the
 * restricted-flag interaction check (none of the five overlay keys may ever
 * appear in `INTERNAL_PREVIEW_RESTRICTED_FLAGS`).
 */
import { describe, it, expect } from 'vitest';
import type { FeatureFlags } from '../../types';
import { DEFAULT_FLAGS, DEMO_ALL_ON_FLAGS, INTERNAL_PREVIEW_RESTRICTED_FLAGS } from '../flags';
import {
  applyInternalTestflightOverlay,
  resolveInitialFeatureFlags,
  INTERNAL_TESTFLIGHT_OVERLAY_FLAGS,
} from '../internalTestflightOverlay';

const FIVE_FLAGS = [
  'elite_motion_enabled',
  'elite_home_experience_enabled',
  'elite_weekly_report_enabled',
  'elite_voice_coach_enabled',
  'offline_intake_outbox_enabled',
] as const;

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
  it('is exactly the five ruling keys, in the ruling’s own order', () => {
    expect([...INTERNAL_TESTFLIGHT_OVERLAY_FLAGS]).toEqual([...FIVE_FLAGS]);
  });

  it('every ruling key is OFF in DEFAULT_FLAGS today (nothing to no-op flip)', () => {
    for (const key of FIVE_FLAGS) {
      expect(DEFAULT_FLAGS[key]).toBe(false);
    }
  });

  it('none of the five ruling keys are in INTERNAL_PREVIEW_RESTRICTED_FLAGS', () => {
    // Founder decision NO-10 restricts flags like night_out_enabled from ANY
    // generic client-side unlock. This overlay is a distinct, build-time-only
    // mechanism — but it must never become a side-door around that restriction.
    for (const key of FIVE_FLAGS) {
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

describe('applyInternalTestflightOverlay — exactly five when on (internal TestFlight)', () => {
  it('flips exactly the five ruling keys to true and nothing else, per a full key diff', () => {
    const before = DEFAULT_FLAGS;
    const after = applyInternalTestflightOverlay(before, true);

    expect(changedKeys(before, after)).toEqual([...FIVE_FLAGS].sort());
    for (const key of FIVE_FLAGS) {
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
    expect(changedKeys(base, after)).toEqual([...FIVE_FLAGS].sort());
  });

  it('is idempotent: applying twice produces the same five-key diff as applying once', () => {
    const once = applyInternalTestflightOverlay(DEFAULT_FLAGS, true);
    const twice = applyInternalTestflightOverlay(once, true);
    expect(changedKeys(DEFAULT_FLAGS, twice)).toEqual([...FIVE_FLAGS].sort());
  });

  it('does not touch DEMO_ALL_ON_FLAGS — this overlay only patches the value passed in as `base`', () => {
    const snapshot = { ...DEMO_ALL_ON_FLAGS };
    applyInternalTestflightOverlay(DEFAULT_FLAGS, true);
    expect(DEMO_ALL_ON_FLAGS).toEqual(snapshot);
  });
});
