/**
 * ENV PR5.1 — one reading, one verdict, at one canonical `now`.
 *
 * PR5 unified the freshness WINDOW across every consumer but left the two
 * ledger paths re-implementing the arithmetic around it. They applied
 * `CLOCK_SKEW_MS` only to future-dated stamps, while `observe()` also grants it
 * on expiry — so between `window` and `window + skew` the live path called a
 * reading current while the durable record called it stale.
 *
 * Measured before the repair, at a 61-minute-old reading:
 *
 *     live verdict = current      ledger replay = NOT fresh
 *
 * One reading, two verdicts — PR5's own invariant, violated inside PR5. The
 * band was narrow (five minutes) and touched the audit trail rather than the
 * score, which is exactly why nothing caught it: every fixture in the suite sat
 * comfortably inside or outside the window, never in the seam between them.
 *
 * These laws pin the three authorities TOGETHER at every boundary, so a future
 * change cannot move one without moving the others:
 *
 *     LIVE      `commandConfidenceInputsFromState` (what the member sees)
 *     EVIDENCE  `deriveCommandEvidence` weather row (what gets recorded)
 *     REPLAY    `ledgerToCommandConfidenceInputs` (what history replays)
 */
import { describe, it, expect } from 'vitest';
import {
  classifyWeatherObservation,
  isWeatherObservationCurrent,
  weatherFreshWindowMs,
  weatherEffectiveMaxAgeMs,
  resolveCurrentWeather,
} from '../environment/weatherFreshness';
import { CLOCK_SKEW_MS, DEFAULT_VALIDITY_POLICY } from '../environment/environmentalEvidence';
import { commandConfidenceInputsFromState, deriveContextSnapshotFields } from '../scoring/commandConfidence';
import { deriveCommandEvidence } from '../scoring/commandEvidence';
import {
  ledgerToCommandConfidenceInputs,
  contextSnapshotToCommandEvent,
} from '../intelligence/commandEventAdapters';
import { calculateScore } from '../scoringEngine';
import { resolveInitialUserState } from '../../data/initialUserState';

const T0 = Date.UTC(2026, 8, 6, 12, 0, 0);
const MIN = 60_000;
const WINDOW = weatherFreshWindowMs();
const SKEW = CLOCK_SKEW_MS;

/** Warm enough that the evidence row is emitted at all (HEAT_DEMAND_C). */
const TEMP_C = 30;

const stateAged = (ageMs: number | null) => ({
  ...(resolveInitialUserState(false) as unknown as Record<string, unknown>),
  weatherTempC: TEMP_C,
  weatherHumidity: 60,
  weatherFetchedAt: ageMs === null ? null : T0 - ageMs,
  lastIntakeTime: new Date(T0 - 30 * MIN),
  intakeEvents: [],
});

/** LIVE — the verdict the member's confidence is computed from. */
const live = (ageMs: number | null): boolean =>
  commandConfidenceInputsFromState(stateAged(ageMs) as never, T0).hasWeather;

/**
 * EVIDENCE — the freshness status written into the durable record.
 *
 * Driven through the REAL production path (`calculateScore` → the command it
 * actually produced → `deriveCommandEvidence`), so the row under test is the
 * one a member's ledger would receive, not a hand-built approximation.
 */
const evidenceRow = (ageMs: number | null) => {
  const state = stateAged(ageMs);
  const engineOutput = calculateScore(state as never, T0);
  const bundle = deriveCommandEvidence({
    command: engineOutput.command, state: state as never, engineOutput, now: T0,
  } as never) as { integrity?: string; items?: Array<{ key: string; freshness?: { status: string; maxAgeMs: number } }> };
  return bundle.items?.find((i) => i.key === 'weather_heat');
};

const evidenceStatus = (ageMs: number | null): string =>
  evidenceRow(ageMs)?.freshness?.status ?? 'absent';

/** REPLAY — the verdict recovered from ledger history. */
const replay = (ageMs: number | null): boolean => {
  const snap = contextSnapshotToCommandEvent({
    atMs: T0,
    weatherTempC: TEMP_C,
    hasFreshBiometrics: false,
    ...(ageMs === null ? {} : { weatherFetchedAtMs: T0 - ageMs }),
  } as never);
  return snap ? ledgerToCommandConfidenceInputs([snap], T0).hasWeather : false;
};

/**
 * The boundaries the founder required, expressed against the POLICY rather
 * than literal durations, so no fixture here can re-encode a private window.
 */
const BOUNDARIES: Array<[string, number | null, boolean]> = [
  ['window − 1 ms — inside the plain window', WINDOW - 1, true],
  ['window + 1 min — INSIDE ONLY BECAUSE OF SKEW (the broken band)', WINDOW + MIN, true],
  ['window + skew − 1 ms — the last current instant', WINDOW + SKEW - 1, true],
  ['window + skew + 1 ms — the first stale instant', WINDOW + SKEW + 1, false],
];

// ── 1 · the three authorities agree at every boundary ───────────────────────

describe('LAW 1 — live, evidence and replay give ONE verdict', () => {
  it.each(BOUNDARIES)('%s', (_label, age, expectedCurrent) => {
    const l = live(age);
    const r = replay(age);
    const e = evidenceStatus(age);

    expect(l).toBe(expectedCurrent);
    expect(r).toBe(expectedCurrent);
    expect(e).toBe(expectedCurrent ? 'fresh' : 'stale');
    // Stated as an agreement, not three separate facts: this is the invariant.
    expect({ live: l, replay: r, evidenceFresh: e === 'fresh' })
      .toEqual({ live: expectedCurrent, replay: expectedCurrent, evidenceFresh: expectedCurrent });
  });

  it('the skew band is REAL — it is not vacuously inside the plain window', () => {
    // If skew were zero, `window + 1min` would coincide with the stale side and
    // the decisive row above would prove nothing. This pins that the band the
    // defect lived in actually exists.
    expect(SKEW).toBeGreaterThan(MIN);
    expect(WINDOW + MIN).toBeGreaterThan(WINDOW);
    expect(WINDOW + MIN).toBeLessThan(WINDOW + SKEW);
  });

  it('and the boundary is not vacuous — the verdict really does flip', () => {
    expect(live(WINDOW - 1)).not.toBe(live(WINDOW + SKEW + 1));
    expect(replay(WINDOW - 1)).not.toBe(replay(WINDOW + SKEW + 1));
    expect(evidenceStatus(WINDOW - 1)).not.toBe(evidenceStatus(WINDOW + SKEW + 1));
  });
});

// ── 2 · the non-age rejections agree too ────────────────────────────────────

describe('LAW 2 — unusable timestamps are rejected everywhere', () => {
  it('an implausibly FUTURE timestamp is rejected by all three', () => {
    const future = -(SKEW + MIN); // negative age = ahead of `now`
    expect(live(future)).toBe(false);
    expect(replay(future)).toBe(false);
    expect(evidenceStatus(future)).toBe('absent'); // 'none' suppresses the row
    // ...while drift INSIDE tolerance is ordinary and still current.
    const slightlyAhead = -(SKEW - MIN);
    expect(live(slightlyAhead)).toBe(true);
    expect(replay(slightlyAhead)).toBe(true);
    expect(evidenceStatus(slightlyAhead)).toBe('fresh');
  });

  it('a MISSING timestamp is not current anywhere', () => {
    expect(live(null)).toBe(false);
    expect(evidenceStatus(null)).toBe('absent');

    // REPLAY reaches the same end by construction rather than by classifying:
    // a production snapshot cannot carry a weather reading without its anchor,
    // so there is never an un-anchored weather row for replay to judge.
    // Asserting `replay(null) === false` directly would test an unreachable
    // row — and pass for the wrong reason, since the adapter's documented
    // legacy fallback (`weatherFetchedAtMs ?? occurredAtMs`) would anchor it to
    // the snapshot's own instant. Pin the real guarantee instead.
    const fields = deriveContextSnapshotFields(stateAged(null) as never, T0);
    expect(fields.weatherTempC).toBeNull();
    expect(fields.weatherFetchedAtMs).toBeNull();

    const produced = contextSnapshotToCommandEvent({
      atMs: T0,
      weatherTempC: fields.weatherTempC,
      hasFreshBiometrics: fields.hasFreshBiometrics,
      ...(fields.weatherFetchedAtMs != null
        ? { weatherFetchedAtMs: fields.weatherFetchedAtMs } : {}),
    } as never);
    expect(produced ? ledgerToCommandConfidenceInputs([produced], T0).hasWeather : false)
      .toBe(false);
  });

  it('a NON-POSITIVE epoch is a sentinel, not an instant — one rule now', () => {
    // The ledger classifier always refused `<= 0`; the live path did not, and
    // reached the same answer only by accident of ageing. PR5.1 makes it the
    // same rule rather than two that happen to agree.
    expect(classifyWeatherObservation(0, T0)).toBe('none');
    expect(classifyWeatherObservation(-1, T0)).toBe('none');
    expect(resolveCurrentWeather({ weatherTempC: TEMP_C, weatherFetchedAt: 0 }, T0).tempC).toBeNull();
  });

  it('a NON-FINITE timestamp is rejected', () => {
    expect(classifyWeatherObservation(Number.NaN, T0)).toBe('none');
    expect(classifyWeatherObservation(Number.POSITIVE_INFINITY, T0)).toBe('none');
  });
});

// ── 3 · one classifier, not two that match ──────────────────────────────────

describe('LAW 3 — the ledger CONSUMES the classifier, it does not mirror it', () => {
  it('a custom policy moves the ledger verdict with it', () => {
    // The decisive test of routing-vs-matching. If either ledger path still
    // carried its own arithmetic, shrinking the policy would leave it behind.
    const tight = {
      version: 'test-tight',
      rules: {
        ...DEFAULT_VALIDITY_POLICY.rules,
        temperature: { kind: 'time', freshForMs: 2 * MIN },
        humidity: { kind: 'time', freshForMs: 2 * MIN },
      },
    } as const;
    const age = 5 * MIN + SKEW + 1;
    expect(classifyWeatherObservation(T0 - age, T0)).toBe('current');
    expect(classifyWeatherObservation(T0 - age, T0, tight as never)).toBe('stale');
    expect(isWeatherObservationCurrent(T0 - age, T0, tight as never)).toBe(false);
  });

  it('the recorded max-age is the bound the verdict actually used', () => {
    // A durable row that records the bare window while the status beside it was
    // decided on window+skew puts a third number in the permanent record.
    expect(weatherEffectiveMaxAgeMs()).toBe(WINDOW + SKEW);
    const row = evidenceRow(WINDOW + MIN);
    expect(row?.freshness?.maxAgeMs).toBe(WINDOW + SKEW);
    // The row this bound is attached to is the one from the previously-broken
    // band, so the number and the status it justifies travel together.
    expect(row?.freshness?.status).toBe('fresh');
  });

  it('the verdict is a pure function of the timestamp and `now`', () => {
    // No hidden clock: PR5.1's classifier must inherit P0.5's determinism.
    const a = classifyWeatherObservation(T0 - WINDOW - MIN, T0);
    const b = classifyWeatherObservation(T0 - WINDOW - MIN, T0);
    expect(a).toBe(b);
    expect(a).toBe('current');
    expect(classifyWeatherObservation(T0 - WINDOW - MIN, T0 + 10 * MIN)).toBe('stale');
  });
});
