/**
 * How the Journal screen settles its two INDEPENDENT reads.
 *
 * WHY THIS MODULE EXISTS. The screen used to load both with
 * `await Promise.all([fetchJournalTimeline(r), fetchJournalRollups(r)])` inside
 * one `try`. `Promise.all` rejects on the first rejection, so a failed rollups
 * read discarded a timeline that had already arrived intact, and the whole
 * screen fell to a single error line.
 *
 * That got much sharper when the client started HARD-FAILING on a non-dense
 * rollups response (founder rollout ruling, PR #912): a server that has not yet
 * shipped the dense capability makes `fetchJournalRollups` throw on every load,
 * and the trend chart — which is drawn from the TIMELINE and needs no rollup at
 * all — went dark with it.
 *
 * The two reads answer different questions and fail independently, so they are
 * settled independently.
 *
 * NULL IS "UNAVAILABLE", AND IT IS NOT `[]`. An empty array is a CLAIM — "we
 * looked and there is nothing here" — and rendering it after a failed read
 * tells a member with months of history that their journal is empty. The same
 * distinction `PerformanceSignalV3` already draws by deliberately leaving its
 * rollups state null on a failed read. Only a fetch that actually succeeded may
 * produce an array.
 *
 * This is pure so the behavior is testable without the store, the router, or
 * the Expo runtime — the same reason `homeBaselineState.ts` and the V3
 * presentation modules are pure.
 */
import type { JournalRollup, JournalTimelineEntry } from '@/types';

export interface JournalLoadState {
  /** Timeline entries, or null when that read failed. Never `[]` on failure. */
  timeline: JournalTimelineEntry[] | null;
  /** Dense rollups, or null when that read failed. Never `[]` on failure. */
  rollups: JournalRollup[] | null;
  /**
   * True only when BOTH reads failed and the screen genuinely has nothing to
   * show. A single failure is reported by its own null, so the surviving half
   * still renders.
   */
  bothFailed: boolean;
}

/**
 * Settle the two reads into screen state.
 *
 * Takes `PromiseSettledResult`s rather than doing the fetching, so a test can
 * state the exact combination it cares about — including the one that matters
 * most and is awkward to provoke against a real server: timeline fulfilled,
 * rollups rejected.
 */
export function settleJournalLoad(
  timelineResult: PromiseSettledResult<JournalTimelineEntry[]>,
  rollupsResult: PromiseSettledResult<JournalRollup[]>,
): JournalLoadState {
  const timeline = timelineResult.status === 'fulfilled' ? timelineResult.value : null;
  const rollups = rollupsResult.status === 'fulfilled' ? rollupsResult.value : null;
  return {
    timeline,
    rollups,
    bothFailed: timeline == null && rollups == null,
  };
}
