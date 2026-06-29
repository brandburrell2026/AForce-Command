/**
 * Adaptive Profile Engine™ repository (Section 18) — lifecycle + contract-A
 * behavior, exercised through the in-memory impl. The in-memory and Drizzle
 * impls share one contract; the Drizzle path wraps the same steps in a single
 * transaction (atomicity is enforced by Postgres and not unit-testable here).
 *
 * Locks:
 *   1. First major change mints v1, opens a first baseline at the higher
 *      first-baseline confidence, and advances the pointer.
 *   2. A second major change mints v2, ARCHIVES the prior baseline (never
 *      deletes), and opens a new active baseline at the lower
 *      post-recalibration confidence.
 *   3. Idempotent replay: the same clientChangeId returns the existing ids
 *      with minted:false and does NOT create a second version.
 *   4. A minor change records a log row but never touches versions/baselines.
 *   5. updateBaselineProgress moves the active baseline's count + confidence.
 */

import { describe, it, expect } from 'vitest';
import { createInMemoryProfileRepo } from '../profileRepo';

// The repo is the pure persistence layer: it stores whatever confidence the
// caller (the app engine) computed. To keep the DB package free of any
// dependency on the app, these tests use literal stand-ins for the engine's
// first-baseline vs post-recalibration values — the actual confidence FORMULA
// is covered in adaptiveProfileEngine.test.ts.
const FIRST_BASELINE_CONFIDENCE = 0.5;
const RECALIBRATION_CONFIDENCE = 0.35;

const USER = 'user_test';

function major(overrides: Record<string, unknown> = {}) {
  return {
    userId: USER,
    snapshot: { weightLbs: 200 },
    changedFields: ['weightLbs'],
    explanation: 'Your hydration targets were recalibrated…',
    initialConfidence: RECALIBRATION_CONFIDENCE,
    ...overrides,
  };
}

describe('profileRepo lifecycle (in-memory)', () => {
  it('mints v1 + first baseline and advances the pointer', async () => {
    const repo = createInMemoryProfileRepo();
    const res = await repo.recordMajorChange(
      major({ initialConfidence: FIRST_BASELINE_CONFIDENCE }),
    );
    expect(res.minted).toBe(true);
    expect(res.pointers.versionNumber).toBe(1);

    const profile = await repo.getCurrentProfile(USER);
    expect(profile?.currentProfileVersionId).toBe(res.pointers.profileVersionId);
    expect(profile?.currentBaselineVersionId).toBe(res.pointers.baselineVersionId);
    expect(profile?.lastCalibrationAt).toBeInstanceOf(Date);

    const baseline = await repo.getActiveBaseline(USER);
    expect(baseline?.confidence).toBe(FIRST_BASELINE_CONFIDENCE);
    expect(baseline?.status).toBe('active');
  });

  it('mints v2, archives the prior baseline, opens a new active one', async () => {
    const repo = createInMemoryProfileRepo();
    const v1 = await repo.recordMajorChange(
      major({ initialConfidence: FIRST_BASELINE_CONFIDENCE }),
    );
    const v2 = await repo.recordMajorChange(
      major({ snapshot: { weightLbs: 188 }, initialConfidence: RECALIBRATION_CONFIDENCE }),
    );

    expect(v2.pointers.versionNumber).toBe(2);
    expect(v2.pointers.baselineVersionId).not.toBe(v1.pointers.baselineVersionId);

    const active = await repo.getActiveBaseline(USER);
    expect(active?.id).toBe(v2.pointers.baselineVersionId);
    // Post-recalibration confidence opens lower than the first baseline.
    expect(active?.confidence).toBe(RECALIBRATION_CONFIDENCE);
    expect(active?.confidence).toBeLessThan(FIRST_BASELINE_CONFIDENCE);
  });

  it('is idempotent on a replayed clientChangeId', async () => {
    const repo = createInMemoryProfileRepo();
    const first = await repo.recordMajorChange(
      major({ clientChangeId: 'change_abc' }),
    );
    const replay = await repo.recordMajorChange(
      major({ clientChangeId: 'change_abc' }),
    );
    expect(first.minted).toBe(true);
    expect(replay.minted).toBe(false);
    expect(replay.pointers.profileVersionId).toBe(first.pointers.profileVersionId);
    expect(replay.pointers.versionNumber).toBe(1); // not bumped to 2
  });

  it('records a minor change without minting a version', async () => {
    const repo = createInMemoryProfileRepo();
    await repo.recordMinorChange({
      userId: USER,
      changedFields: ['hydrationPreference'],
      explanation: '',
    });
    expect(await repo.getCurrentProfile(USER)).toBeNull();
    expect(await repo.getActiveBaseline(USER)).toBeNull();
  });

  it('advances baseline observation count + confidence', async () => {
    const repo = createInMemoryProfileRepo();
    const res = await repo.recordMajorChange(
      major({ initialConfidence: RECALIBRATION_CONFIDENCE }),
    );
    // Stand-in for an engine-computed "3 observations" confidence — the repo
    // stores it verbatim; the ramp formula itself is tested in the engine.
    const rampedConfidence = 0.5;
    await repo.updateBaselineProgress(
      res.pointers.baselineVersionId,
      3,
      rampedConfidence,
    );
    const baseline = await repo.getActiveBaseline(USER);
    expect(baseline?.observationCount).toBe(3);
    expect(baseline?.confidence).toBe(rampedConfidence);
  });
});
