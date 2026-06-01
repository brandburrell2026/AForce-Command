/**
 * Profile-identity slice — editable identity fields shown on the
 * premium profile card. Pins the reducer contract (partial-merge
 * UPDATE vs full-record SET) used by the Edit Profile modal and the
 * AsyncStorage hydration effect.
 */

import { describe, it, expect } from 'vitest';

import { reducer } from '../appStoreReducer';
import {
  DEFAULT_PROFILE_IDENTITY,
  sanitizeProfileIdentity,
  AURA_STATES,
} from '../../utils/profileIdentity';
import { makeState } from './_fixtures';

describe('store · profileIdentity slice', () => {
  it('initial state seeds DEFAULT_PROFILE_IDENTITY (empty strings + FLOW aura)', () => {
    const s = makeState();
    expect(s.profileIdentity).toEqual(DEFAULT_PROFILE_IDENTITY);
  });

  it('UPDATE_PROFILE_IDENTITY merges a single field without clobbering others', () => {
    const start = makeState({
      profileIdentity: { ...DEFAULT_PROFILE_IDENTITY, city: 'Miami' },
    });
    const next = reducer(start, {
      type: 'UPDATE_PROFILE_IDENTITY',
      payload: { nickname: 'MiamiPulse' },
    });
    expect(next.profileIdentity.nickname).toBe('MiamiPulse');
    expect(next.profileIdentity.city).toBe('Miami');
    expect(next.profileIdentity.auraState).toBe('FLOW');
  });

  it('UPDATE_PROFILE_IDENTITY with empty string clears a chip (valid save)', () => {
    const start = makeState({
      profileIdentity: { ...DEFAULT_PROFILE_IDENTITY, teamCircle: 'Old Team' },
    });
    const next = reducer(start, {
      type: 'UPDATE_PROFILE_IDENTITY',
      payload: { teamCircle: '' },
    });
    expect(next.profileIdentity.teamCircle).toBe('');
  });

  it('two sequential UPDATE_PROFILE_IDENTITY calls accumulate', () => {
    const a = reducer(makeState(), {
      type: 'UPDATE_PROFILE_IDENTITY',
      payload: { nickname: 'A', city: 'Austin' },
    });
    const b = reducer(a, {
      type: 'UPDATE_PROFILE_IDENTITY',
      payload: { auraState: 'IGNITE' },
    });
    expect(b.profileIdentity.nickname).toBe('A');
    expect(b.profileIdentity.city).toBe('Austin');
    expect(b.profileIdentity.auraState).toBe('IGNITE');
  });

  it('SET_PROFILE_IDENTITY replaces the entire record (hydration path)', () => {
    const start = makeState({
      profileIdentity: { ...DEFAULT_PROFILE_IDENTITY, nickname: 'Stale' },
    });
    const fresh = {
      displayName: 'Coach Rock',
      nickname: 'Fresh',
      avatarUri: '',
      city: 'NYC',
      country: 'USA',
      teamCircle: '',
      territoryBadge: '',
      auraState: 'APEX' as const,
      recoveryGoal: 'PERFORMANCE' as const,
      bodyWeightLbs: 170,
      heightCm: 180,
      birthYear: 1990,
      biologicalSex: 'male' as const,
      activityLevel: null,
    };
    const next = reducer(start, { type: 'SET_PROFILE_IDENTITY', payload: fresh });
    expect(next.profileIdentity).toEqual(fresh);
    // Body weight should also be mirrored into userState so the
    // scoring engine + personalization helper see the live value
    // without a separate dispatch.
    expect(next.userState.bodyWeightLbs).toBe(170);
  });

  it('UPDATE_PROFILE_IDENTITY mirrors bodyWeightLbs into userState', () => {
    const start = makeState();
    const next = reducer(start, {
      type: 'UPDATE_PROFILE_IDENTITY',
      payload: { bodyWeightLbs: 195 },
    });
    expect(next.profileIdentity.bodyWeightLbs).toBe(195);
    expect(next.userState.bodyWeightLbs).toBe(195);
  });

  it('UPDATE_PROFILE_IDENTITY without bodyWeightLbs leaves userState untouched', () => {
    const start = makeState();
    const beforeWeight = start.userState.bodyWeightLbs;
    const next = reducer(start, {
      type: 'UPDATE_PROFILE_IDENTITY',
      payload: { nickname: 'NoBodyChange' },
    });
    expect(next.userState.bodyWeightLbs).toBe(beforeWeight);
  });

  it('UPDATE_PROFILE_IDENTITY with bodyWeightLbs:null resets userState to the canonical default', () => {
    // Seed a non-default custom weight so we can prove the reset actually fired.
    const seeded = reducer(makeState(), {
      type: 'UPDATE_PROFILE_IDENTITY',
      payload: { bodyWeightLbs: 240 },
    });
    expect(seeded.userState.bodyWeightLbs).toBe(240);
    const cleared = reducer(seeded, {
      type: 'UPDATE_PROFILE_IDENTITY',
      payload: { bodyWeightLbs: null },
    });
    expect(cleared.profileIdentity.bodyWeightLbs).toBeNull();
    // Default = 180 (matches mockUserProfile.bodyWeightLbs).
    expect(cleared.userState.bodyWeightLbs).toBe(180);
  });

  it('SET_PROFILE_IDENTITY with bodyWeightLbs:null resets userState to the canonical default', () => {
    const seeded = reducer(makeState(), {
      type: 'UPDATE_PROFILE_IDENTITY',
      payload: { bodyWeightLbs: 240 },
    });
    const cleared = reducer(seeded, {
      type: 'SET_PROFILE_IDENTITY',
      payload: {
        ...DEFAULT_PROFILE_IDENTITY,
        bodyWeightLbs: null,
      },
    });
    expect(cleared.userState.bodyWeightLbs).toBe(180);
  });

  it('AURA_STATES exposes all five canonical aura modes', () => {
    expect(new Set(AURA_STATES)).toEqual(
      new Set(['IGNITE', 'FLOW', 'STORM', 'CALM', 'APEX']),
    );
  });
});

describe('utils · sanitizeProfileIdentity', () => {
  it('returns defaults when raw is null/undefined/non-object', () => {
    expect(sanitizeProfileIdentity(null)).toEqual(DEFAULT_PROFILE_IDENTITY);
    expect(sanitizeProfileIdentity(undefined)).toEqual(DEFAULT_PROFILE_IDENTITY);
    expect(sanitizeProfileIdentity('garbage')).toEqual(DEFAULT_PROFILE_IDENTITY);
    expect(sanitizeProfileIdentity(42)).toEqual(DEFAULT_PROFILE_IDENTITY);
  });

  it('round-trips a fully-valid payload', () => {
    const payload = {
      displayName: 'Coach Rock',
      nickname: 'MiamiPulse',
      avatarUri: 'https://cdn.example.com/me.jpg',
      city: 'Miami',
      country: 'USA',
      teamCircle: 'South Beach Run Club',
      territoryBadge: 'MIAMI HEAT ZONE',
      auraState: 'FLOW' as const,
      recoveryGoal: 'PERFORMANCE' as const,
      bodyWeightLbs: 175,
      heightCm: 180,
      birthYear: 1990,
      biologicalSex: 'male' as const,
      activityLevel: 7,
    };
    expect(sanitizeProfileIdentity(payload)).toEqual(payload);
  });

  it('falls back per-field when a field is the wrong type', () => {
    const result = sanitizeProfileIdentity({
      nickname: 42,
      city: 'Miami',
      country: null,
      teamCircle: undefined,
      territoryBadge: { not: 'a string' },
      auraState: 'INVALID',
    });
    expect(result).toEqual({
      displayName: '',
      nickname: '',
      avatarUri: '',
      city: 'Miami',
      country: '',
      teamCircle: '',
      territoryBadge: '',
      auraState: 'FLOW',
      recoveryGoal: 'BALANCE',
      bodyWeightLbs: null,
      heightCm: null,
      birthYear: null,
      biologicalSex: 'unspecified',
      activityLevel: null,
    });
  });

  it('accepts every canonical recovery goal', () => {
    for (const goal of ['PERFORMANCE', 'RECOVERY', 'ENDURANCE', 'BALANCE', 'LONGEVITY'] as const) {
      const result = sanitizeProfileIdentity({ recoveryGoal: goal });
      expect(result.recoveryGoal).toBe(goal);
    }
  });

  it('falls back to BALANCE recovery goal for invalid values', () => {
    expect(sanitizeProfileIdentity({ recoveryGoal: 'WINNING' }).recoveryGoal).toBe('BALANCE');
    expect(sanitizeProfileIdentity({ recoveryGoal: 42 }).recoveryGoal).toBe('BALANCE');
    expect(sanitizeProfileIdentity({ recoveryGoal: null }).recoveryGoal).toBe('BALANCE');
  });

  it('accepts https / http / data:image avatar URIs', () => {
    expect(sanitizeProfileIdentity({ avatarUri: 'https://cdn.example.com/a.png' }).avatarUri).toBe(
      'https://cdn.example.com/a.png',
    );
    expect(sanitizeProfileIdentity({ avatarUri: 'http://example.com/a.jpg' }).avatarUri).toBe(
      'http://example.com/a.jpg',
    );
    expect(
      sanitizeProfileIdentity({ avatarUri: 'data:image/png;base64,iVBORw0KGgo=' }).avatarUri,
    ).toBe('data:image/png;base64,iVBORw0KGgo=');
  });

  it('drops hostile / unknown avatar URI schemes to empty', () => {
    expect(sanitizeProfileIdentity({ avatarUri: 'javascript:alert(1)' }).avatarUri).toBe('');
    expect(sanitizeProfileIdentity({ avatarUri: 'file:///etc/passwd' }).avatarUri).toBe('');
    expect(sanitizeProfileIdentity({ avatarUri: 'ftp://example.com/a.png' }).avatarUri).toBe('');
    expect(sanitizeProfileIdentity({ avatarUri: 'data:text/html,<script>' }).avatarUri).toBe('');
    expect(sanitizeProfileIdentity({ avatarUri: '   ' }).avatarUri).toBe('');
    expect(sanitizeProfileIdentity({ avatarUri: 42 }).avatarUri).toBe('');
  });

  it('drops absurdly long avatar URIs to empty (DoS guard)', () => {
    const huge = 'https://example.com/' + 'x'.repeat(3000);
    expect(sanitizeProfileIdentity({ avatarUri: huge }).avatarUri).toBe('');
  });

  it('accepts a displayName (real name OR alias) up to 48 chars', () => {
    expect(sanitizeProfileIdentity({ displayName: 'Coach Rock' }).displayName).toBe('Coach Rock');
    expect(sanitizeProfileIdentity({ displayName: 'SurgeKing' }).displayName).toBe('SurgeKing');
    expect(sanitizeProfileIdentity({ displayName: 'x'.repeat(100) }).displayName).toHaveLength(48);
    expect(sanitizeProfileIdentity({ displayName: '' }).displayName).toBe('');
  });

  it('clamps body-model numbers out of guardrail range to null', () => {
    const result = sanitizeProfileIdentity({
      bodyWeightLbs: 5,        // < 60 lb
      heightCm: 999,           // > 230 cm
      birthYear: 1700,         // < 1900
      biologicalSex: 'martian',
    });
    expect(result.bodyWeightLbs).toBeNull();
    expect(result.heightCm).toBeNull();
    expect(result.birthYear).toBeNull();
    expect(result.biologicalSex).toBe('unspecified');
  });

  it('accepts in-range body-model numbers and rounds to integers', () => {
    const result = sanitizeProfileIdentity({
      bodyWeightLbs: 175.7,
      heightCm: 180.4,
      birthYear: 1990,
      biologicalSex: 'female',
    });
    expect(result.bodyWeightLbs).toBe(176);
    expect(result.heightCm).toBe(180);
    expect(result.birthYear).toBe(1990);
    expect(result.biologicalSex).toBe('female');
  });

  it('preserves the non-binary biological-sex option', () => {
    const result = sanitizeProfileIdentity({ biologicalSex: 'non-binary' });
    expect(result.biologicalSex).toBe('non-binary');
  });

  it('trims whitespace and caps fields at 48 chars', () => {
    const long = 'x'.repeat(100);
    const result = sanitizeProfileIdentity({
      nickname: '   spaced   ',
      city: long,
    });
    expect(result.nickname).toBe('spaced');
    expect(result.city).toHaveLength(48);
  });

  it('strips control characters but preserves emoji', () => {
    const result = sanitizeProfileIdentity({
      nickname: 'miami\u0000pulse\u001F',
      city: 'Miami ☀️',
    });
    expect(result.nickname).toBe('miamipulse');
    expect(result.city).toBe('Miami ☀️');
  });

  it('accepts every canonical aura state', () => {
    for (const aura of AURA_STATES) {
      const result = sanitizeProfileIdentity({ auraState: aura });
      expect(result.auraState).toBe(aura);
    }
  });
});
