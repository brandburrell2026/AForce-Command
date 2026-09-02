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
  recapStatsScope, dayVersion, statsDayVersion, isRecordedIncompatibleDay,
  dayProvenance, classifyRecapProvenance,
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

function rollup(date: string, avgScore: number, modelVersions: (string | null)[]): JournalRollup {
  return { date, avgScore, minScore: avgScore, maxScore: avgScore, snapshotsCount: 4,
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
    const segs = segmentForRender(rows, dayVersion);
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
    const segs = segmentForRender(rows, dayVersion);
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
      const streakComparable = !spansModelBoundary(rows.map(statsDayVersion));
      const card = computeRecapCardStats(rows, scope, { streakComparable });

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
      const segs = segmentForRender(rows, dayVersion);
      expect(segs.flatMap((s) => s.points).length).toBe(30);
    });
  }

  it('v1.0 and v1.1: ONE score population, TWO visual runs', () => {
    const rows = spec([[15, [V1]], [15, [V11]]]);
    // Statistical comparability — the registry says same-major is comparable.
    expect(recapStatsScope(rows).length).toBe(30);
    // Visual continuity — a separate contract, exact identity by founder ruling.
    expect(segmentForRender(rows, dayVersion).length).toBe(2);
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
    expect(spansModelBoundary(rows.map(dayVersion)), 'filter must be reached').toBe(true);
    const scope = recapStatsScope(rows);
    expect(scope.length, 'v1.0 + v1.1 are one score population').toBe(20);
    expect(scope.some((r) => r.modelVersions?.[0] === V1)).toBe(true);
    expect(scope.some((r) => r.modelVersions?.[0] === V11)).toBe(true);
    expect(scope.every((r) => r.modelVersions?.[0] !== V0)).toBe(true);
    // ...while the RENDER still seams all three (exact identity, by ruling).
    expect(segmentForRender(rows, dayVersion).length).toBe(3);
  });

  it('recapStatsScope routes through statsDayVersion, NOT the render predicate', () => {
    // The distinguishing shape: days carrying [v1.0, v1.1]. `statsDayVersion`
    // resolves them to v1.0 (same major, comparable) and keeps them in the
    // score population; `dayVersion` collapses them to null and drops them.
    // Without this fixture the swap survived the entire suite.
    const rows = range([...Array.from({ length: 15 }, () => [V1]),
                        ...Array.from({ length: 15 }, () => [V1, V11])]);
    expect(statsDayVersion(rows[29]!)).toBe(V1);   // comparable -> resolved
    expect(dayVersion(rows[29]!)).toBeNull();      // render identity -> null
    // The population must follow the STATISTICAL predicate: all 30 days.
    expect(recapStatsScope(rows).length).toBe(30);
    // ...while rendering still seams them, by founder ruling.
    expect(segmentForRender(rows, dayVersion).length).toBe(2);
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
    const card = computeRecapCardStats(rows, recapStatsScope(rows), { streakComparable: true });
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
    const rollupOf = (vs: string[]) => rollup('2026-08-01', 70, vs);
    expect(dayVersion(rollupOf([V0, V1]))).toBeNull();
    // ...and a same-major pair is ONE score population but still its own run.
    expect(P([V1, V11]).scoreableVersion).toBe(V1);
    expect(dayVersion(rollupOf([V1, V11]))).toBeNull();
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
    expect(segmentForRender(rows, dayVersion).length).toBe(2);     // two visual runs
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
    expect(dayVersion(rows[29]!), 'must not join the v1.0 run').toBeNull();
    expect(segmentForRender(rows, dayVersion).length).toBe(2);
    expect(buildRecapSegmentPaths(rows, 300, 100, PAD).length).toBe(2);
  });

  it('the picture and the caption agree about which days count', () => {
    // The defect drew 30 continuous points under "29 COMPARABLE DAYS".
    const rows = mk([...Array.from({ length: 29 }, () => [V1]), [null, V1]]);
    const scope = recapStatsScope(rows);
    const runs = segmentForRender(rows, dayVersion);
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
    expect(dayVersion(row)).toBeNull();                      // render
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
