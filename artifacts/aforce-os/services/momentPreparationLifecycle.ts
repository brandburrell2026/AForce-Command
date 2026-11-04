import type { MomentPreparation } from "@/types/moments";

/** Terminal outcomes on the existing Moment. Cancellation is not a return,
 * completion, check-in, or permission to resume expired advice. */
export function preparationClosed(
  preparation: MomentPreparation | undefined,
): boolean {
  return !!(preparation?.returnedAtIso || preparation?.cancelledAtIso);
}
