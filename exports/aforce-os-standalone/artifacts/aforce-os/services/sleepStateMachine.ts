/**
 * Hidden Sleep state machine — Rule #14.
 *
 * Pure, dependency-free derivation of a 5-state Sleep lifecycle. Lives
 * behind the `spec_sleep` feature flag; no visible UI consumes it yet.
 * This file establishes the contract so later rules can wire it into
 * the existing SleepModeScreen, notification scheduler, and Recovery
 * Capacity engine without re-litigating the state shape.
 *
 *   IDLE             — daytime / no sleep context (default)
 *   PREPARE          — ≥ 90 min before planned bedtime; nudge water
 *   WIND_DOWN        — ≤ 60 min before planned bedtime; dim, last sip
 *   RECOVERY         — asleep (between sleepStartAt and sleepEndAt)
 *   MORNING_RESTORE  — first 2 h after waking; rehydrate window
 *
 * The transitions are derived from the current time + planned bedtime
 * + actual sleep start/end. No external dependencies — safe to call
 * from any layer (slice, render, scheduler, test).
 */

import { useMemo } from 'react';

import { useFeatureFlags } from '../store/useAppStore';

export type SleepState =
  | 'idle'
  | 'prepare'
  | 'wind_down'
  | 'recovery'
  | 'morning_restore';

/** Lead time (minutes) before planned bedtime when PREPARE begins. */
export const PREPARE_LEAD_MIN = 90;
/** Lead time (minutes) before planned bedtime when WIND_DOWN begins. */
export const WIND_DOWN_LEAD_MIN = 60;
/** Duration (minutes) of the MORNING_RESTORE window after wake. */
export const MORNING_RESTORE_MIN = 120;

const MIN_MS = 60_000;

export interface SleepStateInputs {
  /** Current epoch ms. Injected (not `Date.now()`) so callers can test deterministically. */
  now: number;
  /** Planned bedtime today (epoch ms). `null` if user hasn't set one. */
  plannedBedtimeAt: number | null;
  /** Actual sleep start (epoch ms). `null` until detected/logged. */
  sleepStartAt: number | null;
  /** Actual sleep end / wake time (epoch ms). `null` while still asleep or before sleep. */
  sleepEndAt: number | null;
}

export interface SleepStateSnapshot {
  state: SleepState;
  /** Epoch ms the current state started (for "since X min ago" UI). */
  since: number;
  /** Epoch ms of the next scheduled transition, or `null` if unknown. */
  nextTransitionAt: number | null;
}

/**
 * Pure derivation. Order of checks matters — RECOVERY (asleep right
 * now) beats PREPARE/WIND_DOWN; MORNING_RESTORE beats IDLE.
 */
export function deriveSleepState(inputs: SleepStateInputs): SleepStateSnapshot {
  const { now, plannedBedtimeAt, sleepStartAt, sleepEndAt } = inputs;

  // RECOVERY — actively asleep right now.
  if (sleepStartAt != null && sleepStartAt <= now && (sleepEndAt == null || sleepEndAt > now)) {
    return {
      state: 'recovery',
      since: sleepStartAt,
      nextTransitionAt: sleepEndAt,
    };
  }

  // MORNING_RESTORE — woke within the last MORNING_RESTORE_MIN.
  if (sleepEndAt != null && sleepEndAt <= now) {
    const restoreEndsAt = sleepEndAt + MORNING_RESTORE_MIN * MIN_MS;
    if (now < restoreEndsAt) {
      return {
        state: 'morning_restore',
        since: sleepEndAt,
        nextTransitionAt: restoreEndsAt,
      };
    }
  }

  // PREPARE / WIND_DOWN — approaching planned bedtime.
  if (plannedBedtimeAt != null && now < plannedBedtimeAt) {
    const minutesUntil = (plannedBedtimeAt - now) / MIN_MS;
    if (minutesUntil <= WIND_DOWN_LEAD_MIN) {
      return {
        state: 'wind_down',
        since: plannedBedtimeAt - WIND_DOWN_LEAD_MIN * MIN_MS,
        nextTransitionAt: plannedBedtimeAt,
      };
    }
    if (minutesUntil <= PREPARE_LEAD_MIN) {
      return {
        state: 'prepare',
        since: plannedBedtimeAt - PREPARE_LEAD_MIN * MIN_MS,
        nextTransitionAt: plannedBedtimeAt - WIND_DOWN_LEAD_MIN * MIN_MS,
      };
    }
  }

  // IDLE — daytime / no active sleep context.
  return {
    state: 'idle',
    since: now,
    nextTransitionAt:
      plannedBedtimeAt != null && now < plannedBedtimeAt
        ? plannedBedtimeAt - PREPARE_LEAD_MIN * MIN_MS
        : null,
  };
}

/**
 * React hook — returns the derived snapshot, or `null` when
 * `spec_sleep` is off (the hidden state machine stays invisible to
 * the rest of the app until the flag flips on).
 *
 * Inputs must be passed in by the caller; this hook deliberately does
 * NOT read from the store so it can be unit-tested without spinning
 * up the app store, and so individual screens can decide which
 * bedtime / wake signals to feed it.
 */
export function useHiddenSleepState(inputs: SleepStateInputs): SleepStateSnapshot | null {
  const flags = useFeatureFlags();
  return useMemo(() => {
    if (!flags.spec_sleep) return null;
    return deriveSleepState(inputs);
  }, [
    flags.spec_sleep,
    inputs.now,
    inputs.plannedBedtimeAt,
    inputs.sleepStartAt,
    inputs.sleepEndAt,
  ]);
}
