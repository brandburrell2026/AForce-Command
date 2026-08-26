/**
 * S2-2 — Profile production truth (Stage-1-severity carryover from the
 * world-class-release Stage-2 audit).
 *
 * The defect: the LIVE Profile (`spec_profile: true` → ProfileScreenV2)
 * rendered `mockUserProfile` fixtures as if real — a hardcoded 'core'
 * subscription tier (ignoring the server entitlement the same file already
 * refreshes), a constant 12-day streak, 180 lb body weight, "Field Athlete",
 * a 06:30 wake time, an invented daily-target-×12 oz figure, and a personal
 * fabricated name fallback.
 *
 * Locked here, per the founder's S2-2 requirements: real canonical state
 * where it exists; honest not-set states where it doesn't; never an
 * invented replacement value.
 *
 * Source-scanned per the documented house convention for store-connected
 * containers (`hydrationScreenV2OfflineBannerWiring.test.ts` header).
 * `ProfileLegacy` still imports the fixture but is flag-dead
 * (`spec_profile: true` makes ProfileScreenV2 the only mounted Profile);
 * the reachable-surface guard below pins exactly that.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const PKG = resolve(__dirname, '..', '..', '..');
function read(rel: string): string {
  return readFileSync(resolve(PKG, rel), 'utf8');
}
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, '');
}

const profile = stripComments(read('components/profile/ProfileScreenV2.tsx'));
const en = JSON.parse(read('locales/en.json')) as {
  profile: { v2: Record<string, string> };
};

describe('S2-2 — the live Profile renders no mock fixture data', () => {
  it('mockUserProfile is gone from the live surface (code, not comments)', () => {
    expect(profile).not.toContain('mockUserProfile');
  });

  it('the live Profile stays the reachable one (spec_profile default ON)', () => {
    const flags = stripComments(read('featureFlags/flags.ts'));
    expect(flags).toMatch(/spec_profile:\s*true/);
  });

  it('no fabricated literals survive: streak 12, 180 lb, Field Athlete, 06:30', () => {
    expect(profile).not.toMatch(/streakDays/);
    expect(profile).not.toMatch(/\b180\s*lb|bodyWeightLbs:\s*180/);
    expect(profile).not.toContain('Field Athlete');
    expect(profile).not.toContain('06:30');
    expect(profile).not.toContain("'Brandon'");
  });
});

describe('S2-2 — tier comes from the server entitlement, honestly gated', () => {
  it('the identity tier reads the server entitlement slice, never a hardcoded tier', () => {
    expect(profile).toMatch(/const entitlement = useSubscriptionSlice\(\);\s*const tierKey = entitlement\.planId \?\? null;/);
    expect(profile).not.toMatch(/tierKey\s*=\s*['"]core['"]/);
  });

  it('the tier CHIP renders only from a real planId (unknown ⇒ no chip, not a guess)', () => {
    expect(profile).toMatch(/\{tierKey && tier \? \([\s\S]{0,300}?IdentityChip[\s\S]{0,300}?\) : null\}/);
  });

  it('unknown entitlement gets a neutral accent, not a tier color', () => {
    expect(profile).toMatch(/const tierColor = tier\?\.color \?\? af\.textTertiary;/);
  });
});

describe('S2-2 — engine and member state replace the fixtures', () => {
  it('the streak chip is the engine complianceStreak, gated on a real streak', () => {
    expect(profile).toMatch(
      /userState\.complianceStreak > 0 \?[\s\S]{0,200}?day_streak', \{ days: userState\.complianceStreak \}/,
    );
  });

  it('daily target renders real unit and real oz targets — no invented ×12', () => {
    expect(profile).toMatch(/unit_units', \{ value: userState\.dailyTarget \}/);
    expect(profile).toMatch(/daily_target_oz_sub', \{ value: userState\.ozTarget \}/);
    expect(profile).not.toMatch(/dailyTarget \* 12/);
  });

  it('weight / activity / wake fall back to the honest not-set label, never a number', () => {
    expect(profile).toMatch(/bodyWeightLbs != null[\s\S]{0,200}?not_set/);
    expect(profile).toMatch(/activity_type'\)\} value=\{t\('profile\.v2\.not_set'\)\}/);
    expect(profile).toMatch(/userState\.wakeTime[\s\S]{0,300}?not_set/);
  });

  it('the name fallback is the neutral localized label, not a personal name', () => {
    expect(profile).toMatch(/clerkUser\?\.firstName \?\? t\('profile\.v2\.member_fallback'\)/);
  });

  it('the honest labels exist in en.json', () => {
    expect(en.profile.v2.not_set).toBe('Not set');
    expect(en.profile.v2.member_fallback).toBe('Member');
  });
});
