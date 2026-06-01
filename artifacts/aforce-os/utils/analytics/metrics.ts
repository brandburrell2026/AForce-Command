/**
 * Analytics metrics — Priority #4 (Analytics Layer).
 *
 * "Powerful underneath. Simple on top." This module is the *underneath*:
 * a set of PURE functions that turn a raw event log into the five
 * metrics the engine cares about. No storage, no React, no Date.now —
 * everything is derived from the events passed in, so it is fully
 * deterministic and unit-testable.
 *
 * The analytics layer has NO user-facing surface. It exists to power the
 * engine internally (e.g. later adaptive-reminder phases read the
 * reminder-response rate and time-to-first-win from here).
 */

export type AnalyticsEventType =
  | 'session_open'
  | 'onboarding_completed'
  | 'win'
  | 'reminder_shown'
  | 'reminder_response'
  | 'streak_changed'
  | 'log_action';

export interface AnalyticsEvent {
  type: AnalyticsEventType;
  /** ISO 8601 timestamp. */
  at: string;
  /** Optional context (win id, streak value, reminder slot, …). */
  meta?: Record<string, string | number>;
}

export interface AnalyticsMetrics {
  /** ms from the onboarding/first-session anchor to the first win, or null. */
  timeToFirstWinMs: number | null;
  onboarding: {
    completed: boolean;
    completedAt: string | null;
    /** ms from first session to onboarding completion, or null. */
    msFromFirstSession: number | null;
  };
  retention: {
    firstSeenAt: string | null;
    lastActiveAt: string | null;
    /** Distinct calendar days with at least one session. */
    activeDays: number;
    /** Consecutive active days ending at the most recent active day. */
    currentDayStreak: number;
  };
  reminders: {
    /** Distinct reminder slots shown. */
    shown: number;
    /** Distinct reminder slots the user responded to. */
    responded: number;
    /** responded / shown, or null when nothing was shown. */
    responseRate: number | null;
  };
  streak: {
    /** Latest recorded compliance-streak value, or null. */
    current: number | null;
    /** Highest compliance-streak value ever recorded, or null. */
    max: number | null;
    /** Number of recorded streak transitions. */
    changes: number;
  };
  logging: {
    /** Total one-tap log actions recorded. */
    count: number;
    /** Median Time-To-Log in ms (KPI target < 2000), or null. */
    medianTimeToLogMs: number | null;
    /** Fraction of logs completed under 2s, or null when none recorded. */
    underTwoSecondsRate: number | null;
  };
}

const MS_PER_DAY = 86_400_000;

function timeOf(e: AnalyticsEvent): number {
  return Date.parse(e.at);
}

function isValid(e: AnalyticsEvent): boolean {
  return Number.isFinite(timeOf(e));
}

/** UTC day index — stable, timezone-free bucket for "distinct days". */
function dayIndex(at: string): number | null {
  const ms = Date.parse(at);
  return Number.isFinite(ms) ? Math.floor(ms / MS_PER_DAY) : null;
}

function sortedByTime(events: AnalyticsEvent[]): AnalyticsEvent[] {
  return events.filter(isValid).sort((a, b) => timeOf(a) - timeOf(b));
}

function firstOfType(
  events: AnalyticsEvent[],
  type: AnalyticsEventType,
): AnalyticsEvent | null {
  for (const e of events) if (e.type === type) return e;
  return null;
}

function lastOfType(
  events: AnalyticsEvent[],
  type: AnalyticsEventType,
): AnalyticsEvent | null {
  for (let i = events.length - 1; i >= 0; i -= 1) {
    if (events[i].type === type) return events[i];
  }
  return null;
}

/** Distinct reminder slot keys for a given event type. */
function reminderSlotSet(
  events: AnalyticsEvent[],
  type: AnalyticsEventType,
): Set<string> {
  const slots = new Set<string>();
  for (const e of events) {
    if (e.type !== type) continue;
    const slot = e.meta?.reminderDay;
    slots.add(slot != null ? String(slot) : e.at);
  }
  return slots;
}

/** Median of a numeric list, or null when empty. */
function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/** Consecutive active days ending at the most recent active day. */
function currentDayStreak(activeDayIndices: number[]): number {
  if (activeDayIndices.length === 0) return 0;
  const unique = Array.from(new Set(activeDayIndices)).sort((a, b) => a - b);
  let streak = 1;
  for (let i = unique.length - 1; i > 0; i -= 1) {
    if (unique[i - 1] === unique[i] - 1) streak += 1;
    else break;
  }
  return streak;
}

export function computeAnalyticsMetrics(
  rawEvents: AnalyticsEvent[],
): AnalyticsMetrics {
  const events = sortedByTime(rawEvents);

  // ── Retention ──────────────────────────────────────────────────────
  const sessions = events.filter((e) => e.type === 'session_open');
  const sessionDayIndices = sessions
    .map((e) => dayIndex(e.at))
    .filter((d): d is number => d != null);
  const firstSession = sessions[0] ?? null;
  const lastSession = sessions[sessions.length - 1] ?? null;

  // ── Onboarding ─────────────────────────────────────────────────────
  const onboarding = firstOfType(events, 'onboarding_completed');
  const onboardingAnchorMs =
    onboarding && firstSession
      ? timeOf(onboarding) - timeOf(firstSession)
      : null;

  // ── Time To First Win ──────────────────────────────────────────────
  // Anchor on onboarding completion when known, else the first session.
  const winAnchor = onboarding ?? firstSession;
  const firstWin = firstOfType(events, 'win');
  const timeToFirstWinMs =
    winAnchor && firstWin && timeOf(firstWin) >= timeOf(winAnchor)
      ? timeOf(firstWin) - timeOf(winAnchor)
      : null;

  // ── Reminder response ──────────────────────────────────────────────
  // Only count responses to slots that were actually shown, so the rate
  // is always a clean fraction in [0, 1] even if a stray response or log
  // truncation leaves an unmatched response event behind.
  const shownSlots = reminderSlotSet(events, 'reminder_shown');
  const respondedSlots = reminderSlotSet(events, 'reminder_response');
  const shown = shownSlots.size;
  const responded = [...respondedSlots].filter((s) => shownSlots.has(s)).length;

  // ── Streak progression ─────────────────────────────────────────────
  const streakEvents = events.filter((e) => e.type === 'streak_changed');
  const streakValues = streakEvents
    .map((e) => Number(e.meta?.value))
    .filter((n) => Number.isFinite(n));
  const lastStreak = lastOfType(events, 'streak_changed');
  const currentStreak =
    lastStreak && Number.isFinite(Number(lastStreak.meta?.value))
      ? Number(lastStreak.meta?.value)
      : null;

  // ── Time To Log (passive logging KPI) ──────────────────────────────
  const logTtls = events
    .filter((e) => e.type === 'log_action')
    .map((e) => Number(e.meta?.ttlMs))
    .filter((n) => Number.isFinite(n) && n >= 0);
  const underTwoSeconds = logTtls.filter((n) => n < 2000).length;

  return {
    timeToFirstWinMs,
    onboarding: {
      completed: onboarding != null,
      completedAt: onboarding?.at ?? null,
      msFromFirstSession: onboardingAnchorMs != null && onboardingAnchorMs >= 0
        ? onboardingAnchorMs
        : null,
    },
    retention: {
      firstSeenAt: firstSession?.at ?? null,
      lastActiveAt: lastSession?.at ?? null,
      activeDays: new Set(sessionDayIndices).size,
      currentDayStreak: currentDayStreak(sessionDayIndices),
    },
    reminders: {
      shown,
      responded,
      responseRate: shown > 0 ? responded / shown : null,
    },
    streak: {
      current: currentStreak,
      max: streakValues.length > 0 ? Math.max(...streakValues) : null,
      changes: streakEvents.length,
    },
    logging: {
      count: logTtls.length,
      medianTimeToLogMs: median(logTtls),
      underTwoSecondsRate:
        logTtls.length > 0 ? underTwoSeconds / logTtls.length : null,
    },
  };
}
