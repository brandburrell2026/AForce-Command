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
} from '../scoring/modelBoundary';
import { buildWeeklyV3Model } from '@/components/insights/weeklyV3Presentation';
import {
  bucketizeSegmented, buildRecapSegmentPaths, segmentForRender,
  recapStatsScope, dayVersion,
} from '../scoring/boundarySeries';
import { computeRecapStats, computeRecapStatsSplit } from '../journalRecapStats';
import type { JournalRollup, JournalSnapshot } from '@/types';

const PAD = { top: 8, right: 4, bottom: 8, left: 4 };
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

function rollup(date: string, avgScore: number, modelVersions: string[]): JournalRollup {
  return { date, avgScore, minScore: avgScore, maxScore: avgScore, snapshotsCount: 4,
    endOzConsumed: 60, endAforceUnits: 0, endUnitsConsumed: 5, endSodiumDeliveredMg: 0,
    endSodiumLostMg: 0, endDeficitPct: 0, pctTimePeak: 0, pctTimeBalanced: 100,
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
      expect(src).not.toMatch(/we changed how|how we measure|recalibrat/i);
      expect(src).not.toMatch(/DELTA_EXPLAIN|SHIFT_THRESHOLD|>= ?12\b/);
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
  const range = (versions: string[][]) =>
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
  const range = (versions: string[][]) =>
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
      const split = computeRecapStatsSplit(rows, scope);
      const whole = computeRecapStats(rows);

      // 1 · score metrics never blend incomparable model versions
      expect(scope.length, 'score population').toBe(expectedScore);
      const anchor = dayVersion(scope[scope.length - 1]!);
      for (const r of scope) {
        expect(isComparableModelVersion(dayVersion(r), anchor), 'all comparable').toBe(true);
      }

      // 2 · non-score totals still represent the WHOLE reporting range
      expect(split.daysTracked, 'daysTracked').toBe(30);
      expect(split.totalOunces).toBe(whole.totalOunces);
      expect(split.totalSticks).toBe(whole.totalSticks);

      // 3 · a one-day score run must not make the card look like a one-day report
      expect(split.daysTracked).toBeGreaterThan(1);

      // 4 · no observation disappears
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

  it('duplicate version entries on one day are not a boundary', () => {
    // `[v1, v1]` is length 2 but names ONE version. `dayVersion` returns null
    // for it (length !== 1), so it is treated as unstamped rather than mixed —
    // conservative, and it must not be mistaken for a real boundary.
    expect(isMixedModelDay([V1, V1])).toBe(false);
    const rows = range([...Array.from({ length: 29 }, () => [V1]), [V1, V1]]);
    // The trailing duplicate day is unstamped-by-collapse; the score population
    // is the 29 known v1 days and the totals still cover all 30.
    expect(computeRecapStatsSplit(rows, recapStatsScope(rows)).daysTracked).toBe(30);
  });

  it('a one-day score run still produces a DRAWN stroke, not a bare moveto', () => {
    const rows = spec([[29, []], [1, [V1]]]);
    const paths = buildRecapSegmentPaths(rows, 300, 100, PAD);
    expect(paths.length).toBe(2);
    for (const d of paths) expect(d, `must draw: ${d}`).toMatch(/L/);
  });
});
