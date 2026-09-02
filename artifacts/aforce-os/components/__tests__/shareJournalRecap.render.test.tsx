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
import { computeRecapStats } from '@/utils/journalRecapStats';

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
/** Explicit per-day scores — required whenever a law must prove the scored and
 *  whole-range populations genuinely DIFFER. With the default score curve they
 *  can coincide, and an assertion that compares them then passes either way. */
const rangeScored = (spec: Array<[string[], number]>) =>
  spec.map(([vs, score], i) => ({ ...rollup(i, vs), avgScore: score, maxScore: score }));

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

describe('ShareJournalRecap — the card only shows what it can support', () => {
  it('ROLLOUT DAY 1: DAYS is 30, and the 1-day scoring population is DISCLOSED', () => {
    const rows = range([...Array.from({ length: 29 }, () => [] as string[]), [V1]]);
    render(rows);
    expect(statValue('DAYS')).toBe('30');
    // D3 — the smaller scoring population may not be silent.
    expect(host.textContent).toMatch(/HYDROSTATE · 1 COMPARABLE DAY/);
    expect(host.querySelector('[data-testid="recap-comparable-days"]')).not.toBeNull();
  });

  it('the disclosure pluralises and is ABSENT when every day is comparable', () => {
    render(range([...Array.from({ length: 20 }, () => [V0]),
                  ...Array.from({ length: 10 }, () => [V1])]));
    expect(host.textContent).toMatch(/HYDROSTATE · 10 COMPARABLE DAYS/);
    flushSync(() => root.unmount());
    host = document.createElement('div');
    document.body.appendChild(host);
    render(range(Array.from({ length: 30 }, () => [V1])));
    // ANTI-VACUITY: a wholly comparable range must NOT carry the qualifier.
    expect(host.textContent).not.toMatch(/COMPARABLE DAY/);
  });

  it('D2 — a cross-model range renders the STREAK as unavailable, not as 1', () => {
    const rows = range([...Array.from({ length: 29 }, () => [V0]), [V1]]);
    render(rows);
    expect(host.querySelector('[data-testid="recap-streak-unavailable"]')).not.toBeNull();
    expect(host.textContent).toMatch(/NEW MODEL PERIOD/);
    // and the tile itself must not print a collapsed number
    expect(host.textContent).not.toMatch(/STREAK[^0-9]*1\b/);
  });

  it('D2 — a wholly comparable range still renders a real streak', () => {
    // ANTI-VACUITY for the law above: suppression must not be unconditional.
    render(range(Array.from({ length: 30 }, () => [V1])));
    expect(host.querySelector('[data-testid="recap-streak-unavailable"]')).toBeNull();
    expect(statValue('STREAK')).not.toBeNull();
    expect(Number(statValue('STREAK'))).toBeGreaterThan(1);
  });

  it('OUNCES and STICKS render the unavailable state, never a number', () => {
    for (const rows of [
      range(Array.from({ length: 30 }, () => [V1])),
      range([...Array.from({ length: 29 }, () => [] as string[]), [V1]]),
    ]) {
      flushSync(() => root?.unmount());
      host = document.createElement('div'); document.body.appendChild(host);
      render(rows);
      const txt = host.textContent ?? '';
      expect(txt).toMatch(/OUNCES\s*—/);
      expect(txt).toMatch(/STICKS\s*—/);
      // the card must not print ANY digit against those labels
      expect(statValue('OUNCES')).toBeNull();
      expect(statValue('STICKS')).toBeNull();
    }
  });

  it('score tiles never blend across an incomparable boundary', () => {
    // The v0 run scores HIGH and the v1 run LOW on purpose, so the scored and
    // whole-range figures cannot coincide. With the default curve they did
    // (84 === 84), and the law passed whichever population the component used —
    // which is precisely how `peakScore` went unpinned.
    const rows = rangeScored([
      ...Array.from({ length: 20 }, () => [[V0], 95] as [string[], number]),
      ...Array.from({ length: 10 }, () => [[V1], 61] as [string[], number]),
    ]);
    render(rows);
    const scoped = computeRecapStats(recapStatsScope(rows));
    const whole = computeRecapStats(rows);
    // ANTI-VACUITY FIRST: prove the populations differ before asserting which.
    expect(scoped.avgScore).not.toBe(whole.avgScore);
    expect(scoped.peakScore).not.toBe(whole.peakScore);
    expect(statValue('AVG')).toBe(String(scoped.avgScore));
    expect(statValue('PEAK AVG')).toBe(String(scoped.peakScore));
  });

  it('v1.0 and v1.1 are ONE score population but TWO visual runs', () => {
    const rows = range([...Array.from({ length: 15 }, () => [V1]),
                        ...Array.from({ length: 15 }, () => [V11])]);
    render(rows);
    expect(renderedPaths().length).toBe(2);
    expect(recapStatsScope(rows).length).toBe(30);
    expect(statValue('DAYS')).toBe('30');
    expect(host.textContent).not.toMatch(/COMPARABLE DAY/);   // nothing to disclose
  });
});
