/**
 * ENV PR5 LAWS — one piece of environmental evidence, ONE freshness truth.
 *
 * Before PR5 the same persisted weather reading was simultaneously: current
 * forever to Core and the heat engine, fresh-for-6h to Command Confidence,
 * fresh-for-1h to the presentation windows and the evidence contract, and dead
 * after 10 minutes to the provider caches. Five verdicts about one fact.
 *
 * From PR5 on there is one classifier — the versioned ValidityPolicy (PR3/3.1)
 * through `resolveCurrentWeather` — and these laws prove that every authority
 * flips AT THE SAME INSTANT, in both directions:
 *
 *   inside the window   → the reading is used, everywhere, identically;
 *   beyond the window   → the reading behaves exactly like ABSENCE, everywhere.
 *
 * "Exactly like absence" is the sharp edge: stale must never be silently
 * current, and missing must never become a neutral OBSERVATION. The heat
 * engine's 70 °F neutral is its zero-risk absence element, not a reading —
 * LAW 3 pins stale ≡ absent per authority, so no consumer can ever treat the
 * fallback as evidence.
 */
import { describe, it, expect } from 'vitest';
import {
  resolveCurrentWeather,
  weatherTemperatureEvidence,
  weatherFreshWindowMs,
} from '../environment/weatherFreshness';
import {
  observe,
  reclassify,
  DEFAULT_VALIDITY_POLICY,
  CLOCK_SKEW_MS,
} from '../environment/environmentalEvidence';
import { calculateScore } from '../scoringEngine';
import { commandConfidenceInputsFromState } from '../scoring/commandConfidence';
import { FRESHNESS_WINDOWS } from '../../config/hydroStateModel';
import { buildHeatSignalInput, currentAmbientTempC } from '../../services/heatGuardInput';
import { buildSocialRollup } from '../../services/socialModeEngine';
import { CACHE_TTL_MS as LOCATION_CACHE_TTL_MS } from '../../services/locationIntelligenceService';
import { CACHE_TTL_MS as CITY_CACHE_TTL_MS } from '../../services/cityClimateService';
import { resolveInitialUserState } from '../../data/initialUserState';
import { computeEventImpact } from '../../services/hydrationScoreService';

const T0 = Date.UTC(2026, 8, 6, 12, 0, 0);
const MIN = 60_000;
const WINDOW = weatherFreshWindowMs();

/**
 * The canonical boundary instants. The classifier tolerates CLOCK_SKEW_MS
 * beyond the window — drift never condemns a reading — so "the last current
 * instant" and "the first stale instant" straddle window + skew, not the bare
 * window. Every law below uses these four, so no test can quietly encode a
 * private boundary again.
 */
const AGE = {
  fresh: 0,
  lastCurrent: WINDOW + CLOCK_SKEW_MS - 1,
  firstStale: WINDOW + CLOCK_SKEW_MS + 1,
  ancient: 9 * 3_600_000,
} as const;

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

const hydrated = (over: Record<string, unknown> = {}) => {
  const a = ev(210, 32, [], 40); const b = ev(90, 32, [a], 55); const c = ev(30, 32, [a, b], 70);
  return { ...P(), ozConsumedToday: 96, unitsConsumedToday: 8,
    intakeEvents: [a, b, c], lastIntakeTime: c.loggedAt, ...over };
};

/** Hot weather whose reading is `ageMs` old at T0. */
const hotAt = (ageMs: number, over: Record<string, unknown> = {}) => hydrated({
  weatherTempC: 38, weatherHumidity: 80, weatherFetchedAt: T0 - ageMs, ...over,
});
const noWeather = (over: Record<string, unknown> = {}) => hydrated({
  weatherTempC: null, weatherHumidity: null, weatherFetchedAt: null, ...over,
});

// ── 1 · every authority flips at the SAME instant ───────────────────────────

describe('LAW 1 — one boundary, every authority', () => {
  it('the fixture is not vacuous: current hot weather really moves each authority', () => {
    // The P0.5 masking lesson, applied prophylactically: prove the lanes are
    // entered before proving anything about their boundaries.
    const withHeat = calculateScore(hotAt(AGE.fresh) as never, T0);
    const without = calculateScore(noWeather() as never, T0);
    expect(withHeat.score).toBeLessThan(without.score);
    expect(commandConfidenceInputsFromState(hotAt(AGE.fresh) as never, T0).hasWeather).toBe(true);
    const heat = buildHeatSignalInput(hotAt(AGE.fresh) as never, 60, T0);
    expect(heat.ambientTempMeasured).toBe(true);
    expect(heat.ambientTempF).toBeCloseTo(100.4, 5);
  });

  it('CORE — current is used through the last current instant, then the seed', () => {
    const fresh = calculateScore(hotAt(AGE.fresh) as never, T0).score;
    const edge = calculateScore(hotAt(AGE.lastCurrent) as never, T0).score;
    const stale = calculateScore(hotAt(AGE.firstStale) as never, T0).score;
    const absent = calculateScore(noWeather() as never, T0).score;
    expect(edge).toBe(fresh);    // the whole window counts, skew included
    expect(stale).toBe(absent);  // one tick past it, the reading is gone
    expect(stale).not.toBe(fresh);
  });

  it('CONFIDENCE — hasWeather flips at the same instant', () => {
    expect(commandConfidenceInputsFromState(hotAt(AGE.lastCurrent) as never, T0).hasWeather).toBe(true);
    expect(commandConfidenceInputsFromState(hotAt(AGE.firstStale) as never, T0).hasWeather).toBe(false);
  });

  it('HEAT GUARD — measured flips to the zero-risk neutral at the same instant', () => {
    const edge = buildHeatSignalInput(hotAt(AGE.lastCurrent) as never, 60, T0);
    const stale = buildHeatSignalInput(hotAt(AGE.firstStale) as never, 60, T0);
    expect(edge.ambientTempMeasured).toBe(true);
    expect(stale.ambientTempMeasured).toBe(false);
    expect(stale.ambientTempF).toBe(70); // NEUTRAL — the engine's zero element
    expect(stale.humidityPct).toBe(0);
  });

  it('VOICE ESCALATION — the band gate reads the same verdict', () => {
    // The pure seam `useHeatGuard` gates spoken heat warnings through. A
    // reading from this morning must not fire (or suppress) a warning tonight.
    expect(currentAmbientTempC(hotAt(AGE.lastCurrent) as never, T0)).toBe(38);
    expect(currentAmbientTempC(hotAt(AGE.firstStale) as never, T0)).toBeNull();
  });

  it('SOCIAL RECOVERY — environmental stress flips at the same instant', () => {
    const social = (state: Record<string, unknown>) => buildSocialRollup({
      ...state,
      socialMode: { active: true, startedAt: new Date(T0 - 120 * MIN),
        drinks: [{ id: 'd1', type: 'beer', loggedAt: new Date(T0 - 30 * MIN),
          multiplier: 1.4, hydrated: null, abv: 5, oz: 12 }],
        sex: 'male', ateRecently: true, preset: null },
    } as never, 70, T0);
    const edge = social(hotAt(AGE.lastCurrent));
    const stale = social(hotAt(AGE.firstStale));
    const absent = social(noWeather());
    expect(edge).not.toBeNull();
    // The member-visible Recovery Capacity must agree with the score about
    // whether the same reading exists.
    expect(JSON.stringify(stale?.recoveryCapacity)).toBe(JSON.stringify(absent?.recoveryCapacity));
    expect(JSON.stringify(edge?.recoveryCapacity)).not.toBe(JSON.stringify(stale?.recoveryCapacity));
  });

  it('PRESENTATION — the fresh boundary IS the policy boundary', () => {
    expect(FRESHNESS_WINDOWS.weather.freshUntilMs).toBe(WINDOW);
    expect(FRESHNESS_WINDOWS.weather.freshUntilMs)
      .toBe(DEFAULT_VALIDITY_POLICY.rules.temperature.kind === 'time'
        ? DEFAULT_VALIDITY_POLICY.rules.temperature.freshForMs
        : Number.NaN);
    // The refinement stages subdivide the NOT-current side; they can never
    // extend the current one.
    expect(FRESHNESS_WINDOWS.weather.staleAfterMs).toBeGreaterThanOrEqual(WINDOW);
  });
});

// ── 2 · stale is ABSENCE, not a quieter observation ─────────────────────────

describe('LAW 2 — stale evidence never silently becomes current', () => {
  it('an ancient reading is indistinguishable from no reading, everywhere', () => {
    const stale = hotAt(AGE.ancient);
    const absent = noWeather();
    expect(JSON.stringify(calculateScore(stale as never, T0)))
      .toBe(JSON.stringify(calculateScore(absent as never, T0)));
    expect(commandConfidenceInputsFromState(stale as never, T0))
      .toEqual(commandConfidenceInputsFromState(absent as never, T0));
    expect(buildHeatSignalInput(stale as never, 60, T0))
      .toEqual(buildHeatSignalInput(absent as never, 60, T0));
  });

  it('but the EVIDENCE keeps its value — honesty about the past is allowed', () => {
    // Stale ≠ erased. A surface that HONESTLY qualifies ("38 °C, nine hours
    // ago") may still read it via lastKnownValue; it just can no longer be
    // spent as a present-tense fact anywhere.
    const evd = weatherTemperatureEvidence(hotAt(AGE.ancient) as never, T0);
    expect(evd.kind).toBe('stale');
    expect(evd.kind === 'stale' && evd.value).toBe(38);
  });
});

// ── 3 · missing never becomes a neutral observation ─────────────────────────

describe('LAW 3 — absence stays absence', () => {
  it('an UNDATED reading cannot be called current', () => {
    // temp present, anchor missing: it cannot be aged, so it cannot be
    // current. This was Core behavior change B3 — before PR5 an undated
    // reading scored as live weather forever.
    const undated = hydrated({ weatherTempC: 38, weatherHumidity: 80, weatherFetchedAt: null });
    expect(weatherTemperatureEvidence(undated as never, T0).kind).toBe('unobserved');
    expect(JSON.stringify(calculateScore(undated as never, T0)))
      .toBe(JSON.stringify(calculateScore(noWeather() as never, T0)));
    expect(commandConfidenceInputsFromState(undated as never, T0).hasWeather).toBe(false);
    expect(buildHeatSignalInput(undated as never, 60, T0).ambientTempMeasured).toBe(false);
  });

  it('the verdict can only DROP a value, never manufacture one', () => {
    expect(resolveCurrentWeather(noWeather() as never, T0)).toEqual({ tempC: null, humidityPct: null });
    expect(resolveCurrentWeather(
      { weatherTempC: Number.NaN, weatherHumidity: 55, weatherFetchedAt: T0 }, T0).tempC).toBeNull();
    // Per-signal independence: a broken temp does not take humidity with it.
    expect(resolveCurrentWeather(
      { weatherTempC: Number.NaN, weatherHumidity: 55, weatherFetchedAt: T0 }, T0).humidityPct).toBe(55);
  });

  it('a FUTURE-implausible timestamp is refused by the one classifier', () => {
    // Pre-PR5 the classifiers split here: confidence's private isFresh
    // rejected far-future stamps while the contract accepted them — the same
    // implausible row was "current" to Core and "not fresh" to confidence.
    const skewed = hydrated({ weatherTempC: 38, weatherHumidity: 80,
      weatherFetchedAt: T0 + CLOCK_SKEW_MS - 1_000 });
    const implausible = hydrated({ weatherTempC: 38, weatherHumidity: 80,
      weatherFetchedAt: T0 + CLOCK_SKEW_MS + 60_000 });
    expect(weatherTemperatureEvidence(skewed as never, T0).kind).toBe('observed');
    const evd = weatherTemperatureEvidence(implausible as never, T0);
    expect(evd.kind).toBe('unobserved');
    expect(evd.kind === 'unobserved' && evd.reason).toBe('provider_unavailable');
    expect(commandConfidenceInputsFromState(implausible as never, T0).hasWeather).toBe(false);
    expect(JSON.stringify(calculateScore(implausible as never, T0)))
      .toBe(JSON.stringify(calculateScore(noWeather() as never, T0)));
  });
});

// ── 4 · the policy is the ONLY number ───────────────────────────────────────

describe('LAW 4 — no private windows survive', () => {
  it('a custom policy moves every verdict with it — no consumer pinned 1h', () => {
    // If any adopted consumer still carried its own literal, shrinking the
    // policy window would leave it behind. 2-minute policy: a 5-minute-old
    // reading must be stale to the verdict.
    const tight = {
      version: 'test-tight',
      rules: { ...DEFAULT_VALIDITY_POLICY.rules,
        temperature: { kind: 'time', freshForMs: 2 * MIN },
        humidity: { kind: 'time', freshForMs: 2 * MIN } },
    } as const;
    const fiveMinOld = hotAt(5 * MIN + CLOCK_SKEW_MS + 1) as never;
    expect(resolveCurrentWeather(fiveMinOld, T0).tempC).toBe(38); // default: current
    expect(resolveCurrentWeather(fiveMinOld, T0, tight as never).tempC).toBeNull();
    expect(weatherFreshWindowMs(tight as never)).toBe(2 * MIN);
  });

  it('provider-supplied expiry may only SHORTEN the window, never extend it', () => {
    const base = { signal: 'temperature', value: 30, unit: 'celsius',
      observedAt: T0, provenance: 'provider', source: 'open-meteo',
      locationPrecision: 'city' } as const;
    // Provider says 10 minutes: stale at 10min+skew even though policy says 1h.
    const shortLived = observe({ ...base, expiresAt: T0 + 10 * MIN }, T0 + 10 * MIN + CLOCK_SKEW_MS + 1);
    expect(shortLived.kind).toBe('stale');
    // Provider says 24 hours: the policy still wins — Math.min, not trust.
    const longClaim = observe({ ...base, expiresAt: T0 + 24 * 3_600_000 },
      T0 + WINDOW + CLOCK_SKEW_MS + 1);
    expect(longClaim.kind).toBe('stale');
  });

  it('the caches may only serve what the policy still calls current', () => {
    // A TTL is refetch economy, not a freshness truth — but it must sit inside
    // the shortest window of any signal the producer serves, or a cache hit
    // could hand out data the policy has stopped believing. Location snapshots
    // serve uvIndex (the shortest time-bound signal); city climate serves
    // temperature and humidity.
    const rules = DEFAULT_VALIDITY_POLICY.rules;
    const winOf = (s: keyof typeof rules) => {
      const r = rules[s];
      return r.kind === 'time' ? r.freshForMs : Number.POSITIVE_INFINITY;
    };
    const locationServed = Math.min(winOf('temperature'), winOf('humidity'),
      winOf('uvIndex'), winOf('airQuality'));
    expect(LOCATION_CACHE_TTL_MS).toBeLessThanOrEqual(locationServed);
    expect(CITY_CACHE_TTL_MS).toBeLessThanOrEqual(Math.min(winOf('temperature'), winOf('humidity')));
  });

  it('location invalidation is untouched — a time-bound weather verdict never location-invalidates, altitude still does', () => {
    const temp = observe({ signal: 'temperature', value: 30, unit: 'celsius',
      observedAt: T0, provenance: 'provider', source: 'open-meteo',
      locationPrecision: 'coarse', locationKey: '39.7,-105.0' }, T0);
    // Moving does not expire ambient temperature — it is time-bound.
    expect(reclassify(temp, T0 + MIN, { locationKey: '25.8,-80.2' }).kind).toBe('observed');
    const alt = observe({ signal: 'altitude', value: 1609, unit: 'meters',
      observedAt: T0, provenance: 'provider', source: 'open-meteo',
      locationPrecision: 'coarse', locationKey: '39.7,-105.0' }, T0);
    expect(reclassify(alt, T0 + MIN, { locationKey: '25.8,-80.2' }).kind).toBe('unobserved');
  });
});
