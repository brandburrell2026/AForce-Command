/**
 * Hydration Scoring Engine — per-event, time-windowed.
 *
 * STATUS: Product design rubric (AForce IP), not a clinical model.
 * The constants below are the AForce performance-scoring spec — chosen
 * to produce a responsive, anti-gaming feel. They are NOT derived from
 * peer-reviewed sport-science literature and MUST NOT be presented as
 * medical claims. Calibration against blood-marker / urine-osmolality
 * work is on the Year-1 sport-science partnership roadmap.
 *
 * VOLUME PARITY (RP-8b, founder ruling 2026-08-31). Physiological credit
 * comes from consumed VOLUME, never from product identity. AForce may be
 * counted as a product / ritual fact (`aforceUnitsToday`), but the brand
 * of a fluid does not change what it is worth here. What this rubric said
 * before: a flat +10/+11 per AForce serving regardless of ounces, +2 heat
 * and +2 depletion bonuses reachable only through a branded fluid, and a
 * faster absorption curve for product — a premium that paid 5x water at
 * 4 oz and LESS than water at 32.
 *
 * Composition-based scoring (sodium, electrolytes, carbohydrate) is a
 * SEPARATE authorized lane and is deliberately absent here: nothing in
 * this file may infer composition from brand, format, or packaging.
 *
 * Rubric:
 *
 *   1 unit = 12 oz
 *
 *   Every fluid: +0.5 pts/oz  (12oz=+6, 16oz=+8, 24oz=+12, 32oz=+16)
 *
 *   Absorption cap: ≤1.5 units per rolling 20-min window. Excess
 *   intake is absorbed at 75% efficiency.
 *
 *   Absorption curve (all fluids): 60% immediate, 40% over 12.5 min
 *
 *   Score is clamped 0..100 by the caller. Continuous decay is owned
 *   by `utils/scoringEngine.ts`.
 *
 *   Anti-game: the cap prevents rapid stacked logs from spiking the score.
 *   Realistic feel: delayed portion ramps in linearly so the orb keeps
 *   moving after the log — feels like the body absorbing.
 */

import type { IntakeEvent, FluidType, ProductFlavor } from '../types';

// ─── Constants ───────────────────────────────────────────────────────────────
export const HYDRATION_UNIT_OZ = 12;
/**
 * Points per ounce of consumed fluid — the ONE physiological rate
 * (RP-8b, founder ruling 2026-08-31). Volume is the defensible input;
 * product identity is not. Formerly `WATER_PTS_PER_OZ`, when it applied
 * only to water and every other fluid took a flat brand rate instead.
 */
export const HYDRATION_PTS_PER_OZ = 0.5;

export const ABSORPTION_CAP_UNITS = 1.5;
export const ABSORPTION_WINDOW_MIN = 20;
export const EXCESS_EFFICIENCY = 0.75;

/**
 * The ONE absorption curve, applied to every fluid (RP-8b). AForce
 * formats previously took 70% immediate over a 25-minute ramp against
 * water's 60% over 12.5 — a second brand advantage, independent of the
 * points table, that made the same volume of product score faster AND
 * linger longer on the orb.
 */
export const HYDRATION_IMMEDIATE_PCT = 0.6;
export const HYDRATION_DELAYED_DURATION_MIN = 12.5;

export interface ImpactContext {
  /** True when the Heat Guard band is WARNING+ (heat score ≥ 45). */
  heatGuardActive: boolean;
  /** Score immediately before this intake — used for the Soursop bonus. */
  scoreBefore: number;
}

export interface ImpactResult {
  /** Raw flavor / oz score before the absorption cap. */
  baseImpact: number;
  /** After applying the 20-min absorption cap (≤ baseImpact). */
  capAdjusted: number;
  /** capAdjusted × immediate fraction. Applied at t=0. */
  immediate: number;
  /** capAdjusted × delayed fraction. Released linearly over delayedDurationMin. */
  delayed: number;
  delayedDurationMin: number;
  /** Effective absorption efficiency (1.0 = full, 0.75 = excess). */
  absorptionEfficiency: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
/**
 * PROVENANCE ONLY (RP-8b). This says WHAT was drunk so the breakdown can
 * report water vs product; it may never decide what the intake is WORTH.
 * The scoring path below is deliberately free of it.
 */
export function isAforceFluid(fluidType: FluidType): boolean {
  return fluidType !== 'water';
}

function unitsFromOz(oz: number): number {
  return oz / HYDRATION_UNIT_OZ;
}

/** Sum of units logged within `windowMin` minutes BEFORE `now`. */
export function unitsInWindow(events: IntakeEvent[], now: Date, windowMin: number = ABSORPTION_WINDOW_MIN): number {
  const cutoff = now.getTime() - windowMin * 60_000;
  let sum = 0;
  for (const e of events) {
    const t = e.loggedAt instanceof Date ? e.loggedAt.getTime() : new Date(e.loggedAt as unknown as string).getTime();
    if (t >= cutoff && t <= now.getTime()) sum += unitsFromOz(e.oz);
  }
  return sum;
}

/**
 * The base impact (before cap) of a consumed volume — VOLUME PARITY
 * (RP-8b, founder ruling 2026-08-31).
 *
 * Every fluid earns on the same per-ounce curve. `fluidType`, `flavor` and
 * `ctx` are accepted because callers hold them for provenance and audit,
 * and because a future COMPOSITION lane (separately authorized, not this
 * one) will need a real signal here — but none of them may change the
 * number today. Product identity is not a physiological input.
 *
 * What this replaced: a flat per-serving table (berry 10, watermelon 10,
 * soursop 11, unflavored 10) that ignored volume entirely, plus a +2 heat
 * bonus and a +2 depletion bonus reachable only through a branded fluid.
 * The `unflavored: 10` entry was the proof it keyed on format, not
 * composition.
 */
export function baseEventImpact(
  _fluidType: FluidType,
  _flavor: ProductFlavor | undefined,
  oz: number,
  _ctx: ImpactContext,
): number {
  return oz * HYDRATION_PTS_PER_OZ;
}

/**
 * Apply the rolling 20-min absorption cap. The cap is on UNITS, not
 * points — so a 32oz water (≈2.67 units) on its own already exceeds
 * the cap and gets the excess scaled.
 *
 * Splits the new intake into "under-cap" (full efficiency) and
 * "over-cap" (75%) portions; returns a single weighted multiplier
 * that the caller applies to baseImpact.
 */
export function absorptionEfficiency(
  prevUnitsInWindow: number,
  newUnits: number,
): number {
  if (newUnits <= 0) return 1;
  const headroom = Math.max(0, ABSORPTION_CAP_UNITS - prevUnitsInWindow);
  if (newUnits <= headroom) return 1;
  const underCap = headroom;
  const overCap = newUnits - headroom;
  return (underCap + overCap * EXCESS_EFFICIENCY) / newUnits;
}

/**
 * Compute the full impact decomposition for a NEW event, given the
 * recent event history and current context. The caller persists this
 * decomposition on the event so the materialized score is reproducible.
 */
export function computeEventImpact(
  fluidType: FluidType,
  flavor: ProductFlavor | undefined,
  oz: number,
  history: IntakeEvent[],
  now: Date,
  ctx: ImpactContext,
): ImpactResult {
  const base = baseEventImpact(fluidType, flavor, oz, ctx);
  const prevUnits = unitsInWindow(history, now);
  const efficiency = absorptionEfficiency(prevUnits, unitsFromOz(oz));
  const capAdjusted = base * efficiency;
  // One curve for every fluid (RP-8b): brand buys no faster uptake and no
  // longer tail.
  const immediatePct = HYDRATION_IMMEDIATE_PCT;
  const delayedDur = HYDRATION_DELAYED_DURATION_MIN;
  return {
    baseImpact: base,
    capAdjusted,
    immediate: capAdjusted * immediatePct,
    delayed: capAdjusted * (1 - immediatePct),
    delayedDurationMin: delayedDur,
    absorptionEfficiency: efficiency,
  };
}

/** Linear ramp of the delayed portion over its absorption window. */
function materializedFor(event: IntakeEvent, now: Date): number {
  const t = event.loggedAt instanceof Date ? event.loggedAt.getTime() : new Date(event.loggedAt as unknown as string).getTime();
  const elapsedMin = Math.max(0, (now.getTime() - t) / 60_000);
  const immediate = event.immediate;
  const delayed = event.delayed;
  const dur = Math.max(0.0001, event.delayedDurationMin);
  const delayedRealized = elapsedMin >= dur ? delayed : delayed * (elapsedMin / dur);
  return immediate + delayedRealized;
}

/**
 * Sum the materialized score contribution of all events. Caller should
 * have already trimmed the array to "today" — this function does not
 * re-filter by date because "today" is timezone-dependent.
 *
 * Returns a breakdown so the orb breakdown UI can label water vs AForce.
 */
export function materializedIntakePoints(events: IntakeEvent[], now: Date): {
  total: number;
  waterPoints: number;
  aforcePoints: number;
} {
  // The split is PROVENANCE reporting (which points came from product),
  // never a scoring difference — both buckets are earned on the identical
  // per-ounce curve since RP-8b.
  let waterPoints = 0;
  let aforcePoints = 0;
  // Defensive 24h trim at materialization time so stale events that
  // weren't trimmed on a write path can't keep contributing to score.
  const fresh = trimOldEvents(events, now);
  for (const e of fresh) {
    const m = materializedFor(e, now);
    if (e.fluidType === 'water') waterPoints += m;
    else aforcePoints += m;
  }
  return { total: waterPoints + aforcePoints, waterPoints, aforcePoints };
}

/** Trim events older than `maxAgeMin` so the JSONB array stays bounded. */
export function trimOldEvents(events: IntakeEvent[], now: Date, maxAgeMin: number = 24 * 60): IntakeEvent[] {
  const cutoff = now.getTime() - maxAgeMin * 60_000;
  return events.filter((e) => {
    const t = e.loggedAt instanceof Date ? e.loggedAt.getTime() : new Date(e.loggedAt as unknown as string).getTime();
    return t >= cutoff;
  });
}
