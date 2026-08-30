/**
 * Editorial Protocol — pure presentation logic (E4, founder decisions
 * 2026-08-30). No react-native import, so the law lock exercises it directly.
 */

/**
 * The canonical clock's hairline gauge (founder Decision 1). The completion
 * ring is FOLDED INTO this gauge — there is no second dominant completion
 * instrument, and this is not a new metric: it is the same completed/total
 * the checklist already states in words, expressed as the gauge's length.
 *
 * Deliberately NOT rendered as a percentage anywhere; the checklist remains
 * the truthful step-completion representation.
 */
export function briefGaugeFraction(completed: number, total: number): number {
  if (!Number.isFinite(completed) || !Number.isFinite(total) || total <= 0) return 0;
  return Math.max(0, Math.min(1, completed / total));
}
