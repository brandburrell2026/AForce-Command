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
import { buildRecapSegmentPaths, recapStatsScope, classifyRecapProvenance, statsDayVersion } from '@/utils/scoring/boundarySeries';
import { computeRecapStats } from '@/utils/journalRecapStats';

/** A path must have VISIBLE LENGTH — a draw command alone is not the contract. */
function expectNonZeroLength(d: string): void {
  const xs = [...d.matchAll(/[MLC]([\d.]+),/g)].map((m) => Number(m[1]));
  expect(xs.length, `two endpoints expected: ${d}`).toBeGreaterThanOrEqual(2);
  expect(Math.abs(xs[xs.length - 1]! - xs[0]!), `zero-length stroke: ${d}`)
    .toBeGreaterThan(0);
}

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

function rollup(i: number, modelVersions: (string | null)[]): JournalRollup {
  return {
    date: `2026-08-${String(i + 1).padStart(2, '0')}`,
    avgScore: 70 + (i % 15), minScore: 50, maxScore: 90, snapshotsCount: 4,
    endOzConsumed: 60 + i, endAforceUnits: i, endUnitsConsumed: 5,
    endSodiumDeliveredMg: 0, endSodiumLostMg: 0, endDeficitPct: 0,
    pctTimePeak: 0, pctTimeBalanced: 100, pctTimeRecovering: 0, pctTimeDepleted: 0,
    intakeCount: 3, autopilotSessions: 0, socialSessions: 0, modelVersions,
  } as unknown as JournalRollup;
}
const range = (spec: (string | null)[][]) => spec.map((vs, i) => rollup(i, vs));
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
  // Anchored on the tile, NOT on the first occurrence of the word in the card.
  // The qualifier "…COMPARABLE DAYS" contains "DAYS", so a text-wide search for
  // `DAYS` silently read the AVG tile's number on any fixture that renders a
  // plural qualifier — a latent way for these laws to assert the wrong number.
  const tiles = Array.from(host.querySelectorAll('div, span, [data-testid]'));
  for (const el of tiles) {
    const t = el.textContent ?? '';
    if (!t.startsWith(label)) continue;
    const rest = t.slice(label.length);
    const m = /^\s*(—|-?\d+)/.exec(rest);
    if (m) return m[1] === '—' ? null : m[1]!;
  }
  return null;
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
    for (const d of paths) {
      expect(d, `must draw: ${d}`).toMatch(/L/);
      expectNonZeroLength(d);
    }
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
    expectNonZeroLength(lone);   // `M x,y L x,y` has an L and draws nothing
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
    // BEHAVIOURAL, not a regex that can never match: the tile must render the
    // unavailable state, so `statValue` (which returns null for '—') is null.
    expect(statValue('STREAK'), 'STREAK tile must be unavailable').toBeNull();
  });

  it('ALL-UNSTAMPED legacy history keeps its real streak — no NEW MODEL PERIOD', () => {
    // THE MODAL CASE. `hydrostate_model_version` is nullable with no backfill,
    // so every member's history is entirely unstamped until v1.0 lands. An
    // earlier gate asked `spansModelBoundary`, which is true for an all-null
    // array, and printed "NEW MODEL PERIOD" over a range containing no model
    // version at all — while the scoring population said the opposite.
    render(range(Array.from({ length: 30 }, () => [])));
    expect(host.querySelector('[data-testid="recap-streak-unavailable"]')).toBeNull();
    expect(host.textContent).not.toMatch(/NEW MODEL PERIOD/);
    expect(host.textContent).not.toMatch(/COMPARABLE DAY/);
    expect(Number(statValue('STREAK'))).toBe(30);
  });

  it('a same-day v1.0 + v1.1 range keeps its streak (D4 at the card level)', () => {
    // Every day carries BOTH comparable versions. The day is a full member of
    // the score population, so the streak stands. Pins the gate against being
    // re-derived from the render predicate, which would suppress it.
    render(range(Array.from({ length: 30 }, () => [V1, V11])));
    expect(host.querySelector('[data-testid="recap-streak-unavailable"]')).toBeNull();
    expect(Number(statValue('STREAK'))).toBe(30);
  });

  it('SUPPRESSED ⟺ NARROWED — the two signals can never disagree', () => {
    // The invariant the regression violated: the card must not call a range
    // incomparable for the streak while treating it as whole for AVG/PEAK.
    for (const spec of [
      Array.from({ length: 30 }, () => [] as string[]),
      Array.from({ length: 30 }, () => [V1]),
      [...Array.from({ length: 29 }, () => [] as string[]), [V1]],
      [...Array.from({ length: 20 }, () => [V0]), ...Array.from({ length: 10 }, () => [V1])],
      Array.from({ length: 30 }, () => [V1, V11]),
      // THE DISTINGUISHING SHAPE: render segmentation says TWO runs (exact
      // identity) while the score population says ONE (comparability). A gate
      // derived from the render predicate suppresses the streak here and is
      // wrong; only a population-derived gate gets it right.
      [...Array.from({ length: 15 }, () => [V1]), ...Array.from({ length: 15 }, () => [V11])],
    ]) {
      flushSync(() => root?.unmount());
      host = document.createElement('div'); document.body.appendChild(host);
      const rows = range(spec);
      render(rows);
      const suppressed = host.querySelector('[data-testid="recap-streak-unavailable"]') !== null;
      const narrowed = recapStatsScope(rows).length !== rows.length;
      expect(suppressed, `suppressed must equal narrowed for ${JSON.stringify(spec[0])}…`)
        .toBe(narrowed);
      const qualifier = host.textContent?.includes('COMPARABLE DAY') ?? false;
      expect(qualifier, 'qualifier must equal narrowed').toBe(narrowed);
    }
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

/* ═════════ D3A — four semantic states, never one boolean ═════════
 *
 * Unknown provenance is not known comparability. `recapStatsScope` returns the
 * full range BOTH when every day is proven comparable and when no day's
 * provenance can be established, and those states owe the member different
 * words — one of them must not borrow the other's silence, and neither may
 * assert a model transition that is not known to have happened.
 */
describe('D3A — qualifier classification', () => {
  const CASES: Array<[string, string[][], {
    qualifier: RegExp | null; streakNote: RegExp | null; streakShown: boolean;
    aggregatesSuppressed?: boolean;
  }]> = [
    ['all unstamped', Array.from({ length: 30 }, () => []),
      { qualifier: /MODEL HISTORY UNAVAILABLE/, streakNote: null, streakShown: true }],
    ['all v1', Array.from({ length: 30 }, () => [V1]),
      { qualifier: null, streakNote: null, streakShown: true }],
    ['v0 → v1', [...Array.from({ length: 20 }, () => [V0]), ...Array.from({ length: 10 }, () => [V1])],
      { qualifier: /10 COMPARABLE DAYS/, streakNote: /NEW MODEL PERIOD/, streakShown: false }],
    ['v1.0 → v1.1', [...Array.from({ length: 15 }, () => [V1]), ...Array.from({ length: 15 }, () => [V11])],
      { qualifier: null, streakNote: null, streakShown: true }],
    ['known + trailing unstamped', [...Array.from({ length: 29 }, () => [V1]), []],
      { qualifier: /29 COMPARABLE DAYS/, streakNote: /MODEL HISTORY UNAVAILABLE/, streakShown: false }],
    ['known + leading unstamped', [[], ...Array.from({ length: 29 }, () => [V1])],
      { qualifier: /29 COMPARABLE DAYS/, streakNote: /MODEL HISTORY UNAVAILABLE/, streakShown: false }],
    ['same-day mixed [v1.0, v1.1]', Array.from({ length: 30 }, () => [V1, V11]),
      { qualifier: null, streakNote: null, streakShown: true }],
    // FIFTH STATE. Every day is fully RECORDED as [v0, v1.0] — nothing is
    // unknown. Each day's own avgScore is already a v0+v1 blend, so no
    // comparable subset exists and every aggregate must be suppressed rather
    // than published. It must never wear provenance_unknown's words.
    ['entirely recorded-incompatible [v0, v1]', Array.from({ length: 30 }, () => [V0, V1]),
      { qualifier: /MODEL VERSIONS NOT COMPARABLE/, streakNote: /NEW MODEL PERIOD/,
        streakShown: false, aggregatesSuppressed: true }],
    // THE LITERAL ROLLOUT DAY. The server accumulates a day's snapshot versions
    // into one Set, so the deploy day is ['v0','v1.0'] for anyone who logged on
    // both sides of it. Both versions are RECORDED — nothing about this day is
    // unknown — so the transition notice is exactly what it must show. Reading
    // the evidence from the collapsed day-version erased both stamps and said
    // MODEL HISTORY UNAVAILABLE instead.
    ['rollout day: 6× v0 then [v0, v1.0]',
      [...Array.from({ length: 6 }, () => [V0]), [V0, V1]],
      { qualifier: /6 COMPARABLE DAYS/, streakNote: /NEW MODEL PERIOD/, streakShown: false }],
    // ...and the same day at the START of the window, where the transition is
    // likewise present only inside the mixed day.
    ['rollout day first: [v0, v1.0] then v1.0',
      [[V0, V1], ...Array.from({ length: 6 }, () => [V1])],
      { qualifier: /6 COMPARABLE DAYS/, streakNote: /NEW MODEL PERIOD/, streakShown: false }],
    // A same-major straddle is NOT a transition — it must not borrow C's words.
    ['same-major straddle [v1.0, v1.1]',
      [[V1], [V1, V11], [V11]],
      { qualifier: null, streakNote: null, streakShown: true }],
  ];

  for (const [label, spec, want] of CASES) {
    it(`${label}: qualifier and streak note are the RIGHT ones`, () => {
      render(range(spec));
      const txt = host.textContent ?? '';

      if (want.qualifier) expect(txt, 'qualifier').toMatch(want.qualifier);
      else expect(txt, 'no qualifier expected').not.toMatch(/HYDROSTATE ·/);

      // A false transition claim is the specific harm: never say NEW MODEL
      // PERIOD unless a transition between two KNOWN versions is present.
      if (want.streakNote?.source.includes('NEW MODEL')) {
        expect(txt).toMatch(/NEW MODEL PERIOD/);
      } else {
        expect(txt, 'must not claim an unproven model transition')
          .not.toMatch(/NEW MODEL PERIOD/);
      }
      if (want.streakNote) expect(txt, 'streak note').toMatch(want.streakNote);

      if (want.streakShown) {
        expect(host.querySelector('[data-testid="recap-streak-unavailable"]')).toBeNull();
        expect(Number(statValue('STREAK'))).toBeGreaterThan(0);
      } else {
        expect(host.querySelector('[data-testid="recap-streak-unavailable"]')).not.toBeNull();
      }

      // An empty comparable population must SUPPRESS aggregates, never print 0.
      if (want.aggregatesSuppressed) {
        expect(statValue('AVG'), 'AVG must be suppressed').toBeNull();
        expect(statValue('PEAK AVG'), 'PEAK must be suppressed').toBeNull();
        expect(txt, 'never a fabricated zero').not.toMatch(/AVG\s*0\b/);
        expect(recapStatsScope(range(spec)).length).toBe(0);
      } else {
        expect(statValue('AVG'), 'AVG must render').not.toBeNull();
      }
      // `MODEL HISTORY UNAVAILABLE` is reserved for genuinely missing evidence.
      if (/MODEL VERSIONS NOT COMPARABLE/.test(txt)) {
        expect(txt).not.toMatch(/MODEL HISTORY UNAVAILABLE/);
      }
      // 'N COMPARABLE DAYS' may only appear when comparability was DECIDED.
      if (/COMPARABLE DAY/.test(txt)) {
        const p = classifyRecapProvenance(range(spec));
        expect(p.kind).toBe('partially_comparable');
      }
    });
  }

  it('N COMPARABLE DAYS is never claimed over UNKNOWN days', () => {
    // The control that exposes it: 20 unstamped days alone correctly say
    // MODEL HISTORY UNAVAILABLE. Add ONE recorded-incompatible day — which is
    // then EXCLUDED from the population — and the very same 20 unknown days
    // used to flip to "20 COMPARABLE DAYS". Comparability had been decided for
    // none of them; `isComparableModelVersion(null, null)` is false by design.
    const unknownOnly = range(Array.from({ length: 20 }, () => []));
    const plusDeployDay = range([...Array.from({ length: 20 }, () => []), [V0, V1]]);

    render(unknownOnly);
    expect(host.textContent).toMatch(/MODEL HISTORY UNAVAILABLE/);
    expect(host.textContent).not.toMatch(/COMPARABLE DAY/);

    flushSync(() => root.unmount());
    host = document.createElement('div'); document.body.appendChild(host);
    render(plusDeployDay);
    // The population is still entirely unknown, so the claim must not appear.
    expect(recapStatsScope(plusDeployDay).every((r) => statsDayVersion(r) == null)).toBe(true);
    expect(host.textContent, 'must not claim comparability over unknown days')
      .not.toMatch(/COMPARABLE DAY/);
    expect(host.textContent).toMatch(/MODEL HISTORY UNAVAILABLE/);
    // ...but the transition IS recorded, so it is still announced.
    expect(host.textContent).toMatch(/NEW MODEL PERIOD/);
  });

  it('every COMPARABLE DAYS claim is backed by known-version days', () => {
    // Swept: wherever the qualifier appears, every counted day must have a
    // known version. A claim about comparability requires decided evidence.
    for (const spec of [
      [...Array.from({ length: 20 }, () => [V0]), ...Array.from({ length: 10 }, () => [V1])],
      [...Array.from({ length: 6 }, () => [V0]), [V0, V1]],
      [...Array.from({ length: 29 }, () => [V1]), []],
      [...Array.from({ length: 20 }, () => [] as string[]), [V0, V1]],
      Array.from({ length: 10 }, () => [V0, V1]),
    ]) {
      flushSync(() => root?.unmount());
      host = document.createElement('div'); document.body.appendChild(host);
      const rows = range(spec);
      render(rows);
      if (/COMPARABLE DAY/.test(host.textContent ?? '')) {
        const scope = recapStatsScope(rows);
        expect(scope.length).toBeGreaterThan(0);
        for (const r of scope) {
          expect(statsDayVersion(r), 'counted day must have a known version').not.toBeNull();
        }
      }
    }
  });

  it('the four states are genuinely distinct — no two collapse', () => {
    const kinds = CASES.map(([, spec]) => {
      const p = classifyRecapProvenance(range(spec));
      return p.kind === 'partially_comparable'
        ? `partial:${p.knownTransition ? 'transition' : 'unknown'}` : p.kind;
    });
    // ANTI-VACUITY: all four semantic states must actually occur above, or the
    // table proves nothing about the classifier's ability to tell them apart.
    expect(new Set(kinds)).toEqual(new Set([
      'provenance_unknown', 'fully_comparable',
      'partial:transition', 'partial:unknown', 'recorded_incompatible',
    ]));
  });
});
