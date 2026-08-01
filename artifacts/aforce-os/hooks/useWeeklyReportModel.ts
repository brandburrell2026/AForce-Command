/**
 * useWeeklyReportModel — the shared data wiring for the Weekly Report.
 *
 * Assembles the deterministic `buildWeeklyReport` inputs the legacy report and
 * the E2 elite editorial both need: a stable "now" anchor + last completed week,
 * the async analytics event log, and the live Performance Age reference. It is a
 * read-only projection — `buildWeeklyReport` never fabricates a trend, and this
 * hook dispatches nothing into the hydration reducer (Score-Protection).
 *
 * Mounted ONLY where the report is actually shown (the legacy screen, or the
 * elite editorial which is itself flag-gated), so the flag-off Weekly surface
 * runs none of this.
 */
import React from 'react';

import {
  buildWeeklyReport,
  lastCompletedWeek,
  type WeeklyReport,
} from '@/utils/weeklyReport';
import type { AnalyticsEvent } from '@/utils/analytics/metrics';
import { getAnalyticsSnapshot } from '@/services/analytics';
import { usePerformanceAge } from '@/hooks/usePerformanceAge';

export interface WeeklyReportModel {
  report: WeeklyReport;
  weekStartISO: string;
  weekEndISO: string;
  generatedAtISO: string;
}

export function useWeeklyReportModel(): WeeklyReportModel {
  // Deterministic "now" anchor captured once on mount so the report + its week
  // boundaries stay stable while the screen is open.
  const nowISO = React.useRef(new Date().toISOString()).current;
  const week = React.useMemo(() => lastCompletedWeek(nowISO), [nowISO]);

  const [events, setEvents] = React.useState<AnalyticsEvent[]>([]);
  React.useEffect(() => {
    let cancelled = false;
    void getAnalyticsSnapshot().then((snap) => {
      if (!cancelled && snap) setEvents(snap.events);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const pa = usePerformanceAge();

  const report = React.useMemo(
    () =>
      buildWeeklyReport({
        nowISO,
        weekStartISO: week.weekStartISO,
        weekEndISO: week.weekEndISO,
        priorWeekStartISO: week.priorWeekStartISO,
        priorWeekEndISO: week.priorWeekEndISO,
        analyticsEvents: events,
        current: { performanceAge: pa.result },
      }),
    [nowISO, week, events, pa.result],
  );

  return {
    report,
    weekStartISO: report.weekStartISO,
    weekEndISO: report.weekEndISO,
    generatedAtISO: report.generatedAtISO,
  };
}
