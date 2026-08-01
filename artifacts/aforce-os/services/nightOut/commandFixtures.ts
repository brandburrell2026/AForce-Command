/**
 * Night Out command — deterministic view-model fixtures (NO-c).
 *
 * One resolved `NightOutCommandView` per acceptance state, clock-injected so they
 * are reproducible for tests + (dev-only) galleries/screenshots. DEV/test only —
 * never presented as real connected data in production.
 */
import {
  resolveNightOutCommandView,
  type NightOutCommandInput,
  type NightOutCommandView,
} from './commandPresentation';
import { makeCommandTimer, resolveCommandTimerView } from './commandTimer';

export const NIGHT_OUT_CMD_FIXTURE_BASE_MS = Date.UTC(2026, 0, 1, 22, 0, 0);
const MIN = 60 * 1000;

export type NightOutCmdFixtureId =
  | 'pre-session-command'
  | 'pre-session-no-command'
  | 'active-timer'
  | 'timer-expired'
  | 'processing'
  | 'limited-confidence'
  | 'stale-offline'
  | 'invalid-timer-recovery';

function input(over: Partial<NightOutCommandInput>): NightOutCommandInput {
  return {
    score: 76,
    stateLabel: 'BALANCED',
    interpretation: 'Your confirmed signals are steady.',
    hasActionableCommand: true,
    commandTitle: 'Water first',
    commandInstruction: 'Drink 12 oz water',
    doseOz: 12,
    reason: 'Stay ahead of the curve',
    confidenceLevel: 'high',
    freshnessAgeMs: 2 * MIN,
    reassessMinutes: 20,
    windowMinutes: 20,
    timerView: null,
    ...over,
  };
}

export function nightOutCommandFixtures(
  base: number = NIGHT_OUT_CMD_FIXTURE_BASE_MS,
): Record<NightOutCmdFixtureId, NightOutCommandView> {
  const timer20 = makeCommandTimer('c', 20 * MIN, base);
  const timer1 = makeCommandTimer('c', 1 * MIN, base);
  return {
    'pre-session-command': resolveNightOutCommandView(input({})),
    'pre-session-no-command': resolveNightOutCommandView(input({ hasActionableCommand: false })),
    'active-timer': resolveNightOutCommandView(
      input({ timerView: resolveCommandTimerView(timer20, base + 5 * MIN) }),
    ),
    'timer-expired': resolveNightOutCommandView(
      input({ timerView: resolveCommandTimerView(timer1, base + 5 * MIN) }),
    ),
    processing: resolveNightOutCommandView(input({ justCompleted: true })),
    'limited-confidence': resolveNightOutCommandView(
      input({ confidenceLevel: 'low', freshnessAgeMs: null }),
    ),
    'stale-offline': resolveNightOutCommandView(
      input({ confidenceLevel: 'low', freshnessAgeMs: 6 * 60 * MIN }),
    ),
    'invalid-timer-recovery': resolveNightOutCommandView(
      input({ timerView: { status: 'invalid', remainingMs: 0, remainingSec: 0, elapsedMs: 0, expired: false } }),
    ),
  };
}
