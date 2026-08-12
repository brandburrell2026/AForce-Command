import { describe, it, expect, vi } from 'vitest';

// `services/profileSource.ts` imports `useFeatureFlags` from
// `@/store/useAppStore` at module scope for the hidden
// `useHiddenProfileSource()` hook. The store transitively reaches
// RN/Expo native edges (the 'expo' winter runtime, expo-notifications,
// AsyncStorage) that fail to load under Vitest's Node environment.
// Mirroring the repo convention (coachModeResolution.test.ts,
// realApi.intake.test.ts): stub the RN-only edge minimally; every
// manifest/resolver under test here is pure and stays real.
vi.mock('@/store/useAppStore', () => ({
  useFeatureFlags: () => ({}),
}));

import {
  PROFILE_DOMAINS,
  PROFILE_DOMAIN_LABELS,
  UNIT_FAMILIES,
  UNIT_LABELS,
  UNIT_VARIANTS,
  isProfileDomain,
  resolveUnitSystem,
  unitLabelFor,
} from '../profileSource';

describe('profileSource — domain registry', () => {
  it('lists the ten spec domains in order', () => {
    expect(PROFILE_DOMAINS).toEqual([
      'language',
      'units',
      'coach',
      'sleep',
      'timeline',
      'journal',
      'notifications',
      'hydroScan',
      'social',
      'cruise',
    ]);
  });

  it('labels match the spec strings verbatim', () => {
    expect(PROFILE_DOMAIN_LABELS.language).toBe('Language');
    expect(PROFILE_DOMAIN_LABELS.units).toBe('Units');
    expect(PROFILE_DOMAIN_LABELS.coach).toBe('Coach');
    expect(PROFILE_DOMAIN_LABELS.sleep).toBe('Sleep');
    expect(PROFILE_DOMAIN_LABELS.timeline).toBe('Timeline');
    expect(PROFILE_DOMAIN_LABELS.journal).toBe('Journal');
    expect(PROFILE_DOMAIN_LABELS.notifications).toBe('Notifications');
    expect(PROFILE_DOMAIN_LABELS.hydroScan).toBe('HydroScan');
    expect(PROFILE_DOMAIN_LABELS.social).toBe('Social');
    expect(PROFILE_DOMAIN_LABELS.cruise).toBe('Cruise');
  });
});

describe('isProfileDomain', () => {
  it('returns true for every domain', () => {
    for (const d of PROFILE_DOMAINS) {
      expect(isProfileDomain(d)).toBe(true);
    }
  });

  it('returns false for unknown strings', () => {
    expect(isProfileDomain('hydration')).toBe(false);
    expect(isProfileDomain('')).toBe(false);
  });
});

describe('profileSource — unit registry', () => {
  it('lists the four spec families', () => {
    expect(UNIT_FAMILIES).toEqual([
      'temperature',
      'weight',
      'height',
      'volume',
    ]);
  });

  it('variants cover metric + imperial for every family', () => {
    for (const family of UNIT_FAMILIES) {
      expect(UNIT_VARIANTS[family].metric).toBeTruthy();
      expect(UNIT_VARIANTS[family].imperial).toBeTruthy();
    }
  });

  it('labels match the spec strings verbatim', () => {
    expect(UNIT_LABELS.temperature.imperial).toBe('°F');
    expect(UNIT_LABELS.temperature.metric).toBe('°C');
    expect(UNIT_LABELS.weight.imperial).toBe('lbs');
    expect(UNIT_LABELS.weight.metric).toBe('kg');
    expect(UNIT_LABELS.height.imperial).toBe('ft');
    expect(UNIT_LABELS.height.metric).toBe('cm');
    expect(UNIT_LABELS.volume.imperial).toBe('oz');
    expect(UNIT_LABELS.volume.metric).toBe('mL');
  });
});

describe('resolveUnitSystem — Auto mode', () => {
  it('returns imperial for US / LR / MM', () => {
    expect(resolveUnitSystem({ kind: 'auto' }, 'US')).toBe('imperial');
    expect(resolveUnitSystem({ kind: 'auto' }, 'LR')).toBe('imperial');
    expect(resolveUnitSystem({ kind: 'auto' }, 'MM')).toBe('imperial');
  });

  it('returns metric for every other region', () => {
    for (const r of ['CA', 'GB', 'DE', 'JP', 'AU', 'FR', 'BR', 'IN', 'ZA']) {
      expect(resolveUnitSystem({ kind: 'auto' }, r)).toBe('metric');
    }
  });

  it('is case-insensitive and trims whitespace', () => {
    expect(resolveUnitSystem({ kind: 'auto' }, 'us')).toBe('imperial');
    expect(resolveUnitSystem({ kind: 'auto' }, '  US  ')).toBe('imperial');
  });

  it('falls back to metric for null / empty region', () => {
    expect(resolveUnitSystem({ kind: 'auto' }, null)).toBe('metric');
    expect(resolveUnitSystem({ kind: 'auto' }, undefined)).toBe('metric');
    expect(resolveUnitSystem({ kind: 'auto' }, '')).toBe('metric');
  });
});

describe('resolveUnitSystem — Override mode', () => {
  it('always returns the override, regardless of region', () => {
    expect(
      resolveUnitSystem({ kind: 'override', system: 'imperial' }, 'JP'),
    ).toBe('imperial');
    expect(
      resolveUnitSystem({ kind: 'override', system: 'metric' }, 'US'),
    ).toBe('metric');
  });
});

describe('unitLabelFor', () => {
  it('returns the spec label for every family × system combo', () => {
    expect(unitLabelFor('temperature', 'metric')).toBe('°C');
    expect(unitLabelFor('temperature', 'imperial')).toBe('°F');
    expect(unitLabelFor('weight', 'metric')).toBe('kg');
    expect(unitLabelFor('weight', 'imperial')).toBe('lbs');
    expect(unitLabelFor('height', 'metric')).toBe('cm');
    expect(unitLabelFor('height', 'imperial')).toBe('ft');
    expect(unitLabelFor('volume', 'metric')).toBe('mL');
    expect(unitLabelFor('volume', 'imperial')).toBe('oz');
  });
});
