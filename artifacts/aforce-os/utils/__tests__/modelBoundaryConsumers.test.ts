/**
 * MODEL-BOUNDARY CONSUMER LAWS (founder PR 3 ruling, 2026-09-01).
 *
 * PR 1 shipped `utils/scoring/modelBoundary.ts` and PR 2 shipped the v1.0
 * engine — and for two PRs the boundary helper had ZERO production consumers.
 * The capability existed; nothing used it. Every surface that drew a history,
 * averaged a bucket or computed a week-over-week delta was still treating a v0
 * score and a v1.0 score as the same measurement.
 *
 * These laws pin the six invariants on the consumer layer:
 *   1. no visual segment contains more than one model version
 *   2. no bucket average contains points from multiple model versions
 *   3. no path is drawn across a model boundary
 *   4. mixed-day aggregates are explicitly marked non-comparable
 *   5. week-over-week deltas are suppressed across or within a boundary
 *   6. exported recaps preserve the same semantics
 *
 * SCOPE: structure only. No member-facing copy is asserted here, because none
 * ships in PR 3 — the first-v1 notice and any individualized explanation are
 * PR 4, together with the measured "band change OR |Δ| ≥ 12" trigger.
 */
import { describe, it, expect } from 'vitest';
import {
  segmentByModelVersion,
  spansModelBoundary,
  isMixedModelDay,
  isComparableModelVersion,
  provenanceOfVersions,
} from '../scoring/modelBoundary';
import { buildWeeklyV3Model } from '@/components/insights/weeklyV3Presentation';
import {
  bucketizeSegmented, buildRecapSegmentPaths, segmentForRender,
  recapStatsScope, statsDayVersion, isRecordedIncompatibleDay,
  dayProvenance, classifyRecapProvenance, renderKeyOf,
  hasHydroStateObservation, observedRows, observedCount,
  classifyStreakEligibility, reportedSpanDays,
} from '../scoring/boundarySeries';
import { computeRecapStats, computeRecapCardStats } from '../journalRecapStats';
import type { JournalRollup, JournalSnapshot } from '@/types';

const PAD = { top: 8, right: 4, bottom: 8, left: 4 };
/** Safe reader — `fully_comparable` and `no_history` carry no transition flag. */
const hasKnownTransition = (p: ReturnType<typeof classifyRecapProvenance>): boolean =>
  p.kind !== 'fully_comparable' && p.kind !== 'no_history' && p.knownTransition;
const V0 = 'hydrostate-v0';
const V1 = 'hydrostate-v1.0';

function snap(at: string, score: number, modelVersion: string | null): JournalSnapshot {
  return { at, score, level: 'BALANCED', ozConsumedToday: 60, aforceUnitsToday: 0,
    unitsConsumedToday: 5, sodiumDeliveredMg: 0, sodiumLostMg: 0, deficitPct: 0,
    clutchActive: false, socialActive: false, autopilotActive: false, reason: '',
    modelVersion } as unknown as JournalSnapshot;
}

/** A rollup with NO modelVersions field at all — the server emits this shape. */
function rollupNoVersions(date: string): JournalRollup {
  const r = rollup(date, 70, []) as unknown as Record<string, unknown>;
  delete r.modelVersions;
  return r as unknown as JournalRollup;
}

/**
 * Observation presence is EXPLICIT. Every fixture used to hardcode
 * `snapshotsCount: 4`, so a scoreless day — the server's real
 * intake-without-snapshot row — was unconstructible and its whole defect class
 * invisible. `snapshotsCount` is now a parameter, and `scorelessRollup` builds
 * the sentinel shape the server actually emits.
 */
function scorelessRollup(date: string): JournalRollup {
  // Exactly what journal.ts emits for a day with intakes and no snapshot.
  return rollup(date, 0, [], 0);
}

function rollup(
  date: string,
  avgScore: number,
  modelVersions: (string | null)[],
  snapshotsCount = 4,
): JournalRollup {
  return { date, avgScore, minScore: avgScore, maxScore: avgScore, snapshotsCount,
    endOzConsumed: 60, endAforceUnits: 0, endUnitsConsumed: 5, endSodiumDelivered: 0,
    endSodiumLost: 0, endDeficitPct: 0, pctTimePeak: 0, pctTimeBalanced: 100,
    pctTimeRecovering: 0, pctTimeDepleted: 0, intakeCount: 3, autopilotSessions: 0,
    socialSessions: 0, modelVersions } as unknown as JournalRollup;
}

/* ── 1 · 2 · 3 — the in-app trend chart ─────────────────────────────────── */

describe('LAW 1-3 — JournalChart segments the series at every model boundary', () => {
  // The chart's own segmentation contract, exercised through the same helper
  // the component uses. (The component is a react-native-svg tree; asserting
  // on its rendered <Path> set requires a native renderer, so the invariant is
  // pinned on the pure function that decides the strokes, plus a source law
  // below proving the component actually routes through it.)
  const mixed: JournalSnapshot[] = [
    snap('2026-08-28T09:00:00Z', 70, V0),
    snap('2026-08-29T09:00:00Z', 72, V0),
    snap('2026-08-30T09:00:00Z', 68, V0),
    snap('2026-08-31T09:00:00Z', 84, V1),
    snap('2026-09-01T09:00:00Z', 86, V1),
  ];

  it('no visual segment contains more than one model version', () => {
    const segments = segmentByModelVersion(mixed, (d) => d.modelVersion ?? null);
    expect(segments.length).toBe(2);
    for (const seg of segments) {
      const versions = new Set(seg.points.map((p) => p.modelVersion));
      expect(versions.size).toBe(1);
    }
  });

  it('no bucket average contains points from multiple model versions', () => {
    // The defect this replaces: `sum / slice.length` over a slice that spans
    // the boundary produced an anchor corresponding to no real measurement.
    const segments = segmentByModelVersion(mixed, (d) => d.modelVersion ?? null);
    for (const seg of segments) {
      const avg = seg.points.reduce((a, p) => a + p.score, 0) / seg.points.length;
      const within = seg.points.map((p) => p.score);
      expect(avg).toBeGreaterThanOrEqual(Math.min(...within));
      expect(avg).toBeLessThanOrEqual(Math.max(...within));
      expect(new Set(seg.points.map((p) => p.modelVersion)).size).toBe(1);
    }
  });

  it('no path is drawn across a model boundary — one stroke per segment', () => {
    const segments = segmentByModelVersion(mixed, (d) => d.modelVersion ?? null);
    expect(segments.length).toBeGreaterThan(1);          // ANTI-VACUITY
    // Every point belongs to exactly one stroke, and no stroke bridges two.
    const drawn = segments.flatMap((s) => s.points);
    expect(drawn.length).toBe(mixed.length);
    expect(drawn.map((p) => p.at)).toEqual(mixed.map((p) => p.at));  // order preserved
  });

  it('a single-version history is still ONE unbroken stroke', () => {
    // The guard against over-correcting: segmentation must not fragment a
    // history that has no boundary in it.
    const uniform = mixed.map((d) => ({ ...d, modelVersion: V1 }));
    expect(segmentByModelVersion(uniform, (d) => d.modelVersion ?? null).length).toBe(1);
  });

  it('the CHART bucketizer itself never mixes versions in one bucket', () => {
    // Behavioural, on the chart's own exported function. A source scan for the
    // identifier survived a mutation that kept the name and reverted the call
    // site, so the law is executed instead.
    const groups = bucketizeSegmented(mixed, 5);
    expect(groups.length).toBe(2);                       // one group per version
    expect(groups.flat().length).toBeGreaterThan(0);     // ANTI-VACUITY
    // Reconstruct which version each bucket's timestamp belongs to and assert
    // no bucket average could have blended the two.
    const versionAt = new Map(mixed.map((m) => [m.at, m.modelVersion]));
    for (const g of groups) {
      const vs = new Set(g.map((b) => versionAt.get(b.at)));
      expect(vs.size).toBe(1);
    }
    // and the two groups are genuinely different versions
    const groupVersions = groups.map((g) => versionAt.get(g[0]!.at));
    expect(new Set(groupVersions).size).toBe(2);
  });

  it('the chart bucketizer keeps ONE group for a single-version history', () => {
    const uniform = mixed.map((d) => ({ ...d, modelVersion: V1 }));
    expect(bucketizeSegmented(uniform, 5).length).toBe(1);
  });
});

/* ── 4 — mixed-day aggregates ───────────────────────────────────────────── */

describe('LAW 4 — a mixed-model day is marked non-comparable', () => {
  it('isMixedModelDay is true only for two or more KNOWN versions', () => {
    expect(isMixedModelDay([V0, V1])).toBe(true);
    expect(isMixedModelDay([V0])).toBe(false);
    expect(isMixedModelDay([V1, V1])).toBe(false);
    expect(isMixedModelDay([])).toBe(false);
    expect(isMixedModelDay(undefined)).toBe(false);
    // "not recorded" is not evidence of mixing — it is absence of evidence.
    expect(isMixedModelDay([null])).toBe(false);
    // TWO unstamped readings on one day are ONE unstamped day, not a mixed one.
    // Without deduping, this answered `true` because an unrecorded score is
    // comparable to nothing — including to another unrecorded score. Correct
    // for comparability, wrong for "is this day mixed".
    expect(isMixedModelDay([null, null])).toBe(false);
    expect(isMixedModelDay([V1, V1, V1])).toBe(false);
  });

  it('containsMixedDay => crossesBoundary holds for ARBITRARY input', () => {
    // The weekly suppression drops the `containsMixedDay` term as redundant.
    // That is only sound if the implication is a theorem rather than a habit of
    // the current producer. Deduping makes it one; this law is the proof, run
    // over the shapes that previously broke it.
    const shapes: (string | null)[][] = [
      [null, null], [V1, V1], [V0, V0, V0],
      [null, V1], [V0, V1], [V1, 'hydrostate-v1.1'],
      [], [null], [V1],
    ];
    for (const vs of shapes) {
      if (isMixedModelDay(vs)) {
        expect(spansModelBoundary(vs), `mixed must imply boundary: ${JSON.stringify(vs)}`)
          .toBe(true);
      }
    }
  });

  it('an unrecorded version alongside a known one IS non-comparable', () => {
    expect(isMixedModelDay([null, V1])).toBe(true);
  });

  it('the DAY CARD marks the mixed aggregate instead of colouring it as a band', () => {
    const src = read('components/journal/JournalDayCard.tsx');
    expect(src).toMatch(/isMixedModelDay/);
    // The band colour is itself a comparability claim; a mixed day must not
    // receive one.
    expect(src).toMatch(/mixedModelDay \? String\(styles\.meta\.color\) : avgColor/);
    expect(src).toMatch(/journal-day-avg-mixed-model/);
  });
});

/* ── 5 — week over week ─────────────────────────────────────────────────── */

describe('LAW 5 — week-over-week deltas are suppressed across a boundary', () => {
  // The trend MUST be genuinely available, or these laws are vacuous: with an
  // empty snapshot series `previousAge` is null whether or not the suppression
  // exists, and removing the suppression entirely still passes. (It did — this
  // fixture replaces the one that let it.) Two days spanning the trend window
  // with a real age movement make `previousAge` non-null by default.
  const LATEST_DAY = Math.floor(Date.parse('2026-09-01T12:00:00Z') / 86_400_000);
  const base = {
    nowISO: '2026-09-01T12:00:00Z',
    analyticsEvents: [] as never[],
    paSnapshots: [
      { dayIndex: LATEST_DAY - 30, performanceAge: 47 },
      { dayIndex: LATEST_DAY, performanceAge: 44 },
    ],
    paResult: { performanceAge: 44 },
    complianceStreak: 0,
  };

  it('the fixture itself produces a REAL comparison when no boundary is present', () => {
    // Anti-vacuity anchor for every suppression law below.
    const m = buildWeeklyV3Model({ ...base, rollups: [
      rollup('2026-08-25', 70, [V1]),
      rollup('2026-08-26', 72, [V1]),
    ] } as never);
    expect(m.performanceAge.trend.available).toBe(true);
    expect(m.performanceAge.previousAge).not.toBeNull();
  });

  it('a week that CROSSES the boundary suppresses the comparison', () => {
    const m = buildWeeklyV3Model({ ...base, rollups: [
      rollup('2026-08-25', 70, [V0]),
      rollup('2026-08-26', 72, [V0]),
      rollup('2026-08-27', 85, [V1]),
    ] } as never);
    expect(m.modelBoundary.crossesBoundary).toBe(true);
    expect(m.modelBoundary.weekOverWeekSuppressed).toBe(true);
    expect(m.performanceAge.previousAge).toBeNull();
  });

  it('a week CONTAINING a mixed day suppresses the comparison', () => {
    const m = buildWeeklyV3Model({ ...base, rollups: [
      rollup('2026-08-25', 70, [V1]),
      rollup('2026-08-26', 72, [V0, V1]),   // the day itself straddles it
    ] } as never);
    expect(m.modelBoundary.containsMixedDay).toBe(true);
    expect(m.modelBoundary.weekOverWeekSuppressed).toBe(true);
    expect(m.performanceAge.previousAge).toBeNull();
  });

  it('a single-version week is NOT suppressed (anti-vacuity)', () => {
    const m = buildWeeklyV3Model({ ...base, rollups: [
      rollup('2026-08-25', 70, [V1]),
      rollup('2026-08-26', 72, [V1]),
    ] } as never);
    expect(m.modelBoundary.crossesBoundary).toBe(false);
    expect(m.modelBoundary.containsMixedDay).toBe(false);
    expect(m.modelBoundary.weekOverWeekSuppressed).toBe(false);
  });

  it('the timeline itself still renders every day', () => {
    // Suppressing a COMPARISON must not delete the member's data.
    const m = buildWeeklyV3Model({ ...base, rollups: [
      rollup('2026-08-25', 70, [V0]),
      rollup('2026-08-26', 85, [V1]),
    ] } as never);
    expect(m.timeline.length).toBe(2);
    expect(m.daysTracked).toBe(2);
  });
});

/* ── 6 — the exported recap ─────────────────────────────────────────────── */

describe('LAW 6 — an exported recap carries the same boundary semantics', () => {
  it('emits ONE path per segment — never a single rejoined stroke', () => {
    const rows = [
      rollup('2026-08-25', 70, [V0]),
      rollup('2026-08-26', 72, [V0]),
      rollup('2026-08-27', 85, [V1]),
      rollup('2026-08-28', 86, [V1]),
    ];
    const paths = buildRecapSegmentPaths(rows, 300, 100, PAD);
    expect(paths.length).toBe(2);                        // ANTI-VACUITY
    // Each stroke starts exactly once: a rejoined path would contain a single
    // M followed by every point, which is the defect being prevented.
    for (const d of paths) {
      expect((d.match(/M/g) ?? []).length).toBe(1);
      expect((d.match(/L/g) ?? []).length).toBe(1);      // 2 points per segment
    }
    // A boundary-free range stays one unbroken stroke.
    const uniform = rows.map((r) => ({ ...r, modelVersions: [V1] }));
    const whole = buildRecapSegmentPaths(uniform, 300, 100, PAD);
    expect(whole.length).toBe(1);
    // X-AXIS INVARIANT, pinned exactly: segmenting changes which strokes exist,
    // never where a day sits on the timeline. Collapsing the cursor would
    // overlay the segments and this comparison is what notices.
    const split = buildRecapSegmentPaths(rows, 300, 100, PAD);
    const xsOf = (ds: string[]) =>
      [...ds.join(' ').matchAll(/[ML]([\d.]+),/g)].map((m) => m[1]);
    expect(xsOf(split)).toEqual(xsOf(whole));
  });

  it('the recap uses the SHIPPED scope decision, not an inline predicate', () => {
    const src = read('components/ShareJournalRecap.tsx');
    expect(src).toMatch(/recapStatsScope\(rollups\)/);
    // The inline predicate that narrowed an all-unstamped range must be gone.
    expect(src).not.toMatch(/crossesModelBoundary/);
    expect(src).not.toMatch(/segments\.at\(-1\)/);
  });

  it('a mixed day isolates rather than joining a neighbouring segment', () => {
    const rows = [
      rollup('2026-08-25', 70, [V0]),
      rollup('2026-08-26', 74, [V0, V1]),   // mixed → comparable to nothing
      rollup('2026-08-27', 85, [V1]),
    ];
    // Uses the SHIPPED dayVersion + render segmentation, not a test-local copy:
    // two earlier laws re-implemented the predicate inline and therefore
    // asserted nothing about production behaviour.
    const segs = segmentForRender(rows, renderKeyOf);
    expect(segs.length).toBe(3);
    for (const seg of segs) expect(seg.points.length).toBe(1);
  });

  it('a single-day segment still gets its own stroke — no day is dropped', () => {
    // The mutation this catches: skipping segments with only one point, which
    // silently erases an isolated mixed day from the exported timeline.
    const rows = [
      rollup('2026-08-25', 70, [V0]),
      rollup('2026-08-26', 74, [V0, V1]),   // mixed → its own one-day segment
      rollup('2026-08-27', 85, [V1]),
    ];
    const paths = buildRecapSegmentPaths(rows, 300, 100, PAD);
    expect(paths.length).toBe(3);
    // ...and every one of them must actually STROKE. An svg path of `M x,y`
    // alone draws nothing, so counting paths is not enough: that is the same
    // root cause as the shattered history, one layer down. A lone day rendered
    // as a bare moveto is a day that exists in the data and not in the export.
    for (const d of paths) {
      expect(d, `path must stroke, not just move: ${d}`).toMatch(/L/);
      // NON-ZERO GEOMETRY. `M x,y L x,y` contains an L and draws nothing, so
      // presence of a draw command is not the contract — visible length is.
      const xs = [...d.matchAll(/[ML]([\d.]+),/g)].map((m) => Number(m[1]));
      expect(xs.length, `two endpoints expected: ${d}`).toBeGreaterThanOrEqual(2);
      expect(Math.abs(xs[xs.length - 1]! - xs[0]!), `zero-length stroke: ${d}`)
        .toBeGreaterThan(0);
    }
  });

  it('every exported day survives segmentation — no data is dropped', () => {
    const rows = [
      rollup('2026-08-25', 70, [V0]),
      rollup('2026-08-26', 72, [V0]),
      rollup('2026-08-27', 85, [V1]),
    ];
    const segs = segmentForRender(rows, renderKeyOf);
    expect(segs.flatMap((seg) => seg.points).map((r) => r.date))
      .toEqual(rows.map((r) => r.date));
  });
});

/* ── the excluded set, pinned so PR 3 cannot quietly grow ───────────────── */

describe('PR 3 scope fence — the consumer layer only', () => {
  it('no member-facing boundary copy ships in PR 3', () => {
    for (const f of ['components/journal/JournalChart.tsx',
                     'components/journal/JournalDayCard.tsx',
                     'components/ShareJournalRecap.tsx',
                     'components/insights/weeklyV3Presentation.ts']) {
      // Comments must be stripped first. An earlier version of this law
      // scanned raw source and failed on the word "recalibration" inside an
      // explanatory code comment — a law that fires on its own documentation
      // teaches people to weaken it. Only shipped STRINGS are member-facing.
      const src = read(f)
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
      // AUTHORIZED (founder D3 / D3A, this branch): the boundary QUALIFIERS —
      // "N COMPARABLE DAY(S)", "MODEL HISTORY UNAVAILABLE", "MODEL VERSIONS NOT
      // COMPARABLE", "NEW MODEL PERIOD" — are member-facing copy and ship here.
      // Still forbidden: the first-v1 notice, any individualized score-shift
      // explanation, and the |delta| >= 12 trigger, all of which remain PR 4.
      expect(src).not.toMatch(/we changed how|how we measure|recalibrat/i);
      expect(src).not.toMatch(/DELTA_EXPLAIN|SHIFT_THRESHOLD|>= ?12\b/);
      expect(src).not.toMatch(/your (score|hydration) (went|got|is now)/i);
    }
  });

  it('spansModelBoundary still treats an unversioned row as comparable to nothing', () => {
    expect(spansModelBoundary([null, null])).toBe(true);
    expect(spansModelBoundary([V1])).toBe(false);
  });
});

// ── helper, defined last so the laws above read first ─────────────────────
function read(rel: string): string {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { readFileSync } = require('fs');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { join } = require('path');
  return readFileSync(join(__dirname, '..', '..', rel), 'utf8');
}

/* ═══════════════ REMEDIATION — the four post-merge defects ═══════════════
 *
 * #909 passed every automated gate it was given and then failed a delayed
 * substantive review. Four defects shipped. The laws below are the ones that
 * should have existed, written so that each FAILS on the old implementation
 * and PASSES on the repaired one.
 */

describe('FIX 1 — the weekly trend itself is unavailable across a boundary', () => {
  const LATEST_DAY = Math.floor(Date.parse('2026-09-01T12:00:00Z') / 86_400_000);
  const withTrend = {
    nowISO: '2026-09-01T12:00:00Z',
    analyticsEvents: [] as never[],
    paSnapshots: [
      { dayIndex: LATEST_DAY - 30, performanceAge: 47 },
      { dayIndex: LATEST_DAY, performanceAge: 44 },
    ],
    paResult: { performanceAge: 44 },
    complianceStreak: 0,
  };

  it('ANTI-VACUITY — the same fixture yields an AVAILABLE trend with no boundary', () => {
    const m = buildWeeklyV3Model({ ...withTrend, rollups: [
      rollup('2026-08-25', 70, [V1]),
      rollup('2026-08-26', 72, [V1]),
    ] } as never);
    expect(m.performanceAge.trend.available).toBe(true);
    expect(m.performanceAge.trend.deltaYears).toBe(-3);
    // This is the number the pill renders: consumers do
    // `trend.available ? trend.deltaYears : null`.
    const paDelta = m.performanceAge.trend.available ? m.performanceAge.trend.deltaYears : null;
    expect(paDelta).toBe(-3);
  });

  it('a boundary-crossing week makes the MEMBER-FACING trend unavailable', () => {
    const m = buildWeeklyV3Model({ ...withTrend, rollups: [
      rollup('2026-08-25', 70, [V0]),
      rollup('2026-08-26', 85, [V1]),
    ] } as never);
    // The exact expression both live consumers evaluate.
    const paDelta = m.performanceAge.trend.available ? m.performanceAge.trend.deltaYears : null;
    expect(paDelta).toBeNull();               // no "▼ 3 years" pill
    expect(m.performanceAge.trend.available).toBe(false);
    expect(m.performanceAge.trend.deltaYears).toBeNull();
    expect(m.performanceAge.previousAge).toBeNull();
  });

  it('both live consumers read the delta off `trend`, so gating it there is what matters', () => {
    for (const f of ['components/insights/WeeklyReportV3.tsx',
                     'components/editorial/weekly/EditorialWeeklyScreen.tsx']) {
      expect(read(f)).toMatch(/trend\.available \? \w+\.trend\.deltaYears : null/);
    }
  });
});

describe('FIX 2 — unstamped history is ONE continuous run', () => {
  const unstamped = (n: number) =>
    Array.from({ length: n }, (_, i) => snap(`2026-08-${String(i + 1).padStart(2, '0')}T09:00:00Z`, 70 + (i % 7), null));
  const stamped = (n: number, v: string, from = 1) =>
    Array.from({ length: n }, (_, i) => snap(`2026-09-${String(from + i).padStart(2, '0')}T09:00:00Z`, 80 + (i % 5), v));

  it('30 unstamped observations form ONE run, not 30', () => {
    const data = unstamped(30);
    expect(segmentForRender(data, (d) => d.modelVersion ?? null).length).toBe(1);
    // and the chart returns the DESIGNED anchor count, not one per point
    expect(bucketizeSegmented(data, 5).length).toBe(1);
    expect(bucketizeSegmented(data, 5).flat().length).toBe(5);
  });

  it('20 unstamped then 10 v1 observations form EXACTLY two visual runs', () => {
    const data = [...unstamped(20), ...stamped(10, V1)];
    const segs = segmentForRender(data, (d) => d.modelVersion ?? null);
    expect(segs.length).toBe(2);
    expect(segs[0]!.points.length).toBe(20);
    expect(segs[1]!.points.length).toBe(10);
    expect(segs[0]!.modelVersion).toBeNull();
    expect(segs[1]!.modelVersion).toBe(V1);
    // both runs must be strokeable (>= 2 points), not moveto-only stubs
    for (const g of bucketizeSegmented(data, 5)) expect(g.length).toBeGreaterThanOrEqual(2);
  });

  it('a known v0 → known v1 transition forms two runs', () => {
    const data = [...stamped(5, V0), ...stamped(5, V1, 10)];
    const segs = segmentForRender(data, (d) => d.modelVersion ?? null);
    expect(segs.length).toBe(2);
    expect(segs.map((x) => x.modelVersion)).toEqual([V0, V1]);
  });

  it('a single known version history stays ONE run', () => {
    expect(segmentForRender(stamped(12, V1), (d) => d.modelVersion ?? null).length).toBe(1);
  });

  it('no observation is lost during segmentation', () => {
    const data = [...unstamped(20), ...stamped(10, V1)];
    const segs = segmentForRender(data, (d) => d.modelVersion ?? null);
    expect(segs.flatMap((x) => x.points).map((p) => p.at)).toEqual(data.map((p) => p.at));
  });

  it('grouping nulls for RENDER does not make them comparable for TRUTH', () => {
    // The two concepts stay separate: one stroke, still not comparable.
    expect(segmentForRender(unstamped(5), (d) => d.modelVersion ?? null).length).toBe(1);
    expect(spansModelBoundary([null, null])).toBe(true);
    expect(isMixedModelDay([null, V1])).toBe(true);
  });
});

describe('FIX 2b — LEGACY REGRESSION: pre-version history renders as it did before PR 3', () => {
  it('a boundary-free unstamped history keeps its pre-PR-3 continuity', () => {
    // The exact population every existing member has: `hydrostate_model_version`
    // is nullable with no backfill, so ALL history predating the column is null.
    const legacy = Array.from({ length: 30 }, (_, i) =>
      snap(`2026-08-${String(i + 1).padStart(2, '0')}T09:00:00Z`, 60 + (i % 25), null));
    const groups = bucketizeSegmented(legacy, 5);
    expect(groups.length).toBe(1);              // ONE stroke, as before PR 3
    expect(groups.flat().length).toBe(5);       // 5 anchors, as before PR 3
    // and a single stroke of 5 anchors is drawable, not a moveto-only stub
    expect(groups[0]!.length).toBeGreaterThanOrEqual(2);
  });
});

describe('FIX 3 — the recap headline is never narrowed by absent stamps', () => {
  const range = (versions: (string | null)[][]) =>
    versions.map((vs, i) => rollup(`2026-08-${String(i + 1).padStart(2, '0')}`, 60 + i, vs));

  it('all-unstamped 30-day history: ONE run, headline over ALL 30 days', () => {
    const rows = range(Array.from({ length: 30 }, () => []));
    expect(buildRecapSegmentPaths(rows, 300, 100, PAD).length).toBe(1);   // visual
    expect(recapStatsScope(rows).length).toBe(30);                        // population
    // THE HEADLINE CLAIM: a card labelled 30-DAY must not report one day.
    expect(computeRecapStats(recapStatsScope(rows)).daysTracked)
      .toBe(computeRecapStats(rows).daysTracked);
  });

  it('unstamped history followed by v1: TWO runs, headline over the V1 RUN ONLY', () => {
    // THE ACTUAL ROLLOUT SHAPE — every existing member on the day v1.0 lands.
    // An earlier revision returned all 30 here on the reasoning that "null is
    // not a real boundary". That was wrong in the direction that matters: an
    // unstamped day is comparable to NOTHING, including to a v1.0 day, so a
    // single blended headline across that seam is exactly the defect this
    // function exists to prevent.
    const rows = range([...Array.from({ length: 20 }, () => [] as string[]),
                        ...Array.from({ length: 10 }, () => [V1])]);
    expect(buildRecapSegmentPaths(rows, 300, 100, PAD).length).toBe(2);
    const scope = recapStatsScope(rows);
    expect(scope.length).toBe(10);
    expect(scope.every((r) => r.modelVersions?.[0] === V1)).toBe(true);
  });

  it('single known version history: ONE run, headline over everything', () => {
    const rows = range(Array.from({ length: 30 }, () => [V1]));
    expect(buildRecapSegmentPaths(rows, 300, 100, PAD).length).toBe(1);
    expect(recapStatsScope(rows).length).toBe(30);
  });

  it('a REAL boundary ending on a mixed/unstamped day does NOT narrow to that day', () => {
    // The residual defect the first remediation left behind. `dayVersion` maps a
    // mixed day, an absent list and an empty list all to null, and a day with a
    // logged intake but no captured snapshot legitimately has `modelVersions: []`
    // (api-server builds that rollup from intakes alone). Taking the LAST segment
    // outright made a 30-day card report a single day.
    const base = [...Array.from({ length: 20 }, () => [V0]),
                  ...Array.from({ length: 9 }, () => [V1])];
    for (const [label, trailing] of [
      ['mixed', [V0, V1]], ['empty', []],
    ] as Array<[string, string[]]>) {
      const rows = range([...base, trailing]);
      const scope = recapStatsScope(rows);
      expect(scope.length, `${label}: must not collapse to the trailing day`).toBe(9);
      expect(scope.every((r) => r.modelVersions?.[0] === V1), label).toBe(true);
      // and the headline must not read as one day under a 30-day label
      expect(computeRecapStats(scope).daysTracked, label).toBeGreaterThan(1);
    }
    // an ABSENT modelVersions field behaves identically
    const absent = range([...base]).concat([rollupNoVersions('2026-08-30')]);
    expect(recapStatsScope(absent).length).toBe(9);
  });

  it('a range with NO known-version run anywhere is never narrowed', () => {
    const rows = range(Array.from({ length: 10 }, () => []));
    expect(recapStatsScope(rows).length).toBe(10);
  });

  it('known v0 then known v1: TWO runs, headline narrowed to the v1 run', () => {
    const rows = range([...Array.from({ length: 20 }, () => [V0]),
                        ...Array.from({ length: 10 }, () => [V1])]);
    expect(buildRecapSegmentPaths(rows, 300, 100, PAD).length).toBe(2);
    expect(recapStatsScope(rows).length).toBe(10);                   // v1 run only
    expect(recapStatsScope(rows).every((r) => r.modelVersions?.[0] === V1)).toBe(true);
  });
});

describe('FIX 4 — JournalChart is proven to ROUTE THROUGH the shared logic', () => {
  it('fails if the component is reverted to its pre-PR-3 implementation', () => {
    const src = read('components/journal/JournalChart.tsx');
    // imports and CALLS the shared segmented bucketizer
    expect(src).toMatch(/import \{[^}]*\bbucketizeSegmented\b[^}]*\} from '@\/utils\/scoring\/boundarySeries'/);
    expect(src).toMatch(/bucketizeSegmented\(renderedData, TARGET_ANCHORS\)/);
    // the private pre-PR-3 bucketizer has NOT returned
    expect(src).not.toMatch(/^function bucketize\(/m);
    // renders a stroke PER SEGMENT, not one scalar path across everything
    expect(src).toMatch(/pathDs\.map\(/);
    expect(src).not.toMatch(/\{pathD && \(/);
    expect(src).not.toMatch(/pathD: smoothPath\(pts\)/);
  });
});

/* ═══════════ ROLLOUT-DAY SHAPES — first-class cases, not edge cases ═══════════
 *
 * B1 shipped because every FIX-3 fixture used a comfortable 9 or 10 comparable
 * days. The first day of a model rollout has exactly ONE, and that shape made a
 * 30-day card report "DAYS 1". The shapes a rollout actually produces are
 * enumerated here so none of them can be the case nobody tried.
 */
describe('ROLLOUT SHAPES — score population vs full reporting range', () => {
  const V11 = 'hydrostate-v1.1';
  const range = (versions: (string | null)[][]) =>
    versions.map((vs, i) => rollup(`2026-08-${String(i + 1).padStart(2, '0')}`, 60 + i, vs));
  const spec = (parts: Array<[number, string[]]>) =>
    range(parts.flatMap(([n, vs]) => Array.from({ length: n }, () => vs)));

  const SHAPES: Array<[string, Array<[number, string[]]>, number]> = [
    ['rollout day 1  — 29 unstamped + 1 v1', [[29, []], [1, [V1]]], 1],
    ['rollout day 1  — 29 v0 + 1 v1',        [[29, [V0]], [1, [V1]]], 1],
    ['rollout day 2  — 28 unstamped + 2 v1', [[28, []], [2, [V1]]], 2],
    ['settled        — 20 unstamped + 10 v1',[[20, []], [10, [V1]]], 10],
    ['minor bump     — 15 v1.0 + 15 v1.1',   [[15, [V1]], [15, [V11]]], 30],
    ['mixed stamped/unstamped interleaved',  [[10, [V0]], [5, []], [15, [V1]]], 15],
  ];

  for (const [label, parts, expectedScore] of SHAPES) {
    it(`${label}: score population ${expectedScore}, totals over all 30`, () => {
      const rows = spec(parts);
      expect(rows.length).toBe(30);
      const scope = recapStatsScope(rows);
      const streakEligible = classifyStreakEligibility(rows).kind === 'eligible';
      const card = computeRecapCardStats(rows, scope, { streakEligible });

      // 1 · score metrics never blend incomparable model versions
      expect(scope.length, 'score population').toBe(expectedScore);
      const anchor = statsDayVersion(scope[scope.length - 1]!);
      for (const r of scope) {
        expect(isComparableModelVersion(statsDayVersion(r), anchor), 'all comparable').toBe(true);
      }

      // 2 · the reporting range is reported in full
      expect(card.daysTracked, 'daysTracked').toBe(30);

      // 3 · a one-day score run must not make the card look like a one-day report
      expect(card.daysTracked).toBeGreaterThan(1);
      // ...and the smaller scoring population is DISCLOSED, never silent.
      expect(card.comparableDays).toBe(expectedScore);

      // 4 · activity totals are suppressed until an authoritative source exists
      expect(card.totalOunces, 'ounces must not be fabricated').toBeNull();
      expect(card.totalSticks, 'sticks must not be fabricated').toBeNull();

      // 5 · no observation disappears
      expect(buildRecapSegmentPaths(rows, 300, 100, PAD).length).toBeGreaterThanOrEqual(1);
      const segs = segmentForRender(rows, renderKeyOf);
      expect(segs.flatMap((s) => s.points).length).toBe(30);
    });
  }

  it('v1.0 and v1.1: ONE score population, TWO visual runs', () => {
    const rows = spec([[15, [V1]], [15, [V11]]]);
    // Statistical comparability — the registry says same-major is comparable.
    expect(recapStatsScope(rows).length).toBe(30);
    // Visual continuity — a separate contract, exact identity by founder ruling.
    expect(segmentForRender(rows, renderKeyOf).length).toBe(2);
    expect(buildRecapSegmentPaths(rows, 300, 100, PAD).length).toBe(2);
  });

  it('a REAL boundary plus a minor bump: the comparable pair stays together', () => {
    // THE FIXTURE THAT ACTUALLY REACHES THE COMPARABILITY FILTER.
    // `[v1.0, v1.1]` alone does NOT span a boundary — they are comparable — so
    // `recapStatsScope` returns early and the filter never runs. A law built on
    // that shape passes whatever the filter does, which is how a mutation
    // swapping comparability for exact identity survived. Adding v0 makes the
    // range genuinely non-comparable, so the filter runs and must keep BOTH
    // same-major versions.
    const rows = spec([[10, [V0]], [10, [V1]], [10, [V11]]]);
    expect(spansModelBoundary(rows.map(statsDayVersion)), 'filter must be reached').toBe(true);
    const scope = recapStatsScope(rows);
    expect(scope.length, 'v1.0 + v1.1 are one score population').toBe(20);
    expect(scope.some((r) => r.modelVersions?.[0] === V1)).toBe(true);
    expect(scope.some((r) => r.modelVersions?.[0] === V11)).toBe(true);
    expect(scope.every((r) => r.modelVersions?.[0] !== V0)).toBe(true);
    // ...while the RENDER still seams all three (exact identity, by ruling).
    expect(segmentForRender(rows, renderKeyOf).length).toBe(3);
  });

  it('recapStatsScope routes through statsDayVersion, NOT the render predicate', () => {
    // The distinguishing shape: days carrying [v1.0, v1.1]. `statsDayVersion`
    // resolves them to v1.0 (same major, comparable) and keeps them in the
    // score population; `dayVersion` collapses them to null and drops them.
    // Without this fixture the swap survived the entire suite.
    const rows = range([...Array.from({ length: 15 }, () => [V1]),
                        ...Array.from({ length: 15 }, () => [V1, V11])]);
    expect(statsDayVersion(rows[29]!)).toBe(V1);            // comparable -> resolved
    // Render identity is a TOTAL key, never a nullable version. What matters is
    // that a same-major straddle day cannot SHARE a run with a clean v1.0 day —
    // not that it is "isolated"; two identical straddle days may group.
    expect(renderKeyOf(rows[29]!, 29)).not.toBe(renderKeyOf(rows[0]!, 0));
    // The population must follow the STATISTICAL predicate: all 30 days.
    expect(recapStatsScope(rows).length).toBe(30);
    // ...while rendering still seams them, by founder ruling.
    expect(segmentForRender(rows, renderKeyOf).length).toBe(2);
  });

  it('a recorded-incompatible day never enters the score population', () => {
    const rows = range([...Array.from({ length: 10 }, () => [V1]),
                        ...Array.from({ length: 5 }, () => [V0, V1])]);
    const scope = recapStatsScope(rows);
    expect(scope.length).toBe(10);
    for (const r of scope) expect(isRecordedIncompatibleDay(r)).toBe(false);
    // An ENTIRELY incompatible range leaves no comparable subset at all.
    expect(recapStatsScope(range(Array.from({ length: 30 }, () => [V0, V1]))).length).toBe(0);
    // ...but an all-unstamped range is NOT incompatible and stays whole.
    expect(recapStatsScope(range(Array.from({ length: 30 }, () => []))).length).toBe(30);
  });

  it('duplicate version entries on one day are not a boundary', () => {
    // `[v1, v1]` is length 2 but names ONE version. `dayVersion` returns null
    // for it (length !== 1), so it is treated as unstamped rather than mixed —
    // conservative, and it must not be mistaken for a real boundary.
    expect(isMixedModelDay([V1, V1])).toBe(false);
    const rows = range([...Array.from({ length: 29 }, () => [V1]), [V1, V1]]);
    // A duplicate-version day names ONE version, so it is a full member of the
    // score population — not a hole. (Before the dedup fix it collapsed to null
    // and was excluded, which is the D4 transition-day defect in miniature.)
    expect(statsDayVersion(rows[29]!)).toBe(V1);
    expect(recapStatsScope(rows).length).toBe(30);
    const card = computeRecapCardStats(rows, recapStatsScope(rows), { streakEligible: true });
    expect(card.daysTracked).toBe(30);
    expect(card.comparableDays).toBe(30);
  });

  it('a one-day score run still produces a DRAWN stroke, not a bare moveto', () => {
    const rows = spec([[29, []], [1, [V1]]]);
    const paths = buildRecapSegmentPaths(rows, 300, 100, PAD);
    expect(paths.length).toBe(2);
    for (const d of paths) expect(d, `must draw: ${d}`).toMatch(/L/);
  });
});

/* ═══════ CANONICAL DAY PROVENANCE — the structure, and the four questions ═══════
 *
 * Seven review rounds found the same conflation in seven costumes, because a
 * day answered four different questions through one nullable collapse. These
 * laws pin the structure that replaced it: one classification per day, four
 * fields, and no consumer answering one question with another's predicate.
 */
describe('DayModelProvenance — canonical classification', () => {
  const P = (vs: (string | null)[] | undefined) => provenanceOfVersions(vs);
  const V11 = 'hydrostate-v1.1';
  const range = (versions: (string | null)[][]) =>
    versions.map((vs, i) => rollup(`2026-08-${String(i + 1).padStart(2, '0')}`, 60 + i, vs));

  const TABLE: Array<[string, (string | null)[] | undefined,
    { kind: string; scoreable: string | null; recorded: string[] }]> = [
    ['absent field',            undefined,      { kind: 'unrecorded',   scoreable: null, recorded: [] }],
    ['empty list',              [],             { kind: 'unrecorded',   scoreable: null, recorded: [] }],
    ['[null]',                  [null],         { kind: 'unrecorded',   scoreable: null, recorded: [] }],
    ['[null, null]',            [null, null],   { kind: 'unrecorded',   scoreable: null, recorded: [] }],
    ['one known',               [V1],           { kind: 'known',        scoreable: V1,   recorded: [V1] }],
    ['duplicate known',         [V1, V1],       { kind: 'known',        scoreable: V1,   recorded: [V1] }],
    ['same-major pair',         [V1, V11],      { kind: 'known',        scoreable: V1,   recorded: [V1, V11] }],
    ['incompatible pair',       [V0, V1],       { kind: 'incompatible', scoreable: null, recorded: [V0, V1] }],
    ['known + unrecorded',      [null, V1],     { kind: 'incompatible', scoreable: null, recorded: [V1] }],
    ['three, one disagreeing',  [V1, V11, V0],  { kind: 'incompatible', scoreable: null, recorded: [V1, V11, V0] }],
  ];

  for (const [label, input, want] of TABLE) {
    it(`${label} → ${want.kind}`, () => {
      const p = P(input);
      expect(p.kind, 'kind').toBe(want.kind);
      expect(p.scoreableVersion, 'scoreableVersion').toBe(want.scoreable);
      expect(p.recordedVersions, 'recordedVersions').toEqual(want.recorded);
    });
  }

  it('unrecorded is NEVER silently treated as incompatible', () => {
    for (const vs of [undefined, [], [null], [null, null]] as Array<(string | null)[] | undefined>) {
      expect(P(vs).kind, JSON.stringify(vs)).toBe('unrecorded');
      expect(isMixedModelDay(vs), 'not a mixed day').toBe(false);
    }
  });

  it('the four questions use four different fields', () => {
    // Q1 population, Q2 known?, Q3 transition evidence, Q4 render identity.
    const deployDay = P([V0, V1]);
    expect(deployDay.scoreableVersion).toBeNull();          // Q1: cannot score
    expect(deployDay.kind).not.toBe('unrecorded');          // Q2: IS recorded
    expect(deployDay.recordedVersions).toEqual([V0, V1]);   // Q3: witnesses it
    // Q4: render identity is exact — a two-version day is its own run.
    const rollupOf = (vs: (string | null)[]) => rollup('2026-08-01', 70, vs);
    expect(renderKeyOf(rollupOf([V0, V1]), 0)).toMatch(/^isolated:/);
    // ...and a same-major pair is ONE score population but still its own run.
    expect(P([V1, V11]).scoreableVersion).toBe(V1);
    expect(renderKeyOf(rollupOf([V1, V11]), 0))
      .not.toBe(renderKeyOf(rollupOf([V1]), 1));
  });

  it('an EXCLUDED incompatible day cannot make unknown survivors "comparable"', () => {
    const unknownOnly = range(Array.from({ length: 20 }, () => []));
    const plusDeploy = range([...Array.from({ length: 20 }, () => []), [V0, V1]]);
    // The added day is excluded from the population...
    expect(recapStatsScope(plusDeploy).length).toBe(20);
    // ...and the twenty that remain are still unknown, so no claim is made.
    expect(classifyRecapProvenance(unknownOnly).kind).toBe('provenance_unknown');
    expect(classifyRecapProvenance(plusDeploy).kind).toBe('provenance_unknown');
  });

  it('unknown provenance never becomes NEW MODEL PERIOD', () => {
    const p = classifyRecapProvenance(range(Array.from({ length: 30 }, () => [])));
    expect(p.kind).toBe('provenance_unknown');
    expect(hasKnownTransition(p)).toBe(false);
  });

  it('knownTransition requires actual mutually INCOMPARABLE known versions', () => {
    const t = (spec: string[][]) => {
      return hasKnownTransition(classifyRecapProvenance(range(spec)));
    };
    expect(t(Array.from({ length: 5 }, () => [V1]))).toBe(false);            // one version
    expect(t([[V1], [V11]])).toBe(false);                                    // same major
    expect(t(Array.from({ length: 5 }, () => []))).toBe(false);              // unrecorded
    expect(t([[V0], [V1]])).toBe(true);                                      // real transition
    expect(t([...Array.from({ length: 5 }, () => []), [V0, V1]])).toBe(true); // inside one day
  });

  it('incompatible days NEVER enter a score population', () => {
    for (const spec of [
      [[V1], [V0, V1], [V1]],
      [[V0, V1]],
      [...Array.from({ length: 10 }, () => [V1]), ...Array.from({ length: 3 }, () => [V0, V1])],
    ]) {
      for (const r of recapStatsScope(range(spec))) {
        expect(dayProvenance(r).kind, 'no incompatible day in population').not.toBe('incompatible');
      }
    }
  });

  it('render identity and statistical comparability stay separate', () => {
    const rows = range([...Array.from({ length: 15 }, () => [V1]),
                        ...Array.from({ length: 15 }, () => [V11])]);
    expect(recapStatsScope(rows).length).toBe(30);                 // one population
    expect(segmentForRender(rows, renderKeyOf).length).toBe(2);     // two visual runs
  });
});

/* ═══════ NULL-BEARING DAYS — the shape the fixtures could not express ═══════
 *
 * `JournalRollup.modelVersions` was typed `string[]` while the server emits
 * `[...Set<string | null>]` unfiltered. No fixture could construct a
 * null-bearing day, so an entire class of defect was invisible to every law —
 * and one shipped: `dayVersion` read `recordedVersions.length`, which drops
 * nulls, so [null, v1.0] reduced to ['v1.0'] and drew the api-server deploy day
 * INSIDE the v1.0 stroke. The type now admits null; these are the laws it makes
 * possible.
 */
describe('null-bearing days render and score honestly', () => {
  const V11 = 'hydrostate-v1.1';
  const mk = (spec: (string | null)[][]) =>
    spec.map((vs, i) => rollup(`2026-08-${String(i + 1).padStart(2, '0')}`, 80, vs));

  it('[null, v1.0] is INCOMPATIBLE and renders as its OWN run', () => {
    const rows = mk([...Array.from({ length: 29 }, () => [V1]), [null, V1]]);
    const p = dayProvenance(rows[29]!);
    expect(p.kind).toBe('incompatible');
    expect(p.scoreableVersion).toBeNull();
    // recordedVersions is length 1 — the trap. Render identity must consult
    // `kind`, not that length.
    expect(p.recordedVersions).toEqual([V1]);
    expect(renderKeyOf(rows[29]!, 29), 'must not join the v1.0 run').toMatch(/^isolated:/);
    expect(segmentForRender(rows, renderKeyOf).length).toBe(2);
    expect(buildRecapSegmentPaths(rows, 300, 100, PAD).length).toBe(2);
  });

  it('the picture and the caption agree about which days count', () => {
    // The defect drew 30 continuous points under "29 COMPARABLE DAYS".
    const rows = mk([...Array.from({ length: 29 }, () => [V1]), [null, V1]]);
    const scope = recapStatsScope(rows);
    const runs = segmentForRender(rows, renderKeyOf);
    expect(scope.length).toBe(29);
    // The excluded day is visually separated, not welded into the run.
    const largest = Math.max(...runs.map((r) => r.points.length));
    expect(largest).toBe(scope.length);
  });

  it('a null-bearing day is not silently readmitted anywhere', () => {
    const rows = mk([[V1], [null, V1], [V1]]);
    for (const r of recapStatsScope(rows)) {
      expect(dayProvenance(r).kind).toBe('known');
    }
    expect(isMixedModelDay([null, V1])).toBe(true);
    // ...while a day that is merely UNRECORDED still is not "incompatible".
    expect(isMixedModelDay([null])).toBe(false);
    expect(isMixedModelDay([null, null])).toBe(false);
  });

  it('every surface agrees about one null-bearing day', () => {
    // The two-surface contradiction: the day card marked it non-comparable
    // while the share card drew it inside the v1.0 stroke.
    const row = rollup('2026-08-30', 80, [null, V1]);
    expect(isMixedModelDay(row.modelVersions)).toBe(true);   // JournalDayCard
    expect(renderKeyOf(row, 0)).toMatch(/^isolated:/);       // render
    expect(statsDayVersion(row)).toBeNull();                 // population
    expect(dayProvenance(row).kind).toBe('incompatible');    // canonical
  });

  it('null-bearing days still witness a transition', () => {
    const rows = mk([...Array.from({ length: 5 }, () => [] as (string | null)[]), [null, V1]]);
    const p = classifyRecapProvenance(rows);
    // Only ONE known version is present, so this is NOT a transition...
    expect(hasKnownTransition(p)).toBe(false);
    // ...but a genuine v0/v1 straddle inside one day IS.
    const t = classifyRecapProvenance(mk([[V0], [null, V0, V1]]));
    expect(hasKnownTransition(t)).toBe(true);
    // ...and a same-major straddle is not.
    const sm = classifyRecapProvenance(mk([[V1], [V1, V11]]));
    expect(hasKnownTransition(sm)).toBe(false);
  });
});

/* ═══════ RENDER WELD — isolation must hold beside UNSTAMPED neighbours ═══════
 *
 * Every earlier isolation law placed the non-clean day between STAMPED
 * neighbours — the one arrangement where exact-identity grouping isolates it by
 * accident. Beside unstamped days, which is the modal shape while the version
 * column has no backfill, `null === null` welded three disjoint provenance
 * kinds into one visual run.
 */
describe('a non-clean day never joins an UNSTAMPED run', () => {
  const V11 = 'hydrostate-v1.1';
  const mk = (spec: (string | null)[][]) =>
    spec.map((vs, i) => rollup(`2026-08-${String(i + 1).padStart(2, '0')}`, 75, vs));

  const CASES: Array<[string, (string | null)[][], number]> = [
    ['column-deploy day after unstamped history',
      [...Array.from({ length: 9 }, () => [null]), [null, V1]], 2],
    ['minor-bump day after unstamped history',
      [...Array.from({ length: 9 }, () => [null]), [V1, V11]], 2],
    ['incompatible day after unstamped history',
      [...Array.from({ length: 9 }, () => [null]), [V0, V1]], 2],
    ['straddle day BETWEEN unstamped runs',
      [...Array.from({ length: 5 }, () => [null]), [V1, V11],
       ...Array.from({ length: 4 }, () => [null])], 3],
    ['two adjacent non-clean days never share a run',
      [[null], [V0, V1], [V1, V11], [null]], 4],
  ];

  for (const [label, spec, expectedRuns] of CASES) {
    it(`${label}: ${expectedRuns} runs`, () => {
      const rows = mk(spec);
      const runs = segmentForRender(rows, renderKeyOf);
      expect(runs.length, 'visual runs').toBe(expectedRuns);
      expect(buildRecapSegmentPaths(rows, 300, 100, PAD).length).toBe(expectedRuns);
      // No run may contain both a scoreable day and a non-scoreable one.
      for (const run of runs) {
        const kinds = new Set(run.points.map((r) => dayProvenance(r).kind));
        expect(kinds.size, `run mixes kinds: ${[...kinds]}`).toBe(1);
      }
      // ...and no observation is lost.
      expect(runs.flatMap((r) => r.points).length).toBe(rows.length);
    });
  }

  it('the picture and the caption agree BESIDE UNSTAMPED days too', () => {
    // The exact shape the earlier law forbade but never constructed.
    const rows = mk([...Array.from({ length: 29 }, () => [null]), [null, V1]]);
    const scope = recapStatsScope(rows);
    const runs = segmentForRender(rows, renderKeyOf);
    expect(scope.length).toBe(29);                      // one day excluded
    expect(runs.length).toBe(2);                        // and visually separated
    expect(Math.max(...runs.map((r) => r.points.length))).toBe(scope.length);
  });

  it('a clean single-version run still groups (anti-over-isolation)', () => {
    const rows = mk(Array.from({ length: 10 }, () => [V1]));
    expect(segmentForRender(rows, renderKeyOf).length).toBe(1);
    const unstamped = mk(Array.from({ length: 10 }, () => [null]));
    expect(segmentForRender(unstamped, renderKeyOf).length).toBe(1);
  });
});

describe('SCOPE LAW — no lossy render predicate survives', () => {
  it('`dayVersion` no longer exists or is exported anywhere in the boundary module', () => {
    // It collapsed unrecorded, incompatible and known-multi-version days onto
    // `null`, and `null === null` welded three semantically distinct states
    // into one visual run. The value must not survive as a shortcut for the
    // next consumer to reach for.
    const src = read('utils/scoring/boundarySeries.ts');
    const code = src.split('\n')
      .filter((l) => !l.trim().startsWith('*') && !l.trim().startsWith('//') && !l.trim().startsWith('/*'))
      .join('\n');
    expect(code).not.toMatch(/export function dayVersion\b/);
    expect(code).not.toMatch(/\bdayVersion\s*\(/);
  });

  it('no render grouping is keyed on a nullable version anywhere', () => {
    const src = read('utils/scoring/boundarySeries.ts')
      .split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
    // Every segmentForRender call must pass a TOTAL key function.
    const calls = [...src.matchAll(/segmentForRender\([^,]+,\s*([^)]+)\)/g)].map((m) => m[1]!.trim());
    expect(calls.length).toBeGreaterThan(0);                 // ANTI-VACUITY
    for (const arg of calls) {
      expect(arg, `render key must be total, got: ${arg}`)
        .toMatch(/renderKeyOf|snapshotRenderKeyOf/);
    }
    expect(src).not.toMatch(/segmentForRender\([^)]*modelVersion \?\? null/);
  });

  it('the render key is TOTAL over every provenance kind', () => {
    const V11 = 'hydrostate-v1.1';
    const key = (vs: (string | null)[], i = 0) =>
      renderKeyOf(rollup('2026-08-01', 70, vs), i);
    // Distinct provenance states must not collapse onto one key.
    const unrecorded = key([]);
    const knownV1 = key([V1]);
    const straddle = key([V1, V11]);
    const incompatible = key([V0, V1], 5);
    expect(new Set([unrecorded, knownV1, straddle, incompatible]).size).toBe(4);
    // ...and no key is null or empty.
    for (const k of [unrecorded, knownV1, straddle, incompatible]) {
      expect(typeof k).toBe('string');
      expect(k.length).toBeGreaterThan(0);
    }
    // Identical states DO share, so this is not blanket isolation.
    expect(key([])).toBe(key([]));
    expect(key([V1])).toBe(key([V1], 9));
    expect(key([V1, V11])).toBe(key([V1, V11], 9));
    // Incompatible days never share, even with each other.
    expect(key([V0, V1], 1)).not.toBe(key([V0, V1], 2));
  });
});

/* ═══════ SENTINEL GATE — ABSENT ≠ ZERO ≠ UNKNOWN ≠ INCOMPATIBLE ═══════
 *
 * The wire audit named these states in prose and never fed them to a consumer.
 * Every recap fixture hardcoded `snapshotsCount: 4`, so the server's real
 * intake-without-snapshot row was unconstructible and 149 laws stayed green
 * while one missed sync dragged a 30-day average from 90 to 87 and — after the
 * rollout — printed "MODEL HISTORY UNAVAILABLE" over a fully-stamped run.
 * These laws run the sentinel THROUGH the production consumers.
 */
describe('SENTINEL GATE — a scoreless day is not a score', () => {
  const mk = (n: number, vs: (string | null)[], score = 90) =>
    Array.from({ length: n }, (_, i) =>
      rollup(`2026-08-${String(i + 1).padStart(2, '0')}`, score, vs));
  const withGapAt = (rows: JournalRollup[], i: number) => {
    const copy = [...rows];
    copy[i] = scorelessRollup(copy[i]!.date);
    return copy;
  };
  // The helper must ask the PRODUCTION classifier. Computing its own gate here
  // is what hid the shipped defect: this file's `scope.length === observed.length`
  // was the correct comparison, the component's `scope.length === rollups.length`
  // was not, and no law could see the divergence because no law used the
  // component's version. A test helper that re-derives production logic is
  // testing itself.
  const cardFor = (rows: JournalRollup[]) =>
    computeRecapCardStats(rows, recapStatsScope(rows), {
      streakEligible: classifyStreakEligibility(rows).kind === 'eligible',
    });

  it('H1 — a scoreless day never drags the average toward zero', () => {
    const clean = mk(30, [], 90);
    const gap = withGapAt(clean, 14);
    expect(cardFor(clean).avgScore).toBe(90);
    expect(cardFor(gap).avgScore, 'the sentinel must not be averaged in').toBe(90);
    // ANTI-VACUITY: the sentinel really is present and really is excluded.
    expect(gap[14]!.snapshotsCount).toBe(0);
    expect(gap[14]!.avgScore).toBe(0);
    expect(recapStatsScope(gap).length).toBe(29);
    // ...and it is still a tracked day of the reporting range.
    expect(cardFor(gap).daysTracked).toBe(30);
  });

  it('H2 — a scoreless day never announces model uncertainty', () => {
    const clean = mk(30, [V1], 90);
    const gap = withGapAt(clean, 14);
    expect(classifyRecapProvenance(clean).kind).toBe('fully_comparable');
    expect(classifyRecapProvenance(gap).kind,
      'a missing snapshot is not a comparability event').toBe('fully_comparable');
    expect(cardFor(gap).avgScore).toBe(90);
  });

  it('a scoreless day is a GAP in the chart, never a plotted zero', () => {
    const gap = withGapAt(mk(30, [V1], 90), 14);
    const paths = buildRecapSegmentPaths(gap, 300, 100, PAD);
    expect(paths.length, 'the stroke breaks at the gap').toBe(2);
    // No geometry may sit on the score-0 baseline.
    const baselineY = PAD.top + (100 - PAD.top - PAD.bottom);
    for (const d of paths) {
      const ys = [...d.matchAll(/[ML][\d.]+,(-?[\d.]+)/g)].map((m) => Number(m[1]));
      // ANTI-VACUITY: `for (const y of [])` asserts nothing, and a regex that
      // cannot match a negative coordinate produces exactly that.
      expect(ys.length, `no coordinates parsed from: ${d}`).toBeGreaterThan(0);
      for (const y of ys) expect(y, `plotted at the zero baseline: ${d}`).toBeLessThan(baselineY);
    }
  });

  it('gap position: first, last, middle, and several consecutive', () => {
    const base = mk(30, [V1], 90);
    for (const [label, idxs, expectPaths] of [
      ['first', [0], 1], ['last', [29], 1], ['middle', [14], 2],
      ['three consecutive', [10, 11, 12], 2],
    ] as Array<[string, number[], number]>) {
      let rows = base;
      for (const i of idxs) rows = withGapAt(rows, i);
      const c = cardFor(rows);
      expect(c.avgScore, `${label}: average unaffected`).toBe(90);
      expect(c.daysTracked, `${label}: still 30 tracked days`).toBe(30);
      expect(classifyRecapProvenance(rows).kind, `${label}: no model uncertainty`)
        .toBe('fully_comparable');
      expect(buildRecapSegmentPaths(rows, 300, 100, PAD).length, `${label}: strokes`)
        .toBe(expectPaths);
    }
  });

  it('ABSENT ≠ ZERO — a MEASURED zero behaves completely differently', () => {
    const measuredZero = mk(30, [V1], 90);
    measuredZero[14] = rollup(measuredZero[14]!.date, 0, [V1], 4);   // real 0, observed
    const absent = withGapAt(mk(30, [V1], 90), 14);
    // The measured zero IS a score: it enters the population and moves the mean.
    expect(recapStatsScope(measuredZero).length).toBe(30);
    expect(cardFor(measuredZero).avgScore).toBeLessThan(90);
    // The absent day does neither.
    expect(recapStatsScope(absent).length).toBe(29);
    expect(cardFor(absent).avgScore).toBe(90);
  });

  it('ZERO ≠ UNKNOWN ≠ INCOMPATIBLE — four states, four behaviours', () => {
    const at = (r: JournalRollup) => ({
      inScope: recapStatsScope([rollup('2026-08-01', 90, [V1]), r]).length,
      kind: classifyRecapProvenance([rollup('2026-08-01', 90, [V1]), r]).kind,
    });
    const scoreless = at(scorelessRollup('2026-08-02'));
    const measured0 = at(rollup('2026-08-02', 0, [V1], 4));
    const unknown = at(rollup('2026-08-02', 90, [], 4));
    const incompatible = at(rollup('2026-08-02', 90, [V0, V1], 4));
    // ABSENT: excluded from the population, and NOT a comparability event.
    expect(scoreless).toEqual({ inScope: 1, kind: 'fully_comparable' });
    // MEASURED ZERO: a real score — enters the population, no uncertainty.
    expect(measured0).toEqual({ inScope: 2, kind: 'fully_comparable' });
    // UNKNOWN PROVENANCE: excluded, and comparability WAS decided for the
    // survivor, so this narrows rather than reporting unknown history.
    expect(unknown).toEqual({ inScope: 1, kind: 'partially_comparable' });
    // INCOMPATIBLE: excluded, and it carries transition evidence the others
    // do not — so it is a different state again.
    expect(incompatible.inScope).toBe(1);
    expect(incompatible.kind).toBe('partially_comparable');
    const inc = classifyRecapProvenance([rollup('2026-08-01', 90, [V1]), rollup('2026-08-02', 90, [V0, V1], 4)]);
    expect(hasKnownTransition(inc), 'only the incompatible day witnesses a transition').toBe(true);
    const unk = classifyRecapProvenance([rollup('2026-08-01', 90, [V1]), rollup('2026-08-02', 90, [], 4)]);
    expect(hasKnownTransition(unk)).toBe(false);
    // All four are genuinely distinct.
    // Four genuinely distinct behaviours across (inScope, kind, transition).
    const sig = (o: { inScope: number; kind: string }, t: boolean) => `${o.inScope}|${o.kind}|${t}`;
    expect(new Set([
      sig(scoreless, false), sig(measured0, false),
      sig(unknown, hasKnownTransition(unk)), sig(incompatible, hasKnownTransition(inc)),
    ]).size).toBe(4);
  });

  it('a scoreless day with REAL intake keeps its activity', () => {
    // PR B will source authoritative totals from intake rows; the day must
    // survive in the reporting range for that to be possible.
    const gap = withGapAt(mk(30, [V1], 90), 14);
    expect(gap[14]!.intakeCount).toBeGreaterThanOrEqual(0);
    expect(cardFor(gap).daysTracked).toBe(30);
  });

  it('an entirely scoreless range has NO history, not unknown history', () => {
    const rows = Array.from({ length: 10 }, (_, i) =>
      scorelessRollup(`2026-08-${String(i + 1).padStart(2, '0')}`));
    expect(classifyRecapProvenance(rows).kind).toBe('no_history');
    expect(recapStatsScope(rows).length).toBe(0);
  });
});

/* ═══════ ONE OBSERVATION DENOMINATOR (founder ruling A, 2026-09-02) ═══════
 *
 * `hasHydroStateObservation` was installed last round and wired into
 * `recapStatsScope` and `classifyRecapProvenance`. `ShareJournalRecap` was left
 * asking `statsScope.length === rollups.length`, so the card held two answers
 * about the same array: one missed sync either deleted a genuine 29-day streak
 * in SILENCE (fully-stamped month — no qualifier, no note) or reported it as
 * "MODEL HISTORY UNAVAILABLE" (unstamped month), blaming a recalibration for a
 * missing snapshot.
 *
 * A seam asked at some call sites is a convention. These laws pin the
 * population as a NAMED VALUE and pin the three causes apart.
 */
describe('OBSERVATION DENOMINATOR — one population, three streak causes', () => {
  const day = (i: number, vs: (string | null)[], score = 90, snaps = 4) =>
    rollup(`2026-08-${String(i + 1).padStart(2, '0')}`, score, vs, snaps);
  type DaySpec = { vs: (string | null)[]; score?: number; snaps?: number };
  const rowsOf = (specs: DaySpec[]) =>
    specs.map((s, i) => day(i, s.vs, s.score ?? 90, s.snaps ?? 4));
  const many = (n: number, vs: (string | null)[], extra: Partial<DaySpec> = {}): DaySpec[] =>
    Array.from({ length: n }, () => ({ vs, ...extra }));
  /** The server's real intake-without-snapshot row. */
  const SCORELESS: DaySpec = { vs: [], score: 0, snaps: 0 };
  const cardFor = (rows: JournalRollup[]) =>
    computeRecapCardStats(rows, recapStatsScope(rows), {
      streakEligible: classifyStreakEligibility(rows).kind === 'eligible',
    });

  it('observedRows / observedCount ARE the seam — nothing re-encodes it', () => {
    const rows = rowsOf([...many(14, [V1]), SCORELESS, ...many(15, [V1])]);
    expect(observedCount(rows)).toBe(29);
    expect(observedRows(rows).every(hasHydroStateObservation)).toBe(true);
    expect(observedRows(rows).some((r) => r === rows[14])).toBe(false);
    // The two questions have DIFFERENT answers on this row set, which is the
    // whole point: `rollups.length` answers "how many days does the label
    // cover", `observedCount` answers "how many did HydroState measure".
    expect(observedCount(rows)).not.toBe(rows.length);
  });

  it('the streak denominator is OBSERVED days, not the reporting range', () => {
    const rows = rowsOf([...many(14, [V1]), SCORELESS, ...many(15, [V1])]);
    // ANTI-VACUITY: the fixture reaches the divergence. Score population and
    // observed population agree (29); only the raw range differs (30).
    expect(recapStatsScope(rows).length).toBe(29);
    expect(observedCount(rows)).toBe(29);
    expect(rows.length).toBe(30);

    expect(classifyStreakEligibility(rows)).toEqual({
      kind: 'coverage_incomplete', measuredDays: 29, rangeDays: 30,
    });
    // The reported numerator is the OBSERVED count. Substituting the reporting
    // range for it changes both the kind and the number this law asserts.
    const e = classifyStreakEligibility(rows);
    expect(e.kind === 'coverage_incomplete' && e.measuredDays).toBe(observedCount(rows));
    expect(e.kind === 'coverage_incomplete' && e.rangeDays).toBe(rows.length);
  });

  it('THREE causes are three distinct answers', () => {
    const complete = rowsOf(many(30, [V1]));
    const uncovered = rowsOf([...many(14, [V1]), SCORELESS, ...many(15, [V1])]);
    const incomparable = rowsOf([...many(20, [V0]), ...many(10, [V1])]);

    expect(classifyStreakEligibility(complete).kind).toBe('eligible');
    expect(classifyStreakEligibility(uncovered).kind).toBe('coverage_incomplete');
    expect(classifyStreakEligibility(incomparable).kind).toBe('not_comparable');
    expect(classifyStreakEligibility([]).kind).toBe('no_history');

    // ANTI-VACUITY: all four are genuinely reachable and genuinely distinct.
    expect(new Set([complete, uncovered, incomparable, []]
      .map((r) => classifyStreakEligibility(r).kind)).size).toBe(4);

    // ...and the model cause survives coverage being complete: a boundary is
    // still a boundary. If coverage had swallowed every cause, this would fail.
    expect(observedCount(incomparable)).toBe(incomparable.length);
  });

  it('COVERAGE is asked before COMPARABILITY — a gap is never a model event', () => {
    // Both defects present at once. The streak cause is coverage, because a day
    // with no observation has no score for comparability to rule on.
    const rows = rowsOf([...many(20, [V0]), SCORELESS, ...many(9, [V1])]);
    expect(classifyStreakEligibility(rows).kind).toBe('coverage_incomplete');
    // ...and the model fact is NOT lost — it is still classified, on the
    // provenance channel, which is what the card discloses separately.
    expect(hasKnownTransition(classifyRecapProvenance(rows))).toBe(true);
  });

  it('a MEASURED zero keeps the streak ELIGIBLE — absence and zero differ', () => {
    const measured = rowsOf([...many(14, [V1]), { vs: [V1], score: 0 }, ...many(15, [V1])]);
    const absent = rowsOf([...many(14, [V1]), SCORELESS, ...many(15, [V1])]);
    expect(observedCount(measured)).toBe(30);
    expect(classifyStreakEligibility(measured).kind).toBe('eligible');
    expect(classifyStreakEligibility(absent).kind).toBe('coverage_incomplete');
    // The measured zero is published as a real, shorter streak; the absence is
    // not published at all.
    const shown = cardFor(measured).bestStreak;
    expect(shown).not.toBeNull();
    expect(shown!).toBeGreaterThan(0);
    expect(shown!).toBeLessThan(30);
    expect(cardFor(absent).bestStreak).toBeNull();
  });

  it('gap position does not change the cause: first, last, middle, consecutive', () => {
    for (const [label, idxs, measured] of [
      ['first', [0], 29], ['last', [29], 29], ['middle', [14], 29],
      ['three consecutive', [10, 11, 12], 27],
    ] as Array<[string, number[], number]>) {
      const specs: DaySpec[] = many(30, [V1]);
      for (const i of idxs) specs[i] = SCORELESS;
      const rows = rowsOf(specs);
      expect(classifyStreakEligibility(rows), label).toEqual({
        kind: 'coverage_incomplete', measuredDays: measured, rangeDays: 30,
      });
      expect(cardFor(rows).bestStreak, `${label}: unknowable`).toBeNull();
      // The member's participation is never discarded by a missing snapshot.
      expect(cardFor(rows).daysTracked, `${label}: range intact`).toBe(30);
      // ...nor is the average dragged toward the sentinel.
      expect(cardFor(rows).avgScore, `${label}: average intact`).toBe(90);
    }
  });

  it('an entirely scoreless range reports 0 OF N measured, not silence', () => {
    const rows = rowsOf(many(10, [V1], { score: 0, snaps: 0 }));
    expect(classifyStreakEligibility(rows)).toEqual({
      kind: 'coverage_incomplete', measuredDays: 0, rangeDays: 10,
    });
    // ...while an EMPTY range genuinely has nothing to explain.
    expect(classifyStreakEligibility([]).kind).toBe('no_history');
  });

  it('complete coverage + entirely UNRECORDED provenance keeps the real streak', () => {
    // The modal shape while `hydrostate_model_version` is nullable with no
    // backfill. Unknown provenance is not a coverage failure and not a
    // boundary, so the streak stands — with the qualifier still disclosed.
    const rows = rowsOf(many(30, []));
    expect(observedCount(rows)).toBe(30);
    expect(classifyStreakEligibility(rows).kind).toBe('eligible');
    expect(cardFor(rows).bestStreak).toBe(30);
    expect(classifyRecapProvenance(rows).kind).toBe('provenance_unknown');
  });

  it('computeRecapCardStats publishes the streak EXACTLY when eligible', () => {
    let sawEligible = false, sawSuppressed = false;
    for (const [label, rows] of [
      ['complete v1', rowsOf(many(30, [V1]))],
      ['complete unstamped', rowsOf(many(30, []))],
      ['one gap', rowsOf([...many(14, [V1]), SCORELESS, ...many(15, [V1])])],
      ['all scoreless', rowsOf(many(10, [V1], { score: 0, snaps: 0 }))],
      ['v0 -> v1', rowsOf([...many(20, [V0]), ...many(10, [V1])])],
      ['entirely incompatible', rowsOf(many(10, [V0, V1]))],
      ['gap AND transition', rowsOf([...many(20, [V0]), SCORELESS, ...many(9, [V1])])],
    ] as Array<[string, JournalRollup[]]>) {
      const eligible = classifyStreakEligibility(rows).kind === 'eligible';
      sawEligible ||= eligible;
      sawSuppressed ||= !eligible;
      expect(cardFor(rows).bestStreak !== null, `${label}: published ⟺ eligible`)
        .toBe(eligible);
    }
    // ANTI-VACUITY: suppression must not be unconditional, nor publication.
    expect(sawEligible && sawSuppressed).toBe(true);
  });
});

/* ═══════ NO SECOND SCORING PATH (founder ruling B, 2026-09-02) ═══════
 *
 * `buildRecapSegmentPaths` carried a `rollups.length === 1` shortcut that read
 * `rollups[0].avgScore` directly and returned a full-width stroke. It predated
 * the observation seam and never learned it, so a lone intake-without-snapshot
 * day was drawn as a hard line across the card at the score-0 baseline, under
 * tiles that all correctly read "—". It also skipped the clamp the multi-row
 * branch applies, so a score outside 0..100 escaped the plot area.
 *
 * The branch is gone. These laws pin that every range — one row included —
 * comes through the same segmentation.
 */
describe('recap geometry — one path through the pipeline, for every length', () => {
  const INNER_W = 300, INNER_H = 100;
  const BASELINE_Y = PAD.top + INNER_H;      // where a score of 0 is drawn
  const paths = (rows: JournalRollup[]) =>
    buildRecapSegmentPaths(rows, INNER_W, INNER_H, PAD);
  // NEGATIVES MUST MATCH. `([\d.]+)` cannot match `-372.0`, so an UNCLAMPED
  // coordinate — the exact value these laws exist to catch — extracted as an
  // EMPTY array and every `for (const y of ys)` assertion passed vacuously. A
  // mutation removing the clamp survived the whole suite on that alone.
  const coords = (d: string, group: 1 | 2) => {
    const out = [...d.matchAll(/[ML](-?[\d.]+),(-?[\d.]+)/g)].map((m) => Number(m[group]));
    expect(out.length, `no coordinates parsed from: ${d}`).toBeGreaterThan(0);
    return out;
  };
  const xsOf = (d: string) => coords(d, 1);
  const ysOf = (d: string) => coords(d, 2);

  it('a SCORELESS single day renders no geometry at all', () => {
    const rows = [scorelessRollup('2026-08-01')];
    // ANTI-VACUITY: the sentinel is present and would plot at the baseline.
    expect(rows[0]!.snapshotsCount).toBe(0);
    expect(rows[0]!.avgScore).toBe(0);
    expect(paths(rows)).toEqual([]);
  });

  it('an OBSERVED single day renders a drawn mark, inside the plot area', () => {
    const d = paths([rollup('2026-08-01', 90, [V1])]);
    expect(d.length).toBe(1);
    expect(d[0]!, 'a bare moveto strokes nothing').toMatch(/L/);
    const xs = xsOf(d[0]!);
    expect(Math.min(...xs), 'left edge').toBeGreaterThanOrEqual(PAD.left);
    expect(Math.max(...xs), 'right edge').toBeLessThanOrEqual(PAD.left + INNER_W);
    expect(Math.abs(xs[xs.length - 1]! - xs[0]!), 'zero-length stroke').toBeGreaterThan(0);
    for (const y of ysOf(d[0]!)) expect(y, 'never the score-0 baseline').toBeLessThan(BASELINE_Y);
  });

  it('a two-row range with one scoreless day draws only the observed day', () => {
    const rows = [rollup('2026-08-01', 90, [V1]), scorelessRollup('2026-08-02')];
    const d = paths(rows);
    expect(d.length).toBe(1);
    for (const y of ysOf(d[0]!)) expect(y).toBeLessThan(BASELINE_Y);
    // ...and the surviving mark stays inside the plot even at the range edge.
    for (const x of xsOf(d[0]!)) {
      expect(x).toBeGreaterThanOrEqual(PAD.left);
      expect(x).toBeLessThanOrEqual(PAD.left + INNER_W);
    }
  });

  it('EVERY length routes through segmentForRender — no special case survives', () => {
    // TOTAL law. The number of drawn paths equals the number of non-gap
    // segments, for ranges of 1, 2 and 30 rows. The deleted shortcut returned
    // one path for a zero-segment range, so it cannot satisfy this.
    const mk = (n: number, vs: (string | null)[]) =>
      Array.from({ length: n }, (_, i) =>
        rollup(`2026-08-${String(i + 1).padStart(2, '0')}`, 90, vs));
    const withGap = (rows: JournalRollup[], i: number) => {
      const c = [...rows]; c[i] = scorelessRollup(c[i]!.date); return c;
    };
    for (const [label, rows] of [
      ['one observed row', mk(1, [V1])],
      ['one scoreless row', [scorelessRollup('2026-08-01')]],
      ['two rows, one gap', withGap(mk(2, [V1]), 1)],
      ['thirty clean rows', mk(30, [V1])],
      ['thirty rows, middle gap', withGap(mk(30, [V1]), 14)],
      ['thirty rows, all scoreless', mk(30, [V1]).map((r) => scorelessRollup(r.date))],
      ['a real boundary', [...mk(15, [V0]),
        ...Array.from({ length: 15 }, (_, i) =>
          rollup(`2026-09-${String(i + 1).padStart(2, '0')}`, 90, [V1]))]],
    ] as Array<[string, JournalRollup[]]>) {
      const drawable = segmentForRender(rows, renderKeyOf)
        .filter((s) => !s.modelVersion!.startsWith('gap:'));
      expect(paths(rows).length, `${label}: one path per drawable segment`)
        .toBe(drawable.length);
    }
  });

  it('a single row never spans the whole plot width — that was the shortcut', () => {
    // The deleted branch emitted `M left,y L left+innerW,y`. A lone observation
    // is one mark, the same as a lone observation anywhere else in a range.
    const d = paths([rollup('2026-08-01', 90, [V1])])[0]!;
    const xs = xsOf(d);
    expect(Math.max(...xs) - Math.min(...xs), 'a full-width stroke is back')
      .toBeLessThan(INNER_W / 2);
  });

  it('an out-of-range score is clamped, on every path length', () => {
    // The multi-row branch clamped; the deleted single-row branch did not, so a
    // corrupt score drew outside the chart entirely.
    for (const rows of [
      [rollup('2026-08-01', 480, [V1])],
      [rollup('2026-08-01', 480, [V1]), rollup('2026-08-02', 90, [V1])],
    ]) {
      expect(rows[0]!.avgScore, 'the fixture must be out of range').toBeGreaterThan(100);
      expect(paths(rows).length, 'geometry must exist to assert on').toBeGreaterThan(0);
      for (const d of paths(rows)) {
        for (const y of ysOf(d)) {
          expect(y, 'above the plot').toBeGreaterThanOrEqual(PAD.top);
          expect(y, 'below the plot').toBeLessThanOrEqual(BASELINE_Y);
        }
      }
    }
  });
});

/* ═══════ THE WINDOW IS A CALENDAR, NOT A ROW COUNT ═══════
 *
 * `rollups.length` answers "how many days did the SERVER MATERIALISE a row
 * for". Reading it as "how many days does the window cover" was the twelfth
 * instance of this program's defect family, and the worst-behaved: the route
 * omitted any day with neither a snapshot nor an intake, so a day the member
 * skipped ENTIRELY vanished from the array — taking its own absence with it.
 * The streak then walked straight across the hole and published a BROKEN
 * streak for a day HydroState had never observed.
 *
 * The route now densifies the effective window, so row count and calendar span
 * agree by construction. These laws pin the client half: it measures the
 * CALENDAR, so a client running against a server that has not shipped
 * densification still sees the gap instead of silently missing it.
 */
describe('reportedSpanDays — the reporting window in calendar days', () => {
  const day = (i: number, score = 90, snaps = 4) =>
    rollup(`2026-08-${String(i).padStart(2, '0')}`, score, [V1], snaps);

  it('a DENSE array: span equals the row count', () => {
    const rows = Array.from({ length: 30 }, (_, i) => day(i + 1));
    expect(reportedSpanDays(rows)).toBe(30);
    expect(reportedSpanDays(rows)).toBe(rows.length);
  });

  it('a SPARSE array: span counts the missing day the rows cannot', () => {
    // The exact production shape: 2026-08-15 produced no row at all.
    const rows = Array.from({ length: 30 }, (_, i) => day(i + 1)).filter((r) => r.date !== '2026-08-15');
    expect(rows.length, 'the row count is blind to it').toBe(29);
    expect(reportedSpanDays(rows), 'the calendar is not').toBe(30);
  });

  it('THE DEFECT: a day absent from the wire suppresses the streak', () => {
    const dense = Array.from({ length: 30 }, (_, i) => day(i + 1));
    const sparse = dense.filter((r) => r.date !== '2026-08-15');
    // Dense and fully observed -> a real streak.
    expect(classifyStreakEligibility(dense).kind).toBe('eligible');
    // The SAME missing observation, delivered as an absent row instead of a
    // scoreless one, must reach the SAME answer. Under `rollups.length` it
    // reached `eligible` and published a broken streak.
    expect(classifyStreakEligibility(sparse)).toEqual({
      kind: 'coverage_incomplete', measuredDays: 29, rangeDays: 30,
    });
    // ANTI-VACUITY: the misleading number really is reachable and really is
    // withheld — `computeRecapStats` breaks the run at the calendar gap.
    expect(computeRecapStats(sparse).bestStreak).toBeLessThan(30);
    expect(computeRecapCardStats(sparse, recapStatsScope(sparse), {
      streakEligible: classifyStreakEligibility(sparse).kind === 'eligible',
    }).bestStreak).toBeNull();
  });

  it('an ABSENT day and a SCORELESS day are the same HydroState question', () => {
    // Founder ruling: "the latter two must have the same HydroState-observation
    // semantics". A member who logged water without a snapshot and a member who
    // logged nothing at all were both unobserved that day.
    const base = Array.from({ length: 30 }, (_, i) => day(i + 1));
    const scoreless = base.map((r, i) => (i === 14 ? scorelessRollup(r.date) : r));
    const absent = base.filter((_, i) => i !== 14);
    expect(classifyStreakEligibility(scoreless)).toEqual(classifyStreakEligibility(absent));
  });

  it('an empty range spans nothing; one row spans one day', () => {
    expect(reportedSpanDays([])).toBe(0);
    expect(reportedSpanDays([day(1)])).toBe(1);
  });

  it('duplicate or unsorted dates can never shrink the window below the rows', () => {
    // A span alone computes SHORTER than the rows present for both shapes, and
    // a window can never contain fewer days than the days it holds.
    const dupes = [day(1), day(1), day(1)];
    expect(reportedSpanDays(dupes)).toBe(3);
    const unsorted = [day(30), day(1)];
    expect(reportedSpanDays(unsorted)).toBeGreaterThanOrEqual(2);
  });

  it('a malformed day key falls back to a lower bound, never to an invented span', () => {
    const bad = [{ ...day(1), date: 'not-a-date' }, day(2)];
    expect(reportedSpanDays(bad)).toBe(2);
    // ...and an impossible calendar date is rejected rather than rolled forward.
    const feb30 = [{ ...day(1), date: '2026-02-30' }, day(2)];
    expect(reportedSpanDays(feb30)).toBe(2);
  });

  it('the window is measured, never assumed — row count is not consulted', () => {
    // STRUCTURAL: for a sparse array the two answers differ, and eligibility
    // must follow the calendar. Swapping `reportedSpanDays` for
    // `rollups.length` in the classifier changes this result.
    const sparse = [day(1), day(2), day(10)];
    expect(sparse.length).toBe(3);
    expect(reportedSpanDays(sparse)).toBe(10);
    expect(classifyStreakEligibility(sparse)).toEqual({
      kind: 'coverage_incomplete', measuredDays: 3, rangeDays: 10,
    });
  });
});
