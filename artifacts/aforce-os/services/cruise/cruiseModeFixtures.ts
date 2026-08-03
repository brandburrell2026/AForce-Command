/**
 * CRUISE MODE (redesign) — fixtures.
 *
 * Deterministic `CruiseModeInput` snapshots covering every state the screen
 * can render: each readiness band, each environment-source state (live / pilot
 * / offline / loading), the building (no-score) state, and self-log empty vs.
 * fully-logged. Used by the resolver unit tests and the DOM render harness so
 * both exercise identical inputs.
 *
 * All values here are the kind of REAL / self-logged data the container would
 * supply — no fabricated telemetry.
 */

import {
  type CruiseModeInput,
  type CruiseLiveEnv,
  type CruiseSelfLog,
  EMPTY_SELF_LOG,
} from './cruiseModeView';

const PORTS = [
  { id: 'miami', label: 'Miami' },
  { id: 'cozumel', label: 'Cozumel' },
  { id: 'nassau', label: 'Nassau' },
  { id: 'st_thomas', label: 'St. Thomas' },
  { id: 'cayman', label: 'Grand Cayman' },
  { id: 'juneau', label: 'Juneau' },
  { id: 'barcelona', label: 'Barcelona' },
] as const;

const LIVE_COZUMEL: CruiseLiveEnv = {
  portName: 'Cozumel',
  conditions: 'Sunny',
  ambientTempF: 88,
  humidityPct: 70,
  sunExposureHours: 5,
  windKts: 9,
  source: 'openweather',
  fetchedAtLabel: '2:14 PM',
};

const HOT_PORT: CruiseLiveEnv = {
  ...LIVE_COZUMEL,
  portName: 'St. Thomas',
  conditions: 'Hot & humid',
  ambientTempF: 94,
  humidityPct: 74,
  sunExposureHours: 6,
  windKts: 5,
};

// A genuinely mild live port (e.g. Juneau) — no heat load, so a well-hydrated
// guest can actually reach LOCKED IN. A hot port legitimately erodes even a
// peak score through ambient heat, so LOCKED IN needs mild real conditions.
const MILD_ENV: CruiseLiveEnv = {
  portName: 'Juneau',
  conditions: 'Cool & clear',
  ambientTempF: 62,
  humidityPct: 55,
  sunExposureHours: 2,
  windKts: 12,
  source: 'openweather',
  fetchedAtLabel: '2:14 PM',
};

const FALLBACK_ENV: CruiseLiveEnv = {
  ...LIVE_COZUMEL,
  conditions: 'Baseline',
  source: 'fallback',
  fetchedAtLabel: '',
};

function log(over: Partial<CruiseSelfLog> = {}): CruiseSelfLog {
  return { ...EMPTY_SELF_LOG, ...over };
}

function base(over: Partial<CruiseModeInput> = {}): CruiseModeInput {
  return {
    hydrationScore: 76,
    minutesSinceLastIntake: 40,
    env: LIVE_COZUMEL,
    envLoading: false,
    envError: false,
    portId: 'cozumel',
    ports: PORTS,
    log: EMPTY_SELF_LOG,
    logWaterAvailable: true,
    reducedMotion: false,
    ...over,
  };
}

export const CRUISE_FIXTURES: Record<string, CruiseModeInput> = {
  // ── Readiness bands (real score + live weather, nothing self-logged) ──
  'live-locked-in': base({ hydrationScore: 88, env: MILD_ENV, portId: 'juneau' }),
  'live-balanced': base({ hydrationScore: 76 }),

  // Recovering / reset: lower real score + a logged heavy day + hot port.
  'live-recovering': base({
    hydrationScore: 62,
    env: HOT_PORT,
    portId: 'st_thomas',
    minutesSinceLastIntake: 95,
    log: log({
      guestType: 'party',
      deckExposure: 'outdoor',
      dayMode: 'sea_day',
      poolHours: 4,
      alcoholDrinks: 3,
      excursionRisk: 'low',
    }),
  }),
  'live-reset-needed': base({
    hydrationScore: 44,
    env: HOT_PORT,
    portId: 'st_thomas',
    minutesSinceLastIntake: 130,
    log: log({
      guestType: 'excursion',
      deckExposure: 'outdoor',
      dayMode: 'port_day',
      excursionHours: 4,
      alcoholDrinks: 3,
      excursionRisk: 'high',
      sleepQualityPct: 55,
    }),
  }),

  // ── Building: engine score not yet available ──
  'building': base({ hydrationScore: null, minutesSinceLastIntake: null, log: EMPTY_SELF_LOG }),

  // ── Environment-source states (score stays real / independent of weather) ──
  'pilot-fallback': base({ env: FALLBACK_ENV }),
  'offline': base({ env: null, envError: true }),
  'loading': base({ env: null, envLoading: true }),

  // ── Self-log fully populated, port day ──
  'port-day-logged': base({
    hydrationScore: 71,
    env: HOT_PORT,
    portId: 'st_thomas',
    log: log({
      guestType: 'excursion',
      dayMode: 'port_day',
      deckExposure: 'outdoor',
      excursionRisk: 'moderate',
      poolHours: 1,
      alcoholDrinks: 1,
      excursionHours: 3,
      sleepQualityPct: 80,
    }),
  }),

  // ── Log-water capability not wired (preview label) ──
  'log-water-preview': base({ logWaterAvailable: false }),

  // ── Reduced motion ──
  'reduced-motion': base({ reducedMotion: true }),
};

export type CruiseFixtureKey = keyof typeof CRUISE_FIXTURES;
