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
import { classifyStreakEligibility } from '@/utils/scoring/boundarySeries';
import { deriveJournalShareContext, toShareRouteParams } from '@/services/journalShareContext';

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

/**
 * OBSERVATION IS EXPLICIT, and the fixture is TYPE-CHECKED.
 *
 * This factory used to hardcode `snapshotsCount: 4` behind an
 * `as unknown as JournalRollup` cast. Both were load-bearing defects: the cast
 * meant the compiler never confirmed the fixture was a production row, and the
 * hardcoded count meant the server's real intake-without-snapshot row was
 * UNCONSTRUCTIBLE here — so no render law in this file could reach the
 * observation seam, and the streak-denominator defect shipped under 36 green
 * laws. `snapshotsCount` is now a parameter and the cast is gone.
 */
function rollup(
  i: number,
  modelVersions: (string | null)[],
  snapshotsCount = 4,
): JournalRollup {
  return {
    date: `2026-08-${String(i + 1).padStart(2, '0')}`,
    avgScore: 70 + (i % 15), minScore: 50, maxScore: 90, snapshotsCount,
    endOzConsumed: 60 + i, endAforceUnits: i, endUnitsConsumed: 5,
    endSodiumDelivered: 0, endSodiumLost: 0, endDeficitPct: 0,
    pctTimePeak: 0, pctTimeBalanced: 100, pctTimeRecovering: 0, pctTimeDepleted: 0,
    intakeCount: 3, autopilotSessions: 0, socialSessions: 0, modelVersions,
  };
}

/**
 * Field-for-field what `routes/aforce/journal.ts` emits for a day with logged
 * intakes and no captured snapshot: `snapshotsCount: 0`, every score field at
 * the sentinel zero, no version stamps — and REAL activity (`intakeCount`,
 * `endOzConsumed`) carried over from the factory, because that activity is
 * exactly what makes the row a member's real day rather than an empty one.
 */
function scorelessAt(i: number): JournalRollup {
  return {
    ...rollup(i, [], 0),
    avgScore: 0, minScore: 0, maxScore: 0,
    pctTimePeak: 0, pctTimeBalanced: 0, pctTimeRecovering: 0, pctTimeDepleted: 0,
  };
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

/** Tear down and re-create the host so one `it` can render several fixtures. */
function remount(): void {
  flushSync(() => root?.unmount());
  host.remove();
  host = document.createElement('div');
  document.body.appendChild(host);
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

  it('SUPPRESSED ⟺ UNCOVERED OR NARROWED — the signals can never disagree', () => {
    // The invariant the regression violated: the card must not call a range
    // incomparable for the streak while treating it as whole for AVG/PEAK.
    //
    // RESTATED for the observation seam. Suppression now has TWO causes, and
    // the earlier one-sided form — `scope.length !== rollups.length` — was the
    // defect itself written as a law: it measured narrowing against the
    // reporting range, so it agreed with the buggy gate on every fixture and
    // could never have caught it. Both denominators are computed here from the
    // raw wire field, INDEPENDENTLY of the helper the implementation uses, so
    // this is an oracle rather than a mirror.
    let sawNarrowed = false;
    let sawUncovered = false;
    for (const [label, rows] of [
      ['all unstamped', range(Array.from({ length: 30 }, () => []))],
      ['all v1', range(Array.from({ length: 30 }, () => [V1]))],
      ['29 unstamped + 1 v1', range([...Array.from({ length: 29 }, () => [] as string[]), [V1]])],
      ['v0 -> v1', range([...Array.from({ length: 20 }, () => [V0]),
                          ...Array.from({ length: 10 }, () => [V1])])],
      ['same-day [v1.0, v1.1]', range(Array.from({ length: 30 }, () => [V1, V11]))],
      // THE COMPARABILITY-vs-RENDER SHAPE: render segmentation says TWO runs
      // (exact identity) while the score population says ONE (comparability). A
      // gate derived from the render predicate suppresses the streak here and
      // is wrong; only a population-derived gate gets it right.
      ['v1.0 -> v1.1', range([...Array.from({ length: 15 }, () => [V1]),
                              ...Array.from({ length: 15 }, () => [V11])])],
      // THE COVERAGE SHAPES the old form could not distinguish. Fully
      // comparable, so nothing narrowed against the OBSERVED population — the
      // suppression here is coverage and nothing else.
      ['v1 with a middle gap', (() => {
        const r = range(Array.from({ length: 30 }, () => [V1])); r[14] = scorelessAt(14); return r;
      })()],
      ['unstamped with a leading gap', (() => {
        const r = range(Array.from({ length: 30 }, () => [])); r[0] = scorelessAt(0); return r;
      })()],
      ['gap AND a real transition', (() => {
        const r = range([...Array.from({ length: 20 }, () => [V0]),
                         ...Array.from({ length: 10 }, () => [V1])]);
        r[25] = scorelessAt(25); return r;
      })()],
    ] as Array<[string, JournalRollup[]]>) {
      remount();
      render(rows);
      const suppressed = host.querySelector('[data-testid="recap-streak-unavailable"]') !== null;
      const observed = rows.filter((r) => r.snapshotsCount > 0);
      const uncovered = observed.length !== rows.length;
      const narrowed = recapStatsScope(rows).length !== observed.length;
      sawNarrowed ||= narrowed;
      sawUncovered ||= uncovered;
      expect(suppressed, `${label}: suppressed ⟺ uncovered OR narrowed`)
        .toBe(uncovered || narrowed);
      // A comparability CLAIM still requires comparability to have narrowed;
      // missing coverage is not evidence about any model.
      const qualifier = host.textContent?.includes('COMPARABLE DAY') ?? false;
      if (qualifier) {
        expect(narrowed, `${label}: "N COMPARABLE DAYS" requires real narrowing`).toBe(true);
      }
    }
    // ANTI-VACUITY: both causes must actually occur, or the disjunction above
    // proves only that one of them works.
    expect(sawNarrowed, 'the sweep must contain a narrowed range').toBe(true);
    expect(sawUncovered, 'the sweep must contain an uncovered range').toBe(true);
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
    // SUPERSEDED (founder ruling §8, 2026-09-02): this used to expect the
    // streak note `NEW MODEL PERIOD`. `recorded_incompatible` is only ever
    // returned WITH a known transition, so testing `knownTransition` before
    // `kind` made the `MODEL VERSIONS NOT COMPARABLE` arm dead code and the
    // card printed TWO different names for one state on one export. The
    // transition is how we know the versions are incomparable; it is not what
    // to call the state.
    ['entirely recorded-incompatible [v0, v1]', Array.from({ length: 30 }, () => [V0, V1]),
      { qualifier: /MODEL VERSIONS NOT COMPARABLE/, streakNote: /MODEL VERSIONS NOT COMPARABLE/,
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

/* ═══════ LOCKED WORDING TAXONOMY (founder ruling 3) ═══════
 * These four states may never substitute for one another.
 */
describe('wording taxonomy — locked', () => {
  const TAXONOMY: Array<[string, (string | null)[][], {
    shows: RegExp | null; forbids: RegExp[];
  }]> = [
    ['no data at all', [],
      { shows: null, forbids: [/MODEL HISTORY UNAVAILABLE/, /NOT COMPARABLE/, /COMPARABLE DAY/, /NEW MODEL PERIOD/] }],
    ['unrecorded provenance', Array.from({ length: 10 }, () => []),
      { shows: /MODEL HISTORY UNAVAILABLE/, forbids: [/NOT COMPARABLE/] }],
    ['recorded incompatible', Array.from({ length: 10 }, () => [V0, V1]),
      { shows: /MODEL VERSIONS NOT COMPARABLE/, forbids: [/MODEL HISTORY UNAVAILABLE/] }],
    ['known transition, usable subset',
      [...Array.from({ length: 6 }, () => [V0]), ...Array.from({ length: 4 }, () => [V1])],
      { shows: /COMPARABLE DAYS/, forbids: [/NOT COMPARABLE/] }],
    // Missing provenance may NOT wear the incompatible wording, even though the
    // day is unusable: only ONE known version was ever recorded here.
    ['known + null only (missing, not incompatible)',
      Array.from({ length: 10 }, () => [null, V1]),
      { shows: /MODEL HISTORY UNAVAILABLE/, forbids: [/NOT COMPARABLE/] }],
  ];

  for (const [label, spec, want] of TAXONOMY) {
    it(`${label}: says the right thing and only that`, () => {
      render(range(spec));
      const txt = host.textContent ?? '';
      if (want.shows) expect(txt, 'expected wording').toMatch(want.shows);
      for (const f of want.forbids) {
        expect(txt, `must not say ${f}`).not.toMatch(f);
      }
    });
  }

  it('an EMPTY range carries no provenance qualifier at all', () => {
    render([]);
    expect(host.textContent).toMatch(/No data yet/);
    expect(host.querySelector('[data-testid="recap-streak-unavailable"]')).toBeNull();
    expect(host.querySelector('[data-testid="recap-model-history-unavailable"]')).toBeNull();
  });

  it('an N-of-M population is NEVER silent, even when provenance is unknown', () => {
    // Ruling B. The survivors are unrecorded, so they are not called
    // "comparable" — but the count is disclosed rather than dropped.
    const rows = range([...Array.from({ length: 20 }, () => []), [V0, V1]]);
    render(rows);
    const scope = recapStatsScope(rows);
    expect(scope.length).toBeLessThan(rows.length);      // ANTI-VACUITY
    expect(host.textContent).toMatch(/MODEL HISTORY UNAVAILABLE/);
    expect(host.textContent, 'the count must appear')
      .toMatch(new RegExp(`${scope.length} OF ${rows.length} DAYS`));
    expect(host.textContent, 'unrecorded days are not "comparable"')
      .not.toMatch(/COMPARABLE DAY/);
  });
});

/* ═══════ STREAK — OBSERVATION COVERAGE vs MODEL COMPARABILITY ═══════
 *
 * FOUNDER RULING, 2026-09-02. A missing HydroState observation makes a
 * HydroState-derived streak UNKNOWABLE across that gap. So the card may not:
 *   - treat the day as score 0
 *   - break the run and imply the member failed
 *   - skip the day and claim continuous qualification nobody observed
 * It suppresses the streak for the window and gives the REAL reason.
 *
 * THREE CAUSES, THREE ANSWERS, never one explanation:
 *   missing observation    -> continuity cannot be established
 *   incomparable models    -> scores are not comparable
 *   complete + comparable  -> compute the real streak
 *
 * WHY THESE LAWS EXIST. The component gated the streak on
 * `statsScope.length === rollups.length` while `recapStatsScope` and
 * `classifyRecapProvenance` had already moved to the OBSERVED denominator. One
 * boolean answered two questions, so a single missed sync either deleted a real
 * streak in SILENCE (a fully-stamped month: no qualifier, no note, STREAK —) or
 * blamed the MODEL for it (an unstamped month: "MODEL HISTORY UNAVAILABLE").
 * Both survived 36 render laws, because every fixture in this file hardcoded
 * `snapshotsCount: 4` and could not build the row that triggers it.
 *
 * Note the shape of the trap: the shipped gate produces the SAME suppressed
 * VALUE on these fixtures. Only the REASON differs. A law that asserts the
 * number alone cannot see this defect, so every law below asserts the reason.
 */
describe('STREAK — coverage and comparability are different causes', () => {
  const clean = (n = 30, vs: (string | null)[] = [V1]) =>
    range(Array.from({ length: n }, () => vs));
  const gapAt = (rows: JournalRollup[], ...idxs: number[]) => {
    const copy = [...rows];
    for (const i of idxs) copy[i] = scorelessAt(i);
    return copy;
  };
  /** The rendered streak note, or null when the card says nothing. */
  const streakNote = () =>
    host.querySelector('[data-testid="recap-streak-unavailable"]')?.textContent ?? null;
  const MODEL_WORDS = /MODEL HISTORY UNAVAILABLE|NEW MODEL PERIOD|VERSIONS NOT COMPARABLE/;

  it('1 — 30 observed qualifying days render the REAL streak, with no note', () => {
    render(clean());
    expect(Number(statValue('STREAK'))).toBe(30);
    expect(streakNote(), 'nothing to explain').toBeNull();
    expect(host.textContent, 'no coverage note when coverage is complete')
      .not.toMatch(/DAYS MEASURED/);
  });

  it('2 — ONE middle scoreless day suppresses the streak and names COVERAGE', () => {
    const rows = gapAt(clean(), 14);
    render(rows);
    expect(statValue('STREAK'), 'unknowable, not zero and not broken').toBeNull();
    expect(streakNote()).toBe('HYDROSTATE · 29 OF 30 DAYS MEASURED');
    // The cause is missing observation. Blaming the model would be a false
    // claim about the member's history, which is the harm that shipped.
    expect(host.textContent, 'must not blame the model').not.toMatch(MODEL_WORDS);
    // The member's participation is untouched: the range is still reported whole.
    expect(statValue('DAYS')).toBe('30');
  });

  it('3 — the missing day carries REAL intake: still unavailable, never a failure', () => {
    const rows = gapAt(clean(), 14);
    // ANTI-VACUITY: this is the server's intake-without-snapshot row, not an
    // empty day. The member drank; the phone did not capture a score.
    expect(rows[14]!.snapshotsCount).toBe(0);
    expect(rows[14]!.intakeCount).toBeGreaterThan(0);
    expect(rows[14]!.endOzConsumed).toBeGreaterThan(0);
    render(rows);
    expect(statValue('STREAK')).toBeNull();
    // THE FORBIDDEN ALTERNATIVE, PROVEN TO EXIST: dropping the day and walking
    // the remainder yields a real, smaller number — 15 — and rendering it would
    // tell the member they broke a streak they did not break.
    const broken = computeRecapStats(recapStatsScope(rows)).bestStreak;
    expect(broken, 'the misleading number is genuinely reachable').toBeLessThan(30);
    expect(statValue('STREAK'), 'and must not be shown').not.toBe(String(broken));
    expect(streakNote()).toMatch(/29 OF 30 DAYS MEASURED/);
  });

  it('4·5·6 — first, last, and several consecutive scoreless days', () => {
    for (const [label, idxs, measured] of [
      ['first', [0], 29],
      ['last', [29], 29],
      ['three consecutive', [10, 11, 12], 27],
    ] as Array<[string, number[], number]>) {
      remount();
      render(gapAt(clean(), ...idxs));
      expect(statValue('STREAK'), `${label}: suppressed`).toBeNull();
      expect(streakNote(), `${label}: names coverage`)
        .toBe(`HYDROSTATE · ${measured} OF 30 DAYS MEASURED`);
      expect(statValue('DAYS'), `${label}: range intact`).toBe('30');
      expect(host.textContent, `${label}: not the model`).not.toMatch(MODEL_WORDS);
    }
  });

  it('7 — a MEASURED zero is a measurement: the streak is COMPUTED, not suppressed', () => {
    const rows = clean();
    // Observed (snapshotsCount 4) and genuinely zero — the member was measured
    // and scored 0. That is data, and it must behave nothing like an absence.
    rows[14] = { ...rows[14]!, avgScore: 0, minScore: 0, maxScore: 0 };
    render(rows);
    expect(rows[14]!.snapshotsCount).toBe(4);       // ANTI-VACUITY: observed
    expect(streakNote(), 'a measured zero is not missing coverage').toBeNull();
    expect(host.textContent).not.toMatch(/DAYS MEASURED/);
    const shown = Number(statValue('STREAK'));
    expect(shown, 'a real streak is published').toBeGreaterThan(0);
    expect(shown, 'and the measured zero really did break the run').toBeLessThan(30);
  });

  it('8 — fully-known v1 history + a missing observation is NOT model uncertainty', () => {
    const rows = gapAt(clean(30, [V1]), 14);
    render(rows);
    // The provenance of every OBSERVED day is known and comparable...
    expect(classifyRecapProvenance(rows).kind).toBe('fully_comparable');
    // ...so no model wording may appear anywhere on the card.
    expect(host.textContent).not.toMatch(/MODEL HISTORY UNAVAILABLE/);
    expect(host.querySelector('[data-testid="recap-model-history-unavailable"]')).toBeNull();
    expect(host.querySelector('[data-testid="recap-comparable-days"]')).toBeNull();
    // The one thing that IS true gets said.
    expect(streakNote()).toBe('HYDROSTATE · 29 OF 30 DAYS MEASURED');
  });

  it('9 — unrecorded provenance keeps its qualifier; coverage is a SEPARATE line', () => {
    const rows = gapAt(clean(30, []), 14);
    render(rows);
    // The provenance qualifier is about the SCORE POPULATION and is retained...
    expect(host.querySelector('[data-testid="recap-model-history-unavailable"]')).not.toBeNull();
    // ...while the STREAK's reason is coverage. Two questions, two lines.
    expect(streakNote()).toBe('HYDROSTATE · 29 OF 30 DAYS MEASURED');
    expect(statValue('STREAK')).toBeNull();

    // CONTROL: the identical range WITHOUT the gap keeps the same qualifier and
    // its real streak — proving the qualifier tracks provenance only, and that
    // the streak was not suppressed by the unrecorded versions.
    remount();
    render(clean(30, []));
    expect(host.querySelector('[data-testid="recap-model-history-unavailable"]')).not.toBeNull();
    expect(Number(statValue('STREAK'))).toBe(30);
    expect(streakNote()).toBeNull();
  });

  it('an INCOMPARABLE model period still says so — coverage did not replace it', () => {
    // ANTI-VACUITY for the whole block: the model reason must survive. If the
    // coverage note simply replaced every streak note, cases 2-6 would pass for
    // the wrong reason and this fails.
    render(range([...Array.from({ length: 29 }, () => [V0]), [V1]]));
    expect(statValue('STREAK')).toBeNull();
    expect(streakNote()).toBe('NEW MODEL PERIOD');
    expect(host.textContent, 'coverage is complete here').not.toMatch(/DAYS MEASURED/);
  });

  it('the denominator is OBSERVED days — the raw reporting range is not a substitute', () => {
    // The shipped gate was `statsScope.length === rollups.length`. On this
    // fixture it yields the SAME suppressed value, so only the reason exposes
    // it: with the raw range the card fell through `fully_comparable` and
    // rendered NO note at all — a genuine 29-day streak deleted in silence.
    const rows = gapAt(clean(30, [V1]), 14);
    expect(rows.length, 'raw reporting range').toBe(30);
    expect(recapStatsScope(rows).length, 'observed and comparable').toBe(29);
    render(rows);
    expect(streakNote(), 'silence is the defect; the card must give a reason')
      .not.toBeNull();
    expect(streakNote()).toMatch(/OF 30 DAYS MEASURED/);
  });

  it('a suppressed streak is NEVER silent, across every suppressing shape', () => {
    // Total sweep: whenever the tile renders unavailable, a reason is present.
    for (const [label, rows] of [
      ['middle gap', gapAt(clean(30, [V1]), 14)],
      ['gap in unstamped history', gapAt(clean(30, []), 3)],
      ['all days scoreless', range(Array.from({ length: 10 }, () => [V1]))
        .map((_, i) => scorelessAt(i))],
      ['v0 -> v1 transition', range([...Array.from({ length: 20 }, () => [V0]),
                                     ...Array.from({ length: 10 }, () => [V1])])],
      ['entirely incompatible', range(Array.from({ length: 10 }, () => [V0, V1]))],
      ['gap AND transition', gapAt(range([...Array.from({ length: 20 }, () => [V0]),
                                          ...Array.from({ length: 10 }, () => [V1])]), 25)],
    ] as Array<[string, JournalRollup[]]>) {
      remount();
      render(rows);
      if (statValue('STREAK') === null) {
        expect(streakNote(), `${label}: suppressed streaks must carry a reason`)
          .not.toBeNull();
      }
    }
  });
});

/* ═══════ CROSS-OUTPUT AGREEMENT (founder ruling §7, 2026-09-02) ═══════
 *
 * `ShareJournalRecap` and `deriveJournalShareContext` are two outputs of the
 * SAME user action. `JournalScreen.onShareJournal` calls `publishJournalShare`
 * and `deriveJournalShareContext` on the identical array in one handler, and
 * `SharePreviewScreenV2` renders both into the same ViewShot slot behind a
 * format picker — so a member can see them one tap apart.
 *
 * They were disagreeing. The card correctly rendered "STREAK —" while the route
 * params from that same press said `streakDays=14`, which the template engine
 * turned into the copy the member posts publicly; and the card's AVG excluded
 * the sentinel while the payload averaged it in. One array, two answers, and
 * the wrong one was the one that left the app.
 *
 * These laws make the two surfaces provably one. They must fail if either
 * surface is fixed alone.
 */
describe('the recap card and the share payload cannot disagree', () => {
  const clean = (n = 30, vs: (string | null)[] = [V1]) =>
    range(Array.from({ length: n }, () => vs));
  const gapAt = (rows: JournalRollup[], ...idxs: number[]) => {
    const copy = [...rows];
    for (const i of idxs) copy[i] = scorelessAt(i);
    return copy;
  };
  /** Every shape that reaches a different corner of the two implementations. */
  const SHAPES: Array<[string, JournalRollup[]]> = [
    ['fully comparable', clean()],
    ['all unstamped', clean(30, [])],
    ['one middle scoreless day', gapAt(clean(), 14)],
    ['scoreless first day', gapAt(clean(), 0)],
    ['scoreless last day', gapAt(clean(), 29)],
    ['three consecutive scoreless', gapAt(clean(), 10, 11, 12)],
    ['v0 -> v1 transition', range([...Array.from({ length: 20 }, () => [V0]),
                                   ...Array.from({ length: 10 }, () => [V1])])],
    ['entirely incompatible', range(Array.from({ length: 10 }, () => [V0, V1]))],
    ['gap AND transition', gapAt(range([...Array.from({ length: 20 }, () => [V0]),
                                        ...Array.from({ length: 10 }, () => [V1])]), 25)],
    // A CALENDAR gap — the row is absent entirely, not merely scoreless. This is
    // what a server that has not shipped densification still sends.
    ['a day missing from the wire', clean().filter((_, i) => i !== 14)],
    ['empty', []],
  ];

  it('AVG agrees exactly, or neither publishes one', () => {
    let sawNumber = false, sawSuppressed = false;
    for (const [label, rows] of SHAPES) {
      remount();
      render(rows);
      const ctx = deriveJournalShareContext(rows, 30);
      const cardAvg = statValue('AVG');
      if (cardAvg === null) {
        sawSuppressed = true;
        expect(ctx.score, `${label}: card says "—", payload must publish nothing`).toBeNull();
        expect(toShareRouteParams(ctx).score, `${label}: and omit the param`).toBeUndefined();
      } else {
        sawNumber = true;
        expect(ctx.score, `${label}: the two AVGs must be the same number`)
          .toBe(Number(cardAvg));
      }
    }
    // ANTI-VACUITY: both branches must occur, or this proves only one of them.
    expect(sawNumber && sawSuppressed, 'the sweep must reach both branches').toBe(true);
  });

  it('a suppressed STREAK never leaves the app in the payload', () => {
    let sawPublished = false, sawSuppressed = false;
    for (const [label, rows] of SHAPES) {
      remount();
      render(rows);
      const ctx = deriveJournalShareContext(rows, 30);
      const cardStreak = statValue('STREAK');
      if (cardStreak === null) {
        sawSuppressed = true;
        // THE DEFECT, PINNED: the card rendered "—" and the payload said
        // `streakDays=14` from the same tap.
        expect(ctx.streakDays, `${label}: card suppressed, payload must too`).toBeUndefined();
        expect(toShareRouteParams(ctx).streakDays, `${label}: no param`).toBeUndefined();
        expect(ctx.type, `${label}: and it may not lead with a streak`).toBe('score');
      } else {
        sawPublished = true;
      }
    }
    expect(sawPublished && sawSuppressed, 'the sweep must reach both branches').toBe(true);
  });

  it('both surfaces read the SAME eligibility — proven on the exact failing shape', () => {
    // The shape that shipped the contradiction: 29 stamped days and one day the
    // member logged water on without a captured snapshot.
    const rows = gapAt(clean(), 14);
    render(rows);
    expect(classifyStreakEligibility(rows).kind).toBe('coverage_incomplete');
    expect(statValue('STREAK'), 'card').toBeNull();
    const ctx = deriveJournalShareContext(rows, 30);
    expect(ctx.streakDays, 'payload').toBeUndefined();
    // ...and the control: remove the gap and BOTH publish again.
    remount();
    const whole = clean();
    render(whole);
    expect(Number(statValue('STREAK'))).toBe(30);
    expect(deriveJournalShareContext(whole, 30).streakDays).toBe(30);
  });

  it('the payload never averages the sentinel — the card never did', () => {
    // ANTI-VACUITY with real arithmetic: the gapped and clean windows must
    // produce the SAME average, because the missing day is not a zero.
    const rows = gapAt(clean(30, [V1]), 14);
    render(rows);
    const ctx = deriveJournalShareContext(rows, 30);
    const naive = Math.round(rows.reduce((a, r) => a + r.avgScore, 0) / rows.length);
    // The old implementation produced `naive`; it must be visibly different.
    expect(ctx.score).not.toBe(naive);
    expect(ctx.score).toBe(Number(statValue('AVG')));
  });
});
