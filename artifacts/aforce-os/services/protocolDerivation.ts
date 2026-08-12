/**
 * Protocol derivation — pure, synchronous derivation of the active
 * protocol payload from a userState + already-computed engineOutput.
 *
 * Formerly `services/mockApi.ts`. Wave-2 PR4 (production data truth):
 * every mock/simulated-network export was deleted (all were dead code
 * fully shadowed by `services/realApi.ts`), and the fabricated
 * `weeklyCompliancePct = 82` default was removed — compliance is now a
 * REQUIRED, NULLABLE input supplied by the caller from real journal
 * rollups (`hooks/useWeeklyCompliance`). `null` means "not enough real
 * data" and consumers must render an honest state, never a number.
 */
import type { ScoreEngineOutput, UserState } from '../types';

export interface ProtocolPayload {
  stage: 'Maintain' | 'Peak Support' | 'Recovery' | 'Depletion Correction' | 'Heat Stress';
  description: string;
  steps: { id: string; label: string; window: string; complete: boolean }[];
  nextRecheckMinutes: number;
  /** Real 7-day compliance from journal rollups; null = not enough data. */
  weeklyCompliancePct: number | null;
}

const PROTOCOL_DESCRIPTION: Record<ProtocolPayload['stage'], string> = {
  'Maintain': 'Drink 8–12 ounces, recheck 45–60 min. Hold rhythm.',
  'Peak Support': 'Maintain fluid. Stick during exertion. Defend Peak.',
  'Recovery': 'Drink 12–16 ounces now. Stick if signals appear.',
  'Depletion Correction': 'Drink 16–24 ounces. Electrolytes critical. Recheck 20–30 min.',
  'Heat Stress': 'Aggressive cadence. Forced 15-min recheck.',
};

/**
 * Pure, synchronous derivation of the active protocol payload from a
 * userState + already-computed engineOutput. Used directly by the
 * Protocol screen so the Depletion Correction stage flips the moment
 * the engine score crosses a threshold — no async fetch, no useEffect
 * race, no loading flash.
 */
export function deriveProtocol(
  userState: UserState,
  engineOutput: ScoreEngineOutput,
  /**
   * Real weekly compliance (journal rollups) or null when unavailable.
   * REQUIRED — there is deliberately no default so a fabricated number
   * can never ship again (Wave-2 PR4).
   */
  weeklyCompliancePct: number | null,
): ProtocolPayload {
  const level = engineOutput.performanceState.level;
  const stage: ProtocolPayload['stage'] =
    level === 'PEAK' ? 'Peak Support' :
    level === 'BALANCED' ? 'Maintain' :
    level === 'RECOVERING' ? 'Recovery' :
    'Depletion Correction';

  return {
    stage,
    description: PROTOCOL_DESCRIPTION[stage],
    steps: (() => {
      // Step completion is driven off live `userState` so the moment a
      // drink is logged the protocol checklist advances in real time.
      // - s1 = any hydration signal on record (urine pick or first intake)
      // - s2 = at least one intake logged this cycle
      // - s3 = halfway through the daily target (signals due for recheck)
      // - s4 = daily target reached → cycle ready to close
      const intakes = userState.unitsConsumedToday;
      const target = Math.max(1, userState.dailyTarget);
      const halfway = Math.ceil(target / 2);
      return [
        {
          id: 's1',
          label: 'Confirm hydration signal',
          window: 'Now',
          complete: userState.urineSignal > 0 || intakes > 0,
        },
        {
          id: 's2',
          label: 'Log next intake',
          window: `Within ${engineOutput.riskTimer.minutes} min`,
          complete: intakes >= 1,
        },
        {
          id: 's3',
          label: 'Recheck performance signals',
          window: 'After intake',
          complete: intakes >= halfway,
        },
        {
          id: 's4',
          label: 'Confirm Status',
          window: 'End of cycle',
          complete: intakes >= target,
        },
      ];
    })(),
    nextRecheckMinutes: engineOutput.riskTimer.minutes,
    weeklyCompliancePct: weeklyCompliancePct ?? null,
  };
}
