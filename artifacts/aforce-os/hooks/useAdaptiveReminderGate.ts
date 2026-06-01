/**
 * useAdaptiveReminderGate — Priority #5.
 *
 * Assembles the live context for the adaptive reminder policy from store
 * slices + analytics + the existing notification delivery history, and
 * returns the policy decision. Reminder surfaces call this and suppress
 * themselves when `allow` is false. No UI, no navigation.
 *
 * Level and analytics load asynchronously with safe defaults ('standard'
 * / unknown response rate), so the decision is computed every render and
 * simply refines once those land — a due reminder is never hidden while
 * waiting on storage.
 */
import React from 'react';

import { useUserSlice } from '@/store/slices';
import { getReminderLevel } from '@/services/reminderPolicy';
import { getAnalyticsMetrics } from '@/services/analytics';
import {
  evaluateReminderPolicy,
  computeHeatIndexC,
  type ReminderDecision,
  type ReminderLevel,
} from '@/utils/reminders/adaptivePolicy';
import type { NotificationsSnapshot } from '@/services/notifications';
import { useSmartModes } from '@/hooks/useSmartModes';

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function deliveredStats(snapshot: NotificationsSnapshot | null): {
  sentToday: number;
  minutesSinceLast: number | null;
} {
  if (!snapshot || snapshot.delivered.length === 0) {
    return { sentToday: 0, minutesSinceLast: null };
  }
  const today = todayKey();
  let sentToday = 0;
  let lastMs = -Infinity;
  for (const d of snapshot.delivered) {
    if (d.deliveredAt.slice(0, 10) === today) sentToday += 1;
    const ms = Date.parse(d.deliveredAt);
    if (Number.isFinite(ms) && ms > lastMs) lastMs = ms;
  }
  const minutesSinceLast =
    lastMs > -Infinity ? Math.max(0, (Date.now() - lastMs) / 60_000) : null;
  return { sentToday, minutesSinceLast };
}

/** Freshest workout-minutes across all linked providers. */
function maxWorkoutMinutes(
  biometrics: ReturnType<typeof useUserSlice>['biometrics'],
): number {
  if (!biometrics) return 0;
  let max = 0;
  for (const snap of Object.values(biometrics)) {
    const m = snap?.workoutMinutesToday;
    if (typeof m === 'number' && m > max) max = m;
  }
  return max;
}

export function useAdaptiveReminderGate(
  snapshot: NotificationsSnapshot | null,
): ReminderDecision {
  const userState = useUserSlice();
  const { reminderIntensityMultiplier } = useSmartModes();

  const [level, setLevel] = React.useState<ReminderLevel>('standard');
  const [responseRate, setResponseRate] = React.useState<number | null>(null);
  const [remindersShown, setRemindersShown] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    void getReminderLevel().then((l) => {
      if (!cancelled) setLevel(l);
    });
    void getAnalyticsMetrics().then((m) => {
      if (cancelled) return;
      setResponseRate(m.reminders.responseRate);
      setRemindersShown(m.reminders.shown);
    });
    return () => {
      cancelled = true;
    };
  }, [snapshot]);

  return React.useMemo(() => {
    const now = new Date();
    const { sentToday, minutesSinceLast } = deliveredStats(snapshot);
    const goalProgress =
      userState.dailyTarget > 0
        ? userState.unitsConsumedToday / userState.dailyTarget
        : 0;

    return evaluateReminderPolicy({
      level,
      nowMinuteOfDay: now.getHours() * 60 + now.getMinutes(),
      responseRate,
      remindersShown,
      workoutMinutesToday: maxWorkoutMinutes(userState.biometrics),
      heatIndexC: computeHeatIndexC(
        userState.weatherTempC ?? null,
        userState.weatherHumidity ?? null,
      ),
      goalProgress,
      remindersSentToday: sentToday,
      minutesSinceLastReminder: minutesSinceLast,
      intensityMultiplier: reminderIntensityMultiplier,
    });
  }, [
    level,
    responseRate,
    remindersShown,
    snapshot,
    userState.dailyTarget,
    userState.unitsConsumedToday,
    userState.biometrics,
    userState.weatherTempC,
    userState.weatherHumidity,
    reminderIntensityMultiplier,
  ]);
}
