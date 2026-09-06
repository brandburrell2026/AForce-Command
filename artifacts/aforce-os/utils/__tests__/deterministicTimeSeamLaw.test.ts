/**
 * P0.5 — THE DETERMINISTIC TIME SEAM.
 *
 * `calculateScore(state, now)` is documented as a pure function of (state, now).
 * It was not. Several producers on the path read the REAL wall clock instead of
 * the injected `now`, so the same member state evaluated at the same logical
 * instant produced different output depending on when the process happened to
 * run.
 *
 * Why this is a truth defect and not a tidiness one: the member sees "Last
 * intake 308 min ago" computed from a clock that has nothing to do with the
 * score sitting next to it. The number and the sentence explaining the number
 * disagree, and the sentence is the one a person reads.
 *
 * THE LAW: freeze the real clock anywhere you like — the epoch, a year from
 * now, 3 AM, midday — and the output for a fixed (state, now) must be
 * byte-identical every time. `now` is the only clock.
 *
 * Nothing here asserts a NEW behaviour. Every expectation is "the value you get
 * when the wall clock happens to agree with `now`" — which is what the engine
 * always intended to produce.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { calculateScore } from '../scoringEngine';
import { generateReasons, calculateRiskTimer } from '../scoring/copy';
import { resolveInitialUserState } from '../../data/initialUserState';
import { computeEventImpact } from '../../services/hydrationScoreService';

const T0 = Date.UTC(2026, 8, 6, 12, 0, 0);
const MIN = 60_000;

/**
 * Wall-clock instants deliberately chosen to be hostile: decades apart, on
 * both sides of `now`, and straddling the 22:00–05:00 late-night overlay
 * window that `composeExplanation` keys off the local hour.
 */
const HOSTILE_CLOCKS: Array<[string, number]> = [
  ['the unix epoch', 0],
  ['long before `now`', Date.UTC(1999, 0, 1, 3, 30, 0)],
  ['`now` itself', T0],
  ['same day, 03:00 local', new Date(2026, 8, 6, 3, 0, 0).getTime()],
  ['same day, 13:00 local', new Date(2026, 8, 6, 13, 0, 0).getTime()],
  ['same day, 23:30 local', new Date(2026, 8, 6, 23, 30, 0).getTime()],
  ['years after `now`', Date.UTC(2031, 5, 17, 9, 15, 0)],
];

const P = () => resolveInitialUserState(false) as unknown as Record<string, unknown>;

const ev = (agoMin: number, oz: number, prior: unknown[], sb: number) => {
  const at = new Date(T0 - agoMin * MIN);
  const i = computeEventImpact('water' as never, undefined, oz, prior as never, at,
    { heatGuardActive: false, scoreBefore: sb });
  return { id: `e${agoMin}`, fluidType: 'water', oz, loggedAt: at,
    baseImpact: i.baseImpact, capAdjusted: i.capAdjusted, immediate: i.immediate,
    delayed: i.delayed, delayedDurationMin: i.delayedDurationMin,
    heatGuardActiveAtLog: false, scoreBeforeAtLog: sb };
};

const hydrated = (lastMin: number, over: Record<string, unknown> = {}) => {
  const a = ev(lastMin + 180, 32, [], 40);
  const b = ev(lastMin + 60, 32, [a], 55);
  const c = ev(lastMin, 32, [a, b], 70);
  return { ...P(), ozConsumedToday: 96, unitsConsumedToday: 8,
    intakeEvents: [a, b, c], lastIntakeTime: c.loggedAt, ...over };
};

/**
 * SOCIAL MODE fixtures.
 *
 * Without these the whole social lane is untested and its clock leaks survive
 * every mutation — `buildSocialRollup`, `generateSocialCommand` and the
 * `buildBaseCommand` hop all sit behind `state.socialMode` being present and
 * the rollup being non-null. A fixture set that leaves `social` at null looks
 * thorough and proves nothing about a third of the call graph.
 */
const drink = (agoMin: number, i: number) => ({
  id: `d${i}`, type: 'beer' as const, loggedAt: new Date(T0 - agoMin * MIN),
  multiplier: 1.4, hydrated: null, abv: 5, oz: 12,
});

const socialActive = (over: Record<string, unknown> = {}) => hydrated(25, {
  bodyWeightLbs: 185,
  socialMode: {
    active: true,
    startedAt: new Date(T0 - 200 * MIN),
    drinks: [drink(180, 1), drink(120, 2), drink(45, 3), drink(15, 4)],
    sex: 'male', ateRecently: true, preset: null,
  },
  ...over,
});

const socialRecovering = () => hydrated(25, {
  bodyWeightLbs: 185,
  socialMode: {
    active: false,
    startedAt: new Date(T0 - 400 * MIN),
    endedAt: new Date(T0 - 90 * MIN),
    drinks: [drink(380, 1), drink(300, 2), drink(200, 3)],
    sex: 'female', ateRecently: false, preset: null,
  },
});

/**
 * Fixtures chosen to reach every producer that was leaking the clock:
 * `reasons` and `riskTimer` (both via an un-threaded `minutesSince`), the
 * late-night explanation overlay (local hour), and the social rollup.
 */
const FIXTURES: Array<[string, Record<string, unknown>]> = [
  ['cold start', { ...P(), lastIntakeTime: new Date(T0) }],
  ['recent intake, 5 min', hydrated(5)],
  ['gap of 30 min', hydrated(30)],
  ['gap of 90 min — crosses the `intake-late` reason threshold', hydrated(90)],
  ['gap of 90 min, hot + humid', hydrated(90, { weatherTempC: 35, weatherHumidity: 80 })],
  ['gap of 8 min — inside the `intake-recent` reason band', hydrated(8)],
  ['streak + strong pace', hydrated(20, { complianceStreak: 6, urineSignal: 2 })],
  ['symptomatic + concentrated', hydrated(45, { symptomState: 'moderate',
    symptoms: ['headache', 'fatigue'], urineSignal: 6, heatLoad: 7, sweatRate: 7 })],
  ['overnight deficit', hydrated(70, { overnightLossOz: 14, hasSeenMorningCommand: false })],
  ['SOCIAL — night active, four drinks', socialActive()],
  ['SOCIAL — night active, awake, hot', socialActive({ weatherTempC: 33, weatherHumidity: 70 })],
  ['SOCIAL — recovery window, winding down', socialRecovering()],
];

afterEach(() => { vi.useRealTimers(); });

/** Evaluate `state` at logical instant `now` while the REAL clock says `wall`. */
function atWallClock(wall: number, state: Record<string, unknown>, now: number = T0) {
  vi.useFakeTimers();
  vi.setSystemTime(wall);
  try {
    return JSON.stringify(calculateScore(state as never, now));
  } finally {
    vi.useRealTimers();
  }
}

// ── 1 · the reproduction ────────────────────────────────────────────────────

describe('LAW 1 — same state + same `now` is byte-identical at any wall-clock time', () => {
  it.each(FIXTURES)('%s', (_label, state) => {
    const reference = atWallClock(T0, state);
    for (const [when, wall] of HOSTILE_CLOCKS) {
      expect(atWallClock(wall, state), `wall clock at ${when}`).toBe(reference);
    }
  });

  it('and `reasons` specifically — the field the defect was found in', () => {
    // Called out on its own because a whole-object comparison can be satisfied
    // by a field that is merely clamped. `reasons` carries free text built from
    // elapsed minutes, so it is the sharpest probe available.
    const state = hydrated(90);
    const reference = JSON.parse(atWallClock(T0, state)).reasons;
    expect(reference.some((r: { text: string }) => /\d+ min ago/.test(r.text))).toBe(true);
    for (const [when, wall] of HOSTILE_CLOCKS) {
      expect(JSON.parse(atWallClock(wall, state)).reasons, `wall clock at ${when}`)
        .toEqual(reference);
    }
  });

  it('and `riskTimer` — the same leak, hidden behind a clamp', () => {
    // `getBaseRiskMinutes` floors every band, so a wall-clock leak here is
    // invisible whenever elapsed time is large enough to saturate the floor.
    // A short gap keeps the value off its floor, where the leak shows.
    const state = hydrated(5);
    const reference = JSON.parse(atWallClock(T0, state)).riskTimer;
    expect(reference.minutes).toBeGreaterThan(5);
    for (const [when, wall] of HOSTILE_CLOCKS) {
      expect(JSON.parse(atWallClock(wall, state)).riskTimer, `wall clock at ${when}`)
        .toEqual(reference);
    }
  });

  it('and the late-night explanation overlay — keyed off the LOCAL hour', () => {
    // `composeExplanation` adds a 22:00–05:00 recovery-window line. Read from
    // the real clock, the same member got different coaching copy depending on
    // what time the process ran.
    const state = hydrated(90);
    const at3am = JSON.parse(atWallClock(new Date(2026, 8, 6, 3, 0, 0).getTime(), state));
    const at1pm = JSON.parse(atWallClock(new Date(2026, 8, 6, 13, 0, 0).getTime(), state));
    expect(at3am.command.explanation).toBe(at1pm.command.explanation);
  });
});

describe('LAW 1b — the social lane is genuinely exercised', () => {
  it('the social fixtures produce a non-null rollup and a social command', () => {
    // Guards against the fixtures being decorative. If `social` came back null
    // the social clock leaks would survive every mutation in this file while
    // the suite still reported green.
    const active = JSON.parse(atWallClock(T0, socialActive()));
    expect(active.social).not.toBeNull();
    expect(active.social.active).toBe(true);
    expect(active.social.drinkCount).toBe(4);
    expect(active.command.id).toMatch(/^cmd-social-/);

    const recovering = JSON.parse(atWallClock(T0, socialRecovering()));
    expect(recovering.social).not.toBeNull();
    expect(recovering.social.inRecoveryWindow).toBe(true);
    expect(recovering.command.id).toMatch(/^cmd-social-/);
  });

  it('the social rollup is byte-identical at any wall-clock time', () => {
    // BAC, hangover risk and the alcohol decay multiplier are all elapsed-time
    // functions — the sharpest probes in the engine, because every one of them
    // is a continuous number rather than a clamped or banded one.
    for (const state of [socialActive(), socialRecovering()]) {
      const reference = JSON.parse(atWallClock(T0, state)).social;
      for (const [when, wall] of HOSTILE_CLOCKS) {
        expect(JSON.parse(atWallClock(wall, state)).social, `wall clock at ${when}`)
          .toEqual(reference);
      }
    }
  });

  it('and so is the social COMMAND copy', () => {
    // `generateSocialCommand` branches on minutes-since-last-drink, so a clock
    // leak there changes which command a drinking member is shown.
    const state = socialActive();
    const reference = JSON.parse(atWallClock(T0, state)).command;
    for (const [when, wall] of HOSTILE_CLOCKS) {
      expect(JSON.parse(atWallClock(wall, state)).command, `wall clock at ${when}`)
        .toEqual(reference);
    }
  });
});

// ── 2 · `now` still does its job ────────────────────────────────────────────

describe('LAW 2 — a DIFFERENT injected `now` still changes the output', () => {
  it('reason timing tracks the injected clock, deterministically', () => {
    // The repair must not achieve determinism by ignoring time altogether.
    // Same state, `now` advanced — the elapsed-minutes copy must advance with
    // it, and by exactly the amount injected.
    const state = hydrated(5);
    const textAt = (now: number) => {
      const out = JSON.parse(atWallClock(0, state, now));
      const late = out.reasons.find((r: { id: string }) => r.id === 'intake-late');
      return late ? late.text : null;
    };
    // 5 min after the last intake: under the 60-minute `intake-late` threshold.
    expect(textAt(T0)).toBeNull();
    // Advance the injected clock two hours: 125 minutes elapsed.
    expect(textAt(T0 + 120 * MIN)).toBe('Last intake 125 min ago.');
    // Another hour: 185. Exact, not approximate.
    expect(textAt(T0 + 180 * MIN)).toBe('Last intake 185 min ago.');
  });

  it('the whole output differs between two injected instants', () => {
    const state = hydrated(5);
    expect(atWallClock(0, state, T0)).not.toBe(atWallClock(0, state, T0 + 120 * MIN));
  });

  it('and it is the INJECTED clock doing the work, not the real one', () => {
    // The decisive pairing: hold `now` fixed and vary the wall clock — identical.
    // Hold the wall clock fixed and vary `now` — different. Only one of the two
    // clocks is allowed to matter, and this says which.
    const state = hydrated(5);
    const wallVaries = new Set(HOSTILE_CLOCKS.map(([, w]) => atWallClock(w, state, T0)));
    const nowVaries = new Set([0, 60, 120, 240].map(m => atWallClock(0, state, T0 + m * MIN)));
    expect(wallVaries.size).toBe(1);
    expect(nowVaries.size).toBe(4);
  });
});

// ── 3 · production is untouched ─────────────────────────────────────────────

describe('LAW 3 — omitting `now` behaves exactly as passing the wall clock', () => {
  it('every production call site is byte-for-byte unaffected by this repair', () => {
    // THE SAFETY ARGUMENT FOR SHIPPING THIS.
    //
    // Every production caller invokes `calculateScore(state)` with no `now`, so
    // the parameter defaults to `Date.now()` — the same clock the leaking
    // producers were reading directly. Before the repair those two clocks were
    // the same value by coincidence; after it they are the same value by
    // construction. Either way the output is identical, so no member sees
    // anything change.
    //
    // The repair is therefore observable ONLY to a caller that injects a `now`
    // differing from the wall clock — a test, a replay, or a deterministic
    // projection. Which is exactly the population that was being lied to.
    for (const [, state] of FIXTURES) {
      vi.useFakeTimers();
      vi.setSystemTime(T0);
      try {
        const omitted = JSON.stringify(calculateScore(state as never));
        const explicit = JSON.stringify(calculateScore(state as never, Date.now()));
        expect(omitted).toBe(explicit);
      } finally {
        vi.useRealTimers();
      }
    }
  });
});

// ── 4 · the seam cannot silently reopen ─────────────────────────────────────

describe('LAW 4 — a re-introduced wall-clock read is caught', () => {
  it('the leaking producers are directly callable with an explicit `now`', () => {
    // Both took `state` only, so the clock leak had nowhere to enter from.
    // Pinning the signatures means dropping the parameter is a compile error
    // in this file, not a silent regression in production copy.
    const state = hydrated(90);
    vi.useFakeTimers();
    vi.setSystemTime(0);
    try {
      const reasons = generateReasons(state as never, T0);
      const timer = calculateRiskTimer(state as never, 'DEPLETED', T0);
      expect(reasons.find(r => r.id === 'intake-late')?.text).toBe('Last intake 90 min ago.');
      expect(timer.minutes).toBe(5);
    } finally {
      vi.useRealTimers();
    }
  });

  it('every producer agrees on ONE clock — no field lags another', () => {
    // A partial repair is the dangerous outcome: `reasons` threaded, `riskTimer`
    // missed, and the two fields describe different instants while both look
    // plausible. Compare a fully-injected evaluation against one where the wall
    // clock also happens to equal `now` — any field still reading the real
    // clock makes these diverge.
    for (const [, state] of FIXTURES) {
      const injected = atWallClock(0, state, T0);
      const aligned = atWallClock(T0, state, T0);
      expect(injected).toBe(aligned);
    }
  });
});
