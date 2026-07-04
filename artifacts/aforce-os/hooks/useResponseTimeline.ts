/**
 * useResponseTimeline — Section 60 surface accessor for the Response Timeline.
 *
 * Reads the append-only Command-Event Ledger (an external store outside the
 * hydration reducer — Score-Protection isolation) and runs the pure Section 60
 * query layer: the bucketed timeline, the data-maturity gate, and how many days
 * of personal history exist. Dispatches nothing; never touches score. Mirrors
 * `useUnifiedPerformanceMemory`.
 */
import React from 'react';

import { useCommandLedgerStore, selectCommandEvents } from '@/services/commandLedger';
import {
  deriveResponseTimeline,
  isResponseTimelineReady,
  personalDataDurationDays,
  type ResponseTimelineBucket,
} from '@/utils/intelligence/responseTimeline';

export interface ResponseTimelineView {
  /** Weekly buckets, newest-first. */
  timeline: ResponseTimelineBucket[];
  /** True once ~60 days of history exist (the spec maturity gate). */
  ready: boolean;
  /** Whole days of personal history so far — drives the "collecting" progress. */
  daysOfData: number;
}

export function useResponseTimeline(): ResponseTimelineView {
  const ledger = useCommandLedgerStore();
  return React.useMemo(() => {
    const events = selectCommandEvents(ledger);
    const now = Date.now();
    return {
      timeline: deriveResponseTimeline(events, now),
      ready: isResponseTimelineReady(events, now),
      daysOfData: personalDataDurationDays(events, now),
    };
  }, [ledger]);
}
