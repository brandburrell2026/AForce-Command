/**
 * ENVIRONMENTAL EVIDENCE — the canonical contract for what AForce knows about
 * the world around the member, and how confidently.
 *
 * WHAT THIS IS NOT. Not a scorer. Not a command authority. It produces no
 * number a member sees and no action a member takes. The architecture is, and
 * remains:
 *
 *     Environment  ->  evidence  ->  Core interpretation  ->  RecoveryCommand
 *
 * Core (`utils/scoring/breakdown.ts`) already owns interpretation and scoring;
 * RecoveryCommand already owns action. This module supplies the first arrow
 * honestly and stops.
 *
 * ── WHY IT EXISTS ─────────────────────────────────────────────────────────
 *
 * The audit of canonical main found the same environmental fact represented
 * three different ways, with five different freshness policies, and no way to
 * distinguish a reading from an assumption:
 *
 *   TEMPERATURE   `UserState.weatherTempC` (°C, persisted) ·
 *                 `LocationInputs.temperatureC` (°C) · `CityClimate.tempF` (°F)
 *   FRESHNESS     cityClimate 10 min · locationIntelligence 10 min ·
 *                 server OpenWeather cache 10 min · command confidence 6 h ·
 *                 the SCORE path: no freshness check at all
 *   PROVENANCE    `source: 'live' | 'mock'` on two services, absent on the
 *                 persisted weather that actually reaches Core
 *
 * Two live defects came out of exactly these gaps, and both are fixed in the
 * PRs preceding this one:
 *   - a calculation neutral (70 °F for "no reading") was one line from being
 *     quoted to a member as a measurement;
 *   - a deterministic demo city was rendered as the member's own conditions
 *     and auto-filled an ACSM protocol.
 *
 * This contract makes both of those unrepresentable rather than merely fixed.
 *
 * ── THE CENTRAL RULE ──────────────────────────────────────────────────────
 *
 * UNKNOWN, STALE and OBSERVED are three different states, and none of them is
 * a number. The repo's recurring defect — 17 logged instances — is ONE LOSSY
 * VALUE collapsing two states, read downstream as the answer to a different
 * question. A nullable number cannot express "we asked and the provider
 * failed" versus "we have a reading from nine hours ago" versus "22 °C, now".
 *
 * So the value lives on the arms that HAVE one, and nowhere else. Reading a
 * temperature requires narrowing the tag first, which is a compile-time
 * obligation rather than a convention someone remembers.
 */

// ─── Signals ────────────────────────────────────────────────────────────────

/**
 * Every environmental signal the system may eventually carry. Listed here so
 * freshness policy is exhaustive by construction — adding a signal without a
 * policy is a type error, not an oversight.
 *
 * Signals present in canonical main today are marked LIVE; the rest are named
 * so the contract can hold them without pretending they exist. Nothing here
 * implies a provider decision, a feature, or a surface.
 */
export type EnvironmentalSignal =
  | 'temperature'        // LIVE — UserState.weatherTempC, CityClimate.tempF, LocationInputs
  | 'humidity'           // LIVE — UserState.weatherHumidity, CityClimate, LocationInputs
  | 'uvIndex'            // LIVE — LocationInputs only
  | 'airQuality'         // LIVE — LocationInputs only (us_aqi)
  | 'altitude'           // LIVE — LocationInputs only
  | 'apparentTemperature'
  | 'precipitation'
  | 'recentRainfall'
  | 'wind'
  | 'pollen'
  | 'sunrise'
  | 'sunset';

/** Units are explicit because the same signal already ships in °C and °F. */
export type EnvironmentalUnit =
  | 'celsius' | 'fahrenheit' | 'percent' | 'uvIndex' | 'aqiUs'
  | 'meters' | 'millimeters' | 'metersPerSecond' | 'grainsPerCubicMeter' | 'iso8601';

// ─── Provenance ─────────────────────────────────────────────────────────────

/**
 * HOW the value came to be. Distinct from freshness: a value can be current
 * and inferred, or stale and directly observed.
 *
 * `inferred` is the one that will matter most later — a mosquito or heat-stress
 * risk derived from temperature and rainfall is inferred, not observed, and a
 * surface must be able to say so. Carrying it now costs nothing and makes the
 * distinction impossible to lose.
 */
export type EvidenceProvenance =
  | 'observed'    // a sensor reading for this member's location
  | 'provider'    // supplied by a third-party feed
  | 'calculated'  // derived deterministically from other observed evidence
  | 'inferred';   // modelled from proxies — defensible, but not a measurement

/**
 * Why nothing is known. `unobserved` is not one state — the reasons differ in
 * what a consumer may do about them, and collapsing them would be the same
 * lossy-value mistake one level up.
 */
export type UnobservedReason =
  | 'never_requested'      // nothing has asked yet
  | 'permission_denied'    // the member declined location
  | 'provider_unavailable' // asked, and the provider failed — NOT a reading
  | 'not_supported'        // this signal has no producer on this platform
  | 'demo_withheld';       // a demo/mock value existed and was deliberately refused

/**
 * How precisely the member's position was known. Recorded because environmental
 * evidence is only as meaningful as its location, and because coarser is
 * usually the privacy-preserving choice.
 */
export type LocationPrecision = 'exact' | 'coarse' | 'city' | 'region' | 'unknown';

/**
 * Quality of the evidence itself, where a producer can defensibly state it.
 * Deliberately coarse and deliberately optional: a fabricated confidence number
 * would be exactly the false precision this contract exists to prevent.
 */
export type EvidenceQuality = 'high' | 'moderate' | 'low';

// ─── The evidence value ─────────────────────────────────────────────────────

/** Fields shared by the two arms that actually carry a reading. */
interface EvidenceCore<T> {
  readonly signal: EnvironmentalSignal;
  readonly value: T;
  readonly unit: EnvironmentalUnit;
  /** When the provider says the value was true. Epoch ms. */
  readonly observedAt: number;
  /** When it stops counting as current. Epoch ms. Derived, never guessed. */
  readonly expiresAt: number;
  readonly provenance: EvidenceProvenance;
  /** Stable id of the producer, e.g. 'open-meteo'. Never a secret. */
  readonly source: string;
  readonly locationPrecision: LocationPrecision;
  readonly quality?: EvidenceQuality;
}

/**
 * The three-arm epistemic state.
 *
 * NOTE WHAT `unobserved` DOES NOT HAVE: a value, a unit, an observedAt. There
 * is nothing on that arm for a consumer to misread, which is the whole point —
 * `0`, `null` and a neutral sentinel are all reachable by accident; a missing
 * property is not.
 *
 * NOTE WHAT `stale` DOES HAVE: the value. A nine-hour-old temperature is real
 * data and a surface may legitimately say "22 °C, nine hours ago". What it may
 * not do is present it as current — which is why staleness is a TAG and not a
 * boolean buried beside the number.
 */
export interface UnobservedEvidence {
  readonly kind: 'unobserved';
  readonly signal: EnvironmentalSignal;
  readonly reason: UnobservedReason;
}

export type EnvironmentalEvidence<T = number> =
  | UnobservedEvidence
  | ({ readonly kind: 'stale' } & EvidenceCore<T>)
  | ({ readonly kind: 'observed' } & EvidenceCore<T>);

// ─── Freshness policy ───────────────────────────────────────────────────────

/**
 * PER-SIGNAL FRESHNESS. Deliberately NOT one universal duration.
 *
 * A single number would be convenient and wrong: a six-hour-old UV index is
 * useless because UV tracks sun angle, while a six-hour-old altitude is still
 * perfectly true. The existing code already proves the hazard — five different
 * TTLs exist for what everyone calls "current conditions", and the SCORE path
 * enforces none of them while the confidence layer enforces six hours.
 *
 * Each duration below is justified by how fast the underlying quantity actually
 * moves, not by implementation convenience.
 */
export const FRESHNESS_MS: Readonly<Record<EnvironmentalSignal, number>> = {
  /** Ambient air moves slowly; an hour-old reading still describes the hour. */
  temperature: 60 * 60 * 1000,
  /** Tracks temperature closely enough to share its window. */
  humidity: 60 * 60 * 1000,
  /** Apparent temperature is derived from both, so it cannot outlive them. */
  apparentTemperature: 60 * 60 * 1000,
  /**
   * UV tracks solar angle and cloud cover — it can change materially inside an
   * hour and is near-meaningless once the sun has moved. The shortest window
   * here, and the clearest case against a universal duration.
   */
  uvIndex: 30 * 60 * 1000,
  /** Air quality shifts on wind and traffic; hours, not minutes. */
  airQuality: 2 * 60 * 60 * 1000,
  /** Whether it is raining right now is a short-lived fact. */
  precipitation: 30 * 60 * 1000,
  /**
   * NOT a point reading — an accumulation over a lookback window. It stays
   * meaningful far longer precisely because it already describes the past.
   */
  recentRainfall: 6 * 60 * 60 * 1000,
  wind: 60 * 60 * 1000,
  /** Published on daily cycles by most feeds. */
  pollen: 12 * 60 * 60 * 1000,
  /**
   * Sunrise and sunset are computed for a date and location. They do not decay
   * through the day; they are simply replaced tomorrow.
   */
  sunrise: 24 * 60 * 60 * 1000,
  sunset: 24 * 60 * 60 * 1000,
  /**
   * ALTITUDE IS NOT TIME-STALE. The ground does not move. It is invalidated by
   * a change of LOCATION, not by the passage of time — a distinction this table
   * cannot express, so the long duration is a floor and producers must
   * re-evaluate on location change. Recorded here because pretending altitude
   * behaves like weather would be its own small fabrication.
   */
  altitude: 7 * 24 * 60 * 60 * 1000,
};

/** Tolerance for device/provider clock drift, matching the existing seam. */
export const CLOCK_SKEW_MS = 5 * 60 * 1000;

// ─── Constructors ───────────────────────────────────────────────────────────

/** The only way to express "nothing is known", and it carries no number. */
export function unobserved(
  signal: EnvironmentalSignal,
  reason: UnobservedReason,
): UnobservedEvidence {
  return { kind: 'unobserved', signal, reason };
}

export interface ObserveInput<T> {
  readonly signal: EnvironmentalSignal;
  readonly value: T;
  readonly unit: EnvironmentalUnit;
  readonly observedAt: number;
  readonly provenance: EvidenceProvenance;
  readonly source: string;
  readonly locationPrecision: LocationPrecision;
  readonly quality?: EvidenceQuality;
  /** Provider-stated expiry, when one exists. Otherwise policy decides. */
  readonly expiresAt?: number;
}

/**
 * Build evidence from a producer reading, classifying it against `now`.
 *
 * DETERMINISTIC BY CONSTRUCTION: `now` is a required argument, never
 * `Date.now()` internally, so expiry is testable and reproducible rather than
 * dependent on when a test happens to run.
 *
 * A non-finite value is NOT a reading. `NaN` survives a `!= null` check and
 * would otherwise sail through as observed — the exact shape of an earlier
 * defect, so it is rejected here rather than downstream.
 */
export function observe<T>(input: ObserveInput<T>, now: number): EnvironmentalEvidence<T> {
  const { signal, value, observedAt } = input;

  if (typeof value === 'number' && !Number.isFinite(value)) {
    return unobserved(signal, 'provider_unavailable');
  }
  if (!Number.isFinite(observedAt)) {
    return unobserved(signal, 'provider_unavailable');
  }

  const expiresAt = input.expiresAt ?? observedAt + FRESHNESS_MS[signal];
  const core = {
    signal, value: input.value, unit: input.unit, observedAt, expiresAt,
    provenance: input.provenance, source: input.source,
    locationPrecision: input.locationPrecision,
    ...(input.quality !== undefined ? { quality: input.quality } : {}),
  } as const;

  // Skew tolerance applies to expiry only. A reading is not made fresher by a
  // drifting clock; it is merely not condemned by one.
  return now <= expiresAt + CLOCK_SKEW_MS
    ? { kind: 'observed', ...core }
    : { kind: 'stale', ...core };
}

/**
 * Re-classify existing evidence against a later `now`. Observed evidence
 * becomes stale as time passes; nothing ever travels the other way.
 *
 * PROVENANCE SURVIVES: every field is carried through unchanged. A value that
 * was `inferred` when fresh is still `inferred` when stale, and a demo value
 * never becomes an observed one by ageing.
 */
export function reclassify<T>(
  evidence: EnvironmentalEvidence<T>,
  now: number,
): EnvironmentalEvidence<T> {
  if (evidence.kind === 'unobserved') return evidence;
  const fresh = now <= evidence.expiresAt + CLOCK_SKEW_MS;
  if (fresh && evidence.kind === 'observed') return evidence;
  if (!fresh && evidence.kind === 'stale') return evidence;
  const { kind: _kind, ...core } = evidence;
  return (fresh ? { kind: 'observed', ...core } : { kind: 'stale', ...core }) as EnvironmentalEvidence<T>;
}

// ─── Reading ────────────────────────────────────────────────────────────────

/**
 * The value ONLY when it is current. Stale and unobserved both yield null.
 *
 * This is the accessor a consumer wanting to state a present-tense fact must
 * use — "it is 31 °C" — and it is deliberately the narrowest one.
 */
export function currentValue<T>(evidence: EnvironmentalEvidence<T>): T | null {
  return evidence.kind === 'observed' ? evidence.value : null;
}

/**
 * The value if one was ever read, current or not. For surfaces that can
 * HONESTLY qualify it — "22 °C, nine hours ago". Returns the staleness so a
 * caller cannot use this accessor and then forget to say which it got.
 */
export function lastKnownValue<T>(
  evidence: EnvironmentalEvidence<T>,
): { value: T; stale: boolean } | null {
  if (evidence.kind === 'unobserved') return null;
  return { value: evidence.value, stale: evidence.kind === 'stale' };
}

/** True only for a present-tense, first-hand or provider-supplied reading. */
export function isCurrent<T>(evidence: EnvironmentalEvidence<T>): boolean {
  return evidence.kind === 'observed';
}

/**
 * Whether this evidence may be presented to a member as a measurement.
 *
 * `inferred` and `calculated` values are legitimate — a heat index is
 * calculated, a risk band may be inferred — but they are not measurements, and
 * a surface that says "it is X" about them is overclaiming. Kept as its own
 * predicate so that judgement lives in one place.
 */
export function isMeasurement<T>(evidence: EnvironmentalEvidence<T>): boolean {
  return (
    (evidence.kind === 'observed' || evidence.kind === 'stale') &&
    (evidence.provenance === 'observed' || evidence.provenance === 'provider')
  );
}
