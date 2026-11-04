import type { Moment, MomentPreparation } from "@/types/moments";

/** Terminal outcomes on the existing Moment. Cancellation is not a return,
 * completion, check-in, or permission to resume expired advice. */
export function preparationClosed(
  preparation: MomentPreparation | undefined,
): boolean {
  return !!(preparation?.returnedAtIso || preparation?.cancelledAtIso);
}

/** Only a known, valid end closes an unconfirmed candidate. Never guess an
 * event length, end Quiet on a clock, or manufacture a Return/check-in. */
export function unconfirmedPreparationExpired(
  moment: Pick<Moment, "startAtIso" | "endAtIso" | "preparation">,
  nowMs: number,
): boolean {
  const start = Date.parse(moment.startAtIso);
  const end = Date.parse(moment.endAtIso ?? "");
  return (
    !moment.preparation?.sealedAtIso &&
    Number.isFinite(nowMs) &&
    Number.isFinite(start) &&
    Number.isFinite(end) &&
    end > start &&
    end <= nowMs
  );
}
