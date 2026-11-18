/**
 * Which secondary rows the Hydration card shows.
 *
 * Screen Upgrade v1.1 (App Spec v1.8.2, Appendix G · Hydration tab):
 * 'Electrolytes "0 servings" and Recovery "—": hide a row until it has data.'
 *
 * Presentation only. It reads counts the screen already has and decides
 * whether to draw a row; it changes no intake, target or score.
 */
export interface HydrationStatInputs {
  /** AFORCE servings logged today. */
  aforceUnitsToday: number;
}

export interface HydrationStatRows {
  electrolytes: boolean;
  recovery: boolean;
}

/**
 * There is no recovery reading on this screen today (see
 * hydrationRecoveryTileTruth.test.ts: the band may never be restated as one),
 * so the Recovery row has no data and stays hidden. When a real recovery
 * input exists, add it to the inputs and turn the row on from here.
 */
export const HYDRATION_HAS_RECOVERY_READING = false;

export function hydrationStatRows({ aforceUnitsToday }: HydrationStatInputs): HydrationStatRows {
  return {
    electrolytes: Number.isFinite(aforceUnitsToday) && aforceUnitsToday > 0,
    recovery: HYDRATION_HAS_RECOVERY_READING,
  };
}
