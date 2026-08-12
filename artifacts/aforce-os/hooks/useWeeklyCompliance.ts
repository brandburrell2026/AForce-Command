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

/** A day counts as compliant with ≥1 snapshot and avgScore ≥ 65. */
export function computeWeeklyCompliancePct(
  rollups: readonly JournalRollup[],
): number | null {
  if (rollups.length === 0) return null;
  const compliantDays = rollups.filter(
    (r) => r.snapshotsCount > 0 && r.avgScore >= 65,
  ).length;
  return Math.round((compliantDays / rollups.length) * 100);
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
