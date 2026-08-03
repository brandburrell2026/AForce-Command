/**
 * SLEEP MODE (redesign) — deterministic fixtures for every visual state.
 *
 * Pure data only (no RN). Used by the resolver/render tests and the dev preview.
 * These are FIXTURES for presentation states — they never fabricate a live metric
 * on the shipping screen; the container supplies real values there. When a fixture
 * shows a recovery metric it is marked `real: true` deliberately to exercise the
 * "connected + real data" layout, and the honest empty states cover the rest.
 */
import type { SleepModeInput } from './sleepModeView';

const FIXED_NOW = new Date('2026-04-22T21:30:00Z').getTime();

const baseHealthConnected = {
  provider: 'Apple Health',
  chip: 'connected' as const,
  freshness: 'Synced 42m ago',
};

function base(over: Partial<SleepModeInput> = {}): SleepModeInput {
  return {
    now: FIXED_NOW,
    mode: 'ready',
    phase: 'idle',
    target: { h: 23, m: 0 },
    minutesUntilTarget: 210, // far out → idle
    sleepLastNight: null,
    sevenNightAvg: null,
    recoveryMetrics: [],
    confidence: 'medium',
    health: { ...baseHealthConnected },
    completed: [],
    ...over,
  };
}

export const SLEEP_FIXTURES: Record<string, SleepModeInput> = {
  // 1 · Idle — target set, far from protocol
  idle: base({ phase: 'idle', minutesUntilTarget: 210 }),

  // 2 · Pre-sleep protocol ready — at the 90-min lead, nothing checked yet
  'pre-sleep-ready': base({
    phase: 'pre_sleep', minutesUntilTarget: 88, completed: [],
    confidence: 'high',
    recoveryMetrics: [
      { key: 'hrv', label: 'HRV', value: 58, unit: 'ms', real: true },
      { key: 'resting_hr', label: 'Resting HR', value: 54, unit: ' bpm', real: true },
    ],
    sleepLastNight: 7.4, sevenNightAvg: 7.1,
  }),

  // 3 · Pre-sleep protocol active — partway through the checklist
  'pre-sleep-active': base({
    phase: 'pre_sleep', minutesUntilTarget: 72, completed: ['hydrate', 'screens_down', 'dim_lights'],
    confidence: 'high',
    recoveryMetrics: [{ key: 'hrv', label: 'HRV', value: 61, unit: 'ms', real: true }],
    sleepLastNight: 7.4, sevenNightAvg: 7.1,
  }),

  // 4 · Recovery window — open now, all checked
  'recovery-window': base({
    phase: 'recovery_window', minutesUntilTarget: 40,
    completed: ['hydrate', 'screens_down', 'dim_lights', 'breathe', 'cool_room'],
    confidence: 'high', sleepLastNight: 7.4, sevenNightAvg: 7.1,
    recoveryMetrics: [{ key: 'resting_hr', label: 'Resting HR', value: 53, unit: ' bpm', real: true }],
  }),

  // 5 · Morning — real last-night sleep, stronger than average
  morning: base({
    phase: 'morning', minutesUntilTarget: 800, sleepLastNight: 7.9, sevenNightAvg: 7.2,
    confidence: 'high',
  }),

  // 6 · Health source disconnected
  'health-disconnected': base({
    phase: 'idle', minutesUntilTarget: 150, confidence: 'low',
    health: { provider: 'Apple Health', chip: 'not_connected', freshness: null },
  }),

  // 7 · Waiting for health signals (connected but no data yet)
  'waiting-signals': base({
    phase: 'idle', minutesUntilTarget: 150, confidence: 'low',
    health: { provider: 'Apple Health', chip: 'waiting', freshness: 'No recent signal' },
  }),

  // 8 · Low-confidence recovery state (connected, real sleep, but limited signals)
  'low-confidence': base({
    phase: 'pre_sleep', minutesUntilTarget: 80, confidence: 'low',
    sleepLastNight: 5.1, sevenNightAvg: 7.0,
    health: { provider: 'Apple Health', chip: 'connected', freshness: 'Synced 3h ago' },
  }),

  // 9 · Loading
  loading: base({ mode: 'loading' }),

  // 10 · Offline / error
  offline: base({ mode: 'offline', health: { provider: 'Apple Health', chip: 'needs_attention', freshness: 'Sync failed' } }),

  // Bonus: no target set (edge state)
  'no-target': base({ phase: 'idle', target: null, minutesUntilTarget: null }),
};

export type SleepFixtureKey = keyof typeof SLEEP_FIXTURES;
