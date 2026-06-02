/**
 * Hydration depletion rate — physiologically grounded model.
 *
 * Returns the score-points-per-minute drop from baseline metabolism
 * + activity + environmental conditions, before any modifier
 * (sleep, clutch, social mode) is applied.
 *
 * ─── Why this lives separately from scoringEngine.ts ─────────────
 * `scoringEngine.ts` transitively pulls in i18next, expo-localization,
 * and the theme palette — none of which can be tested in plain
 * node/vitest without elaborate mocks. This file is pure, dependency-
 * free arithmetic so the depletion math can be exhaustively unit-
 * tested with realistic scenarios (sedentary office, mid-workout,
 * sleeping in hot weather, etc.) and so the constants here are the
 * single source of truth for the engine, the prediction strip, and
 * the journal narrative.
 *
 * ─── Physiological grounding ─────────────────────────────────────
 *
 * Sources:
 *   - ACSM Position Statement: Exercise and Fluid Replacement (2007)
 *     Med. Sci. Sports Exerc. 39(2):377–390
 *   - IOM Dietary Reference Intakes for Water, Potassium, Sodium,
 *     Chloride and Sulfate (2005), National Academies Press
 *   - ISO 7933:2004 Ergonomics of the thermal environment —
 *     Analytical determination and interpretation of heat stress
 *   - NIOSH Criteria for a Recommended Standard: Occupational
 *     Exposure to Heat and Hot Environments (2016)
 *
 * Reference physiology:
 *   - Daily total water turnover, sedentary 70 kg adult: ~2.5 L/day
 *     - Insensible (skin + respiration) ≈ 30 mL/hr at rest in 25 °C
 *     - Recommended fluid intake from beverages: ~2 L/day = ~64 oz
 *   - Sweat rates by activity:
 *       light walking         0.3–0.6 L/hr  (10–20 oz/hr)
 *       moderate cycling      0.6–1.2 L/hr  (20–40 oz/hr)
 *       heavy running         1.2–2.0 L/hr  (40–68 oz/hr)
 *       elite endurance, hot  2.0–3.0 L/hr  (68–100 oz/hr)
 *   - Heat impact (rest, clothed, healthy adult):
 *       30 °C  +30–50 % vs neutral
 *       35 °C  +100–200 %  (sweat roughly doubles)
 *       40 °C  +300–500 %  (sweat ~3–6×)
 *   - Humidity impact: above 50 % RH evaporative cooling is
 *     impaired; the body compensates by sweating more. Effect is
 *     MULTIPLICATIVE on top of the heat term — at low temperature,
 *     humidity contributes negligibly to fluid loss.
 *
 * ─── Score calibration ───────────────────────────────────────────
 *
 *   100 score points ≈ one full performance day's hydration capacity.
 *
 * Anchor scenarios (the constants below are tuned so these all
 * land in physiologically defensible ranges — see the unit tests):
 *
 *   Sedentary 150 lb, 25 °C, 50 % RH:
 *       ≈ 0.083 pts/min = 5 pts/hr
 *       PEAK → DEPLETED (drop of 40 pts) in ~8 hours.
 *
 *   Office worker (activity 2), 25 °C, 50 % RH:
 *       ≈ 0.33 pts/min = 20 pts/hr
 *       PEAK → RECOVERING in ~75 min — gentle nudge to drink.
 *
 *   Athlete training (activity 8), 30 °C, 60 % RH:
 *       ≈ 1.5 pts/min = ~90 pts/hr
 *       PEAK → DEPLETED in ~28 min — drink during the workout.
 *
 *   Heavy exercise, hot/humid (activity 10, 35 °C, 80 % RH):
 *       ≈ 2.5 pts/min = ~150 pts/hr
 *       Drink continuously.
 *
 *   Sleeping 150 lb, 22 °C, 60 % RH (sleep ×0.5):
 *       ≈ 0.04 pts/min = ~2.5 pts/hr
 *       Over 8 hr: ~20 pts decay → wake at BALANCED, not DEPLETED.
 */

/** Sedentary insensible loss for a 150-lb adult at thermoneutral. */
export const RESTING_BASELINE_PER_MIN = 0.083;

/** Added points/min per unit of `activityLevel` (0..10 axis). */
export const ACTIVITY_PER_LEVEL = 0.125;

/** Heat amplification slope: +0.6 multiplier per 10 °C above 25 °C. */
export const HEAT_AMPLIFICATION_PER_10C = 0.6;

/**
 * Humidity coupling factor. Humidity excess (above 50 % RH) multiplies
 * the heat premium by this factor. Pure cool-weather humidity has no
 * effect because heat premium is zero.
 */
export const HUMIDITY_AMPLIFICATION_FACTOR = 0.5;

/** Sleep mode multiplier — insensible loss continues but reduced. */
export const SLEEP_MULTIPLIER = 0.5;

/** Clutch mode multiplier — high-stakes performance window. */
export const CLUTCH_MULTIPLIER = 1.3;

/** Reference weight (lbs) used for body-mass scaling. */
export const REFERENCE_WEIGHT_LBS = 150;

/** Lower bound on `bodyWeightLbs` to protect against zero / undefined. */
export const MIN_WEIGHT_LBS = 60;

/** Thermoneutral temperature (°C) — below this no heat amplification. */
export const THERMONEUTRAL_C = 25;

/** Reference humidity (%) — below this no humidity amplification. */
export const HUMIDITY_NEUTRAL_PCT = 50;

/** Default humidity when no weather feed is available (neutral). */
export const HUMIDITY_DEFAULT_PCT = 50;

/**
 * Converts a 0..10 `heatLoad` axis to an approximate °C temperature
 * for back-fill when `weatherTempC` is not yet available from the
 * api-server. Calibrated so 0 ≈ 20 °C (cool morning), 10 ≈ 32 °C
 * (peak summer). Real OpenWeather data always overrides this.
 */
export function heatLoadToTempC(heatLoad: number): number {
  return 20 + Math.max(0, Math.min(10, heatLoad)) * 1.2;
}

/**
 * Heat amplification multiplier.
 *
 * Per ACSM/ISO 7933, sweat rate rises ~linearly above the
 * thermoneutral zone (≈25 °C clothed). At 35 °C resting sweat
 * approximately doubles vs neutral. Modeled as:
 *   1.0 at ≤25 °C
 *   1.6 at 35 °C
 *   2.2 at 45 °C
 *
 * Multiplicative on the additive (base + activity) term — heat
 * doesn't dehydrate independently, it amplifies whatever sweat rate
 * the body is already producing.
 */
export function heatMultiplier(tempC: number): number {
  const above = Math.max(0, tempC - THERMONEUTRAL_C);
  return 1 + (above / 10) * HEAT_AMPLIFICATION_PER_10C;
}

/**
 * Humidity amplification factor.
 *
 * Per WBGT (NIOSH, ISO 7243), humidity above 50 % RH progressively
 * impairs evaporative cooling. The body compensates by producing
 * MORE sweat to maintain core temperature, so total fluid loss
 * rises. The effect is multiplicative on top of heat — humidity in
 * cool weather has negligible dehydration impact, but humidity in
 * hot weather can substantially increase it.
 *
 * Returns 1.0 when humidity ≤ 50 % OR when temperature is at/below
 * thermoneutral (heatMul == 1, so heatPremium == 0).
 *
 * At 100 % RH and 35 °C: 1 + 1.0 × 0.6 × 0.5 = 1.30  (×1.30 amplifier)
 * At 100 % RH and 25 °C: 1 + 1.0 × 0.0 × 0.5 = 1.00  (no effect)
 */
export function humidityAmplification(humidityPct: number, heatMul: number): number {
  const heatPremium = Math.max(0, heatMul - 1);
  const humidExcess = Math.max(0, (humidityPct - HUMIDITY_NEUTRAL_PCT) / HUMIDITY_NEUTRAL_PCT);
  return 1 + humidExcess * heatPremium * HUMIDITY_AMPLIFICATION_FACTOR;
}

/**
 * Inputs for the depletion calculation. A subset of `UserState` —
 * kept narrow so the helper is testable without constructing a full
 * engine state. Every field is optional with safe defaults.
 */
export interface DepletionInputs {
  /** Body weight in pounds. Defaults to 150 lb. Floors at 60 lb. */
  bodyWeightLbs?: number | null;
  /** Activity intensity 0..10. Defaults to 0 (rest). Clamped. */
  activityLevel?: number | null;
  /** Real weather temperature (°C) from OpenWeather. Preferred input. */
  weatherTempC?: number | null;
  /** Real weather humidity (%) from OpenWeather. Preferred input. */
  weatherHumidity?: number | null;
  /** 0..10 abstract axis used as fallback when no real weather data. */
  heatLoad?: number | null;
  /** Awake (true) or asleep (false). Defaults to awake. */
  isAwake?: boolean;
  /** Clutch mode active — multiplies decay ×1.3. */
  clutchActive?: boolean;
  /**
   * Additional multiplier from `activeDecayMultiplier(drinks)` when
   * social mode is on. Pass 1 (or omit) when not in social mode.
   * The caller computes this because the drinks list lives outside
   * this helper's scope.
   */
  socialDecayMultiplier?: number;
}

/**
 * The single source of truth for hydration depletion (pts/min).
 *
 * Returns a strictly non-negative rate — every modifier is either
 * additive-and-clamped or a positive multiplier. The caller is free
 * to multiply by elapsed minutes and subtract from the score.
 *
 * Order of operations:
 *   1. Additive: baseline (weight-scaled) + activity
 *   2. Multiplicative environmental: heat × humidity
 *   3. Multiplicative state modifiers: sleep, clutch, social
 *
 * State modifiers come LAST so clutch (×1.3) and social (alcohol
 * diuresis) amplify the full environmental rate, not just baseline.
 */
export function depletionRatePerMinute(inputs: DepletionInputs): number {
  const weightRaw = inputs.bodyWeightLbs;
  const weight = Math.max(MIN_WEIGHT_LBS, weightRaw == null || weightRaw <= 0 ? REFERENCE_WEIGHT_LBS : weightRaw);
  const activity = Math.max(0, Math.min(10, inputs.activityLevel ?? 0));

  // Prefer real weather data; otherwise back-fill from heatLoad axis
  // so the score still renders before the first OpenWeather lookup
  // completes (or when offline).
  const tempC = inputs.weatherTempC != null
    ? inputs.weatherTempC
    : heatLoadToTempC(inputs.heatLoad ?? 0);
  const humidity = inputs.weatherHumidity != null
    ? inputs.weatherHumidity
    : HUMIDITY_DEFAULT_PCT;

  const baseDecay = RESTING_BASELINE_PER_MIN * (weight / REFERENCE_WEIGHT_LBS);
  const activityDecay = ACTIVITY_PER_LEVEL * activity;

  const heatMul = heatMultiplier(tempC);
  const humFac = humidityAmplification(humidity, heatMul);

  let perMin = (baseDecay + activityDecay) * heatMul * humFac;

  // Sleep — body still loses water via respiration but at a reduced
  // rate (no activity, lower core temp setpoint).
  if (inputs.isAwake === false) perMin *= SLEEP_MULTIPLIER;

  // Clutch mode — high-stakes performance window. The user has opted
  // in to faster recheck cadence, so we accelerate decay so the orb
  // and AI Coach mirror that intensity.
  if (inputs.clutchActive) perMin *= CLUTCH_MULTIPLIER;

  // Alcohol-driven diuresis. Caller is responsible for computing
  // this from the in-window drinks list (we don't import the social
  // module here to keep this file zero-dep).
  const social = inputs.socialDecayMultiplier ?? 1;
  if (social > 1) perMin *= social;

  return perMin;
}
