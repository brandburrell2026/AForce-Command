/**
 * §55 / Show-10 — Profile Strength display model.
 * Pins that it composes §55 completeness + the shared chip mapping, with no copy.
 */
import { describe, it, expect } from 'vitest';
import { DEFAULT_PROFILE_IDENTITY, type ProfileIdentity } from '../profileIdentity';
import { profileStrength } from '../profile/profileStrength';

const FILLED: ProfileIdentity = {
  ...DEFAULT_PROFILE_IDENTITY,
  bodyWeightLbs: 180, heightCm: 178, birthYear: 1990, biologicalSex: 'male',
  activityLevel: 6, trainingLevel: 'Active', primaryGoal: 'Recovery Optimization',
  sweatClassification: 'moderate', goalWeightLbs: 175,
};

describe('§55 — profileStrength', () => {
  it('a filled profile is rich → RICH chip at full opacity', () => {
    expect(profileStrength(FILLED)).toEqual({ level: 'rich', chip: { label: 'RICH', opacity: 1 } });
  });

  it('an empty (default) profile is sparse → SPARSE chip, dimmed', () => {
    expect(profileStrength(DEFAULT_PROFILE_IDENTITY)).toEqual({
      level: 'sparse',
      chip: { label: 'SPARSE', opacity: 0.47 },
    });
  });

  it('a partially-filled profile is partial', () => {
    const partial: ProfileIdentity = {
      ...DEFAULT_PROFILE_IDENTITY,
      bodyWeightLbs: 180, heightCm: 178, birthYear: 1990, biologicalSex: 'female',
    };
    expect(profileStrength(partial)).toEqual({ level: 'partial', chip: { label: 'PARTIAL', opacity: 0.7 } });
  });

  it('carries no explanatory copy — the chip is label + opacity only', () => {
    const { chip } = profileStrength(FILLED);
    expect(Object.keys(chip).sort()).toEqual(['label', 'opacity']);
  });
});
