// @vitest-environment happy-dom
/**
 * ShareJournalRecap — RENDER-INTEGRATION harness.
 *
 * WHY THIS FILE EXISTS. Until now this component had no render test anywhere in
 * the repo. Its only model-boundary coverage was a source-string assertion, and
 * a source scan asserts vocabulary rather than behaviour: a call-and-discard
 * mutant —
 *
 *     const statsScope = rollups;
 *     void useMemo(() => recapStatsScope(rollups), [rollups]);
 *
 * — keeps every identifier the regex looks for, deletes the narrowing entirely,
 * and leaves the whole suite green. That is the third time in this program a
 * green suite has hidden a real defect, so the guarantee is asserted here on
 * what the component actually renders.
 *
 * These laws prove the shared implementation DRIVES the output: the rendered
 * `<Path>` set is compared against `buildRecapSegmentPaths` directly, and the
 * rendered stat tiles against the two declared populations. A local legacy
 * fallback cannot satisfy them.
 *
 * Harness follows `journalChart.render.test.tsx`: happy-dom + stubbed
 * `react-native-svg`, since native rendering is irrelevant to the contract.
 */
import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { JournalRollup } from '@/types';

vi.mock('react-native-svg', () => {
  const stub = (name: string) => {
    const C = React.forwardRef((props: Record<string, unknown>, ref: React.Ref<unknown>) =>
      React.createElement('svg-stub', { ...props, 'data-stub': name, ref }, props.children as React.ReactNode),
    );
    C.displayName = name;
    return C;
  };
  return { __esModule: true, default: stub('Svg'), Svg: stub('Svg'),
    Path: stub('Path'), Rect: stub('Rect') };
});

import ShareJournalRecap from '../ShareJournalRecap';
import { buildRecapSegmentPaths, recapStatsScope } from '@/utils/scoring/boundarySeries';
import { computeRecapStats, computeRecapStatsSplit } from '@/utils/journalRecapStats';

const V0 = 'hydrostate-v0';
const V1 = 'hydrostate-v1.0';
const V11 = 'hydrostate-v1.1';

/** Mirrors the component's own geometry so path comparison is exact. */
const CARD_W = 360;
const CHART_W = CARD_W - 60;
const CHART_H = 110;
const PAD = { top: 8, right: 4, bottom: 8, left: 4 };
const INNER_W = CHART_W - PAD.left - PAD.right;
const INNER_H = CHART_H - PAD.top - PAD.bottom;

function rollup(i: number, modelVersions: string[]): JournalRollup {
  return {
    date: `2026-08-${String(i + 1).padStart(2, '0')}`,
    avgScore: 70 + (i % 15), minScore: 50, maxScore: 90, snapshotsCount: 4,
    endOzConsumed: 60 + i, endAforceUnits: i, endUnitsConsumed: 5,
    endSodiumDeliveredMg: 0, endSodiumLostMg: 0, endDeficitPct: 0,
    pctTimePeak: 0, pctTimeBalanced: 100, pctTimeRecovering: 0, pctTimeDepleted: 0,
    intakeCount: 3, autopilotSessions: 0, socialSessions: 0, modelVersions,
  } as unknown as JournalRollup;
}
const range = (spec: string[][]) => spec.map((vs, i) => rollup(i, vs));

let host: HTMLElement;
let root: Root;

function render(rollups: readonly JournalRollup[], rangeDays = 30) {
  root = createRoot(host);
  flushSync(() => root.render(
    React.createElement(ShareJournalRecap, { rollups, rangeDays }),
  ));
}

/** The `d` of every rendered trend path, in render order. */
function renderedPaths(): string[] {
  return Array.from(host.querySelectorAll('[data-stub="Path"]'))
    .map((p) => p.getAttribute('d') ?? '')
    .filter((d) => d.length > 0);
}

/** The value rendered under a given stat label, e.g. "DAYS". */
function statValue(label: string): string | null {
  const text = host.textContent ?? '';
  const m = new RegExp(`${label}[^0-9-]*(-?\\d+)`).exec(text);
  return m ? m[1]! : null;
}

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
});
afterEach(() => {
  flushSync(() => root?.unmount());
  host.remove();
});

describe('ShareJournalRecap — the shared segmentation DRIVES the render', () => {
  it('rendered paths are exactly what buildRecapSegmentPaths produced', () => {
    const rows = range([...Array.from({ length: 20 }, () => [V0]),
                        ...Array.from({ length: 10 }, () => [V1])]);
    render(rows);
    const expected = buildRecapSegmentPaths(rows, INNER_W, INNER_H, PAD);
    // Byte-equality, not a count: a local legacy bucketing that happened to
    // produce the same NUMBER of paths would still fail this.
    expect(renderedPaths()).toEqual(expected);
    expect(expected.length).toBe(2);            // ANTI-VACUITY: a real boundary
  });

  it('a model boundary is VISIBLE as two separate strokes', () => {
    render(range([...Array.from({ length: 15 }, () => [V0]),
                  ...Array.from({ length: 15 }, () => [V1])]));
    const paths = renderedPaths();
    expect(paths.length).toBe(2);
    // Each stroke must actually draw — a bare moveto renders nothing.
    for (const d of paths) expect(d, `must draw: ${d}`).toMatch(/L/);
    // and neither stroke may contain every day (that would be a rejoin)
    for (const d of paths) expect((d.match(/L/g) ?? []).length).toBeLessThan(29);
  });

  it('a ONE-DAY trailing segment renders a visible stroke', () => {
    // Rollout day 1: the shape that produced the original defect.
    render(range([...Array.from({ length: 29 }, () => [] as string[]), [V1]]));
    const paths = renderedPaths();
    expect(paths.length).toBe(2);
    const lone = paths[paths.length - 1]!;
    expect(lone, 'a one-day run must draw, not just move').toMatch(/L/);
  });

  it('a boundary-free range renders ONE unbroken stroke', () => {
    render(range(Array.from({ length: 30 }, () => [V1])));
    expect(renderedPaths().length).toBe(1);
  });

  it('an all-unstamped legacy range renders ONE unbroken stroke', () => {
    render(range(Array.from({ length: 30 }, () => [])));
    expect(renderedPaths().length).toBe(1);
  });
});

describe('ShareJournalRecap — the two populations reach the right tiles', () => {
  it('ROLLOUT DAY 1: DAYS is 30, not 1', () => {
    // 29 unstamped days + the first v1.0 day. The defect this replaces made
    // every tile inherit the single comparable row, so a card headed
    // "30-DAY TIMELINE" reported DAYS 1 / STREAK 1.
    const rows = range([...Array.from({ length: 29 }, () => [] as string[]), [V1]]);
    render(rows);
    expect(statValue('DAYS')).toBe('30');
    // and the score tile is computed from the comparable rows only
    const split = computeRecapStatsSplit(rows, recapStatsScope(rows));
    expect(statValue('AVG')).toBe(String(split.avgScore));
    // which is NOT the blended whole-range average
    expect(split.avgScore).not.toBe(computeRecapStats(rows).avgScore);
  });

  it('activity totals follow the FULL range, never the narrowed one', () => {
    // Fixture chosen so the narrowed population does NOT end on the last row.
    // `totalOunces`/`totalSticks` read the END-OF-WINDOW cumulative row, so
    // when the comparable run is TRAILING the two populations coincide and the
    // anti-vacuity check below would be satisfied for the wrong reason. Here
    // the v1 run is at the START, so narrowing would report 20-day-old totals.
    const rows = range([...Array.from({ length: 10 }, () => [V1]),
                        ...Array.from({ length: 20 }, () => [] as string[])]);
    render(rows);
    const whole = computeRecapStats(rows);
    expect(statValue('DAYS')).toBe(String(whole.daysTracked));
    expect(statValue('OUNCES')).toBe(String(whole.totalOunces));
    expect(statValue('STICKS')).toBe(String(whole.totalSticks));
    // ANTI-VACUITY: the narrowed population gives genuinely different totals.
    const narrowed = computeRecapStats(recapStatsScope(rows));
    expect(narrowed.daysTracked).not.toBe(whole.daysTracked);
    expect(narrowed.totalOunces).not.toBe(whole.totalOunces);
  });

  it('score tiles never blend across an incomparable boundary', () => {
    const rows = range([...Array.from({ length: 20 }, () => [V0]),
                        ...Array.from({ length: 10 }, () => [V1])]);
    render(rows);
    const scoped = computeRecapStats(recapStatsScope(rows));
    expect(statValue('AVG')).toBe(String(scoped.avgScore));
    expect(statValue('PEAK AVG')).toBe(String(scoped.peakScore));
    expect(statValue('STREAK')).toBe(String(scoped.bestStreak));
  });

  it('v1.0 and v1.1 are ONE score population but TWO visual runs', () => {
    // Comparability and visual continuity are separate contracts (founder
    // ruling): same-major versions are statistically comparable, and the render
    // still seams them so nothing implies an identical measurement.
    const rows = range([...Array.from({ length: 15 }, () => [V1]),
                        ...Array.from({ length: 15 }, () => [V11])]);
    render(rows);
    expect(renderedPaths().length).toBe(2);              // two visual runs
    expect(recapStatsScope(rows).length).toBe(30);       // one score population
    expect(statValue('DAYS')).toBe('30');
  });
});
