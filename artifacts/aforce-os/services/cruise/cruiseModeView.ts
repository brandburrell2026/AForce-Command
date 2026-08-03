/**
 * CRUISE MODE (redesign) — pure view-model resolver.
 *
 * Turns the REAL cruise inputs — the live engine hydration score, live
 * OpenWeather environment, and the guest's own SELF-LOGGED day — into a fully
 * resolved, presentation-ready view model. No React, no store, no I/O: the
 * container gathers the real values and passes them in; this module only
 * shapes them.
 *
 * HONESTY CONTRACT (AForce Constitution — observation never diagnosis; never
 * fabricate live data):
 *   • The Guest Readiness Signal is the REAL engine score contextualised for
 *     the cruise environment via the existing `evaluateCruise` model. It is
 *     never invented.
 *   • Environmental values (temp / humidity / sun / wind / heat index) come
 *     from the live OpenWeather feed. When the feed is unavailable the screen
 *     says so — it does NOT substitute a plausible number and it excludes the
 *     absent factors from the readiness math (no phantom heat penalty).
 *   • Behavioural load (drinks, pool time, excursion, sleep) is FIRST-PARTY
 *     self-report. Until the guest logs it, it contributes nothing and the UI
 *     frames it as "not logged yet" — never a fabricated count.
 *   • "Deck exposure" and "day mode" are the guest's own declarations, shown in
 *     the self-log section, NOT presented as sensed telemetry.
 *
 * Reuses `evaluateCruise` (services/cruiseModeService.ts) unchanged — the
 * scoring math is untouched; only its inputs are now real.
 */

import {
  evaluateCruise,
  deriveJourneyIntensity,
  JOURNEY_INTENSITY_LABEL,
  RISK_LABEL,
  GUEST_TYPE_LABEL,
  PORT_DAY_CHECKLIST,
  CRUISE_BADGES,
  type CruiseSession,
  type CruiseStatus,
  type CruiseRiskLevel,
  type CruiseGuestType,
  type EnvironmentFactors,
} from '../cruiseModeService';

// ─── Shared vocabulary ───────────────────────────────────────────────────────

/** Within-brand semantic tone. Bound to af.* tokens at the presentation edge. */
export type CruiseTone = 'green' | 'cyan' | 'amber' | 'red' | 'neutral';

export type CruiseEnvSourceKey = 'live' | 'pilot' | 'offline' | 'loading';

export type CruiseDayMode = EnvironmentFactors['dayMode'];
export type CruiseDeckExposure = EnvironmentFactors['deckExposure'];
export type CruiseExcursionRisk = EnvironmentFactors['excursionRisk'];

const STATUS_TONE: Record<CruiseStatus, CruiseTone> = {
  LOCKED_IN: 'green',
  BALANCED: 'cyan',
  RECOVERING: 'amber',
  RESET_NEEDED: 'red',
};

const RISK_TONE: Record<CruiseRiskLevel, CruiseTone> = {
  LOW: 'green',
  MODERATE: 'cyan',
  HIGH: 'amber',
  RECOVERY_CRITICAL: 'red',
};

// ─── Input contract (all real / first-party values) ──────────────────────────

/** Live OpenWeather snapshot, already fetched by the container. */
export interface CruiseLiveEnv {
  portName: string;
  conditions: string;
  ambientTempF: number;
  humidityPct: number;
  sunExposureHours: number;
  windKts: number;
  source: 'openweather' | 'fallback';
  /** Pre-formatted "2:14 PM" (container formats; resolver stays locale-free). */
  fetchedAtLabel: string;
}

/** The guest's own declared day. Everything defaults to "nothing logged". */
export interface CruiseSelfLog {
  guestType: CruiseGuestType | null;
  dayMode: CruiseDayMode;
  deckExposure: CruiseDeckExposure;
  excursionRisk: CruiseExcursionRisk;
  poolHours: number;
  alcoholDrinks: number;
  excursionHours: number;
  fitnessHours: number;
  /** 0–100 from a connected health source; null when not provided. */
  sleepQualityPct: number | null;
}

export const EMPTY_SELF_LOG: CruiseSelfLog = {
  guestType: null,
  dayMode: 'sea_day',
  deckExposure: 'mixed',
  excursionRisk: 'none',
  poolHours: 0,
  alcoholDrinks: 0,
  excursionHours: 0,
  fitnessHours: 0,
  sleepQualityPct: null,
};

// ─── Self-log hygiene (pure helpers, unit-tested) ────────────────────────────

/**
 * Sane physical bounds for self-logged values. The steppers clamp at 0 on the
 * way down; these cap the way up so a runaway tap (or bad stored payload)
 * can't feed absurd loads (400 hr poolside) into the readiness math.
 */
export const SELF_LOG_LIMITS = {
  maxHours: 24, //   pool / excursion / fitness hours per day
  maxDrinks: 20, //  logged drinks per day
} as const;

const clampNum = (n: number, max: number) =>
  Number.isFinite(n) ? Math.min(max, Math.max(0, Math.round(n))) : 0;

/** Bound every numeric field of a self-log; non-numeric fields pass through. */
export function clampSelfLog(log: CruiseSelfLog): CruiseSelfLog {
  return {
    ...log,
    poolHours: clampNum(log.poolHours, SELF_LOG_LIMITS.maxHours),
    excursionHours: clampNum(log.excursionHours, SELF_LOG_LIMITS.maxHours),
    fitnessHours: clampNum(log.fitnessHours, SELF_LOG_LIMITS.maxHours),
    alcoholDrinks: clampNum(log.alcoholDrinks, SELF_LOG_LIMITS.maxDrinks),
    sleepQualityPct:
      log.sleepQualityPct == null ? null : clampNum(log.sleepQualityPct, 100),
  };
}

/**
 * Guest-type cycler INCLUDING the unset state: null → family → … → excursion
 * → back to null, so a guest who tapped in by mistake can return to "Not set"
 * (self-report stays fully reversible — nothing is stuck logged).
 */
const GUEST_TYPE_CYCLE: ReadonlyArray<CruiseGuestType> = [
  'family', 'athlete', 'older_traveler', 'party', 'excursion',
];

export function nextGuestType(cur: CruiseGuestType | null): CruiseGuestType | null {
  if (cur == null) return GUEST_TYPE_CYCLE[0];
  const i = GUEST_TYPE_CYCLE.indexOf(cur);
  return i === GUEST_TYPE_CYCLE.length - 1 ? null : GUEST_TYPE_CYCLE[i + 1];
}

// ─── Day-scoped self-log persistence codec ───────────────────────────────────
// The container persists the guest's log so navigating away doesn't silently
// zero it (and readiness doesn't quietly rise). Day-scoped on purpose: a
// cruise day's sun/drinks/excursions are facts about TODAY only — restoring
// yesterday's log would fabricate today's load.

export interface StoredSelfLog {
  day: string; // local YYYY-MM-DD the log belongs to
  log: CruiseSelfLog;
}

export function encodeSelfLog(log: CruiseSelfLog, day: string): string {
  return JSON.stringify({ day, log } satisfies StoredSelfLog);
}

const GUEST_TYPES = new Set<string>(GUEST_TYPE_CYCLE);
const DAY_MODES = new Set<string>(['sea_day', 'port_day']);
const DECKS = new Set<string>(['indoor', 'mixed', 'outdoor']);
const RISKS = new Set<string>(['none', 'low', 'moderate', 'high']);

/**
 * Parse a stored payload back into a safe CruiseSelfLog. Returns null when the
 * payload is malformed OR belongs to a different local day (fresh day = fresh
 * log). Every field is whitelisted + clamped — storage is treated as untrusted.
 */
export function decodeSelfLog(raw: string | null | undefined, today: string): CruiseSelfLog | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredSelfLog>;
    if (parsed?.day !== today || typeof parsed.log !== 'object' || parsed.log == null) return null;
    const l = parsed.log as Record<string, unknown>;
    return clampSelfLog({
      guestType: typeof l.guestType === 'string' && GUEST_TYPES.has(l.guestType)
        ? (l.guestType as CruiseGuestType) : null,
      dayMode: typeof l.dayMode === 'string' && DAY_MODES.has(l.dayMode)
        ? (l.dayMode as CruiseDayMode) : EMPTY_SELF_LOG.dayMode,
      deckExposure: typeof l.deckExposure === 'string' && DECKS.has(l.deckExposure)
        ? (l.deckExposure as CruiseDeckExposure) : EMPTY_SELF_LOG.deckExposure,
      excursionRisk: typeof l.excursionRisk === 'string' && RISKS.has(l.excursionRisk)
        ? (l.excursionRisk as CruiseExcursionRisk) : EMPTY_SELF_LOG.excursionRisk,
      poolHours: typeof l.poolHours === 'number' ? l.poolHours : 0,
      alcoholDrinks: typeof l.alcoholDrinks === 'number' ? l.alcoholDrinks : 0,
      excursionHours: typeof l.excursionHours === 'number' ? l.excursionHours : 0,
      fitnessHours: typeof l.fitnessHours === 'number' ? l.fitnessHours : 0,
      sleepQualityPct: typeof l.sleepQualityPct === 'number' ? l.sleepQualityPct : null,
    });
  } catch {
    return null;
  }
}

export interface CruiseModeInput {
  /** Live engine readiness score (0–100), already rounded/clamped; null when unavailable. */
  hydrationScore: number | null;
  /** Real minutes since the last logged intake; null when unknown / no history. */
  minutesSinceLastIntake: number | null;
  /** Live environment for the selected port; null while loading or offline. */
  env: CruiseLiveEnv | null;
  envLoading: boolean;
  envError: boolean;
  /** Selected port id + the switchable port list. */
  portId: string;
  ports: ReadonlyArray<{ id: string; label: string }>;
  /** The guest's self-logged day. */
  log: CruiseSelfLog;
  /** Whether a real intake-logging action is wired (else the CTA is a labelled preview). */
  logWaterAvailable: boolean;
  reducedMotion: boolean;
}

// ─── Output view model ───────────────────────────────────────────────────────

export interface CruiseReadinessView {
  /** 'ready' once we have a real score; 'building' while the signal is still forming. */
  posture: 'ready' | 'building';
  score: number | null;
  scoreLabel: string; //           "78" | "—"
  statusKey: CruiseStatus | null;
  statusLabel: string; //          "BALANCED" | "BUILDING SIGNAL"
  tone: CruiseTone;
  recommendation: string;
  recheckLabel: string | null; //  "Next check in 20 min" | null
  ring: { progress: number; caption: string }; // progress 0–1
  /** True when the score reflects live weather; drives the honest "with live conditions" caption. */
  usesLiveConditions: boolean;
}

export interface CruiseEnvCell {
  key: string;
  icon: string;
  label: string;
  value: string;
  accentTone?: CruiseTone;
}

export interface CruiseEnvironmentView {
  source: {
    key: CruiseEnvSourceKey;
    label: string; //   "LIVE" | "PILOT DATA" | "OFFLINE" | "FETCHING"
    caption: string;
    tone: CruiseTone;
  };
  portName: string;
  conditions: string | null;
  hasLiveData: boolean;
  cells: CruiseEnvCell[]; //          only real, present values
  journeyIntensity: { label: string; tone: CruiseTone } | null;
}

export interface CruiseLogRow {
  id: string;
  label: string;
  value: string;
  icon: string;
  /** True when the guest has actually set this field (vs. an honest "not logged" placeholder). */
  set: boolean;
  tone?: CruiseTone;
}

export interface CruiseDayView {
  dayMode: CruiseDayMode;
  dayModeLabel: string;
  /** Suggested (generic, template) rhythm for the chosen day mode — labelled, not the guest's real schedule. */
  rhythm: string[];
  rows: CruiseLogRow[];
  loggedAnything: boolean;
  emptyHint: string | null;
}

export interface CruiseRecoveryView {
  hasSignal: boolean;
  riskLabel: string; //    "" when no signal
  tone: CruiseTone;
  reasons: string[];
  /** Honest copy shown when there is no elevated demand / nothing to report yet. */
  emptyCopy: string | null;
}

export interface CruiseLogWaterView {
  available: boolean;
  label: string;
  /** Non-null when the underlying capability is not wired (shown as a Preview chip). */
  previewNote: string | null;
}

export interface CruiseModeView {
  header: { eyebrow: string; title: string; subtitle: string };
  readiness: CruiseReadinessView;
  environment: CruiseEnvironmentView;
  day: CruiseDayView;
  recovery: CruiseRecoveryView;
  checklist: ReadonlyArray<{ id: string; label: string; icon: string }>;
  logWater: CruiseLogWaterView;
  badges: ReadonlyArray<{ id: string; title: string; hint: string }>;
  disclaimer: string;
  reducedMotion: boolean;
}

// ─── Constants ───────────────────────────────────────────────────────────────

export const CRUISE_DISCLAIMER =
  'Cruise Mode provides estimated recovery and hydration guidance only and is ' +
  'not a medical, diagnostic, safety, or navigation tool.';

const DAY_MODE_LABEL: Record<CruiseDayMode, string> = {
  sea_day: 'Sea Day',
  port_day: 'Port Day',
};

const DECK_LABEL: Record<CruiseDeckExposure, string> = {
  indoor: 'Mostly indoors',
  mixed: 'Mixed sun',
  outdoor: 'Mostly outdoors',
};

// Generic, clearly-a-template rhythm per day mode. This is guidance (like the
// checklist), NOT a claim about the guest's real itinerary.
const RHYTHM: Record<CruiseDayMode, string[]> = {
  sea_day: ['Morning', 'Pool / deck', 'Recovery window', 'Evening'],
  port_day: ['Pre-port hydrate', 'Ashore', 'Recovery window', 'Evening'],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function loggedAnything(log: CruiseSelfLog): boolean {
  return (
    log.guestType != null ||
    log.poolHours > 0 ||
    log.alcoholDrinks > 0 ||
    log.excursionHours > 0 ||
    log.fitnessHours > 0 ||
    log.sleepQualityPct != null ||
    log.excursionRisk !== 'none' ||
    log.dayMode !== 'sea_day' ||
    log.deckExposure !== 'mixed'
  );
}

/**
 * Build the CruiseSession fed to `evaluateCruise` from REAL inputs.
 * When live weather is absent we pass a neutral, sub-heat-threshold environment
 * so the model applies NO phantom heat/sun penalty (honest: absent data = no
 * contribution), while still honouring the guest's declared deck / day / risk.
 */
function toSession(input: CruiseModeInput, score: number): CruiseSession {
  const { env, log } = input;
  const factors: EnvironmentFactors = {
    ambientTempF: env ? env.ambientTempF : 75, // 75 < 80 → rothfusz returns tempF, no heat load
    humidityPct: env ? env.humidityPct : 50,
    // The live feed's sun-hours describe the PORT's sun window, not the guest's
    // personal exposure. Charging it to the readiness math would fabricate
    // "X hrs in direct sun" the guest never reported. Ambient HEAT (temp +
    // humidity → heat index) is applied automatically because the guest is
    // physically in it; personal sun/exposure load comes only from self-logged
    // pool + excursion time below. So env sun is 0 here (shown, not charged).
    sunExposureHours: 0,
    deckExposure: log.deckExposure,
    dayMode: log.dayMode,
    excursionRisk: log.excursionRisk,
  };
  return {
    hydrationScore: score,
    minutesSinceLastIntake: input.minutesSinceLastIntake ?? 0,
    env: factors,
    guest: {
      guestType: log.guestType ?? 'family',
      poolHours: log.poolHours,
      alcoholDrinks: log.alcoholDrinks,
      excursionHours: log.excursionHours,
      fitnessHours: log.fitnessHours,
      // Unknown sleep → 100 so the model applies NO sleep penalty (never fabricate poor sleep).
      sleepQualityPct: log.sleepQualityPct ?? 100,
    },
  };
}

function resolveEnvironment(input: CruiseModeInput): CruiseEnvironmentView {
  const { env, envLoading, envError } = input;
  const isLive = env?.source === 'openweather';

  let source: CruiseEnvironmentView['source'];
  if (envLoading && !env) {
    source = { key: 'loading', label: 'FETCHING', caption: 'Loading live conditions…', tone: 'neutral' };
  } else if (isLive) {
    source = {
      key: 'live',
      label: 'LIVE',
      caption: env?.fetchedAtLabel ? `OpenWeather · ${env.fetchedAtLabel}` : 'OpenWeather',
      tone: 'green',
    };
  } else if (envError && !env) {
    source = { key: 'offline', label: 'OFFLINE', caption: 'Live conditions unavailable', tone: 'amber' };
  } else {
    // Server returned its deterministic Caribbean baseline (source === 'fallback').
    source = { key: 'pilot', label: 'PILOT DATA', caption: 'Baseline conditions — feed unavailable', tone: 'cyan' };
  }

  const cells: CruiseEnvCell[] = [];
  if (env) {
    const heatIndex = evaluateCruise(toSession(input, input.hydrationScore ?? 100)).envHeatIndexF;
    cells.push(
      { key: 'temp', icon: 'thermometer', label: 'Temperature', value: `${Math.round(env.ambientTempF)}°F` },
      { key: 'humidity', icon: 'cloud-drizzle', label: 'Humidity', value: `${Math.round(env.humidityPct)}%` },
      // Environmental sun window (port daylight/UV proxy) — an ambient condition,
      // deliberately NOT labelled as the guest's personal exposure.
      { key: 'sun', icon: 'sun', label: 'Sun window', value: `${env.sunExposureHours.toFixed(1)} hr` },
      {
        key: 'heat',
        icon: 'activity',
        label: 'Heat index',
        value: `${heatIndex}°F`,
        accentTone: heatIndex >= 103 ? 'red' : heatIndex >= 90 ? 'amber' : undefined,
      },
      { key: 'wind', icon: 'navigation', label: 'Wind', value: `${Math.round(env.windKts)} kts` },
    );
  }

  const ji = deriveJourneyIntensity(input.log.excursionRisk);
  const journeyIntensity = ji
    ? {
        label: JOURNEY_INTENSITY_LABEL[ji],
        tone: (ji === 'ELEVATED' ? 'amber' : ji === 'MODERATE' ? 'cyan' : 'green') as CruiseTone,
      }
    : null;

  return {
    source,
    portName: env?.portName ?? '',
    conditions: env?.conditions ?? null,
    hasLiveData: !!env,
    cells,
    journeyIntensity,
  };
}

function resolveReadiness(input: CruiseModeInput): CruiseReadinessView {
  const { hydrationScore } = input;

  if (hydrationScore == null) {
    return {
      posture: 'building',
      score: null,
      scoreLabel: '—',
      statusKey: null,
      statusLabel: 'BUILDING SIGNAL',
      tone: 'cyan',
      recommendation:
        'Your readiness signal is still forming. Log a glass of water to begin, and it will sharpen as the day goes on.',
      recheckLabel: null,
      ring: { progress: 0, caption: 'GUEST READINESS' },
      usesLiveConditions: false,
    };
  }

  const evalr = evaluateCruise(toSession(input, hydrationScore));
  return {
    posture: 'ready',
    score: evalr.score,
    scoreLabel: String(evalr.score),
    statusKey: evalr.status,
    statusLabel: evalr.statusLabel,
    tone: STATUS_TONE[evalr.status],
    recommendation: evalr.recommendation,
    recheckLabel: `Next check in ${evalr.nextCheckMinutes} min`,
    ring: { progress: evalr.score / 100, caption: 'GUEST READINESS' },
    usesLiveConditions: input.env?.source === 'openweather',
  };
}

function resolveDay(input: CruiseModeInput): CruiseDayView {
  const { log } = input;
  const logged = loggedAnything(log);

  const rows: CruiseLogRow[] = [
    {
      id: 'guest_type',
      label: 'Guest type',
      icon: 'user',
      value: log.guestType ? GUEST_TYPE_LABEL[log.guestType] : 'Not set',
      set: log.guestType != null,
    },
    {
      id: 'deck',
      label: 'Sun exposure',
      icon: log.deckExposure === 'outdoor' ? 'sun' : 'home',
      value: DECK_LABEL[log.deckExposure],
      set: log.deckExposure !== 'mixed',
    },
    {
      id: 'pool',
      label: 'Pool / deck time',
      icon: 'droplet',
      value: log.poolHours > 0 ? `${log.poolHours} hr` : 'Not logged',
      set: log.poolHours > 0,
    },
    {
      id: 'drinks',
      label: 'Drinks logged',
      icon: 'coffee',
      value: log.alcoholDrinks > 0 ? `${log.alcoholDrinks}` : 'None logged',
      set: log.alcoholDrinks > 0,
      tone: log.alcoholDrinks >= 3 ? 'amber' : undefined,
    },
    {
      id: 'excursion',
      label: 'Excursion time',
      icon: 'map',
      value: log.excursionHours > 0 ? `${log.excursionHours} hr` : 'Not logged',
      set: log.excursionHours > 0,
    },
    {
      id: 'sleep',
      label: 'Sleep quality',
      icon: 'moon',
      value: log.sleepQualityPct != null ? `${log.sleepQualityPct}%` : 'Not provided',
      set: log.sleepQualityPct != null,
    },
  ];

  return {
    dayMode: log.dayMode,
    dayModeLabel: DAY_MODE_LABEL[log.dayMode],
    rhythm: RHYTHM[log.dayMode],
    rows,
    loggedAnything: logged,
    emptyHint: logged
      ? null
      : 'Log your day as it happens — sun, pool time, drinks, and excursions all sharpen your readiness. Nothing is assumed for you.',
  };
}

function resolveRecovery(input: CruiseModeInput): CruiseRecoveryView {
  if (input.hydrationScore == null) {
    return {
      hasSignal: false,
      riskLabel: '',
      tone: 'neutral',
      reasons: [],
      emptyCopy: 'Recovery demand appears once your readiness signal is established.',
    };
  }

  const evalr = evaluateCruise(toSession(input, input.hydrationScore));
  const hasReasons = evalr.riskReasons.length > 0;

  if (evalr.riskLevel === 'LOW' && !hasReasons) {
    return {
      hasSignal: false,
      riskLabel: RISK_LABEL[evalr.riskLevel],
      tone: RISK_TONE[evalr.riskLevel],
      reasons: [],
      emptyCopy: 'No elevated recovery demand detected. Keep sipping water to stay ahead.',
    };
  }

  return {
    hasSignal: true,
    riskLabel: RISK_LABEL[evalr.riskLevel],
    tone: RISK_TONE[evalr.riskLevel],
    reasons: evalr.riskReasons,
    emptyCopy: null,
  };
}

// ─── Main resolver ───────────────────────────────────────────────────────────

export function resolveCruiseModeView(input: CruiseModeInput): CruiseModeView {
  return {
    header: {
      eyebrow: 'ENTERPRISE · PREMIUM',
      title: 'Cruise Mode',
      subtitle: 'Hydration intelligence for life at sea.',
    },
    readiness: resolveReadiness(input),
    environment: resolveEnvironment(input),
    day: resolveDay(input),
    recovery: resolveRecovery(input),
    checklist: PORT_DAY_CHECKLIST,
    logWater: {
      available: input.logWaterAvailable,
      label: 'Log water',
      previewNote: input.logWaterAvailable ? null : 'Preview — onboard logging ships with cruise-line partners',
    },
    badges: CRUISE_BADGES,
    disclaimer: CRUISE_DISCLAIMER,
    reducedMotion: input.reducedMotion,
  };
}
