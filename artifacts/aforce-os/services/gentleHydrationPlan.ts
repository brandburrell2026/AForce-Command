/**
 * Pure daily presentation model for Gentle Hydration Mode.
 *
 * It projects the member's existing AFORCE target into lower-pressure check-in
 * moments. It does not calculate a medical fluid prescription, schedule an OS
 * notification, or mutate the hydration engine.
 */
import {
  gentleHydrationCheckInCount,
  type GentleHydrationCadence,
} from "./gentleHydrationMode";

export function localDayKey(at = new Date()): string {
  const year = at.getFullYear();
  const month = String(at.getMonth() + 1).padStart(2, "0");
  const day = String(at.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export interface GentleHydrationPlanInput {
  cadence: GentleHydrationCadence;
  ozConsumedToday: number;
  ozTarget: number;
  pausedOnDayKey?: string;
  deferredUntil?: string;
  now?: Date;
}

export interface GentleHydrationPlan {
  checkIns: number;
  complete: boolean;
  paused: boolean;
  deferred: boolean;
  nextMove: "log" | "wait" | "rest" | "complete";
  headline: string;
  detail: string;
}

export function createGentleHydrationPlan(
  input: GentleHydrationPlanInput,
): GentleHydrationPlan {
  const now = input.now ?? new Date();
  const checkIns = gentleHydrationCheckInCount(input.cadence);
  const complete =
    input.ozTarget > 0 && input.ozConsumedToday >= input.ozTarget;
  const paused = input.pausedOnDayKey === localDayKey(now);
  const deferred =
    !paused &&
    !complete &&
    Boolean(
      input.deferredUntil && Date.parse(input.deferredUntil) > now.getTime(),
    );

  if (complete) {
    return {
      checkIns,
      complete,
      paused: false,
      deferred: false,
      nextMove: "complete",
      headline: "Your hydration plan is complete.",
      detail: "Keep listening to your own pace.",
    };
  }
  if (paused) {
    return {
      checkIns,
      complete: false,
      paused: true,
      deferred: false,
      nextMove: "rest",
      headline: "Gentle hydration is paused for today.",
      detail:
        "Your regular hydration plan remains available whenever you are ready.",
    };
  }
  if (deferred) {
    return {
      checkIns,
      complete: false,
      paused: false,
      deferred: true,
      nextMove: "wait",
      headline: "Take the time you need.",
      detail:
        "Your next check-in will be ready later. There is no penalty for waiting.",
    };
  }
  return {
    checkIns,
    complete: false,
    paused: false,
    deferred: false,
    nextMove: "log",
    headline: "One small check-in at a time.",
    detail: `Use ${checkIns} smaller check-ins across your existing plan today.`,
  };
}
