/**
 * Hydration Scoring Engine — per-event, time-windowed.
 *
 * STATUS: Product design rubric (AForce IP), not a clinical model.
 * The constants below are the AForce performance-scoring spec — chosen
 * to produce a responsive, anti-gaming feel and to reward AForce-
 * formulated blends. They are NOT derived from peer-reviewed sport-
 * science literature and MUST NOT be presented as medical claims.
 * Calibration against blood-marker / urine-osmolality work is on the
 * Year-1 sport-science partnership roadmap.
 *
 * Rubric:
 *
 *   1 unit = 12 oz
 *
 *   Water:    +0.5 pts/oz  (so 12oz=+6, 16oz=+8, 24oz=+12, 32oz=+16)
 *   AForce:
 *     Berry Blast        +10
 *     Watermelon Surge   +10 (+2 if Heat Guard active)
 *     Soursop Edge       +11 (+2 if scoreBefore < 40)
 *
 *   Absorption cap: ≤1.5 units per rolling 20-min window. Excess
 *   intake is absorbed at 75% efficiency.
 *
 *   Absorption curve:
 *     Water:  60% immediate, 40% over 12.5 min
 *     AForce: 70% immediate, 30% over 25 min
 *
 *   Score is clamped 0..100 by the caller. Continuous decay is owned
 *   by `utils/scoringEngine.ts`.
 *
 *   Anti-game: cap prevents 4 sticks in 5min from being a +40 jump.
 *   Realistic feel: delayed portion ramps in linearly so the orb keeps
 *   moving for ~25 min after the log — feels like the body absorbing.
 */

import type { IntakeEvent, FluidType, ProductFlavor } from '../types';

// ─── Constants ───────────────────────────────────────────────────────────────
export const HYDRATION_UNIT_OZ = 12;
export const WATER_PTS_PER_OZ = 0.5;

export const ABSORPTION_CAP_UNITS = 1.5;
export const ABSORPTION_WINDOW_MIN = 20;
export const EXCESS_EFFICIENCY = 0.75;

export const WATER_IMMEDIATE_PCT = 0.6;
export const WATER_DELAYED_DURATION_MIN = 12.5;

export const AFORCE_IMMEDIATE_PCT = 0.7;
export const AFORCE_DELAYED_DURATION_MIN = 25;

// Per-flavor base impact for AForce products (regardless of format —
// stick / RTD / canister all map to the same flavor table).
export const AFORCE_BASE_IMPACT: Record<ProductFlavor, number> = {
  berry: 10,
  watermelon: 10,
  soursop: 11,
  unflavored: 10,
};

const HEAT_GUARD_BONUS = 2;
const SOURSOP_DEPLETED_BONUS = 2;
const SOURSOP_DEPLETED_THRESHOLD = 40;

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
function isAforce(fluidType: FluidType): boolean {
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

/** Compute the base impact (before cap) for a fluid + flavor + context. */
export function baseEventImpact(
  fluidType: FluidType,
  flavor: ProductFlavor | undefined,
  oz: number,
  ctx: ImpactContext,
): number {
  if (fluidType === 'water') {
    return oz * WATER_PTS_PER_OZ;
  }
  const f: ProductFlavor = flavor ?? 'unflavored';
  let impact = AFORCE_BASE_IMPACT[f];
  if (f === 'watermelon' && ctx.heatGuardActive) impact += HEAT_GUARD_BONUS;
  if (f === 'soursop' && ctx.scoreBefore < SOURSOP_DEPLETED_THRESHOLD) impact += SOURSOP_DEPLETED_BONUS;
  return impact;
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
  const immediatePct = isAforce(fluidType) ? AFORCE_IMMEDIATE_PCT : WATER_IMMEDIATE_PCT;
  const delayedDur = isAforce(fluidType) ? AFORCE_DELAYED_DURATION_MIN : WATER_DELAYED_DURATION_MIN;
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
