import { describe, it, expect } from 'vitest';
import {
  decideProfileHydration,
  identityPatchFromServerSnapshot,
  isCalibrationEmpty,
  type ServerProfileSnapshot,
} from '../profileHydration';
import { DEFAULT_PROFILE_IDENTITY, type ProfileIdentity } from '../profileIdentity';

const fresh = (): ProfileIdentity => ({ ...DEFAULT_PROFILE_IDENTITY });
const calibrated = (): ProfileIdentity => ({
  ...DEFAULT_PROFILE_IDENTITY,
  bodyWeightLbs: 185,
  heightCm: 180,
  birthYear: 1990,
});
const serverSnap: ServerProfileSnapshot = {
  weightLbs: 200,
  heightCm: 178,
  birthYear: 1988,
  sex: 'male',
  activityLevel: 3,
  trainingLevel: 'competitive',
  performanceGoal: 'recovery',
  sweatClassification: 'heavy',
};

describe('isCalibrationEmpty', () => {
  it('true for a fresh install', () => {
    expect(isCalibrationEmpty(fresh())).toBe(true);
  });
  it('false once any calibration variable exists', () => {
    expect(isCalibrationEmpty({ ...fresh(), bodyWeightLbs: 150 })).toBe(false);
    expect(isCalibrationEmpty({ ...fresh(), trainingLevel: 'casual' as never })).toBe(false);
  });
});

describe('decideProfileHydration — §7 no-silent-overwrite table', () => {
  it('no server version → noop', () => {
    expect(
      decideProfileHydration({ localIdentity: fresh(), hasPendingSync: false, serverSnapshot: null }),
    ).toBe('noop');
  });
  it('pending unsynced local change → keep_local (local is newer by definition)', () => {
    expect(
      decideProfileHydration({ localIdentity: fresh(), hasPendingSync: true, serverSnapshot: serverSnap }),
    ).toBe('keep_local');
  });
  it('fresh install + server has a profile → hydrate', () => {
    expect(
      decideProfileHydration({ localIdentity: fresh(), hasPendingSync: false, serverSnapshot: serverSnap }),
    ).toBe('hydrate');
  });
  it('calibrated local + server present → keep_local (server is never newer than local)', () => {
    expect(
      decideProfileHydration({ localIdentity: calibrated(), hasPendingSync: false, serverSnapshot: serverSnap }),
    ).toBe('keep_local');
  });
});

describe('identityPatchFromServerSnapshot', () => {
  it('maps every server-backed field to its identity slot', () => {
    const patch = identityPatchFromServerSnapshot(serverSnap);
    expect(patch).toEqual({
      bodyWeightLbs: 200,
      heightCm: 178,
      birthYear: 1988,
      biologicalSex: 'male',
      activityLevel: 3,
      trainingLevel: 'competitive',
      primaryGoal: 'recovery',
      sweatClassification: 'heavy',
    });
  });
  it('sparse snapshot never nulls a local field', () => {
    const patch = identityPatchFromServerSnapshot({ weightLbs: 150 });
    expect(patch).toEqual({ bodyWeightLbs: 150 });
    expect('birthYear' in patch).toBe(false);
  });
});
