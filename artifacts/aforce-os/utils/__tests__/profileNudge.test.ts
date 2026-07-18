/**
 * Section 55 Step 3 — Profile Completeness nudge.
 *
 * Pins the performance-scientist ruling: capability-only copy (gated by the §64
 * observation-only guard, no outcome claim, no percentage/counter), a fixed
 * NAMEABLE allowlist that can never surface a body/bio/age field, and an
 * "occasionally, never nag" cadence with locked constants and exact boundaries.
 */
import { describe, it, expect } from 'vitest';
import { DEFAULT_PROFILE_IDENTITY, type ProfileIdentity } from '../profileIdentity';
import { assessProfileCompleteness } from '../profile/profileCompleteness';
import { isCompliantCoachLine } from '../intelligence/conversationalLanguage';
import {
  shouldShowProfileNudge,
  profileNudgeLine,
  selectProfileNudge,
  NAMEABLE_FIELD_KEYS,
  PROFILE_NUDGE_GENERIC,
  PROFILE_NUDGE_GENERIC_ALT,
  NUDGE_MIN_INTERVAL_DAYS,
  NUDGE_DISMISS_COOLDOWN_DAYS,
  NUDGE_MAX_DISMISSALS,
  NUDGE_MAX_LIFETIME_SHOWS,
  NUDGE_MIN_ACCOUNT_AGE_DAYS,
  NUDGE_MIN_SESSIONS,
  type ProfileNudgeSignals,
} from '../profile/profileNudge';

// A profile with the 3 NAMEABLE fields filled but body/bio/age fields missing —
// used to prove the nudge never names a body field.
const NAMEABLE_FILLED_ONLY: ProfileIdentity = {
  ...DEFAULT_PROFILE_IDENTITY,
  trainingLevel: 'Active', primaryGoal: 'Recovery Optimization', activityLevel: 6,
};
const completenessOf = (p: ProfileIdentity) => assessProfileCompleteness(p);

// Every user-facing string the module can emit.
const namedLines = [
  profileNudgeLine(completenessOf(DEFAULT_PROFILE_IDENTITY)), // names first missing (training level)
  profileNudgeLine(completenessOf({ ...DEFAULT_PROFILE_IDENTITY, trainingLevel: 'Active' })), // primary goal
  profileNudgeLine(completenessOf({ ...DEFAULT_PROFILE_IDENTITY, trainingLevel: 'Active', primaryGoal: 'Recovery Optimization' })), // activity level
];
const ALL_COPY = [PROFILE_NUDGE_GENERIC, PROFILE_NUDGE_GENERIC_ALT, ...namedLines];

/** A signals object that DOES show, so each test overrides exactly one rule. */
function showable(over: Partial<ProfileNudgeSignals> = {}): ProfileNudgeSignals {
  return {
    completenessLevel: 'partial',
    accountAgeDays: 30,
    sessionCount: 10,
    shownCount: 0,
    dismissCount: 0,
    daysSinceLastShown: null,
    daysSinceLastDismissed: null,
    ...over,
  };
}

describe('Section 55 Step 3 — copy is capability-only, never a claim or a meter', () => {
  it('every emitted line passes the §64 observation-only guard', () => {
    for (const line of ALL_COPY) {
      expect(isCompliantCoachLine(line), line).toBe(true);
    }
  });

  it('no line makes an outcome/health claim', () => {
    const OUTCOME = /\b(hydrat|recover|performa?nce?|readiness|prevent|avoid|better|improve|reduce|risk)\w*/i;
    for (const line of ALL_COPY) {
      expect(line, line).not.toMatch(OUTCOME);
    }
  });

  it('no line contains a percentage, counter, or 100% target (never a meter)', () => {
    for (const line of ALL_COPY) {
      expect(line, line).not.toMatch(/\d|%/);
    }
  });
});

describe('Section 55 Step 3 — field naming is allowlist-only', () => {
  it('the allowlist is exactly the three behavioral/preference fields', () => {
    expect([...NAMEABLE_FIELD_KEYS].sort()).toEqual(
      ['activityLevel', 'primaryGoal', 'trainingLevel'].sort(),
    );
  });

  it('names the first missing allowlisted field, in priority order', () => {
    expect(profileNudgeLine(completenessOf(DEFAULT_PROFILE_IDENTITY)))
      .toBe('Adding your training level helps AForce OS tailor its recommendations.');
    expect(profileNudgeLine(completenessOf({ ...DEFAULT_PROFILE_IDENTITY, trainingLevel: 'Active' })))
      .toBe('Adding your primary goal helps AForce OS tailor its recommendations.');
    expect(profileNudgeLine(completenessOf({
      ...DEFAULT_PROFILE_IDENTITY, trainingLevel: 'Active', primaryGoal: 'Recovery Optimization',
    }))).toBe('Adding your activity level helps AForce OS tailor its recommendations.');
  });

  it('NEVER names a body/bio/age field — falls back to generic when only those are missing', () => {
    // trainingLevel/primaryGoal/activityLevel all present; weight/sex/height/age/sweat/goalWeight missing.
    const line = profileNudgeLine(completenessOf(NAMEABLE_FILLED_ONLY));
    expect(line).toBe(PROFILE_NUDGE_GENERIC);
    expect(line).not.toMatch(/weight|height|sex|age|birth|sweat/i);
    // and the missing body fields really ARE missing (guards the test's own premise)
    const missing = completenessOf(NAMEABLE_FILLED_ONLY).fields.filter((f) => !f.present).map((f) => f.key);
    expect(missing).toEqual(expect.arrayContaining(['bodyWeightLbs', 'biologicalSex', 'birthYear']));
    for (const k of missing) expect(NAMEABLE_FIELD_KEYS.has(k)).toBe(false);
  });

  it('with no completeness given, uses the generic line', () => {
    expect(profileNudgeLine()).toBe(PROFILE_NUDGE_GENERIC);
  });
});

describe('Section 55 Step 3 — cadence "occasionally, never nag"', () => {
  it('the happy path shows', () => {
    expect(shouldShowProfileNudge(showable())).toBe(true);
  });

  it('rule 1: rich never shows (personalization already strong)', () => {
    expect(shouldShowProfileNudge(showable({ completenessLevel: 'rich' }))).toBe(false);
  });

  it('rule 2: stops forever at the dismissal ceiling (exact boundary)', () => {
    expect(shouldShowProfileNudge(showable({ dismissCount: NUDGE_MAX_DISMISSALS - 1 }))).toBe(true);
    expect(shouldShowProfileNudge(showable({ dismissCount: NUDGE_MAX_DISMISSALS }))).toBe(false);
  });

  it('rule 3: stops forever at the lifetime show ceiling (exact boundary)', () => {
    expect(shouldShowProfileNudge(showable({ shownCount: NUDGE_MAX_LIFETIME_SHOWS - 1 }))).toBe(true);
    expect(shouldShowProfileNudge(showable({ shownCount: NUDGE_MAX_LIFETIME_SHOWS }))).toBe(false);
  });

  it('rule 4: grace period — new account or too few sessions (exact boundaries)', () => {
    expect(shouldShowProfileNudge(showable({ accountAgeDays: NUDGE_MIN_ACCOUNT_AGE_DAYS - 1 }))).toBe(false);
    expect(shouldShowProfileNudge(showable({ accountAgeDays: NUDGE_MIN_ACCOUNT_AGE_DAYS }))).toBe(true);
    expect(shouldShowProfileNudge(showable({ sessionCount: NUDGE_MIN_SESSIONS - 1 }))).toBe(false);
    expect(shouldShowProfileNudge(showable({ sessionCount: NUDGE_MIN_SESSIONS }))).toBe(true);
  });

  it('rule 5: post-dismiss cooldown (exact boundary)', () => {
    expect(shouldShowProfileNudge(showable({ daysSinceLastDismissed: NUDGE_DISMISS_COOLDOWN_DAYS - 1 }))).toBe(false);
    expect(shouldShowProfileNudge(showable({ daysSinceLastDismissed: NUDGE_DISMISS_COOLDOWN_DAYS }))).toBe(true);
  });

  it('rule 6: min interval since last shown (exact boundary)', () => {
    expect(shouldShowProfileNudge(showable({ daysSinceLastShown: NUDGE_MIN_INTERVAL_DAYS - 1 }))).toBe(false);
    expect(shouldShowProfileNudge(showable({ daysSinceLastShown: NUDGE_MIN_INTERVAL_DAYS }))).toBe(true);
  });

  it('never-shown / never-dismissed (null) skips the interval rules', () => {
    expect(shouldShowProfileNudge(showable({ daysSinceLastShown: null, daysSinceLastDismissed: null }))).toBe(true);
  });

  it('fails CLOSED on non-finite counters (a bad-data read never nags)', () => {
    for (const bad of [Number.NaN, Infinity, -Infinity]) {
      expect.soft(shouldShowProfileNudge(showable({ accountAgeDays: bad })), `accountAgeDays=${bad}`).toBe(false);
      expect.soft(shouldShowProfileNudge(showable({ sessionCount: bad })), `sessionCount=${bad}`).toBe(false);
      expect.soft(shouldShowProfileNudge(showable({ shownCount: bad })), `shownCount=${bad}`).toBe(false);
    }
  });
});

describe('Section 55 Step 3 — selectProfileNudge (cadence + copy)', () => {
  it('when hidden, message is null', () => {
    const r = selectProfileNudge(showable({ completenessLevel: 'rich' }));
    expect(r.show).toBe(false);
    expect(r.message).toBeNull();
  });

  it('when shown, message is the completeness-aware line', () => {
    const r = selectProfileNudge(showable(), completenessOf(DEFAULT_PROFILE_IDENTITY));
    expect(r.show).toBe(true);
    expect(r.message).toBe('Adding your training level helps AForce OS tailor its recommendations.');
  });

  it('when shown with no completeness, message is the generic line', () => {
    const r = selectProfileNudge(showable());
    expect(r.show).toBe(true);
    expect(r.message).toBe(PROFILE_NUDGE_GENERIC);
  });
});
