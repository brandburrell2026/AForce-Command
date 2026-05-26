/**
 * Hydration Demand Engine™ — shared pure module.
 *
 * Replaces generic "8 glasses a day" logic with an input-driven daily
 * hydration target. Pure, dependency-free arithmetic so the same
 * module can run in mobile reducers, server admin/debug endpoints,
 * and future Intelligence Layer prompt builders without instantiating
 * any UI or pulling in any platform code.
 *
 * Architecture lock alignment:
 *   - Inputs:  weight, activity, sweat, environment, heat, humidity,
 *              sleep, recovery, water cycles.
 *   - Outputs: today target (oz), remaining (oz), command (action
 *              string), hydration load (Low | Moderate | High).
 *   - Rules:   No 8-glasses logic. Commands are actions only — never
 *              forecasts. Output strings never mention model names,
 *              "AI", "engine", or any medical claim.
 *
 * This module is the single source of truth. Mobile re-exports it
 * via `artifacts/aforce-os/services/hydrationDemandEngine.ts` so the
 * existing adapter + selector + tests don't change. The server admin
 * route imports directly from `@workspace/demand-engine`.
 */

// ─── Inputs ─────────────────────────────────────────────────────────────────

export type SweatProfile = "low" | "moderate" | "high" | "very_high";

export type EnvironmentProfile =
  | "mostly_indoor"
  | "mixed"
  | "mostly_outdoor"
  | "hot_climate"
  | "travel_often";

export interface HydrationDemandInputs {
  /** Body weight in pounds. Required field on Profile. */
  weightLbs: number;
  /** Activity level on the 0..10 axis used by the rest of the app. */
  activityLevel: number;
  /** Sweat profile from Profile. Defaults to 'moderate' when unknown. */
  sweatProfile?: SweatProfile;
  /** Environment profile from Profile. Defaults to 'mixed' when unknown. */
  environmentProfile?: EnvironmentProfile;
  /** Ambient temperature in °C (current or forecast). Defaults to 22. */
  heatC?: number;
  /** Relative humidity, 0..100. Defaults to 50. */
  humidityPct?: number;
  /** Hours slept last night. Defaults to 7.5 (no penalty). */
  sleepHours?: number;
  /** Recovery score, 0..100. Defaults to 70 (neutral). */
  recoveryScore?: number;
  /** Oz already consumed today from any tracked source. Defaults to 0. */
  consumedOz?: number;
  /** Completed Water Cycles today. Defaults to 0. */
  completedCycles?: number;
}

// ─── Outputs ────────────────────────────────────────────────────────────────

export type HydrationLoad = "low" | "moderate" | "high";

export interface HydrationDemandOutputs {
  /** Today's full target in oz, clamped to a defensible band. */
  targetOz: number;
  /** Oz still needed (never negative). */
  remainingOz: number;
  /** Single action to take now. Present-tense, no forecasts. */
  command: string;
  /** Overall demand classification today. */
  load: HydrationLoad;
}

// ─── Tunable constants ──────────────────────────────────────────────────────

/** Sedentary baseline as a fraction of body weight in oz. 0.5 oz/lb. */
export const BASE_OZ_PER_LB = 0.5;

/** Floor / ceiling on the daily target. */
export const TARGET_FLOOR_OZ = 40;
export const TARGET_CEILING_OZ = 220;

/** Oz added per activityLevel point above the sedentary anchor of 2. */
export const ACTIVITY_ANCHOR = 2;
export const OZ_PER_ACTIVITY_POINT = 6;

/** Sweat profile additive (oz/day). */
export const SWEAT_ADDER_OZ: Record<SweatProfile, number> = {
  low: 0,
  moderate: 8,
  high: 20,
  very_high: 36,
};

/** Environment profile additive (oz/day). */
export const ENV_ADDER_OZ: Record<EnvironmentProfile, number> = {
  mostly_indoor: 0,
  mixed: 4,
  mostly_outdoor: 10,
  hot_climate: 18,
  travel_often: 6,
};

/** Heat ramp: only adds above 30 °C, ~3 oz per °C over. */
export const HEAT_THRESHOLD_C = 30;
export const OZ_PER_C_OVER_THRESHOLD = 3;

/** Typical Water Cycle volume (oz). Used by the command picker. */
export const CYCLE_OZ = 16;

// ─── Pure helpers ───────────────────────────────────────────────────────────

function clamp(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return min;
  return Math.min(Math.max(n, min), max);
}

function classifyLoad(targetOz: number, baselineOz: number): HydrationLoad {
  const over = targetOz - baselineOz;
  if (over <= 10) return "low";
  if (over <= 35) return "moderate";
  return "high";
}

function pickCommand(
  remainingOz: number,
  completedCycles: number,
  targetOz: number,
): string {
  if (remainingOz <= 0) return "Hold steady — target met";
  if (completedCycles === 0) return "Complete 1 Water Cycle";
  if (remainingOz > targetOz * 0.5) return "Drink 8 oz now";
  return "Complete 1 Water Cycle";
}

// ─── Engine ─────────────────────────────────────────────────────────────────

/**
 * Pure: same inputs → same outputs, no I/O, no Date.now(), no random.
 */
export function computeHydrationDemand(
  inputs: HydrationDemandInputs,
): HydrationDemandOutputs {
  const weight = clamp(inputs.weightLbs, 60, 400);
  const activity = clamp(inputs.activityLevel, 0, 10);
  const sweat = inputs.sweatProfile ?? "moderate";
  const env = inputs.environmentProfile ?? "mixed";
  const heatC = inputs.heatC ?? 22;
  const humidityPct = clamp(inputs.humidityPct ?? 50, 0, 100);
  const sleepHours = clamp(inputs.sleepHours ?? 7.5, 0, 14);
  const recoveryScore = clamp(inputs.recoveryScore ?? 70, 0, 100);
  const consumedOz = Math.max(0, inputs.consumedOz ?? 0);
  const completedCycles = Math.max(0, Math.floor(inputs.completedCycles ?? 0));

  // Baseline: 0.5 oz/lb — same anchor used by the depletion model.
  const baseline = weight * BASE_OZ_PER_LB;

  // Activity, sweat, environment.
  const activityAdder =
    Math.max(0, activity - ACTIVITY_ANCHOR) * OZ_PER_ACTIVITY_POINT;
  const sweatAdder = SWEAT_ADDER_OZ[sweat];
  const envAdder = ENV_ADDER_OZ[env];

  // Heat: ramps above 30 °C. Humidity amplifies once we're already
  // sweating (heat ≥ 25 °C and humidity ≥ 60 %).
  const heatAdder =
    heatC >= HEAT_THRESHOLD_C
      ? (heatC - HEAT_THRESHOLD_C) * OZ_PER_C_OVER_THRESHOLD
      : 0;
  const humidityAdder =
    heatC >= 25 && humidityPct >= 60
      ? ((heatC - 25) * (humidityPct - 60)) / 40
      : 0;

  // Sleep + recovery modifiers.
  const sleepAdder = sleepHours < 6 ? 5 : 0;
  const recoveryAdder = recoveryScore < 40 ? 6 : recoveryScore > 80 ? -3 : 0;

  const raw =
    baseline +
    activityAdder +
    sweatAdder +
    envAdder +
    heatAdder +
    humidityAdder +
    sleepAdder +
    recoveryAdder;

  const targetOz = Math.round(clamp(raw, TARGET_FLOOR_OZ, TARGET_CEILING_OZ));

  // Each completed cycle counts toward consumption even if the user
  // didn't log the volume separately.
  const cycleVolume = completedCycles * CYCLE_OZ;
  const remainingOz = Math.max(
    0,
    Math.round(targetOz - consumedOz - cycleVolume),
  );

  const command = pickCommand(remainingOz, completedCycles, targetOz);
  const load = classifyLoad(targetOz, baseline);

  return { targetOz, remainingOz, command, load };
}
