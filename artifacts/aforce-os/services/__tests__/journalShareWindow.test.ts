/**
 * `prepareJournalShare` — the ONE seam, proven as a seam.
 *
 * WHY THIS FILE EXISTS. `ShareJournalRecap` and `deriveJournalShareContext`
 * are two outputs of the same tap, and they were disagreeing: the card
 * rendered "STREAK —" while the route params said `streakDays=14`. Nothing
 * proved they were computed from the same array, because they were computed
 * at two call sites.
 *
 * The seam's job is narrower than it once was — densification moved into the
 * route in the consumer-completeness PR, so `window` is no longer derived
 * here — but the guarantee it exists for is unchanged and is what these laws
 * pin: BOTH outputs come from ONE array, and neither can be quietly given a
 * different one.
 */
import { describe, it, expect } from 'vitest';
import { prepareJournalShare } from '../journalShareWindow';
import { deriveJournalShareContext } from '../journalShareContext';
import { observedRows } from '@/utils/scoring/boundarySeries';
import type { JournalRollup } from '@/types';

const V1 = 'hydrostate-v1.0';

/** An OBSERVED day. */
const day = (date: string, score: number): JournalRollup => ({
  date, avgScore: score, minScore: score, maxScore: score, snapshotsCount: 4,
  endOzConsumed: 60, endAforceUnits: 0, endUnitsConsumed: 5, endSodiumDelivered: 0,
  endSodiumLost: 0, endDeficitPct: 0, pctTimePeak: 0, pctTimeBalanced: 100,
  pctTimeRecovering: 0, pctTimeDepleted: 0, intakeCount: 3, autopilotSessions: 0,
  socialSessions: 0, modelVersions: [V1],
});

/** A day the route materialised but HydroState never observed. */
const gap = (date: string): JournalRollup => ({
  ...day(date, 0), snapshotsCount: 0, intakeCount: 0,
  endOzConsumed: 0, endUnitsConsumed: 0, pctTimeBalanced: 0, modelVersions: [],
});

describe('prepareJournalShare — window and context can never diverge', () => {
  it('the window is the rollups it was given — the route already densified them', () => {
    const rows = [day('2026-08-27', 90), gap('2026-08-28'), day('2026-08-29', 90)];
    const { window } = prepareJournalShare(rows, { rangeDays: 7 });
    expect(window.map((r) => r.date)).toEqual(rows.map((r) => r.date));
    // Copied, not aliased: neither output may mutate what the other sees.
    expect(window).not.toBe(rows);
  });

  it('THE WIRING PROOF: context is computed from the SAME array the window exposes', () => {
    // Deriving the context from anything else is the defect this seam exists
    // to prevent.
    // THE FIXTURE HAS TO DISCRIMINATE, and most do not: with an INTERIOR gap,
    // filtering to observed rows produces an identical context, because
    // `reportedSpanDays` measures the calendar distance between the first and
    // last rows either way. A LEADING gap is the shape that separates them —
    // filtering moves the window's start forward onto the first observed day,
    // which turns an incompletely-covered window into an apparently-eligible
    // one and publishes a streak the real window withholds.
    const rows = [gap('2026-08-27'), day('2026-08-28', 90), day('2026-08-29', 90)];
    const { window, context } = prepareJournalShare(rows, { rangeDays: 7 });
    expect(context).toEqual(deriveJournalShareContext(window, 7));

    // ANTI-VACUITY. Densification moved into the route, so `window` is now
    // just a copy of the input and the equality above could hold for reasons
    // that have nothing to do with wiring. These two make it discriminating:
    // the comparison DOES separate a differently-derived array...
    expect(context.streakDays).toBeUndefined();
    const filtered = deriveJournalShareContext([...observedRows(window)], 7);
    expect(filtered.streakDays).toBe(2); // the fabrication filtering would cause
    expect(context).not.toEqual(filtered);
    // ...and it DOES separate a different rangeDays, so neither side is inert.
    expect(context).not.toEqual(deriveJournalShareContext(window, 3));
  });

  it('rangeDays is threaded from the caller, not assumed', () => {
    // The proof above pins `7` on both sides, so a seam that ignored its input
    // and hardcoded 7 would satisfy it. A picker length the default cannot be
    // confused with settles that independently.
    const rows = [day('2026-08-27', 90), day('2026-08-28', 90), day('2026-08-29', 90)];
    expect(prepareJournalShare(rows, { rangeDays: 30 }).context.rangeDays).toBe(30);
    expect(prepareJournalShare(rows, { rangeDays: 14 }).context.rangeDays).toBe(14);
  });

  it('an unobserved day suppresses the streak in the payload, not just on the card', () => {
    // The gap is a real row on the dense wire. The card withholds the streak
    // for it; the payload must withhold it too, or the member posts a streak
    // the card just declined to show them.
    const rows = [day('2026-08-27', 90), gap('2026-08-28'), day('2026-08-29', 90)];
    const { context } = prepareJournalShare(rows, { rangeDays: 3 });
    expect(context.streakDays).toBeUndefined();
  });

  it('a fully-observed window still publishes its real streak', () => {
    // ANTI-VACUITY for the law above: suppression must not be unconditional.
    const rows = [day('2026-08-27', 90), day('2026-08-28', 90), day('2026-08-29', 90)];
    const { context } = prepareJournalShare(rows, { rangeDays: 3 });
    expect(context.streakDays).toBe(3);
    expect(context.score).toBe(90);
  });

  it('the average excludes unobserved days rather than averaging their sentinel', () => {
    const rows = [day('2026-08-27', 90), gap('2026-08-28'), day('2026-08-29', 90)];
    const { context } = prepareJournalShare(rows, { rangeDays: 3 });
    // The naive answer — averaging the sentinel 0 across all three rows — is
    // 60. The honest answer is 90.
    expect(context.score).toBe(90);
    expect(context.score).not.toBe(60);
  });

  it('an all-unobserved window publishes nothing rather than a fabricated zero', () => {
    const rows = [gap('2026-08-27'), gap('2026-08-28')];
    const { context } = prepareJournalShare(rows, { rangeDays: 2 });
    expect(context.score).toBeNull();
    expect(context.state).toBeNull();
    expect(context.streakDays).toBeUndefined();
  });
});
