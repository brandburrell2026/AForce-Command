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

// In-memory secure KV (the service's storage moved from plain AsyncStorage to
// the encrypted secureKV in RC-L11), hoisted so the vi.mock factory can close
// over it. Mocking here also keeps react-native / expo-secure-store (Flow
// syntax) out of the pure runner.
const { mem } = vi.hoisted(() => ({ mem: new Map<string, string>() }));
vi.mock('../secureStorage', () => ({
  secureKV: {
    getItem: async (k: string) => (mem.has(k) ? (mem.get(k) as string) : null),
    setItem: async (k: string, v: string) => {
      mem.set(k, v);
    },
    removeItem: async (k: string) => {
      mem.delete(k);
    },
  },
}));

// Capture GET/POST calls and script the response/throw per test.
const { post, get } = vi.hoisted(() => ({
  post: vi.fn(),
  get: vi.fn(),
}));
vi.mock('../aforceApiClient', () => ({
  postJsonAforceApi: (path: string, body: unknown) => post(path, body),
  getJsonAforceApi: (path: string) => get(path),
}));

import {
  saveProfileVersion,
  profileSnapshotFromIdentity,
  hydrateProfileFromServer,
  flushPendingProfileSync,
} from '../profileSyncService';
import {
  recalibrateTargets,
  recalibrationInputsFromIdentity,
} from '../bodyRecalibrationEngine';
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

  it('sends the §20 recalibrated targets in the mint POST', async () => {
    post.mockResolvedValueOnce(mintOk(1, 1, 1));
    const id = identity({
      bodyWeightLbs: 200,
      trainingLevel: 'Advanced',
      sweatClassification: 'heavy',
      primaryGoal: 'Endurance',
      typicalWorkoutDurationMin: 60,
    });
    await saveProfileVersion(id);

    const body = post.mock.calls[0][1];
    // The service sends exactly the engine's output for these inputs.
    expect(body.targets).toEqual(
      recalibrateTargets(recalibrationInputsFromIdentity(id)),
    );
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

/* ─── RC-L11 — server rehydration + reconnect flush ──────────────────────── */

describe('hydrateProfileFromServer (Lock §7 / RC-L11)', () => {
  const serverVersion = {
    profile: { currentProfileVersionId: 7, currentBaselineVersionId: 9 },
    baseline: { id: 9 },
    version: {
      id: 7,
      versionNumber: 3,
      snapshot: { weightLbs: 200, heightCm: 178, birthYear: 1988, sex: 'male' },
    },
  };

  beforeEach(() => {
    mem.clear();
    get.mockReset();
    post.mockReset();
  });

  it('fresh install + server profile → hydrates and seeds sync state', async () => {
    get.mockResolvedValueOnce(serverVersion);
    const result = await hydrateProfileFromServer({ ...DEFAULT_PROFILE_IDENTITY });
    expect(result.decision).toBe('hydrate');
    expect(result.patch).toMatchObject({ bodyWeightLbs: 200, birthYear: 1988 });
    // Sync state seeded from server truth (pointers + last-synced snapshot).
    const sync = JSON.parse(mem.get('aforce.profileSync') as string);
    expect(sync.profileVersionId).toBe(7);
    expect(sync.baselineVersionId).toBe(9);
    expect(sync.lastSyncedSnapshot.weightLbs).toBe(200);
    expect(sync.pendingClientChangeId).toBeNull();
  });

  it('calibrated local profile → keep_local, no patch, sync state untouched', async () => {
    get.mockResolvedValueOnce(serverVersion);
    const result = await hydrateProfileFromServer({
      ...DEFAULT_PROFILE_IDENTITY,
      bodyWeightLbs: 150,
    });
    expect(result.decision).toBe('keep_local');
    expect(result.patch).toBeNull();
    expect(mem.has('aforce.profileSync')).toBe(false);
  });

  it('pending unsynced change → keep_local (never overwritten by the server)', async () => {
    mem.set(
      'aforce.profileSync',
      JSON.stringify({ lastSyncedSnapshot: null, profileVersionId: null, baselineVersionId: null, pendingClientChangeId: 'pv_x' }),
    );
    get.mockResolvedValueOnce(serverVersion);
    const result = await hydrateProfileFromServer({ ...DEFAULT_PROFILE_IDENTITY });
    expect(result.decision).toBe('keep_local');
  });

  it('offline / GET failure → noop, local state stands', async () => {
    get.mockRejectedValueOnce(new Error('offline'));
    const result = await hydrateProfileFromServer({ ...DEFAULT_PROFILE_IDENTITY });
    expect(result.decision).toBe('noop');
  });

  it('server has no version yet → noop', async () => {
    get.mockResolvedValueOnce({ profile: null, baseline: null, version: null });
    const result = await hydrateProfileFromServer({ ...DEFAULT_PROFILE_IDENTITY });
    expect(result.decision).toBe('noop');
  });
});

describe('flushPendingProfileSync (Lock §7 reconnect flush)', () => {
  beforeEach(() => {
    mem.clear();
    get.mockReset();
    post.mockReset();
  });

  it('no pending change → no-op, no network', async () => {
    const flushed = await flushPendingProfileSync({ ...DEFAULT_PROFILE_IDENTITY });
    expect(flushed).toBe(false);
    expect(post).not.toHaveBeenCalled();
  });

  it('pending change → retries the save with the SAME idempotency key', async () => {
    mem.set(
      'aforce.profileSync',
      JSON.stringify({
        lastSyncedSnapshot: null,
        profileVersionId: null,
        baselineVersionId: null,
        pendingClientChangeId: 'pv_retry_me',
      }),
    );
    post.mockResolvedValueOnce({
      pointers: { profileVersionId: 1, baselineVersionId: 2, versionNumber: 1 },
      minted: true,
    });
    const flushed = await flushPendingProfileSync({
      ...DEFAULT_PROFILE_IDENTITY,
      bodyWeightLbs: 190,
    });
    expect(flushed).toBe(true);
    expect(post).toHaveBeenCalledTimes(1);
    const body = post.mock.calls[0][1] as { clientChangeId: string };
    expect(body.clientChangeId).toBe('pv_retry_me');
  });
});
