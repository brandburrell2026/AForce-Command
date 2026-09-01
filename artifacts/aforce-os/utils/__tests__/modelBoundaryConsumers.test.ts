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
} from '../scoring/modelBoundary';
import { buildWeeklyV3Model } from '@/components/insights/weeklyV3Presentation';
import { bucketizeSegmented, buildRecapSegmentPaths } from '../scoring/boundarySeries';
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
    expect(buildRecapSegmentPaths(uniform, 300, 100, PAD).length).toBe(1);
  });

  it('scopes the headline average away from a blended figure', () => {
    const src = read('components/ShareJournalRecap.tsx');
    expect(src).toMatch(/statsScope/);
    expect(src).toMatch(/crossesModelBoundary/);
  });

  it('a mixed day isolates rather than joining a neighbouring segment', () => {
    const rows = [
      rollup('2026-08-25', 70, [V0]),
      rollup('2026-08-26', 74, [V0, V1]),   // mixed → comparable to nothing
      rollup('2026-08-27', 85, [V1]),
    ];
    const dayVersion = (r: JournalRollup) =>
      r.modelVersions && r.modelVersions.length === 1 ? r.modelVersions[0]! : null;
    const segs = segmentByModelVersion(rows, dayVersion);
    expect(segs.length).toBe(3);
    for (const s of segs) expect(s.points.length).toBe(1);
  });

  it('a single-day segment still gets its own stroke — no day is dropped', () => {
    // The mutation this catches: skipping segments with only one point, which
    // silently erases an isolated mixed day from the exported timeline.
    const rows = [
      rollup('2026-08-25', 70, [V0]),
      rollup('2026-08-26', 74, [V0, V1]),   // mixed → its own one-day segment
      rollup('2026-08-27', 85, [V1]),
    ];
    expect(buildRecapSegmentPaths(rows, 300, 100, PAD).length).toBe(3);
  });

  it('every exported day survives segmentation — no data is dropped', () => {
    const rows = [
      rollup('2026-08-25', 70, [V0]),
      rollup('2026-08-26', 72, [V0]),
      rollup('2026-08-27', 85, [V1]),
    ];
    const dayVersion = (r: JournalRollup) =>
      r.modelVersions && r.modelVersions.length === 1 ? r.modelVersions[0]! : null;
    const segs = segmentByModelVersion(rows, dayVersion);
    expect(segs.flatMap((s) => s.points).map((r) => r.date))
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
