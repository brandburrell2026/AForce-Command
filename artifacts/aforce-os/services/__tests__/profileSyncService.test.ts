/**
 * Profile sync service (Section 18) tests — the client side of Contract A.
 *
 * Locks:
 *   1. Identity → snapshot mapping carries birthYear (contract B) and leaves
 *      not-yet-collected Section 19 fields null.
 *   2. A major body-model change POSTs to /profile/version with the engine's
 *      classification (changedFields + explanation) and a first-baseline
 *      confidence, then persists the returned pointers.
 *   3. A second major change sends the post-recalibration confidence and the
 *      stored pointers advance.
 *   4. A minor save does NOT hit the network.
 *   5. A failed POST keeps the edit (synced:false) and reuses the SAME
 *      clientChangeId on retry (idempotency).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// In-memory AsyncStorage, hoisted so the vi.mock factory can close over it.
const { mem } = vi.hoisted(() => ({ mem: new Map<string, string>() }));
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (k: string) => (mem.has(k) ? (mem.get(k) as string) : null),
    setItem: async (k: string, v: string) => {
      mem.set(k, v);
    },
    removeItem: async (k: string) => {
      mem.delete(k);
    },
  },
}));

// Capture POST calls and script the response/throw per test.
const { post } = vi.hoisted(() => ({
  post: vi.fn(),
}));
vi.mock('../aforceApiClient', () => ({
  postJsonAforceApi: (path: string, body: unknown) => post(path, body),
}));

import { saveProfileVersion, profileSnapshotFromIdentity } from '../profileSyncService';
import {
  DEFAULT_PROFILE_IDENTITY,
  type ProfileIdentity,
} from '../../utils/profileIdentity';

function identity(overrides: Partial<ProfileIdentity> = {}): ProfileIdentity {
  return { ...DEFAULT_PROFILE_IDENTITY, ...overrides };
}

function mintOk(profileVersionId: number, baselineVersionId: number, versionNumber: number) {
  return {
    pointers: { profileVersionId, baselineVersionId, versionNumber },
    minted: true,
  };
}

beforeEach(() => {
  mem.clear();
  post.mockReset();
});

describe('profileSnapshotFromIdentity', () => {
  it('maps body-model fields and carries birthYear; unset §19 fields are null', () => {
    const snap = profileSnapshotFromIdentity(
      identity({ bodyWeightLbs: 200, heightCm: 180, birthYear: 1990, biologicalSex: 'male', activityLevel: 6 }),
    );
    expect(snap.weightLbs).toBe(200);
    expect(snap.birthYear).toBe(1990);
    expect(snap.sex).toBe('male');
    expect(snap.activityLevel).toBe(6);
    expect(snap.trainingLevel).toBeNull();
    expect(snap.performanceGoal).toBeNull();
    expect(snap.connectedWearables).toEqual([]);
  });

  it('passes Section 19 fields into the snapshot slots (primaryGoal → performanceGoal)', () => {
    const snap = profileSnapshotFromIdentity(
      identity({
        trainingLevel: 'Advanced',
        primaryGoal: 'Strength & Muscle',
        sweatClassification: 'heavy',
        // Non-major baseline inputs — not in the snapshot.
        goalWeightLbs: 185,
        typicalWorkoutDurationMin: 60,
      }),
    );
    expect(snap.trainingLevel).toBe('Advanced');
    expect(snap.performanceGoal).toBe('Strength & Muscle');
    expect(snap.sweatClassification).toBe('heavy');
    // homeClimate / sleepSchedule remain unset (their sections haven't landed).
    expect(snap.homeClimate).toBeNull();
    expect(snap.sleepSchedule).toBeNull();
  });
});

describe('saveProfileVersion', () => {
  it('mints v1 on the first major save with first-baseline confidence', async () => {
    post.mockResolvedValueOnce(mintOk(1, 1, 1));
    const res = await saveProfileVersion(identity({ bodyWeightLbs: 200 }));

    expect(post).toHaveBeenCalledTimes(1);
    const [path, body] = post.mock.calls[0];
    expect(path).toBe('/profile/version');
    expect(body.changedFields).toContain('weightLbs');
    expect(typeof body.explanation).toBe('string');
    expect(body.initialConfidence).toBe(0.5); // initialFirstBaseline
    expect(typeof body.clientChangeId).toBe('string');

    expect(res).toMatchObject({ changeType: 'major', synced: true, minted: true, versionNumber: 1 });
  });

  it('uses post-recalibration confidence on the second major save', async () => {
    post.mockResolvedValueOnce(mintOk(1, 1, 1));
    await saveProfileVersion(identity({ bodyWeightLbs: 200 }));

    post.mockResolvedValueOnce(mintOk(2, 2, 2));
    await saveProfileVersion(identity({ bodyWeightLbs: 185 }));

    expect(post).toHaveBeenCalledTimes(2);
    expect(post.mock.calls[1][1].initialConfidence).toBe(0.35); // initialAfterRecalibration
  });

  it('mints when a Section 19 major field changes (training / goal / sweat)', async () => {
    // Establish v1 from a body-model-only save.
    post.mockResolvedValueOnce(mintOk(1, 1, 1));
    await saveProfileVersion(identity({ bodyWeightLbs: 200 }));
    post.mockClear();

    // Now set Primary Goal + Training Level + Sweat — all major slots.
    post.mockResolvedValueOnce(mintOk(2, 2, 2));
    const res = await saveProfileVersion(
      identity({
        bodyWeightLbs: 200,
        primaryGoal: 'Endurance',
        trainingLevel: 'Elite',
        sweatClassification: 'very_heavy',
      }),
    );
    expect(post).toHaveBeenCalledTimes(1);
    const body = post.mock.calls[0][1];
    expect(body.changedFields).toEqual(
      expect.arrayContaining(['performanceGoal', 'trainingLevel', 'sweatClassification']),
    );
    expect(body.snapshot.performanceGoal).toBe('Endurance');
    expect(res).toMatchObject({ changeType: 'major', synced: true, versionNumber: 2 });
  });

  it('does not mint for a non-major §19 field (goal weight / workout duration)', async () => {
    post.mockResolvedValueOnce(mintOk(1, 1, 1));
    await saveProfileVersion(identity({ bodyWeightLbs: 200 }));
    post.mockClear();

    // Goal weight + workout duration are baseline inputs, not snapshot slots.
    const res = await saveProfileVersion(
      identity({ bodyWeightLbs: 200, goalWeightLbs: 180, typicalWorkoutDurationMin: 90 }),
    );
    expect(post).not.toHaveBeenCalled();
    expect(res.changeType).toBe('minor');
  });

  it('does not hit the network for a minor save', async () => {
    // Establish v1 first.
    post.mockResolvedValueOnce(mintOk(1, 1, 1));
    await saveProfileVersion(identity({ bodyWeightLbs: 200, nickname: 'A' }));
    post.mockClear();

    // Only a minor (non-major) field changes — no major-variable delta.
    const res = await saveProfileVersion(identity({ bodyWeightLbs: 200, nickname: 'B' }));
    expect(post).not.toHaveBeenCalled();
    expect(res).toMatchObject({ changeType: 'minor', synced: true, minted: false });
  });

  it('ignores a sub-threshold weight wobble (minor, no POST)', async () => {
    post.mockResolvedValueOnce(mintOk(1, 1, 1));
    await saveProfileVersion(identity({ bodyWeightLbs: 200 }));
    post.mockClear();

    const res = await saveProfileVersion(identity({ bodyWeightLbs: 202 })); // < 3 lb trigger
    expect(post).not.toHaveBeenCalled();
    expect(res.changeType).toBe('minor');
  });

  it('keeps the edit and reuses the clientChangeId after a failed POST', async () => {
    post.mockRejectedValueOnce(new Error('offline'));
    const first = await saveProfileVersion(identity({ bodyWeightLbs: 200 }));
    expect(first).toMatchObject({ changeType: 'major', synced: false, minted: false });
    const firstChangeId = post.mock.calls[0][1].clientChangeId;

    // Retry succeeds — same idempotency key is reused.
    post.mockResolvedValueOnce(mintOk(1, 1, 1));
    const retry = await saveProfileVersion(identity({ bodyWeightLbs: 200 }));
    expect(retry.synced).toBe(true);
    expect(post.mock.calls[1][1].clientChangeId).toBe(firstChangeId);
  });
});
