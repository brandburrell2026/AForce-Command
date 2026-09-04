/**
 * useWeeklyCompliance — REAL 7-day compliance from journal rollups
 * (Wave-2 PR4: replaces the fabricated weeklyCompliancePct=82 that the
 * Protocol tab presented as the member's own consistency).
 *
 * Derivation matches the Journal screen's Consistency KPI (a day is
 * compliant when it has ≥1 snapshot and avgScore ≥ 65) with one honest
 * difference: where Journal shows 0% for an empty range, this returns
 * `null` — the Protocol sheet makes a second-person claim ("You're X%
 * consistent this week"), and with no data the claim must not be made
 * at all rather than rendered as 0%.
 *
 * Fetches lazily (only when `active` first becomes true — the sheet
 * open / badge mount), so the Protocol tab adds no cold-start network
 * call and no auth-race surface. Fetch failure degrades to `null`.
 */
import React from 'react';

import { fetchJournalRollups } from '@/services/realApi';
import type { JournalRollup } from '@/types';
import { observedRows } from '@/utils/scoring/boundarySeries';

/**
 * A day counts as compliant with ≥1 snapshot and avgScore ≥ 65.
 *
 * BOTH SIDES OF THE RATIO ARE OBSERVED DAYS. The numerator always required an
 * observation; the denominator used to be `rollups.length`. On the dense wire
 * that is the width of the member's eligible window, so a day HydroState never
 * observed counted as a failed day — dropping a member who was compliant on
 * every measured day from 100% to 29% and telling them so in the second
 * person ("You're 29% consistent this week"). A day with no measurement is not
 * a day the member failed; it is a day we cannot speak about.
 *
 * Returns `null` when nothing was observed at all — the Protocol sheet makes a
 * second-person claim, and with no measurements the claim must not be made
 * rather than rendered as 0%.
 */
export function computeWeeklyCompliancePct(
  rollups: readonly JournalRollup[],
): number | null {
  const observed = observedRows(rollups);
  if (observed.length === 0) return null;
  const compliantDays = observed.filter((r) => r.avgScore >= 65).length;
  return Math.round((compliantDays / observed.length) * 100);
}

export function useWeeklyCompliance(active: boolean): number | null {
  const [pct, setPct] = React.useState<number | null>(null);
  const requestedRef = React.useRef(false);

  React.useEffect(() => {
    if (!active || requestedRef.current) return;
    requestedRef.current = true;
    let cancelled = false;
    fetchJournalRollups(7)
      .then((rollups) => {
        if (!cancelled) setPct(computeWeeklyCompliancePct(rollups));
      })
      .catch(() => {
        // Honest absence — never a fabricated or stale number.
        if (!cancelled) setPct(null);
      });
    return () => {
      cancelled = true;
    };
  }, [active]);

  return pct;
}
