/**
 * heatGuardInput — the HONEST input builder for the Heat Guard engine
 * (pure, node-safe; extracted from useHeatGuard so the COR-001 battery can
 * exercise it without the Expo module graph).
 *
 * TRUTH CONTRACT (founder ruling, wrong-scale close-out): the engine input
 * built here must never present an inferred proxy as a measured fact.
 *  - MEASURED inputs come only from real sources: OpenWeather temperature/
 *    humidity, member-reported symptoms/urine/energy, real body weight.
 *  - The generic 0–10 activity drive contributes ONLY through the engine's
 *    documented 0–1 `activityIntensity` axis, via `fraction01FromScale10`.
 *  - UNMEASURED vitals (heart rate, HR recovery, sweat-loss rate, continuous
 *    active minutes, sun exposure, sleep deficit) are represented by the
 *    engine's zero-risk NEUTRAL element — unknown adds no risk and is never
 *    invented. The previous inline version synthesized these from the drives
 *    (ambient 78+heatLoad*22 → 166 °F, HR 110+activity*60 → 410 bpm, sweat
 *    sweatRate*30 → 90 oz/hr, negative recoveryMomentum); that is banned.
 */

import type { HeatSignalInput, HeatSymptom } from '../types/heat';
import type { UserState } from '../types';
import { fraction01FromScale10 } from '../utils/quantities';
import { resolveCurrentWeather } from '../utils/environment/weatherFreshness';

export const SYMPTOM_IDS: HeatSymptom[] = [
  'dizziness','headache','nausea','cramping','chills','confusion','fatigue',
];

/**
 * Engine-neutral values for UNMEASURED inputs — each is the element that
 * contributes ZERO risk points in `heatRiskEngine`'s corresponding
 * calculator, so an unknown measurement can never create (or inflate) a
 * heat alarm. None of these values is displayed anywhere; they exist only
 * so the engine's required-number contract is met without inventing data.
 */
const NEUTRAL = {
  /** < 80 °F: heatIndexLoad adds 0 pts and humidity is inert below it. */
  ambientTempF: 70,
  /** Inert whenever temp < 80 °F; 0 also adds nothing above it. */
  humidityPct: 0,
  /** sunExposure * 4 → 0 pts. */
  sunExposure: 0,
  /** ≤ 20 min → 0 pts in activityStress. */
  continuousActiveMin: 0,
  /** < 150 bpm → 0 pts in heartRateStrain (0 = no monitor, not a reading). */
  heartRateBpm: 0,
  /** 0 → no recovery-delay strain. */
  hrRecoveryDelaySec: 0,
  /** lossPct < 0.8 → 0 pts; with weight 0 the engine skips the calc. */
  sweatLossOzPerHr: 0,
  /** 1 = "no momentum deficit": recoveryFailure adds (1 - momentum) * 6. */
  recoveryMomentum: 1,
  /** 0 hr → 0 pts in sleepPenalty. */
  sleepDeficitHrs: 0,
} as const;

/**
 * Build the heat engine's input HONESTLY from user state. Measured facts
 * flow through as measured; the activity drive contributes only on the
 * engine's documented 0–1 intensity axis; everything unmeasured is the
 * zero-risk neutral above.
 */
export function buildHeatSignalInput(
  userState: Pick<
    UserState,
    | 'weatherTempC' | 'weatherHumidity' | 'weatherFetchedAt' | 'activityLevel'
    | 'bodyWeightLbs' | 'symptoms' | 'urineSignal' | 'energyState' | 'lastIntakeTime'
  >,
  hydrationScore: number,
  // PR5: the instant the input is built for. Trailing and defaulted, so the
  // live hook keeps its wall-clock semantics; deterministic callers inject.
  now: number = Date.now(),
): HeatSignalInput {
  const symptoms: HeatSymptom[] = (userState.symptoms ?? []).filter(
    (s): s is HeatSymptom => (SYMPTOM_IDS as string[]).includes(s),
  );
  // MEASURED: real OpenWeather readings while the canonical freshness verdict
  // (PR5 — one truth, the versioned ValidityPolicy) still calls them current;
  // the zero-risk NEUTRAL otherwise. Heat Guard is a safety engine: a reading
  // from yesterday evening must not raise (or suppress) a heat alarm about
  // this afternoon. Beyond validity the engine treats ambient exactly as it
  // treats unmeasured — the neutral element, never an invented value.
  const weather = resolveCurrentWeather(userState, now);
  const tempC = weather.tempC;
  const ambientTempMeasured = tempC != null && Number.isFinite(tempC);
  const ambientTempF = ambientTempMeasured ? tempC * (9 / 5) + 32 : NEUTRAL.ambientTempF;
  const humidity = weather.humidityPct;
  const humidityPct =
    humidity != null && Number.isFinite(humidity)
      ? Math.max(0, Math.min(100, humidity))
      : NEUTRAL.humidityPct;
  // DERIVED DRIVE → the engine's documented 0–1 intensity axis only.
  const activityIntensity = fraction01FromScale10(
    Number.isFinite(userState.activityLevel) ? userState.activityLevel : 0,
  );
  // MEASURED weight or 0 — the engine's own `bodyWeightLbs > 0` guard then
  // skips the sweat-loss estimate instead of us inventing a 175 lb body.
  const bodyWeightLbs =
    Number.isFinite(userState.bodyWeightLbs) && (userState.bodyWeightLbs as number) > 0
      ? (userState.bodyWeightLbs as number)
      : 0;
  const lastIntakeMs = new Date(userState.lastIntakeTime).getTime();
  const minutesSinceLastIntake = Number.isFinite(lastIntakeMs)
    ? Math.max(0, Math.round((now - lastIntakeMs) / 60000))
    : 0;

  return {
    hydrationScore,
    recentFluidOz: 0, // no per-hour intake ledger here; 0 claims no credit
    minutesSinceLastIntake,
    ambientTempF,
    humidityPct,
    ambientTempMeasured,
    sunExposure: NEUTRAL.sunExposure,
    continuousActiveMin: NEUTRAL.continuousActiveMin,
    activityIntensity,
    heartRateBpm: NEUTRAL.heartRateBpm,
    hrRecoveryDelaySec: NEUTRAL.hrRecoveryDelaySec,
    sweatLossOzPerHr: NEUTRAL.sweatLossOzPerHr,
    bodyWeightLbs,
    recoveryMomentum: NEUTRAL.recoveryMomentum,
    symptoms,
    urineSignal: userState.urineSignal ?? 2,
    energyState:
      userState.energyState === 'crashed' ? 'crashed'
      : userState.energyState === 'low' ? 'low'
      : userState.energyState === 'peak' ? 'peak' : 'steady',
    sleepDeficitHrs: NEUTRAL.sleepDeficitHrs,
    recentHeatEvent: false,
  };
}

/**
 * PR5 — the CURRENT ambient temperature for band-gating, or null.
 *
 * Pure seam for `useHeatGuard`'s voice-escalation gate, extracted so the gate
 * is law-testable: a stale reading must not decide whether a heat warning
 * speaks. Returns the same canonical verdict the engine input uses.
 */
export function currentAmbientTempC(
  userState: Pick<UserState, 'weatherTempC' | 'weatherFetchedAt'>,
  now: number = Date.now(),
): number | null {
  return resolveCurrentWeather(userState, now).tempC;
}
