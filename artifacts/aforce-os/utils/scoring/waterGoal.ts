/**
 * Water goal met (founder direction, Brandon, 2026-11-21; Julius's review open).
 *
 * Display only. Nothing here changes the score, a band or the scoring cap: it
 * READS the breakdown the score already produces and names the largest part
 * that is subtracting from it, when that part is one the member reported or
 * the clock measured. If the largest part is anything else, no reason is given.
 */
import type { UserState } from '../../types';
import { buildBreakdown, minutesSince } from './breakdown';

/** Today's logged ounces have reached today's target. No target, no goal. */
export function waterGoalMet(state: UserState): boolean {
  return state.ozTarget > 0 && state.ozConsumedToday >= state.ozTarget;
}

export type HoldDownReason =
  | { readonly id: 'urine' }
  | { readonly id: 'symptom' }
  | { readonly id: 'recency'; readonly minutes: number };

/** Parts a reason may be given for. A wearable-derived part is never named. */
const NAMEABLE = new Set(['urine', 'symptom', 'recency']);

/**
 * The single largest subtracting part of the score, if it is nameable.
 * A tie, or a larger part that is not nameable, gives null: the app does not
 * guess which one matters most.
 */
export function strongestHoldDown(state: UserState, now: number = Date.now()): HoldDownReason | null {
  const negatives = buildBreakdown(state, now)
    .contributions.filter((c) => c.id !== 'base' && c.delta < 0)
    .sort((a, b) => a.delta - b.delta);
  const top = negatives[0];
  if (!top || !NAMEABLE.has(top.id)) return null;
  if (negatives[1] && negatives[1].delta === top.delta) return null;
  if (top.id === 'recency') return { id: 'recency', minutes: minutesSince(state.lastIntakeTime, now) };
  return { id: top.id as 'urine' | 'symptom' };
}

/** "45 minutes", "1 hour", "3 hours": whole units only, never a false precision. */
export function sinceLastDrinkText(minutes: number): string {
  if (minutes < 60) return `${Math.max(1, Math.round(minutes))} minutes`;
  const hours = Math.round(minutes / 60);
  return hours === 1 ? '1 hour' : `${hours} hours`;
}
