/**
 * AForce OS — Mock REST API service layer.
 *
 * Per spec: the frontend MUST NOT invent hydration logic. All score, state,
 * protocol, and pulse configuration come from this service layer (mocked here,
 * later replaced by real /v1 endpoints).
 *
 * Endpoints implemented (mocked):
 *   GET    /v1/home
 *   POST   /v1/intake/log
 *   POST   /v1/signals/update
 *   POST   /v1/urine-signal/update
 *   POST   /v1/energy-state/update
 *   GET    /v1/protocol/current
 *   POST   /v1/checkin
 *   GET    /v1/pulse/current
 *
 * All calls return < 300ms simulated latency to honor the perf budget.
 */

import type {
  UserState,
  ScoreEngineOutput,
  IntakeLog,
  FluidType,
  PulseConfig,
} from '../types';
import { calculateScore } from '../utils/scoringEngine';
import { PRODUCTS } from '../data/products';

const MIN_LATENCY_MS = 60;
const MAX_LATENCY_MS = 220;

function simulateLatency<T>(payload: T): Promise<T> {
  const ms = MIN_LATENCY_MS + Math.random() * (MAX_LATENCY_MS - MIN_LATENCY_MS);
  return new Promise((resolve) => setTimeout(() => resolve(payload), ms));
}

// ─── GET /v1/home ─────────────────────────────────────────────────────────────
export interface HomePayload {
  engineOutput: ScoreEngineOutput;
  userState: UserState;
  serverTime: string;
}

export function fetchHome(userState: UserState): Promise<HomePayload> {
  const engineOutput = calculateScore(userState);
  return simulateLatency({
    engineOutput,
    userState,
    serverTime: new Date().toISOString(),
  });
}

// ─── POST /v1/intake/log ──────────────────────────────────────────────────────
export interface IntakeLogPayload {
  fluidType: FluidType;
  ozAmount?: number;
}
export interface IntakeLogResponse {
  log: IntakeLog;
  newUserState: UserState;
  engineOutput: ScoreEngineOutput;
}

export function postIntakeLog(
  userState: UserState,
  body: IntakeLogPayload,
): Promise<IntakeLogResponse> {
  const product = PRODUCTS[body.fluidType];
  const ozAmount = body.ozAmount ?? product.ozPerServing;
  const scoreBefore = calculateScore(userState).score;

  const newUserState: UserState = {
    ...userState,
    unitsConsumedToday: userState.unitsConsumedToday + 1,
    ozConsumedToday: userState.ozConsumedToday + ozAmount,
    aforceUnitsToday: userState.aforceUnitsToday + (body.fluidType.startsWith('aforce_') ? 1 : 0),
    language: userState.language ?? 'en',
    lastIntakeTime: new Date(),
    lastIntakeType: body.fluidType,
    isSnoozed: false,
    snoozeUntil: null,
    hasSeenMorningCommand: true,
  };

  const engineOutput = calculateScore(newUserState);

  const log: IntakeLog = {
    id: `intake-${Date.now()}`,
    fluidType: body.fluidType,
    ozAmount,
    loggedAt: new Date(),
    scoreBefore,
    scoreAfter: engineOutput.score,
  };

  return simulateLatency({ log, newUserState, engineOutput });
}

// ─── POST /v1/signals/update ──────────────────────────────────────────────────
export function postSignalsUpdate(
  userState: UserState,
  symptoms: string[],
): Promise<{ newUserState: UserState; engineOutput: ScoreEngineOutput }> {
  const symptomState: UserState['symptomState'] =
    symptoms.length === 0 ? 'none' :
    symptoms.length <= 1 ? 'mild' :
    symptoms.length <= 3 ? 'moderate' : 'severe';
  const newUserState: UserState = { ...userState, symptoms, symptomState };
  return simulateLatency({ newUserState, engineOutput: calculateScore(newUserState) });
}

// ─── POST /v1/urine-signal/update ─────────────────────────────────────────────
export function postUrineSignalUpdate(
  userState: UserState,
  urineSignal: number,
): Promise<{ newUserState: UserState; engineOutput: ScoreEngineOutput }> {
  const newUserState: UserState = { ...userState, urineSignal };
  return simulateLatency({ newUserState, engineOutput: calculateScore(newUserState) });
}

// ─── POST /v1/energy-state/update ─────────────────────────────────────────────
export function postEnergyStateUpdate(
  userState: UserState,
  energyState: UserState['energyState'],
): Promise<{ newUserState: UserState; engineOutput: ScoreEngineOutput }> {
  const newUserState: UserState = { ...userState, energyState };
  return simulateLatency({ newUserState, engineOutput: calculateScore(newUserState) });
}

// ─── POST /v1/checkin (Confirm Status) ────────────────────────────────────────
export function postCheckin(userState: UserState): Promise<{
  newUserState: UserState;
  engineOutput: ScoreEngineOutput;
}> {
  return simulateLatency({
    newUserState: { ...userState, hasSeenMorningCommand: true },
    engineOutput: calculateScore(userState),
  });
}

// ─── GET /v1/pulse/current ────────────────────────────────────────────────────
export function fetchPulseConfig(userState: UserState): Promise<PulseConfig> {
  return simulateLatency(calculateScore(userState).pulseConfig);
}

// ─── GET /v1/protocol/current ─────────────────────────────────────────────────
export interface ProtocolPayload {
  stage: 'Maintain' | 'Peak Support' | 'Recovery' | 'Depletion Correction' | 'Heat Stress';
  description: string;
  steps: { id: string; label: string; window: string; complete: boolean }[];
  nextRecheckMinutes: number;
  weeklyCompliancePct: number;
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
 * race, no loading flash. `fetchProtocol` is a thin mock-network
 * wrapper around this same function for parity with the future
 * `/v1/protocol/current` endpoint.
 */
export function deriveProtocol(
  userState: UserState,
  engineOutput: ScoreEngineOutput,
  /** Compliance is a server-owned metric; pass deterministic value when calling sync. */
  weeklyCompliancePct = 82,
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
    weeklyCompliancePct,
  };
}

export function fetchProtocol(userState: UserState): Promise<ProtocolPayload> {
  const out = calculateScore(userState);
  return simulateLatency(
    deriveProtocol(userState, out, 78 + Math.round(Math.random() * 10)),
  );
}
