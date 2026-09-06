/**
 * PR4 LAWS — the provider/adoption seam.
 *
 * This PR changes ARCHITECTURE, not BEHAVIOUR. Two things must therefore be
 * proven, and they pull in opposite directions:
 *
 *   1. The adapter is LOSSY IN ONE DIRECTION ONLY. It may collapse three
 *      epistemic states into `number | null`, because that is what today's
 *      consumers hold. It may NEVER manufacture a reading from an absence.
 *   2. CORE IS BYTE-FOR-BYTE UNCHANGED. Same UserState + same now => same
 *      score, level, breakdown contributions and RecoveryCommand.
 *
 * The second is preserved by construction rather than by matching: the adapter
 * does not touch the server OpenWeather -> UserState.weather* path, which is
 * the only pipeline that reaches Core. The golden parity block proves it
 * anyway, because "by construction" is a claim and a claim can be wrong.
 */
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import {
  toLegacyReading, toLegacyReadingAt, legacyHeatLoadAssumption,
  heatEvidenceFromLegacyState, readingsFromLocationSnapshot,
  readingsFromCityClimate, coarseLocationKey,
} from '../environment/environmentalAdapter';
import { observe, unobserved, type EnvironmentalEvidence } from '../environment/environmentalEvidence';
import { calculateScore } from '../scoringEngine';
import { resolveInitialUserState } from '../../data/initialUserState';
import { computeEventImpact } from '../../services/hydrationScoreService';

const T0 = Date.UTC(2026, 8, 6, 12, 0, 0);
const H = 3_600_000;
const MIN = 60_000;

const snap = (over: Record<string, unknown> = {}) => ({
  inputs: {
    temperatureC: 24, humidityPct: 55, uvIndex: 6,
    airQualityIndex: 30, altitudeMeters: 1609,
    latitude: 39.74, longitude: -104.99,
  },
  source: 'live' as const,
  observedAt: new Date(T0).toISOString(),
  ...over,
});

// ── 1 · round trips ─────────────────────────────────────────────────────────

describe('LAW 1 — observed readings round-trip intact', () => {
  it('observed TEMPERATURE survives the adapter', () => {
    const r = readingsFromLocationSnapshot(snap(), T0);
    expect(r.temperature.kind).toBe('observed');
    expect(toLegacyReading(r.temperature)).toBe(24);
  });

  it('observed HUMIDITY survives the adapter', () => {
    const r = readingsFromLocationSnapshot(snap(), T0);
    expect(r.humidity.kind).toBe('observed');
    expect(toLegacyReading(r.humidity)).toBe(55);
  });

  it('cityClimate °F is normalised to ONE unit for the signal', () => {
    // Unit fragmentation (°C persisted, °F here) is what the explicit `unit`
    // field exists to end.
    const r = readingsFromCityClimate(
      { tempF: 75.2, humidityPct: 40, observedAt: new Date(T0).toISOString(), source: 'live' },
      T0,
    );
    expect(r.temperature.kind !== 'unobserved' && r.temperature.unit).toBe('celsius');
    expect(toLegacyReading(r.temperature)).toBeCloseTo(24, 5);
  });
});

// ── 2 · the one-way rule ────────────────────────────────────────────────────

describe('LAW 2 — the adapter can never manufacture a reading', () => {
  it('UNOBSERVED never becomes a number', () => {
    expect(toLegacyReading(unobserved('temperature', 'never_requested'))).toBeNull();
    expect(toLegacyReading(unobserved('temperature', 'permission_denied'))).toBeNull();
    expect(toLegacyReading(unobserved('temperature', 'not_supported'))).toBeNull();
  });

  it('STALE never becomes current', () => {
    const old = observe({
      signal: 'temperature', value: 24, unit: 'celsius', observedAt: T0 - 9 * H,
      provenance: 'provider', source: 'open-meteo', locationPrecision: 'coarse',
    }, T0);
    expect(old.kind).toBe('stale');
    expect(toLegacyReading(old)).toBeNull();
  });

  it('MOCK/DEMO never becomes production evidence', () => {
    const r = readingsFromLocationSnapshot(snap({ source: 'mock' }), T0);
    for (const e of Object.values(r)) {
      expect(e.kind).toBe('unobserved');
      expect(e.kind === 'unobserved' && e.reason).toBe('demo_withheld');
      expect(toLegacyReading(e)).toBeNull();
    }
  });

  it('MOCK/DEMO never becomes production evidence — the CITY producer too', () => {
    // PR2 repaired exactly this producer: a demo city's weather rendered as
    // the member's own. The gate has to be proven on both entry points, not
    // just the one that happened to be written first.
    const mock = readingsFromCityClimate(
      { tempF: 88, humidityPct: 70, observedAt: new Date(T0).toISOString(),
        source: 'mock', city: 'Denver' },
      T0,
    );
    for (const e of [mock.temperature, mock.humidity]) {
      expect(e.kind).toBe('unobserved');
      expect(e.kind === 'unobserved' && e.reason).toBe('demo_withheld');
      expect(toLegacyReading(e)).toBeNull();
    }
    // And null — the shape PR2 made this service return in production — is
    // an absence, never a zero.
    const absent = readingsFromCityClimate(null, T0);
    expect(toLegacyReading(absent.temperature)).toBeNull();
    expect(toLegacyReading(absent.humidity)).toBeNull();
  });

  it('a STALE city reading never becomes current either', () => {
    const old = readingsFromCityClimate(
      { tempF: 88, humidityPct: 70, observedAt: new Date(T0 - 9 * H).toISOString(),
        source: 'live', city: 'Denver' },
      T0,
    );
    expect(old.temperature.kind).toBe('stale');
    expect(toLegacyReading(old.temperature)).toBeNull();
  });

  it('PROVIDER FAILURE never becomes a fabricated reading', () => {
    expect(readingsFromLocationSnapshot(null, T0).temperature.kind).toBe('unobserved');
    const bad = readingsFromLocationSnapshot(snap({ observedAt: 'not-a-date' }), T0);
    expect(bad.temperature.kind === 'unobserved' && bad.temperature.reason)
      .toBe('provider_unavailable');
    expect(toLegacyReading(bad.temperature)).toBeNull();
  });

  it('LOCATION-INVALID ALTITUDE never becomes valid current altitude', () => {
    const denver = readingsFromLocationSnapshot(snap(), T0);
    expect(toLegacyReading(denver.altitude)).toBe(1609);
    // The member is now somewhere else. A Denver altitude is not evidence here.
    const miamiKey = coarseLocationKey(25.76, -80.19);
    expect(toLegacyReadingAt(denver.altitude, T0 + 60_000, { locationKey: miamiKey }))
      .toBeNull();
  });

  it('the location key resolves the distances that actually change altitude', () => {
    const denver = readingsFromLocationSnapshot(snap(), T0).altitude;
    const at = (lat: number, lon: number) =>
      toLegacyReadingAt(denver, T0 + 60_000, { locationKey: coarseLocationKey(lat, lon) });

    // TOO COARSE is a real failure mode, and a Denver/Miami test alone will
    // not catch it — a whole-degree key would still separate those two.
    // Colorado Springs is ~110 km south and 230 m higher; Golden is ~25 km
    // west and 120 m higher and sits in the SAME whole degree as Denver.
    // Both must invalidate, which is what pins the resolution to sub-degree.
    expect(at(38.83, -104.82)).toBeNull();
    expect(at(39.76, -105.22)).toBeNull();

    // TOO FINE is the opposite failure: GPS jitter of a few metres would
    // invalidate the reading constantly and the member would see altitude
    // blink out while standing still.
    expect(at(39.741, -104.994)).toBe(1609);
  });

  it('an UNLOCATABLE altitude is refused, not carried around the continent', () => {
    // `reclassify` can only invalidate when both sides carry a key, so an
    // altitude captured with no lat/lon could never be invalidated. Time-bound
    // signals are unaffected — a temperature with no coordinates is still a
    // temperature, and it still expires.
    const nowhere = readingsFromLocationSnapshot(
      snap({ inputs: { ...snap().inputs, latitude: undefined, longitude: undefined } }), T0);
    expect(nowhere.altitude.kind).toBe('unobserved');
    expect(toLegacyReading(nowhere.altitude)).toBeNull();
    expect(toLegacyReadingAt(nowhere.altitude, T0 + 60_000,
      { locationKey: coarseLocationKey(25.76, -80.19) })).toBeNull();
    expect(toLegacyReading(nowhere.temperature)).toBe(24);
  });

  it('a CALCULATED or INFERRED value is not handed over as a measurement', () => {
    // Legitimate values, but not measurements — a consumer receiving a bare
    // number could not tell, so the adapter refuses.
    for (const provenance of ['calculated', 'inferred'] as const) {
      const e = observe({
        signal: 'temperature', value: 24, unit: 'celsius', observedAt: T0,
        provenance, source: 'derived', locationPrecision: 'coarse',
      }, T0) as EnvironmentalEvidence<number>;
      expect(e.kind).toBe('observed');
      expect(toLegacyReading(e)).toBeNull();
    }
  });
});

// ── 3 · heatLoad is an assumption ───────────────────────────────────────────

describe('LAW 3 — heatLoad = 4 is an assumption, never an observation', () => {
  it('it is not evidence, and carries no provenance to imply measurement', () => {
    const a = legacyHeatLoadAssumption(4);
    expect(a.kind).toBe('assumption');
    expect((a as unknown as Record<string, unknown>)['provenance']).toBeUndefined();
    expect((a as unknown as Record<string, unknown>)['observedAt']).toBeUndefined();
    expect((a as unknown as Record<string, unknown>)['expiresAt']).toBeUndefined();
  });

  it('and it carries WHY, so the classification is never re-litigated', () => {
    expect(legacyHeatLoadAssumption(4).because).toMatch(/never as environmental evidence/i);
  });

  it('THE EVIDENCE LAYER SAYS UNOBSERVED even though the seed exists', () => {
    // This is the heart of the founder rule: behaviour may remain legacy, the
    // truth classification may not lie. The calculation still has its seed;
    // the evidence system still reports that nothing was observed.
    const e = heatEvidenceFromLegacyState(null, null, T0);
    expect(e.kind).toBe('unobserved');
    expect(toLegacyReading(e)).toBeNull();
  });

  it('a REAL persisted reading is still evidence', () => {
    const e = heatEvidenceFromLegacyState(24, T0, T0);
    expect(e.kind).toBe('observed');
    expect(toLegacyReading(e)).toBe(24);
  });

  it('a reading with NO timestamp is refused rather than assumed fresh', () => {
    const e = heatEvidenceFromLegacyState(24, null, T0);
    expect(e.kind).toBe('unobserved');
  });
});

// ── 4 · GOLDEN CORE PARITY ──────────────────────────────────────────────────

describe('LAW 4 — Core is byte-for-byte unchanged', () => {
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

  /**
   * A member with real logged intake, `lastMin` minutes ago, under weather `w`.
   *
   * The intake matters: with no events the score pins at the 0 floor for every
   * weather input, and a parity table of seven zeroes proves nothing. These
   * fixtures sit ABOVE the floor, where the environmental term is visible.
   */
  const hydrated = (lastMin: number, w: Record<string, unknown>) => {
    const a = ev(lastMin + 180, 32, [], 40);
    const b = ev(lastMin + 60, 32, [a], 55);
    const c = ev(lastMin, 32, [a, b], 70);
    return { ...P(), ozConsumedToday: 96, unitsConsumedToday: 8,
      intakeEvents: [a, b, c], lastIntakeTime: c.loggedAt, ...w };
  };

  /**
   * GOLDEN VALUES — a SHA-256 digest of the ENTIRE `ScoreEngineOutput`, not
   * just the headline number.
   *
   * A failure here is a Core behaviour change. That may be legitimate, but it
   * must be deliberate and authorized — never a side effect of an adoption PR.
   *
   * REPINNED ONCE, 2026-09-06, by the P0.5 deterministic time seam — and this
   * is exactly the tripwire doing its job. P0.5 threaded the injected `now`
   * into `calculateRiskTimer`, which had been computing elapsed time from the
   * real wall clock. `riskTimer.minutes` is the ONLY field that moved, in all
   * seven fixtures, and it moved to the value `getBaseRiskMinutes` has always
   * specified for the injected instant:
   *
   *   cold start   (DEPLETED,   0 min elapsed)  5 -> 13   max(5, ⌊60×0.2⌋+1)
   *   recent intake (RECOVERING, 5 min elapsed) 10 -> 22   max(10, ⌊55×0.4⌋)
   *   30 min gap   (DEPLETED,  30 min elapsed)  5 ->  7   max(5, ⌊30×0.2⌋+1)
   *
   * The old numbers were the floor clamp firing on a wrong, enormous elapsed
   * time. Score, band, command, explanation, breakdown, pulse, prediction and
   * social are byte-identical across the repair. `getBaseRiskMinutes` itself is
   * untouched — same formula, same floors; only its input is now correct.
   */
  const GOLDEN: Array<[string, Record<string, unknown>, number, string, string, string]> = [
    ['cold start, no weather', { ...P(), lastIntakeTime: new Date(T0) },
      0, 'DEPLETED', 'cmd-depleted', 'dacb9b984998cc6e'],
    ['recent intake, no weather', hydrated(5, { weatherTempC: null, weatherHumidity: null }),
      69, 'RECOVERING', 'cmd-recovering', 'ce4ba56a6b387ad6'],
    ['recent intake, mild 21C/45%', hydrated(5, { weatherTempC: 21, weatherHumidity: 45 }),
      69, 'RECOVERING', 'cmd-recovering', 'ce4ba56a6b387ad6'],
    ['recent intake, hot 35C/80%', hydrated(5, { weatherTempC: 35, weatherHumidity: 80 }),
      66, 'RECOVERING', 'cmd-recovering', '454a9add5f7c17a5'],
    ['30min gap, hot 35C/80%', hydrated(30, { weatherTempC: 35, weatherHumidity: 80 }),
      38, 'DEPLETED', 'cmd-depleted', '133f8ab5fffbfc7b'],
    ['30min gap, extreme 42C/90%', hydrated(30, { weatherTempC: 42, weatherHumidity: 90 }),
      17, 'DEPLETED', 'cmd-depleted', 'db1fdba56f90a204'],
    ['30min gap, heatLoad seed only', hydrated(30, { weatherTempC: null, weatherHumidity: null, heatLoad: 4 }),
      57, 'DEPLETED', 'cmd-depleted', '1b25bdd57256f453'],
  ];

  it.each(GOLDEN)('%s — score, band, command and full output digest match main',
    (_label, state, score, level, cmd, digest) => {
      const out = calculateScore(state as never, T0);
      expect(out.score).toBe(score);
      expect(out.performanceState.level).toBe(level);
      expect(out.command.id).toBe(cmd);
      // Byte-level: catches any contribution, explanation, pulse config,
      // prediction or social field Core emits that the three headline
      // assertions above would miss.
      //
      // `reasons` is excluded, and NOT because it is unimportant. It is the one
      // field of `ScoreEngineOutput` that reads the wall clock instead of the
      // injected `now`, so its copy ("Last intake 308 min ago") drifts minute
      // to minute and would make this law a flake. That is a pre-existing
      // purity gap in Core, outside this PR's authority to touch; it is flagged
      // in the PR body rather than silently absorbed here.
      const { reasons: _volatile, ...deterministic } = out as unknown as Record<string, unknown>;
      expect(createHash('sha256').update(JSON.stringify(deterministic)).digest('hex').slice(0, 16))
        .toBe(digest);
    });

  it('the parity table is NOT vacuous — Core really does read the weather', () => {
    // A parity suite over inputs Core ignores would pass no matter what this
    // PR did. These pairs differ ONLY in the environmental terms.
    const mild = calculateScore(GOLDEN[2][1] as never, T0).score;
    const hot = calculateScore(GOLDEN[3][1] as never, T0).score;
    const extreme = calculateScore(GOLDEN[5][1] as never, T0).score;
    const hot30 = calculateScore(GOLDEN[4][1] as never, T0).score;
    expect(hot).toBeLessThan(mild);       // 66 < 69
    expect(extreme).toBeLessThan(hot30);  // 17 < 38
  });

  it('the adapter cannot perturb Core — loading it changes nothing', () => {
    // The adapter is imported at the top of this file. If merely loading it
    // mutated module-level state Core depends on, the digests above would
    // already have failed; this pins the weaker property directly.
    for (const [, state] of GOLDEN) {
      const a = calculateScore(state as never, T0);
      const b = calculateScore(state as never, T0);
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    }
  });

  it('the adapter reads Core state but NEVER writes it', () => {
    const state = { ...P(), weatherTempC: 24, weatherHumidity: 55 } as Record<string, unknown>;
    const before = JSON.stringify(state);
    heatEvidenceFromLegacyState(state['weatherTempC'] as number, T0, T0);
    readingsFromCityClimate({ tempF: 75, humidityPct: 40,
      observedAt: new Date(T0).toISOString(), source: 'live' }, T0);
    expect(JSON.stringify(state)).toBe(before);
  });
});

// ── 5 · rollback ────────────────────────────────────────────────────────────

describe('LAW 5 — the seam is revertible', () => {
  it('legacy shape out equals legacy shape in, for a live reading', () => {
    // Rollback means deleting the adapter, not unwinding consumers. That is
    // only true while the adapter is a pure function of its input with no
    // stored state — proven by identical repeat calls.
    const first = toLegacyReading(readingsFromLocationSnapshot(snap(), T0).temperature);
    const second = toLegacyReading(readingsFromLocationSnapshot(snap(), T0).temperature);
    expect(first).toBe(24);
    expect(second).toBe(first);
  });

  it('the adapter holds no state between calls', () => {
    const live = readingsFromLocationSnapshot(snap(), T0);
    const mock = readingsFromLocationSnapshot(snap({ source: 'mock' }), T0);
    const liveAgain = readingsFromLocationSnapshot(snap(), T0);
    expect(toLegacyReading(live.temperature)).toBe(24);
    expect(toLegacyReading(mock.temperature)).toBeNull();
    // A mock call in between must not poison the next live one.
    expect(toLegacyReading(liveAgain.temperature)).toBe(24);
  });
});
