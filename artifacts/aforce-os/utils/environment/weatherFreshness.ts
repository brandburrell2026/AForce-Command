/**
 * WEATHER FRESHNESS — the ONE verdict (Env PR5).
 *
 * PR5's governing invariant: one piece of environmental evidence may have only
 * one freshness truth. Before this module, the SAME persisted weather reading
 * was simultaneously:
 *
 *     current forever   — Core decay used `weatherTempC` at any age
 *     current forever   — heat guard, social recovery stress, and a dozen
 *                         context readers, same ungated pattern
 *     fresh for 6 h     — Command Confidence's private WEATHER_FRESHNESS_MS
 *     fresh for 1 h     — the presentation windows in hydroStateModel
 *     fresh for 1 h     — the EnvironmentalEvidence validity policy
 *     dead after 10 min — the provider caches
 *
 * Five verdicts about one fact. A member could be told their data was stale by
 * the confidence chip while the score beside it was still being computed from
 * that same reading as though it were live.
 *
 * FROM PR5 ON, the verdict comes from HERE, and this module is deliberately
 * thin: it does no classification of its own. It builds `EnvironmentalEvidence`
 * from the persisted `weather*` fields and lets the versioned
 * `DEFAULT_VALIDITY_POLICY` (PR3/3.1) decide currency — the same classifier,
 * the same per-signal windows, the same version string, for every consumer.
 * There is no weather-specific number in this file, and that is the point:
 * adding one here would be recreating the disease this PR treats.
 *
 * Semantics inherited from the contract, restated for reviewers:
 *   - a reading with NO timestamp cannot be aged, so it cannot be called
 *     current — `unobserved`, never assumed fresh;
 *   - `stale` keeps its value (surfaces that HONESTLY qualify it may show it
 *     via `lastKnownValue`), but it is not current and never becomes a number
 *     through the current-only accessors here;
 *   - absence is absence — never a neutral observation.
 */
import {
  observe,
  unobserved,
  CLOCK_SKEW_MS,
  DEFAULT_VALIDITY_POLICY,
  type EnvironmentalEvidence,
  type EnvironmentalSignal,
  type ValidityPolicy,
} from './environmentalEvidence';

/** The persisted weather fields as they exist on `UserState` today. */
export interface PersistedWeatherFields {
  readonly weatherTempC?: number | null;
  readonly weatherHumidity?: number | null;
  /** Epoch ms the server fetched the reading (see api-server /aforce/weather). */
  readonly weatherFetchedAt?: number | null;
}

function persistedSignalEvidence(
  signal: EnvironmentalSignal,
  value: number | null | undefined,
  unit: 'celsius' | 'percent',
  fetchedAt: number | null | undefined,
  now: number,
  policy: ValidityPolicy,
): EnvironmentalEvidence<number> {
  if (value == null || !Number.isFinite(value)) {
    return unobserved(signal, 'never_requested');
  }
  if (fetchedAt == null || !Number.isFinite(fetchedAt) || fetchedAt <= 0) {
    // A reading with no timestamp cannot be aged, so it cannot be called
    // current. Refusing it is safer than assuming it is fresh.
    //
    // PR5.1: a non-positive epoch is a missing-value sentinel, not an
    // instant. The ledger classifier already refused it; refusing it here too
    // is what makes that ONE rule instead of two that happen to agree.
    return unobserved(signal, 'provider_unavailable');
  }
  return observe(
    {
      signal,
      value,
      unit,
      observedAt: fetchedAt,
      provenance: 'provider',
      source: 'aforce-server/openweather',
      locationPrecision: 'city',
    },
    now,
    policy,
  ) as EnvironmentalEvidence<number>;
}

/** Evidence classification of the persisted ambient temperature. */
export function weatherTemperatureEvidence(
  state: PersistedWeatherFields,
  now: number,
  policy: ValidityPolicy = DEFAULT_VALIDITY_POLICY,
): EnvironmentalEvidence<number> {
  return persistedSignalEvidence(
    'temperature', state.weatherTempC, 'celsius', state.weatherFetchedAt, now, policy,
  );
}

/** Evidence classification of the persisted relative humidity. */
export function weatherHumidityEvidence(
  state: PersistedWeatherFields,
  now: number,
  policy: ValidityPolicy = DEFAULT_VALIDITY_POLICY,
): EnvironmentalEvidence<number> {
  return persistedSignalEvidence(
    'humidity', state.weatherHumidity, 'percent', state.weatherFetchedAt, now, policy,
  );
}

/**
 * The canonical CURRENT weather, per signal.
 *
 * Each field is a number ONLY while that signal's evidence is `observed` under
 * the policy; otherwise null, which every existing consumer already treats as
 * "no weather" (Core falls back to the heatLoad seed, the heat engine to its
 * zero-risk neutral, confidence to hasWeather=false). Temperature and humidity
 * are gated INDEPENDENTLY because they are separate signals with separate
 * validity rules, even though today they share one fetch anchor.
 *
 * This is the presence-shape (`number | null`) consumers already hold — the
 * same one-way collapse the PR4 adapter performs, applied to the persisted
 * path. It can only ever drop a value; it can never manufacture one.
 */
export function resolveCurrentWeather(
  state: PersistedWeatherFields,
  now: number,
  policy: ValidityPolicy = DEFAULT_VALIDITY_POLICY,
): { tempC: number | null; humidityPct: number | null } {
  const temp = weatherTemperatureEvidence(state, now, policy);
  const humidity = weatherHumidityEvidence(state, now, policy);
  return {
    tempC: temp.kind === 'observed' ? temp.value : null,
    humidityPct: humidity.kind === 'observed' ? humidity.value : null,
  };
}

/**
 * The canonical freshness WINDOW for the persisted weather signals, for
 * consumers that must RECORD a max-age (the command ledger writes `maxAgeMs`
 * into evidence rows) or derive a presentation boundary from it.
 *
 * Exposed as a function of the policy rather than a constant so no caller can
 * capture a number that later drifts from the policy version it came from.
 * Throws at module-init time in the (config-error) case of a location-bound
 * rule, which has no duration to report.
 */
export function weatherFreshWindowMs(
  policy: ValidityPolicy = DEFAULT_VALIDITY_POLICY,
): number {
  const rule = policy.rules.temperature;
  if (rule.kind !== 'time') {
    throw new Error(
      `weatherFreshWindowMs: temperature validity is '${rule.kind}', expected 'time' — policy ${policy.version}`,
    );
  }
  return rule.freshForMs;
}

// ─── The canonical verdict over a bare timestamp (PR5.1) ────────────────────

/**
 * What the ONE classifier says about a weather observation, addressed only by
 * its timestamp.
 *
 *   current — inside the policy window (skew grace included)
 *   stale   — a real observation, but past that window
 *   none    — not a usable instant at all: absent, non-finite, non-positive,
 *             or implausibly far in the future
 */
export type WeatherObservationCurrency = 'current' | 'stale' | 'none';

/**
 * PR5.1 — the ledger's verdict, from the SAME classifier as the live one.
 *
 * The command ledger and its replay adapter hold a bare `weatherFetchedAtMs`,
 * not a `UserState`, so they could not call `resolveCurrentWeather`. Each had
 * therefore re-implemented the arithmetic — and re-implemented it slightly
 * differently: they applied `CLOCK_SKEW_MS` only to future-dated stamps, while
 * `observe()` applies it to EXPIRY as well. The result was a five-minute band
 * (window+1min ... window+skew) in which the live path called a reading
 * current and the durable record called it stale. One reading, two verdicts —
 * the exact defect PR5 exists to prevent, surviving inside PR5.
 *
 * This function closes it by ROUTING rather than by matching: it builds the
 * same evidence through the same `observe()`, so the window, the skew grace,
 * the future-timestamp rule and provider-expiry shortening are all inherited.
 * There is no arithmetic here to drift.
 *
 * The value passed to the classifier is a sentinel: classification reads only
 * whether a value is FINITE, never its magnitude, and the result is discarded.
 */
export function classifyWeatherObservation(
  fetchedAtMs: number | null | undefined,
  now: number,
  policy: ValidityPolicy = DEFAULT_VALIDITY_POLICY,
): WeatherObservationCurrency {
  const CLASSIFICATION_ONLY = 0;
  const evidence = weatherTemperatureEvidence(
    { weatherTempC: CLASSIFICATION_ONLY, weatherFetchedAt: fetchedAtMs },
    now,
    policy,
  );
  if (evidence.kind === 'observed') return 'current';
  if (evidence.kind === 'stale') return 'stale';
  return 'none';
}

/** The same verdict as a boolean, for consumers that only need current-or-not. */
export function isWeatherObservationCurrent(
  fetchedAtMs: number | null | undefined,
  now: number,
  policy: ValidityPolicy = DEFAULT_VALIDITY_POLICY,
): boolean {
  return classifyWeatherObservation(fetchedAtMs, now, policy) === 'current';
}

/**
 * The EFFECTIVE maximum age of a current weather observation — the policy
 * window plus the skew grace `observe()` actually allows.
 *
 * For consumers that must RECORD the bound they were judged against (the
 * command ledger writes `maxAgeMs` into durable evidence rows). Recording the
 * bare window there would put a third number in the permanent record that
 * disagrees with the verdict beside it; this is the number the verdict used.
 */
export function weatherEffectiveMaxAgeMs(
  policy: ValidityPolicy = DEFAULT_VALIDITY_POLICY,
): number {
  return weatherFreshWindowMs(policy) + CLOCK_SKEW_MS;
}
