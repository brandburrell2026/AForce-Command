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

/** A closed preparation keeps its original terminal outcome. Private Replay
 * feedback can change without reopening Quiet or fabricating another outcome. */
export function preparationTransitionAllowed(
  before: MomentPreparation | undefined,
  after: MomentPreparation | undefined,
): boolean {
  if (after?.returnedAtIso && after.cancelledAtIso) return false;
  if (!preparationClosed(before)) return true;
  return (
    !!after &&
    after.returnedAtIso === before?.returnedAtIso &&
    after.cancelledAtIso === before?.cancelledAtIso
  );
}
