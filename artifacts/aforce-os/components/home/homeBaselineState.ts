/**
 * Home — first-launch evidence gate (Wave 5, founder ruling 2026-08-12: "Do NOT
 * show a fabricated personal HydroState such as BALANCED 76 before sufficient
 * evidence exists").
 *
 * WHY THIS EXISTS. When this gate was built, `data/mockData.ts`'s
 * `defaultUserState` seeded a demo day — `unitsConsumedToday: 5`,
 * `ozConsumedToday: 45` — and the scoring engine faithfully turned that seed
 * into a confident BALANCED 76 for members who had never logged anything.
 * (PR-2 production-seed honesty, founder-authorized 2026-08-28, later moved
 * production to the honest empty seed in `data/initialUserState.ts` — the
 * tuned day now reaches the store only in DEMO/CAPTURE builds — superseding
 * the "seed stays exactly as it is" half of the original premise. The
 * scoring engine remains off-limits and untouched.) This gate stays either
 * way: nothing here computes, reads into, or alters a score. This module
 * decides ONE thing — whether Home has earned the right to PRESENT the
 * engine's number as the member's state yet.
 *
 * The three states are deliberate, and `pending` is the one that matters most.
 * The local intake list answers the question synchronously; the journal read
 * does not, and a screen that treated "not answered yet" as "no history" (or
 * as "history") would either flash a fabricated number before correcting
 * itself or call a veteran a beginner. `pending` says only what is true: not
 * known yet, so present nothing.
 *
 * Pure — no store reads, no clock, no i18n, no imports (the screen supplies
 * both inputs and translates the copy), so every branch is unit-testable in
 * the node vitest environment. Same convention as `homePresentation.ts` /
 * `homeV3Presentation.ts`.
 */

/** Journal window the evidence read asks for — one week, matching CircleScreenV3's. */
export const BASELINE_LOOKBACK_DAYS = 7;

/**
 * - `pending`     — not known yet; present no state at all.
 * - `building`    — nothing observed; present the baseline-building treatment.
 * - `established` — real logged behaviour exists; Home renders as it always has.
 */
export type HomeEvidenceState = 'pending' | 'building' | 'established';

export interface HomeEvidenceInput {
  /** The member's own logged intakes (`userState.intakeEvents`, rolling 24h). */
  intakeEventCount: number;
  /**
   * Real (non-synthetic) entries already in the store's cycle history, or
   * `null` while the mount-time `/v1/home` read has not settled. `null` means
   * "not known yet" — never "none". Collapsing those two is the whole defect
   * this gate prevents.
   *
   * This comes from state the store ALREADY holds, so the gate costs no
   * network read of its own — Home is the hottest screen in the app and
   * Wave-4's rule is no extra refetching.
   */
  loggedDayCount: number | null;
}

/**
 * Resolve how much AForce has actually observed about this member.
 *
 * Order matters: local intake is checked FIRST and on its own, so anyone who
 * has logged in the last 24h resolves to `established` on the very first
 * paint — no network wait, no placeholder, no change of mind a frame later.
 */
export function resolveHomeEvidence({
  intakeEventCount,
  loggedDayCount,
}: HomeEvidenceInput): HomeEvidenceState {
  if (Number.isFinite(intakeEventCount) && intakeEventCount > 0) return 'established';
  if (loggedDayCount == null || !Number.isFinite(loggedDayCount)) return 'pending';
  return loggedDayCount > 0 ? 'established' : 'building';
}

/**
 * Days in the window that ended with real intake on the books. Same predicate
 * CircleScreenV3 applies to the same payload (`endUnitsConsumed > 0`) — a day
 * the member merely had the app open is not a day of evidence.
 *
 * Structurally typed so this module stays import-free; `JournalRollup[]`
 * satisfies it.
 */
import { hasHydroStateObservation } from '@/utils/scoring/boundarySeries';

export function countLoggedRollupDays(
  rollups: readonly { endUnitsConsumed: number; snapshotsCount: number }[],
): number {
  // The observation gate is explicit rather than implied. On the dense wire
  // `endUnitsConsumed > 0` happens to imply an observation — it is assigned
  // only inside the aggregation's snapshot loop, and `emptyDay` zeroes it —
  // but that is an invariant of a file two packages away, and this filter
  // would silently start counting synthetic days the moment it changed.
  return rollups.filter(
    (r) => hasHydroStateObservation(r) && Number.isFinite(r.endUnitsConsumed) && r.endUnitsConsumed > 0,
  ).length;
}

/**
 * Real cycle history the member has actually accumulated. Synthetic baseline
 * entries (`isSynthetic`) are the honest placeholder the store seeds when
 * there is nothing to show — counting them as evidence would make the gate
 * assert exactly the state it exists to withhold.
 */
export function countRealHistoryEntries(
  history: readonly { isSynthetic?: boolean }[] | null | undefined,
): number | null {
  if (!history) return null;
  return history.filter((h) => h.isSynthetic !== true).length;
}
