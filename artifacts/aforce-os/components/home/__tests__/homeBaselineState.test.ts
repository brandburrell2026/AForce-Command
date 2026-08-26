/**
 * Home first-launch evidence gate — pure resolver coverage (Wave 5, founder
 * ruling 2026-08-12).
 *
 * The defect this locks: `data/mockData.ts` seeds a demo day (5 units / 45 oz)
 * that the scoring engine turns into a confident BALANCED 76, so a member who
 * had never logged anything was shown a personal state on first launch. The
 * seed and the engine are untouched — `resolveHomeEvidence` is the whole fix,
 * so its branch table is the thing worth pinning hardest.
 *
 * The `pending` cases carry the no-flash requirement: while the journal read
 * is in flight there must be NO input combination that says "established",
 * because "established" is what lets Home paint the score.
 */
import { describe, it, expect } from 'vitest';

import {
  BASELINE_LOOKBACK_DAYS,
  countLoggedRollupDays,
  resolveHomeEvidence,
} from '../homeBaselineState';

describe('resolveHomeEvidence — local intake settles it synchronously', () => {
  it('one logged intake is enough: established, with no journal read resolved yet', () => {
    // This is the no-flicker guarantee for a returning member — the answer is
    // available on the FIRST paint, so the arc never waits and never appears
    // after a placeholder.
    expect(resolveHomeEvidence({ intakeEventCount: 1, loggedDayCount: null })).toBe('established');
  });

  it('stays established regardless of what the journal later says', () => {
    expect(resolveHomeEvidence({ intakeEventCount: 3, loggedDayCount: 0 })).toBe('established');
    expect(resolveHomeEvidence({ intakeEventCount: 3, loggedDayCount: 7 })).toBe('established');
  });
});

describe('resolveHomeEvidence — the unresolved window never authorises a score', () => {
  it('no local intake and no journal answer yet → pending, not established', () => {
    const state = resolveHomeEvidence({ intakeEventCount: 0, loggedDayCount: null });
    expect(state).toBe('pending');
    expect(state).not.toBe('established');
  });

  it('NO input combination yields established while the journal answer is null (no-flash lock)', () => {
    // Exhaustive over the only free variable that can be non-positive here:
    // if any of these resolved to "established", HomeScreenV2 would paint the
    // seeded BALANCED 76 for the frames before the read lands.
    for (const intakeEventCount of [0, -1, Number.NaN]) {
      expect(resolveHomeEvidence({ intakeEventCount, loggedDayCount: null })).not.toBe('established');
    }
  });

  it('an unusable journal answer is treated as unanswered, never as a history', () => {
    expect(resolveHomeEvidence({ intakeEventCount: 0, loggedDayCount: Number.NaN })).toBe('pending');
  });
});

describe('resolveHomeEvidence — the answered cases', () => {
  it('journal answered "no days logged" → building', () => {
    expect(resolveHomeEvidence({ intakeEventCount: 0, loggedDayCount: 0 })).toBe('building');
  });

  it('journal answered with at least one logged day → established', () => {
    expect(resolveHomeEvidence({ intakeEventCount: 0, loggedDayCount: 1 })).toBe('established');
    expect(resolveHomeEvidence({ intakeEventCount: 0, loggedDayCount: 7 })).toBe('established');
  });

  it('a nonsense negative count is not evidence', () => {
    expect(resolveHomeEvidence({ intakeEventCount: -2, loggedDayCount: -2 })).toBe('building');
  });
});

describe('resolveHomeEvidence — Score-Protection', () => {
  it('returns only a state label — it never sees, computes, or returns a score', () => {
    const state = resolveHomeEvidence({ intakeEventCount: 0, loggedDayCount: 0 });
    expect(typeof state).toBe('string');
    expect(['pending', 'building', 'established']).toContain(state);
  });
});

describe('countLoggedRollupDays', () => {
  it('counts only days that ended with real intake on the books', () => {
    expect(
      countLoggedRollupDays([
        { endUnitsConsumed: 0 },
        { endUnitsConsumed: 4 },
        { endUnitsConsumed: 0 },
        { endUnitsConsumed: 1 },
      ]),
    ).toBe(2);
  });

  it('an empty week is zero, not a falsy surprise', () => {
    expect(countLoggedRollupDays([])).toBe(0);
    expect(countLoggedRollupDays([{ endUnitsConsumed: 0 }])).toBe(0);
  });

  it('ignores non-finite values rather than counting them as a logged day', () => {
    expect(countLoggedRollupDays([{ endUnitsConsumed: Number.NaN }, { endUnitsConsumed: 2 }])).toBe(1);
  });

  it('mutation-verify: an "app was open" day with nothing consumed must not count', () => {
    // The regression this guards: relaxing the predicate to `!= null` (or to
    // snapshot presence) would call a browsing session a day of evidence and
    // hand a brand-new member the fabricated score back.
    expect(countLoggedRollupDays([{ endUnitsConsumed: 0 }, { endUnitsConsumed: 0 }])).toBe(0);
  });
});

describe('BASELINE_LOOKBACK_DAYS', () => {
  it('asks for the same one-week window CircleScreenV3 already reads', () => {
    expect(BASELINE_LOOKBACK_DAYS).toBe(7);
  });
});
