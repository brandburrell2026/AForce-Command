/**
 * Travel Intelligence — arrival protocol (T1, pure engine).
 *
 * Lays out the arrival plan the member reviews and seals (the Moments Seal
 * screen): Pause → Hydrate → Reset → LOCK-IN → one question after. The
 * engine returns step KEYS, instants and the factors that shaped each step;
 * the UI resolves copy through i18n. A factor is listed only when its input
 * was actually available, so the screen can never explain a step with a
 * reason that did not drive it.
 *
 * Out of scope until science + compliance review: sleep timing and
 * light-exposure advice. No factor for either exists here.
 */

import {
  MOMENT_LOCK_IN_BEFORE_MIN,
  TRAVEL_ARRIVAL_HYDRATE_HEAT_OZ,
  TRAVEL_ARRIVAL_HYDRATE_OZ,
  TRAVEL_PAUSE_MINUTES,
  TRAVEL_PROTOCOL_OFFSETS_MIN,
  TRAVEL_RESET_MINUTES,
} from '../../config/hydroStateModel';
import type { HeatBand, HumidityBand, UvBand } from '../location/locationIntelligence';

const MIN = 60_000;

export interface ArrivalConditions {
  heat: HeatBand | null;
  humidity: HumidityBand | null;
  uv: UvBand | null;
}

export type ArrivalFactor =
  | 'heat' // hot / extreme heat at the destination
  | 'humid' // humid / oppressive air
  | 'dry' // very dry air
  | 'uv_high' // UV high or above → suggest shade
  | 'seated_travel' // the trip itself (always true for a trip)
  | 'next_commitment'; // a calendar or member-entered commitment after landing

export type ArrivalStepKey = 'pause' | 'hydrate' | 'reset' | 'lock_in' | 'after';

export interface ArrivalStep {
  key: ArrivalStepKey;
  /** Planned instant (epoch ms); null for the open-ended 'after' step. */
  atMs: number | null;
  /** Step length in minutes where it has one. */
  minutes?: number;
  /** Hydrate only: recommended range for the first hour. Guidance, not a measurement. */
  ozRange?: { min: number; max: number };
  /** Hydrate only: suggest one electrolyte. */
  electrolyte?: boolean;
  factors: ArrivalFactor[];
}

export interface ArrivalProtocolInput {
  /** Confirmed arrival, or scheduled arrival when building ahead of time. */
  arrivalMs: number;
  /** Next commitment after landing (epoch ms), or null when none is known. */
  nextCommitmentMs: number | null;
  conditions: ArrivalConditions;
}

const isHot = (h: HeatBand | null) => h === 'hot' || h === 'extreme';
const isHumid = (h: HumidityBand | null) => h === 'humid' || h === 'oppressive';
const isDry = (h: HumidityBand | null) => h === 'very_dry';
const isUvHigh = (u: UvBand | null) => u === 'high' || u === 'very_high' || u === 'extreme';

export function buildArrivalProtocol(input: ArrivalProtocolInput): ArrivalStep[] {
  const { arrivalMs, nextCommitmentMs, conditions } = input;
  if (!Number.isFinite(arrivalMs)) return [];

  const heat = isHot(conditions.heat);
  const humid = isHumid(conditions.humidity);
  const dry = isDry(conditions.humidity);
  const uvHigh = isUvHigh(conditions.uv);

  const hydrateFactors: ArrivalFactor[] = ['seated_travel'];
  if (heat) hydrateFactors.push('heat');
  if (humid) hydrateFactors.push('humid');
  if (dry) hydrateFactors.push('dry');
  const strain = heat || dry || (humid && conditions.heat === 'warm');

  const steps: ArrivalStep[] = [
    {
      key: 'pause',
      atMs: arrivalMs + TRAVEL_PROTOCOL_OFFSETS_MIN.pause * MIN,
      minutes: TRAVEL_PAUSE_MINUTES,
      factors: ['seated_travel'],
    },
    {
      key: 'hydrate',
      atMs: arrivalMs + TRAVEL_PROTOCOL_OFFSETS_MIN.hydrate * MIN,
      ozRange: strain ? { ...TRAVEL_ARRIVAL_HYDRATE_HEAT_OZ } : { ...TRAVEL_ARRIVAL_HYDRATE_OZ },
      electrolyte: strain,
      factors: hydrateFactors,
    },
    {
      key: 'reset',
      atMs: arrivalMs + TRAVEL_PROTOCOL_OFFSETS_MIN.reset * MIN,
      minutes: TRAVEL_RESET_MINUTES,
      factors: uvHigh ? ['seated_travel', 'uv_high'] : ['seated_travel'],
    },
  ];

  // LOCK-IN belongs to a real commitment. Without one there is nothing to
  // lock in for, so the step is left out rather than invented.
  const resetEnd = arrivalMs + (TRAVEL_PROTOCOL_OFFSETS_MIN.reset + TRAVEL_RESET_MINUTES) * MIN;
  if (nextCommitmentMs != null && Number.isFinite(nextCommitmentMs)) {
    const lockInAt = nextCommitmentMs - MOMENT_LOCK_IN_BEFORE_MIN * MIN;
    if (lockInAt >= resetEnd) {
      steps.push({ key: 'lock_in', atMs: lockInAt, factors: ['next_commitment'] });
    }
  }

  steps.push({ key: 'after', atMs: null, factors: [] });
  return steps;
}
