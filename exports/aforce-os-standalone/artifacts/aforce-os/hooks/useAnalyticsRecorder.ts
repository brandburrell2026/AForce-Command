/**
 * useAnalyticsRecorder — the single mount-point that feeds the internal
 * Analytics Layer (Priority #4).
 *
 * It records, from one place, the engine-facing signals that originate
 * on the home surface:
 *   - session open (once per launch → retention)
 *   - streak progression (on change)
 *   - daily wins (the same win the banner shows → Time To First Win)
 *
 * Onboarding completion is recorded at its precise moment in
 * `app/onboarding.tsx`; reminder shown/response are recorded in
 * `NotificationBanner`. Nothing here renders — analytics has no UI.
 */
import React from 'react';

import {
  recordSessionOpen,
  recordStreakChanged,
  recordWin,
} from '@/services/analytics';
import { useUserSlice } from '@/store/slices';
import { useTopDailyWin } from '@/hooks/useTopDailyWin';

export function useAnalyticsRecorder(): void {
  const userState = useUserSlice();
  const topWin = useTopDailyWin();

  // Session open — once per launch (the service dedupes to one per day).
  React.useEffect(() => {
    void recordSessionOpen(new Date().toISOString());
  }, []);

  // Streak progression — service only appends when the value changes.
  const streak = userState.complianceStreak;
  React.useEffect(() => {
    void recordStreakChanged(streak, new Date().toISOString());
  }, [streak]);

  // Daily wins — service dedupes to one per win id per day.
  const winId = topWin?.id ?? null;
  React.useEffect(() => {
    if (winId) void recordWin(winId, new Date().toISOString());
  }, [winId]);
}
