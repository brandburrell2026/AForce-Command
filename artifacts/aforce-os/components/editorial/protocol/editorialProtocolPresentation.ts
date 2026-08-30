/**
 * Editorial Protocol — pure presentation logic (E4, founder decisions
 * 2026-08-30).
 */
import { ringFraction } from '@/components/protocol/protocolV3Presentation';

/**
 * The canonical clock's hairline gauge (Decision 1). The completion ring is
 * FOLDED INTO this gauge — one dominant instrument, and NOT a new metric:
 * it is the same completed/total the checklist states in words.
 *
 * DELEGATES to `ringFraction`, the shipped resolver the V3 ring already
 * used, rather than re-authoring the arithmetic. The E4 review caught the
 * duplicate: a forked copy would drift from the canonical rule silently and
 * would defeat the resolver-reuse constraint this migration is built on.
 * Not rendered as a percentage anywhere.
 */
export function briefGaugeFraction(completed: number, total: number): number {
  return ringFraction(completed, total);
}
