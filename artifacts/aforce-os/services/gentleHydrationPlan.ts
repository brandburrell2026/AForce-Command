/** Presentation-only policy for Gentle Hydration. */
import { GENTLE_HYDRATION_COPY as copy } from "./gentleHydrationCopy";
export function createGentleHydrationPresentation(enabled: boolean) {
  return {
    hideShortfall: enabled,
    progressLabel: enabled ? copy.neutralProgress : null,
  };
}
