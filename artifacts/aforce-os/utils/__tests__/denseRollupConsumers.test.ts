/**
 * DENSE-ROLLUP CONSUMER COMPLETENESS (founder ruling, 2026-09-03).
 *
 * `GET /aforce/journal/rollups` now returns one row per calendar day of the
 * member's effective window. A day HydroState did not observe is PRESENT and
 * carries `snapshotsCount: 0` with sentinel zeros in the SCORE fields.
 *
 * Not every field is zero, and assuming so is its own trap: band-time
 * (`pctTime*`) legitimately carries forward past UTC midnight from the
 * previous day's last snapshot, so an unobserved day can hold
 * `pctTimeBalanced: 100` while having been measured never. That is precisely
 * why `snapshotsCount` — and nothing inferred from the other fields — is the
 * one signal that says whether a score exists.
 *
 * Densifying that contract was tried once before and reverted, because six
 * live consumers read `rollups.length` as an observation count and the
 * sentinel `avgScore: 0` as a measurement. These laws are the other half of
 * the ruling: EVERY consumer is migrated onto the observation seam in the same
 * change, and each of the specific harms is pinned so it cannot come back.
 *
 * They exercise the REAL production functions on realistic dense fixtures —
 * not source scans — so a consumer that silently regresses fails here rather
 * than shipping a Signal-Red bar over a day nothing was measured.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { JournalRollup } from '@/types';
import { buildWeeklyV3Model } from '@/components/insights/weeklyV3Presentation';
import { buildDayViews, historyCompletenessLevel } from '@/components/hydration/signalV3Presentation';
import { deriveSectionSummary, deriveWinMoments } from '@/services/performanceTimeline';
import { computeWeeklyCompliancePct } from '@/hooks/useWeeklyCompliance';
import { classifyStreakEligibility, isEmptyWindow, observedCount, observedRows } from '@/utils/scoring/boundarySeries';
import { computeRecapStats } from '@/utils/journalRecapStats';
import { deriveJournalShareContext } from '@/services/journalShareContext';

const V1 = 'hydrostate-v1.0';

/** An OBSERVED day — a real measurement. */
function day(date: string, over: Partial<JournalRollup> = {}): JournalRollup {
  return {
    date, snapshotsCount: 4, avgScore: 80, minScore: 70, maxScore: 90,
    endOzConsumed: 64, endAforceUnits: 2, endUnitsConsumed: 5,
    endSodiumDelivered: 900, endSodiumLost: 400, endDeficitPct: 12,
    pctTimePeak: 20, pctTimeBalanced: 60, pctTimeRecovering: 15, pctTimeDepleted: 5,
    intakeCount: 4, autopilotSessions: 0, socialSessions: 0, modelVersions: [V1],
    ...over,
  };
}

/**
 * A day the route materialised because it is inside the window, but which
 * HydroState never observed — field-for-field what `emptyDay` emits.
 */
function gap(date: string): JournalRollup {
  return {
    date, snapshotsCount: 0,
    avgScore: 0, minScore: 0, maxScore: 0,
    endOzConsumed: 0, endAforceUnits: 0, endUnitsConsumed: 0,
    endSodiumDelivered: 0, endSodiumLost: 0, endDeficitPct: 0,
    pctTimePeak: 0, pctTimeBalanced: 0, pctTimeRecovering: 0, pctTimeDepleted: 0,
    intakeCount: 0, autopilotSessions: 0, socialSessions: 0, modelVersions: [],
  };
}

/** A REAL day the member logged intake on without a snapshot being captured. */
function intakeOnly(date: string): JournalRollup {
  return { ...gap(date), intakeCount: 3, endOzConsumed: 40 };
}

const WEEK = ['2026-08-24', '2026-08-25', '2026-08-26', '2026-08-27', '2026-08-28', '2026-08-29', '2026-08-30'];
/** A silent week: every calendar day present, none observed. */
const SILENT_WEEK = WEEK.map(gap);
/** Two measured days inside an otherwise silent week. */
const MIXED_WEEK = WEEK.map((d, i) => (i < 2 ? day(d) : gap(d)));

describe('compliance denominators ignore unobserved days', () => {
  it('a silent week makes NO claim — not a 0% failure', () => {
    // `rollups.length` would have made this 0/7 = "You're 0% consistent this
    // week" about a week nothing was measured.
    expect(computeWeeklyCompliancePct(SILENT_WEEK)).toBeNull();
  });

  it('an unobserved day never dilutes a compliant one', () => {
    // Both measured days are compliant; the five silent days are not failures.
    expect(computeWeeklyCompliancePct(MIXED_WEEK)).toBe(100);
    // ANTI-VACUITY: the naive row-count answer is visibly different.
    const naive = Math.round((2 / MIXED_WEEK.length) * 100);
    expect(naive).toBe(29);
  });

  it('a real failure still reads as a failure', () => {
    // Suppression must not be unconditional: an OBSERVED sub-threshold day
    // still counts against the member.
    const week = WEEK.map((d, i) =>
      i === 0 ? day(d, { avgScore: 90 }) : i === 1 ? day(d, { avgScore: 40 }) : gap(d));
    expect(computeWeeklyCompliancePct(week)).toBe(50);
  });

  it('an intake-only day is not a compliance failure either', () => {
    // The member drank; HydroState just did not capture a score.
    const week = [day(WEEK[0]!), intakeOnly(WEEK[1]!)];
    expect(computeWeeklyCompliancePct(week)).toBe(100);
  });
});

describe('weekly timelines do not paint unobserved days as DEPLETED', () => {
  const build = (rollups: JournalRollup[]) =>
    buildWeeklyV3Model({
      nowISO: '2026-09-02T12:00:00.000Z',
      analyticsEvents: [], rollups, paSnapshots: [], paResult: null,
    });

  it('an unobserved day carries NO score and NO band accent', () => {
    const model = build(MIXED_WEEK);
    const unmeasured = model.timeline.filter((d) => d.score == null);
    expect(unmeasured.length).toBe(5);
    // The accent is what would have been Signal Red — it must be absent too,
    // not merely a different colour.
    expect(unmeasured.every((d) => d.accent == null)).toBe(true);
  });

  it('the day still gets a COLUMN — the timeline is a calendar', () => {
    // Dropping the day would silently reshape the week; the column stays and
    // simply renders as unmeasured.
    expect(build(MIXED_WEEK).timeline.map((d) => d.date)).toEqual(WEEK);
  });

  it('a measured day still carries its real score and accent', () => {
    // ANTI-VACUITY: the null-ing is not unconditional.
    const measured = build(MIXED_WEEK).timeline.filter((d) => d.score != null);
    expect(measured.length).toBe(2);
    expect(measured.every((d) => typeof d.accent === 'string')).toBe(true);
    expect(measured[0]!.score).toBe(80);
  });

  it('daysTracked counts OBSERVED days, not the window width', () => {
    expect(build(MIXED_WEEK).daysTracked).toBe(2);
    expect(build(SILENT_WEEK).daysTracked).toBe(0);
    // ANTI-VACUITY: the row count is a genuinely different number.
    expect(MIXED_WEEK.length).toBe(7);
  });

  it('a silent week does not masquerade as model-version evidence', () => {
    expect(build(SILENT_WEEK).modelBoundary.crossesBoundary).toBe(false);
    expect(build(SILENT_WEEK).modelBoundary.versions).toEqual([]);
    expect(build(MIXED_WEEK).modelBoundary.crossesBoundary).toBe(false);
  });

  it('an unobserved day carrying a NULL stamp cannot fabricate a boundary', () => {
    // THE FIXTURE THAT ACTUALLY ISOLATES THE FILTER. The plain `gap()` row
    // above has `modelVersions: []`, which contributes NOTHING to the deduped
    // version list — so filtering it out changes no result and a law built
    // only on that shape proves nothing (verified: a mutation removing the
    // `observedRows` filter survives it).
    //
    // `[null]` is different. `spansModelBoundary([null, 'hydrostate-v1.0'])`
    // is TRUE by design — an unstamped observation is not evidence that it is
    // comparable with a stamped one. So an UNOBSERVED day carrying a null
    // stamp would inject that null into the window's version list and
    // suppress a week-over-week comparison between days that are perfectly
    // comparable with each other. A day with no observation has no provenance
    // to contribute.
    const week = [
      day(WEEK[0]!),
      day(WEEK[1]!),
      { ...gap(WEEK[2]!), modelVersions: [null] } as JournalRollup,
    ];
    const boundary = build(week).modelBoundary;
    expect(boundary.crossesBoundary, 'a silent day is not a recalibration').toBe(false);
    expect(boundary.versions, 'only observed days contribute versions').toEqual([V1]);
    expect(boundary.weekOverWeekSuppressed).toBe(false);
  });

  it('a REAL boundary between two observed days is still detected', () => {
    // ANTI-VACUITY for the law above: the filter must not blind the check.
    const week = [
      day(WEEK[0]!, { modelVersions: ['hydrostate-v0'] }),
      day(WEEK[1]!, { modelVersions: [V1] }),
    ];
    const boundary = build(week).modelBoundary;
    expect(boundary.crossesBoundary).toBe(true);
    expect(boundary.weekOverWeekSuppressed).toBe(true);
  });
});

describe('coverage/richness depends on observed data, not calendar width', () => {
  it('a week with two readings is NOT rich', () => {
    expect(historyCompletenessLevel(observedCount(MIXED_WEEK), 7)).toBe('sparse');
    // The row count would have graded the same week as full coverage.
    expect(historyCompletenessLevel(MIXED_WEEK.length, 7)).toBe('rich');
  });

  it('a fully-observed week IS rich', () => {
    const full = WEEK.map((d) => day(d));
    expect(historyCompletenessLevel(observedCount(full), 7)).toBe('rich');
  });

  it('the Performance Signal day list omits unobserved days entirely', () => {
    // This list has no calendar obligation — every row asserts a reading.
    const views = buildDayViews(MIXED_WEEK, '2026-08-30');
    expect(views.map((v) => v.date)).toEqual(['2026-08-25', '2026-08-24']);
    expect(buildDayViews(SILENT_WEEK, '2026-08-30')).toEqual([]);
  });
});

describe('win moments cannot be minted from an unobserved day', () => {
  it('"Stabilized faster than yesterday" does not fire on a sentinel deficit', () => {
    // THE ALREADY-LIVE DEFECT: an intake-only day ships `endDeficitPct: 0`,
    // so comparing it against a real prior day showed a ≥5-point "drop" and
    // awarded an achievement for a measurement that does not exist.
    const rollups = [day('2026-08-29', { endDeficitPct: 30 }), intakeOnly('2026-08-30')];
    const ids = deriveWinMoments(rollups, 0).map((m) => m.id);
    expect(ids).not.toContain('stabilized');
  });

  it('a real stabilization between two MEASURED days still fires', () => {
    // ANTI-VACUITY: the guard suppresses the fabricated case only.
    const rollups = [day('2026-08-29', { endDeficitPct: 30 }), day('2026-08-30', { endDeficitPct: 10 })];
    expect(deriveWinMoments(rollups, 0).map((m) => m.id)).toContain('stabilized');
  });

  it('comparisons use the two most recent OBSERVED days, not the last two rows', () => {
    // With a gap as the newest row, the comparison must reach back past it
    // rather than comparing a real day against a sentinel.
    const rollups = [
      day('2026-08-28', { endDeficitPct: 30 }),
      day('2026-08-29', { endDeficitPct: 10 }),
      gap('2026-08-30'),
    ];
    expect(deriveWinMoments(rollups, 0).map((m) => m.id)).toContain('stabilized');
  });

  it('a silent window mints nothing at all', () => {
    expect(deriveWinMoments(SILENT_WEEK, 0)).toEqual([]);
  });
});

describe('section summaries average over observed days', () => {
  it('the Recovery tile is not diluted by unobserved days', () => {
    // Both measured days are 80% in-band; the five silent days must not drag
    // that toward zero.
    const recovery = deriveSectionSummary(MIXED_WEEK, 0).find((s) => s.key === 'recovery')!;
    expect(recovery.value).toBe('80%');
    // ANTI-VACUITY: the row-count answer is visibly different.
    expect(Math.round((80 * 2) / 7)).toBe(23);
  });

  it('SUMS still cover the whole window — an unobserved day contributes 0, which is true', () => {
    const summary = deriveSectionSummary(MIXED_WEEK, 0);
    // 2 measured days × 4 intakes each.
    expect(summary.find((s) => s.key === 'corrections')!.value).toBe('8');
    // 2 measured days × 64 oz each.
    expect(summary.find((s) => s.key === 'hydration')!.value).toBe('128 oz');
  });

  it('a silent window WITHHOLDS recovery rather than claiming 0% in the green', () => {
    // This law previously asserted '0%' — pinning a fabrication. "0% time in
    // green" is a claim about the member's physiology, and a window with no
    // observations cannot support it. (Caught by the adversarial gate: a law
    // that locks in the wrong answer is worse than no law.)
    const recovery = deriveSectionSummary(SILENT_WEEK, 0).find((s) => s.key === 'recovery')!;
    expect(recovery.value).toBe('—');
  });

  it('...but a MEASURED zero still reads as a real 0%', () => {
    // ANTI-VACUITY: the withholding is about absence, not about the number 0.
    // A member who was measured all week and spent none of it in the green
    // has a real, publishable 0%.
    const week = WEEK.map((d) =>
      day(d, { pctTimePeak: 0, pctTimeBalanced: 0, pctTimeRecovering: 40, pctTimeDepleted: 60 }));
    const recovery = deriveSectionSummary(week, 0).find((s) => s.key === 'recovery')!;
    expect(recovery.value).toBe('0%');
  });
});

/* ═══════ SOURCE GUARDS for the migrations with no other law ═══════
 *
 * The adversarial gate found four migrations in this PR that could be
 * REVERTED with every suite still green — the code was right, but nothing
 * held it there. Two are store/router-connected screens (this repo's
 * convention is a source guard with mutation-verify, not a fabricated
 * harness — see components/home/__tests__/homeScreenV2Wiring.test.ts); two
 * are render branches whose components pull the RN/Expo runtime.
 *
 * Each guard below re-runs its assertions against a hand-written regressed
 * string, so the guard cannot silently stop detecting what it names.
 */
describe('unprotected migrations are now held', () => {
  const src = (p: string) => readFileSync(join(__dirname, '..', '..', p), 'utf8');

  // EACH GUARD IS A NAMED FUNCTION, and its mutation-verify twin re-runs THE
  // SAME FUNCTION against a regressed string. The earlier shape hand-copied a
  // SUBSET of each guard's assertions into its twin, so the two could drift:
  // strengthening the real law left the twin proving something weaker, and a
  // guard that silently stopped detecting its own defect would still pass.
  function assertSignalUsesObservedRows(code: string): void {
    expect(code).toMatch(/const observed = React\.useMemo\(\(\) => observedRows\(rollups \?\? \[\]\), \[rollups\]\);/);
    expect(code).toMatch(/computeRecapStats\(\[\.\.\.observed\]\)/);
    expect(code, 'the raw wire must not reach the aggregator').not.toMatch(/computeRecapStats\(rollups/);
    // The coverage denominator is the member's ELIGIBLE window, never the
    // requested constant — a three-day-old member was told "2 of 7 days
    // tracked" and given a sparse chip for a window they had fully covered.
    expect(code).toMatch(/const eligibleDays = React\.useMemo\(\(\) => reportedSpanDays\(rollups \?\? \[\]\), \[rollups\]\);/);
    expect(code).toMatch(/historyCompletenessLevel\(recap\.daysTracked, eligibleDays\)/);
    expect(code).toMatch(/total: eligibleDays,/);
    expect(code, 'the requested constant must not be the denominator').not.toMatch(
      /historyCompletenessLevel\(recap\.daysTracked, RANGE_DAYS\)/,
    );
  }

  it('PerformanceSignalV3 feeds computeRecapStats OBSERVED rows, not the raw wire', () => {
    // `computeRecapStats` is a naive aggregator with no observation gate.
    // Every other caller hands it a pre-filtered population; this screen was
    // the one that passed the raw array, folding sentinel zeros into the week
    // average, the peak, the best streak AND the coverage chip.
    assertSignalUsesObservedRows(src('components/hydration/PerformanceSignalV3.tsx'));
  });

  it('mutation-verify: reverting PerformanceSignalV3 to the raw wire is detectable', () => {
    const regressed = `
      const recap = React.useMemo(() => computeRecapStats(rollups ?? []), [rollups]);
      const chip = completenessChip(historyCompletenessLevel(recap.daysTracked, RANGE_DAYS));
      const daysTrackedText = t('signal.v3.days_tracked', { n: recap.daysTracked, total: RANGE_DAYS });`;
    expect(() => assertSignalUsesObservedRows(regressed)).toThrow();
  });

  it('mutation-verify: restoring the hardcoded coverage denominator is detectable', () => {
    // The real source with ONLY the denominator regressed — proving the guard
    // catches that defect on its own, not merely as a side effect of the
    // observed-rows assertions above.
    const code = src('components/hydration/PerformanceSignalV3.tsx');
    const regressed = code.replace(
      'historyCompletenessLevel(recap.daysTracked, eligibleDays)',
      'historyCompletenessLevel(recap.daysTracked, RANGE_DAYS)',
    );
    expect(regressed).not.toBe(code);
    expect(() => assertSignalUsesObservedRows(regressed)).toThrow();
  });

  function assertEditorialWithholdsUnmeasured(code: string): void {
    expect(code).toMatch(/const unmeasured = d\.score == null;/);
    expect(code).toMatch(/timeline_day_unmeasured_a11y/);
    expect(code).toMatch(/\{unmeasured \? null : \(/);
  }

  it('EditorialWeeklyScreen draws no bar and speaks "no reading" on an unobserved day', () => {
    assertEditorialWithholdsUnmeasured(src('components/editorial/weekly/EditorialWeeklyScreen.tsx'));
  });

  it('mutation-verify: collapsing the Editorial unmeasured branch is detectable', () => {
    const regressed = `
      <View style={styles.timelineTrack}>
        <View style={{ flex: Math.max(0.02, 1 - Math.min(100, d.score) / 100) }} />
      </View>`;
    expect(() => assertEditorialWithholdsUnmeasured(regressed)).toThrow();
  });

  it('JournalDayCard shows an em-dash and no lesson on an unobserved day', () => {
    // One of the two ALREADY-LIVE defects this PR fixes: an intake-only day
    // has always shipped sentinel zeros, so the card painted a DEPLETED red 0
    // for a member who drank all day, and coached them about it.
    const code = src('components/journal/JournalDayCard.tsx');
    expect(code).toMatch(/const measured = hasHydroStateObservation\(rollup\);/);
    expect(code).toMatch(/\{measured \? rollup\.avgScore : EM_DASH\}/);
    expect(code).toMatch(/const lesson = measured \? getTodaysLesson\(rollup\) : null;/);
    expect(code).toMatch(/\{lesson != null && \(/);
    // The score cell is also announced honestly, not read as a literal zero.
    expect(code).toMatch(/'journal-day-avg-unmeasured'/);
  });

  function assertPdfWithholdsUnmeasured(code: string): void {
    expect(code).toMatch(/const measured = hasHydroStateObservation\(r\);/);
    expect(code).toMatch(/const scoreCells = measured/);
    expect(code).toMatch(/class="nr">\$\{NO_READING\}/);
    expect(code).toMatch(/measured \? `\$\{r\.endDeficitPct\.toFixed\(1\)\}%` : NO_READING/);
    // EVERY snapshot-derived column, not only the score ones. Gating scores
    // alone left the row printing "0 oz consumed / 0 mg sodium lost" beside a
    // real "3 intakes" — a physiological claim about an unmeasured day, in a
    // document that leaves the app.
    expect(code).toMatch(/const cell = \(v: string\) => \(measured \? v : /);
    expect(code).toMatch(/cell\(r\.endSodiumLost\.toFixed\(0\)\)/);
    expect(code).toMatch(/cell\(r\.endSodiumDelivered\.toFixed\(0\)\)/);
    expect(code).toMatch(/cell\(r\.endOzConsumed\.toFixed\(0\)\)/);
    expect(code, 'sodium loss must never print raw on an unmeasured day').not.toMatch(
      /">\$\{r\.endSodiumLost\.toFixed\(0\)\}<\/td>/,
    );
    // `intakeCount` is the ONE column sourced from the intake table rather
    // than a snapshot, so it alone stays ungated.
    expect(code).toMatch(/">\$\{r\.intakeCount\}<\/td>/);
    // ...and the units total comes from the last OBSERVED day, not the last
    // row (which on a dense wire is always today, synced or not).
    expect(code).toMatch(/observedForReport\[observedForReport\.length - 1\]!\.endAforceUnits/);
  }

  it('the PDF export withholds score cells for an unobserved day', () => {
    // This document LEAVES THE APP. A fabricated 0/0/0 row in it is a claim
    // the member cannot take back.
    assertPdfWithholdsUnmeasured(src('screens/JournalScreen.tsx'));
  });

  it('mutation-verify: dropping the PDF observation gate is detectable', () => {
    const regressed = `
      const dailyRows = [...rollups].reverse().map((r) => \`
        <td>\${r.avgScore}</td><td>\${r.minScore}</td><td>\${r.maxScore}</td>\`);`;
    expect(() => assertPdfWithholdsUnmeasured(regressed)).toThrow();
  });

  it('mutation-verify: taking the PDF units total from the last ROW is detectable', () => {
    const code = src('screens/JournalScreen.tsx');
    const regressed = code.replace(
      'observedForReport[observedForReport.length - 1]!.endAforceUnits',
      'rollups[rollups.length - 1]!.endAforceUnits',
    );
    expect(regressed).not.toBe(code);
    expect(() => assertPdfWithholdsUnmeasured(regressed)).toThrow();
  });
});

/* ═══════ CROSS-SURFACE + ADJACENCY (adversarial gate, second pass) ═══════ */
describe('a streak is suppressed on EVERY surface, or published on every surface', () => {
  const WEEK_WITH_GAP = [
    day('2026-08-24'), day('2026-08-25'), day('2026-08-26'), day('2026-08-27'),
    gap('2026-08-28'),
    day('2026-08-29'), day('2026-08-30'),
  ];

  it('the Performance Signal sheet does not publish a streak the recap withholds', () => {
    // `computeRecapStats` breaks the run at the calendar gap and returns a
    // real, smaller number (4). Publishing it while the recap card suppresses
    // the SAME streak for the SAME array is the cross-surface disagreement
    // this program keeps having to remove.
    expect(classifyStreakEligibility(WEEK_WITH_GAP).kind).toBe('coverage_incomplete');
    // ANTI-VACUITY: the misleading number is genuinely reachable.
    expect(computeRecapStats([...observedRows(WEEK_WITH_GAP)]).bestStreak).toBe(4);
    // The screen's guard is the same helper the recap uses, so both withhold.
    const code = readFileSync(
      join(__dirname, '..', '..', 'components/hydration/PerformanceSignalV3.tsx'), 'utf8');
    expect(code).toMatch(/classifyStreakEligibility\(rollups \?\? \[\]\)\.kind === 'eligible'/);
    expect(code).toMatch(/streakEligible[\s\S]{0,120}recap\.bestStreak[\s\S]{0,40}: EM_DASH/);
  });

  it('a fully-observed week still publishes its streak on both surfaces', () => {
    // ANTI-VACUITY: suppression is not unconditional.
    const whole = WEEK.map((d) => day(d));
    expect(classifyStreakEligibility(whole).kind).toBe('eligible');
    expect(computeRecapStats([...observedRows(whole)]).bestStreak).toBe(7);
  });
});

describe('day-over-day win moments require calendar adjacency', () => {
  it('"Stabilized faster than yesterday" does not fire across a week-long gap', () => {
    // Filtering to observed days can leave the two most recent measurements a
    // week apart. The copy says "yesterday"; adjacency is what makes it true.
    const across = [
      day('2026-08-01', { endDeficitPct: 30 }),
      gap('2026-08-02'), gap('2026-08-03'), gap('2026-08-04'),
      gap('2026-08-05'), gap('2026-08-06'), gap('2026-08-07'),
      day('2026-08-08', { endDeficitPct: 10 }),
    ];
    expect(deriveWinMoments(across, 0).map((m) => m.id)).not.toContain('stabilized');
  });

  it('...but two genuinely adjacent observed days still fire', () => {
    // ANTI-VACUITY: adjacency gates the claim, it does not delete the feature.
    const adjacent = [
      day('2026-08-07', { endDeficitPct: 30 }),
      day('2026-08-08', { endDeficitPct: 10 }),
    ];
    expect(deriveWinMoments(adjacent, 0).map((m) => m.id)).toContain('stabilized');
  });

  it('the streak moment is NOT day-over-day and still fires across a gap', () => {
    // `complianceStreak` is the engine's own canonical value, not a rollup
    // derivation, so the adjacency precondition must not suppress it.
    const across = [day('2026-08-01'), gap('2026-08-02'), day('2026-08-03')];
    expect(deriveWinMoments(across, 5).map((m) => m.id)).toContain('streak');
  });
});

describe('isEmptyWindow — an intake-only day is NOT an empty day', () => {
  it('a window whose only activity is a logged drink is not empty', () => {
    // THE DISTINCTION `hasAnyActivity` EXISTS FOR. A day with a logged intake
    // and no captured snapshot has no SCORE, but the member did something and
    // `JournalDayCard` renders it. Collapsing the screen to "Your performance
    // timeline begins after your first check" would tell them their drink
    // never happened.
    expect(isEmptyWindow([intakeOnly('2026-08-24')])).toBe(false);
    expect(isEmptyWindow(WEEK.map((d, i) => (i === 3 ? intakeOnly(d) : gap(d))))).toBe(false);
  });

  it('a window with a measurement is not empty', () => {
    expect(isEmptyWindow(MIXED_WEEK)).toBe(false);
  });

  it('a window where nothing happened at all IS empty', () => {
    // ANTI-VACUITY: the predicate must still be able to return true, or the
    // welcome line is simply dead by another route.
    expect(isEmptyWindow(SILENT_WEEK)).toBe(true);
    expect(isEmptyWindow([])).toBe(true);
  });

  it('it is the SAME predicate the day card hides on, so the two cannot drift', () => {
    // JournalDayCard returns null for `snapshotsCount === 0 && intakeCount === 0`.
    // The screen is empty exactly when every card would render nothing.
    const cardWouldHide = (r: JournalRollup) => r.snapshotsCount === 0 && r.intakeCount === 0;
    for (const window of [SILENT_WEEK, MIXED_WEEK, [intakeOnly('2026-08-24')], []]) {
      expect(isEmptyWindow(window)).toBe(window.every(cardWouldHide));
    }
  });
});

/* ═══════ PENDING ≠ MISSING — the trailing edge of the dense window ═══════
 *
 * THE FOURTEENTH INSTANCE, caught by the second adversarial gate. The dense
 * window always ends at TODAY, and today carries `snapshotsCount: 0` until the
 * member's first sync after midnight. Measured against the raw span, that
 * not-yet-happened day was indistinguishable from a hole inside the run:
 * `measuredDays < rangeDays` was answering "is there a gap in this streak?"
 * with "has the last day of the window been measured yet?".
 *
 * Every member, every morning, lost their streak on the Signal sheet and had
 * their share payload silently drop from `type: 'streak'` to `type: 'score'`.
 * Before densification the same member was `eligible` — the wire simply had no
 * row for today yet — so this was a regression introduced by the dense
 * contract, not a pre-existing flaw.
 */
describe('a not-yet-synced TODAY does not blank a fully-observed streak', () => {
  const SIX_THEN_TODAY = [...WEEK.slice(0, 6).map((d) => day(d)), gap(WEEK[6]!)];

  it('trailing unobserved days are PENDING — the streak stays publishable', () => {
    expect(classifyStreakEligibility(SIX_THEN_TODAY).kind).toBe('eligible');
    // ANTI-VACUITY: the real, fully-observed streak it would otherwise refuse
    // to print genuinely exists.
    expect(computeRecapStats([...observedRows(SIX_THEN_TODAY)]).bestStreak).toBe(6);
  });

  it('the share payload still leads with the streak, as it did pre-densification', () => {
    const ctx = deriveJournalShareContext(SIX_THEN_TODAY, 7);
    expect(ctx.type).toBe('streak');
    expect(ctx.streakDays).toBe(6);
  });

  it('an INTERIOR gap still suppresses — the fix is about the edge, not the rule', () => {
    // ANTI-VACUITY, and the distinction the whole fix rests on: trimming the
    // trailing day must not also blind the check to a real hole.
    const interior = [
      day(WEEK[0]!), day(WEEK[1]!), gap(WEEK[2]!),
      day(WEEK[3]!), day(WEEK[4]!), day(WEEK[5]!), day(WEEK[6]!),
    ];
    expect(classifyStreakEligibility(interior).kind).toBe('coverage_incomplete');
    expect(deriveJournalShareContext(interior, 7).streakDays).toBeUndefined();
  });

  it('an interior gap PLUS a pending today is still suppressed, and counts honestly', () => {
    const both = [
      day(WEEK[0]!), gap(WEEK[1]!), day(WEEK[2]!),
      day(WEEK[3]!), day(WEEK[4]!), day(WEEK[5]!), gap(WEEK[6]!),
    ];
    // The denominator is the window UP TO the last observed day (6), not the
    // full 7 — the pending day is not one we failed to measure.
    expect(classifyStreakEligibility(both)).toEqual({
      kind: 'coverage_incomplete', measuredDays: 5, rangeDays: 6,
    });
  });

  it('a window with NOTHING measured still reports 0 OF N, never silence', () => {
    // The trim must not collapse an entirely-unmeasured window to `no_history`
    // — a founder ruling from the prior PR that this fix must not undo.
    expect(classifyStreakEligibility(SILENT_WEEK)).toEqual({
      kind: 'coverage_incomplete', measuredDays: 0, rangeDays: 7,
    });
  });

  it('the streak walk skips a pending day rather than reading its sentinel as a failure', () => {
    // The walk used to break on today's `avgScore: 0` at the very first step,
    // publishing streakDays 0 for a member with six qualifying days.
    const ctx = deriveJournalShareContext(SIX_THEN_TODAY, 7);
    expect(ctx.streakDays).toBe(6);
    expect(ctx.streakDays).not.toBe(0);
  });
});

/* Only the TAIL is pending. A gap anywhere else is a day inside the member's
 * eligible history that HydroState genuinely did not observe, and narrowing
 * the window to first-observed..last-observed would let the window report
 * itself fully covered when its FIRST day never was. */
describe('the trim takes the tail only — never a leading or interior gap', () => {
  it('a LEADING unobserved day still suppresses', () => {
    const leading = [gap(WEEK[0]!), ...WEEK.slice(1).map((d) => day(d))];
    expect(classifyStreakEligibility(leading)).toEqual({
      kind: 'coverage_incomplete', measuredDays: 6, rangeDays: 7,
    });
  });

  it('a leading gap AND a pending today: the tail goes, the hole stays', () => {
    const both = [gap(WEEK[0]!), ...WEEK.slice(1, 6).map((d) => day(d)), gap(WEEK[6]!)];
    // Judged over days 1-6 (the pending 7th is dropped); day 1 is a real hole.
    expect(classifyStreakEligibility(both)).toEqual({
      kind: 'coverage_incomplete', measuredDays: 5, rangeDays: 6,
    });
  });
});

/* A win moment is written in the present tense — "Stabilized faster than
 * YESTERDAY". Filtering to observed rows let the pair drift into the past
 * while the copy kept claiming it was current; before the filter, the latest
 * row was necessarily the latest day, so this is a harm the filter created. */
describe('a win moment cannot claim "yesterday" about a pair days in the past', () => {
  /** A stabilising pair: deficit drops 20 points day-over-day. */
  const pair = (a: string, b: string) => [
    day(a, { endDeficitPct: 30 }),
    day(b, { endDeficitPct: 10 }),
  ];
  const stabilized = (ms: ReturnType<typeof deriveWinMoments>) =>
    ms.some((m) => m.id === 'stabilized');

  it('fires when the pair is current — today simply has not synced yet', () => {
    // ANTI-VACUITY, and the case the fix must NOT break: one trailing
    // unobserved row is today-pending, exactly as `classifyStreakEligibility`
    // treats it.
    expect(stabilized(deriveWinMoments(
      [...pair('2026-08-30', '2026-08-31'), gap('2026-09-01')], 0,
    ))).toBe(true);
  });

  it('is withheld once the member has been away a full day or more', () => {
    // The same measured pair, two unobserved days later. The comparison is
    // still true of those two days; it is no longer true of "yesterday".
    expect(stabilized(deriveWinMoments(
      [...pair('2026-08-30', '2026-08-31'), gap('2026-09-01'), gap('2026-09-02')], 0,
    ))).toBe(false);
  });

  it('fires on a pair that ends the window, with nothing trailing at all', () => {
    expect(stabilized(deriveWinMoments(pair('2026-08-30', '2026-08-31'), 0))).toBe(true);
  });

  it('the streak moment is unaffected — it is not a day-over-day claim', () => {
    // `${n}-day streak active` is about a run, not about yesterday, so a quiet
    // stretch must not silently suppress it too.
    const away = [...pair('2026-08-30', '2026-08-31'), gap('2026-09-01'), gap('2026-09-02')];
    expect(deriveWinMoments(away, 4).some((m) => m.id === 'streak')).toBe(true);
  });
});

/* ═══════ THE TAIL TRIM IS KEYED ON ACTIVITY, NOT ON OBSERVATION ═══════
 *
 * The first attempt at the pending-vs-missing fix trimmed any trailing row
 * with `snapshotsCount === 0`, and that broke a founder-ruled case: an
 * intake-without-snapshot day suppresses the streak WHEREVER IT FALLS, last
 * included (`shareJournalRecap.render` cases 3 and 4·5·6). It would have been
 * this program's own defect family committed while fixing an instance of it —
 * one predicate answering "has nothing happened yet?" with "was nothing
 * measured?".
 *
 * Two genuinely different days both carry `snapshotsCount: 0`:
 *   · intake logged, no snapshot captured — the member PARTICIPATED and
 *     HydroState failed to measure them. A real hole.
 *   · nothing at all — the day has not happened yet. Pending.
 */
describe('a trailing day the member participated in is a hole, not a pending day', () => {
  /** The server's intake-without-snapshot row: real activity, no measurement. */
  const intakeOnly = (date: string): JournalRollup => ({
    ...gap(date), intakeCount: 3, endOzConsumed: 48, endUnitsConsumed: 4,
  });

  it('a trailing INTAKE-ONLY day still suppresses — the ruled case, at the end', () => {
    const rows = [...WEEK.slice(0, 6).map((d) => day(d)), intakeOnly(WEEK[6]!)];
    expect(classifyStreakEligibility(rows)).toEqual({
      kind: 'coverage_incomplete', measuredDays: 6, rangeDays: 7,
    });
    expect(deriveJournalShareContext(rows, 7).streakDays).toBeUndefined();
  });

  it('a trailing EMPTY day does not — nothing has happened on it yet', () => {
    // ANTI-VACUITY: identical shape, identical `snapshotsCount`, opposite
    // answer. The ONLY difference between these two fixtures is whether the
    // member did anything, which is exactly the distinction being pinned.
    const rows = [...WEEK.slice(0, 6).map((d) => day(d)), gap(WEEK[6]!)];
    expect(rows[6]!.snapshotsCount).toBe(intakeOnly(WEEK[6]!).snapshotsCount);
    expect(classifyStreakEligibility(rows).kind).toBe('eligible');
    expect(deriveJournalShareContext(rows, 7).streakDays).toBe(6);
  });

  it('an INTERIOR intake-only day suppresses too — position never mattered', () => {
    const rows = [
      day(WEEK[0]!), day(WEEK[1]!), intakeOnly(WEEK[2]!),
      day(WEEK[3]!), day(WEEK[4]!), day(WEEK[5]!), day(WEEK[6]!),
    ];
    expect(classifyStreakEligibility(rows).kind).toBe('coverage_incomplete');
  });

  it('a window of nothing but participation reports 0 OF N, never silence', () => {
    // Every day has intake and no snapshot: no trim (they are all activity),
    // and the founder's "0 OF N" answer survives.
    expect(classifyStreakEligibility(WEEK.map((d) => intakeOnly(d)))).toEqual({
      kind: 'coverage_incomplete', measuredDays: 0, rangeDays: 7,
    });
  });
});

/* ONLY TODAY CAN BE PENDING. The window always ends at today, so exactly one
 * trailing row can be a day that has not happened yet. Trimming a RUN of them
 * deleted real coverage holes: a member last measured weeks ago was judged
 * over a fully-covered window and handed a live streak to post publicly. */
describe('the pending day is ONE day — a run of empty days is real silence', () => {
  /**
   * REAL UTC ARITHMETIC. Building dates as `2026-08-${22 + i}` has already
   * bitten this program once: past the 31st it yields "2026-08-32", and a
   * fixture meant to be twelve contiguous stamped days silently became ten
   * days plus two phantom gaps.
   */
  const dayAfter = (start: string, n: number): string => {
    const d = new Date(`${start}T00:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  };

  it('TWO trailing empty days is silence, not pending', () => {
    const rows = [...WEEK.slice(0, 5).map((d) => day(d)), gap(WEEK[5]!), gap(WEEK[6]!)];
    expect(classifyStreakEligibility(rows)).toEqual({
      kind: 'coverage_incomplete', measuredDays: 5, rangeDays: 6,
    });
    expect(deriveJournalShareContext(rows, 7).streakDays).toBeUndefined();
  });

  it('a member unmeasured for a long stretch is never handed a live streak', () => {
    // The reported harm, end to end: 10 observed days then 20 silent ones.
    const observedDays = Array.from({ length: 10 }, (_, i) => dayAfter('2026-08-01', i));
    const silentDays = Array.from({ length: 20 }, (_, i) => dayAfter('2026-08-11', i));
    const rows = [...observedDays.map((d) => day(d)), ...silentDays.map((d) => gap(d))];
    expect(rows).toHaveLength(30);

    const kind = classifyStreakEligibility(rows);
    expect(kind.kind).toBe('coverage_incomplete');
    // The window is judged to the last day anything happened, not to today.
    expect(kind).toEqual({ kind: 'coverage_incomplete', measuredDays: 10, rangeDays: 29 });

    const ctx = deriveJournalShareContext(rows, 30);
    expect(ctx.type).not.toBe('streak');
    expect(ctx.streakDays, 'no live streak may be published').toBeUndefined();
  });

  it('ONE trailing empty day is still pending — the fix must not undo itself', () => {
    // ANTI-VACUITY: bounding the trim must not re-break the morning case.
    const rows = [...WEEK.slice(0, 6).map((d) => day(d)), gap(WEEK[6]!)];
    expect(classifyStreakEligibility(rows).kind).toBe('eligible');
    expect(deriveJournalShareContext(rows, 7).streakDays).toBe(6);
  });
});
