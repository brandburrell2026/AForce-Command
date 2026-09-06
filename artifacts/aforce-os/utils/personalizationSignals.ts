/**
 * Personalization Signals — pure, dependency-free helper.
 *
 * Reads the physiological + environmental + behavioral inputs already
 * present in `UserState` and `ScoreEngineOutput` and condenses them
 * into a tiny structure the UI uses to render a "Why this for you"
 * line under HydroScan + Smart Capture recommendations.
 *
 * Inputs (all already wired in the app):
 *   - bodyWeightLbs           → mass-scaled fluid turnover
 *   - activityLevel (0..10)   → exertion-driven demand
 *   - weatherTempC            → live ambient temperature
 *   - weatherHumidity         → humidity premium on heat
 *   - heatLoad (0..10)        → coarse fallback when no live weather
 *   - performanceState.level  → DEPLETED / RECOVERING / BALANCED / PEAK
 *   - complianceStreak        → hydration consistency (days in a row)
 *   - socialAlcoholMultiplier → alcohol-driven diuresis (>1 when active)
 *
 * Output:
 *   - `signals` — derived per-axis levels (low/normal/elevated/high)
 *   - `reasons` — ordered list of the dominant drivers (most → least
 *     impactful) so the UI can show 1–3 short chips.
 *   - `summary` — a single-line eyebrow string used above the reasons.
 *
 * The ranking is deterministic and matches the physiological weight of
 * each signal in `utils/depletionRate.ts`: heat × humidity dominates,
 * activity is next, then recovery/depletion, then alcohol, then
 * consistency (positive reinforcement), then mass (small effect).
 */

import type { ScoreEngineOutput, UserState } from '../types';
import { activeDecayMultiplier } from './hangoverRisk';
import {
  ageFromBirthYear,
  type ProfileIdentity,
} from './profileIdentity';
import {
  acidicLoadLabel,
  computeLoadSignals,
  stimulantLoadLabel,
  type LoadEvent,
} from './loadSignals';

/**
 * Finite-number guard. `??` does not catch `NaN` (NaN is not nullish),
 * so corrupted persisted state could otherwise leak NaN into bands +
 * labels. Use everywhere we accept a raw number from `UserState`.
 */
function safeNum(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

export type SignalLevel = 'low' | 'normal' | 'elevated' | 'high';

export interface PersonalizationSignals {
  /** Ambient °C — null when neither weather nor heatLoad provided. */
  tempC: number | null;
  /** Humidity % — null when no live data. */
  humidityPct: number | null;
  /** Activity level 0..10. */
  activity: number;
  /** Body weight in lbs, sanitized. */
  bodyWeightLbs: number;
  /** Hydration streak in days. */
  consistencyDays: number;
  /** True when alcohol multiplier > 1. */
  alcoholActive: boolean;
  /** Performance level passed through from the engine. */
  performanceLevel: ScoreEngineOutput['performanceState']['level'];
  /** Per-axis bands. */
  bands: {
    heat: SignalLevel;
    humidity: SignalLevel;
    activity: SignalLevel;
    recovery: SignalLevel;
    consistency: SignalLevel;
    mass: SignalLevel;
  };
}

export interface PersonalizationReason {
  /** Short chip label (≤24 chars). */
  label: string;
  /** Stable machine key — useful for tests + telemetry. */
  key: 'heat' | 'humidity' | 'activity' | 'recovery' | 'alcohol' | 'consistency' | 'mass' | 'bodyModel' | 'acidicLoad' | 'stimulantLoad' | 'caffeine' | 'occupation' | 'travel';
}

export interface PersonalizationOutput {
  signals: PersonalizationSignals;
  reasons: PersonalizationReason[];
  /** One-line eyebrow, e.g. "Tuned to your body, intake & environment". */
  summary: string;
}

// ─── Thresholds (kept in lock-step with depletionRate.ts) ─────────────

const HEAT_ELEVATED_C = 27;
const HEAT_HIGH_C = 32;
const HUMIDITY_ELEVATED = 60;
const HUMIDITY_HIGH = 80;
const ACTIVITY_ELEVATED = 4;
const ACTIVITY_HIGH = 7;
const STREAK_STRONG_DAYS = 5;
const WEIGHT_HIGH_LBS = 200;
const WEIGHT_LOW_LBS = 120;

// ─── Pure helpers ─────────────────────────────────────────────────────

function heatBand(tempC: number | null): SignalLevel {
  if (tempC == null) return 'normal';
  if (tempC >= HEAT_HIGH_C) return 'high';
  if (tempC >= HEAT_ELEVATED_C) return 'elevated';
  if (tempC < 10) return 'low';
  return 'normal';
}

function humidityBand(humidityPct: number | null): SignalLevel {
  if (humidityPct == null) return 'normal';
  if (humidityPct >= HUMIDITY_HIGH) return 'high';
  if (humidityPct >= HUMIDITY_ELEVATED) return 'elevated';
  return 'normal';
}

function activityBand(activity: number): SignalLevel {
  if (activity >= ACTIVITY_HIGH) return 'high';
  if (activity >= ACTIVITY_ELEVATED) return 'elevated';
  return 'normal';
}

function recoveryBand(level: ScoreEngineOutput['performanceState']['level']): SignalLevel {
  if (level === 'DEPLETED') return 'high';        // high RECOVERY DEMAND
  if (level === 'RECOVERING') return 'elevated';
  if (level === 'PEAK') return 'low';             // low RECOVERY DEMAND
  return 'normal';
}

function consistencyBand(streakDays: number): SignalLevel {
  if (streakDays >= STREAK_STRONG_DAYS) return 'high';   // strong streak
  if (streakDays >= 2) return 'elevated';
  return 'normal';
}

function massBand(lbs: number): SignalLevel {
  if (lbs >= WEIGHT_HIGH_LBS) return 'elevated';
  if (lbs <= WEIGHT_LOW_LBS) return 'low';
  return 'normal';
}

function heatLoadToTempCFallback(heatLoad: number): number {
  return 20 + Math.max(0, Math.min(10, heatLoad)) * 1.2;
}

// ─── Public API ───────────────────────────────────────────────────────

export interface DeriveArgs {
  userState: UserState;
  engineOutput: ScoreEngineOutput;
  /**
   * Override the alcohol multiplier. Normally omitted — the helper
   * reads `userState.socialMode` and computes it via
   * `activeDecayMultiplier(drinks)`. Passed explicitly only from tests.
   */
  socialAlcoholMultiplier?: number;
  /**
   * The user-edited body model (height / birth year / biological sex).
   * Slice 2 — when at least two body-model fields are filled in we
   * surface a "BODY MODEL" reason so the user can see the system
   * actually using their profile. Omit when no profile is loaded —
   * the helper degrades gracefully.
   */
  profileIdentity?: ProfileIdentity | null;
  /**
   * Recent intake events (typically `userState.intakeEvents` for the
   * rolling 24h window). When provided, the helper computes Acidic
   * Load and Stimulant Load signals over the last 6h and surfaces
   * "Acidic Load Elevated" / "Stimulant Load Elevated" chips with the
   * canonical phrasing from `loadSignals`. Coffee is NEVER named in
   * the chip — only the abstract load — so the tone stays informative
   * rather than judgmental. Omit to skip those signals entirely.
   */
  recentIntake?: LoadEvent[] | null;
  /**
   * Test seam — override "now" so timestamp-windowed load math is
   * deterministic. Defaults to `Date.now()`.
   */
  nowMs?: number;
}

export function derivePersonalizationSignals(args: DeriveArgs): PersonalizationOutput {
  const { userState: u, engineOutput: e } = args;

  // LANE B — CALCULATION ASSUMPTION ≠ OBSERVED EVIDENCE.
  //
  // `tempC` has two very different origins and the chip copy below could not
  // tell them apart. A measured reading is the member's world; the fallback is
  // `20 + clamp(heatLoad,0,10)*1.2` applied to a SEEDED CONSTANT that no code
  // path writes from an observation (PR4 quarantined it as
  // `legacyHeatLoadAssumption`). Rendered identically, a first-run member with
  // no weather data at all was shown "Warm 25°C" — the seed's arithmetic
  // image, wearing a degree sign.
  //
  // The value stays: bands, thresholds and every consumer of `signals.tempC`
  // are unchanged, because the fallback is a legitimate CALCULATION. Only the
  // provenance is now carried alongside it, so the member-facing claim can be
  // withheld where it would be a fabrication.
  const tempIsObserved =
    typeof u.weatherTempC === 'number' && Number.isFinite(u.weatherTempC);
  const tempC: number | null = tempIsObserved
    ? (u.weatherTempC as number)
    : typeof u.heatLoad === 'number' && Number.isFinite(u.heatLoad)
      ? heatLoadToTempCFallback(u.heatLoad)
      : null;

  const humidityPct: number | null =
    typeof u.weatherHumidity === 'number' && Number.isFinite(u.weatherHumidity)
      ? u.weatherHumidity
      : null;

  const activity = Math.max(0, Math.min(10, safeNum(u.activityLevel, 0)));
  const bodyWeightLbs = Math.max(60, safeNum(u.bodyWeightLbs, 150));
  const consistencyDays = Math.max(0, Math.round(safeNum(u.complianceStreak, 0)));

  // Auto-derive the alcohol multiplier from socialMode unless the caller
  // explicitly overrides (test seam). Wrapped so a malformed drinks
  // array never throws at the call site — bad state → no alcohol chip.
  let socialAlcoholMultiplier = 1;
  if (typeof args.socialAlcoholMultiplier === 'number') {
    socialAlcoholMultiplier = args.socialAlcoholMultiplier;
  } else {
    try {
      const sm = u.socialMode;
      if (sm && sm.active && Array.isArray(sm.drinks) && sm.drinks.length > 0) {
        socialAlcoholMultiplier = activeDecayMultiplier(sm.drinks);
      }
    } catch {
      socialAlcoholMultiplier = 1;
    }
  }
  const alcoholActive = Number.isFinite(socialAlcoholMultiplier) && socialAlcoholMultiplier > 1;

  const signals: PersonalizationSignals = {
    tempC,
    humidityPct,
    activity,
    bodyWeightLbs,
    consistencyDays,
    alcoholActive,
    performanceLevel: e.performanceState.level,
    bands: {
      heat: heatBand(tempC),
      humidity: humidityBand(humidityPct),
      activity: activityBand(activity),
      recovery: recoveryBand(e.performanceState.level),
      consistency: consistencyBand(consistencyDays),
      mass: massBand(bodyWeightLbs),
    },
  };

  // Order reasons by physiological dominance, most impactful first.
  const reasons: PersonalizationReason[] = [];

  // The degree is quoted ONLY for an observed reading. An assumed temperature
  // still drives the band (the calculation is legitimate) but names no number,
  // because a number in a °C chip is a claim about the member's environment
  // that nothing observed.
  if (signals.bands.heat === 'high' && tempC != null) {
    reasons.push({
      key: 'heat',
      label: tempIsObserved ? `Heat ${Math.round(tempC)}°C` : 'Heat load high',
    });
  } else if (signals.bands.heat === 'elevated' && tempC != null) {
    reasons.push({
      key: 'heat',
      label: tempIsObserved ? `Warm ${Math.round(tempC)}°C` : 'Heat load elevated',
    });
  }

  if (signals.bands.humidity === 'high' && humidityPct != null) {
    reasons.push({ key: 'humidity', label: `Humid ${Math.round(humidityPct)}%` });
  } else if (signals.bands.humidity === 'elevated' && humidityPct != null) {
    reasons.push({ key: 'humidity', label: `Humidity ${Math.round(humidityPct)}%` });
  }

  if (signals.bands.activity === 'high') {
    reasons.push({ key: 'activity', label: `High activity ${activity}/10` });
  } else if (signals.bands.activity === 'elevated') {
    reasons.push({ key: 'activity', label: `Active ${activity}/10` });
  }

  if (signals.bands.recovery === 'high') {
    reasons.push({ key: 'recovery', label: 'Depleted state' });
  } else if (signals.bands.recovery === 'elevated') {
    reasons.push({ key: 'recovery', label: 'Recovering' });
  } else if (signals.bands.recovery === 'low') {
    reasons.push({ key: 'recovery', label: 'Peak recovery' });
  }

  if (alcoholActive) {
    reasons.push({ key: 'alcohol', label: 'Alcohol in window' });
  }

  if (signals.bands.consistency === 'high') {
    reasons.push({ key: 'consistency', label: `${consistencyDays}-day streak` });
  } else if (signals.bands.consistency === 'elevated') {
    reasons.push({ key: 'consistency', label: `${consistencyDays}-day streak` });
  }

  if (signals.bands.mass === 'elevated') {
    reasons.push({ key: 'mass', label: `${Math.round(bodyWeightLbs)} lb body mass` });
  } else if (signals.bands.mass === 'low') {
    reasons.push({ key: 'mass', label: `${Math.round(bodyWeightLbs)} lb body mass` });
  }

  // Body model — surface only when the user has actually filled in at
  // least two of the body fields beyond just weight, so the chip is
  // an honest signal that the engine is using their profile rather
  // than guessing. Placed near the bottom (lower physiological
  // dominance) so heat/activity/recovery still win the top 3.
  const pid = args.profileIdentity;
  if (pid) {
    const age = ageFromBirthYear(pid.birthYear);
    const sexInitial =
      pid.biologicalSex === 'male'
        ? 'M'
        : pid.biologicalSex === 'female'
        ? 'F'
        : null;
    const heightCm =
      typeof pid.heightCm === 'number' && Number.isFinite(pid.heightCm)
        ? Math.round(pid.heightCm)
        : null;
    const parts: string[] = [];
    if (heightCm != null) parts.push(`${heightCm}cm`);
    if (sexInitial) parts.push(sexInitial);
    if (age != null) parts.push(`${age}y`);
    if (parts.length >= 2) {
      reasons.push({ key: 'bodyModel', label: parts.join(' · ') });
    }

    // Lifestyle demand chips — surfaced only for explicit (non-'unspecified')
    // self-reported fields, so the chip honestly reflects a value the user
    // set. Non-scoring: these explain why the engine raised hydration
    // *demand*; they never move the score (Score-Protection). Placed last
    // (lowest dominance) so physiological signals keep the top slots.
    if (pid.caffeineHabit === 'high') {
      reasons.push({ key: 'caffeine', label: 'High caffeine load' });
    } else if (pid.caffeineHabit === 'moderate') {
      reasons.push({ key: 'caffeine', label: 'Caffeine load' });
    }
    const occupationLabel =
      pid.occupationType === 'outdoor'
        ? 'Outdoor demand'
        : pid.occupationType === 'active'
        ? 'Active-job demand'
        : pid.occupationType === 'shift'
        ? 'Shift-work demand'
        : null;
    if (occupationLabel) {
      reasons.push({ key: 'occupation', label: occupationLabel });
    }
    if (pid.frequentTraveler) {
      reasons.push({ key: 'travel', label: 'Travel dryness' });
    }
  }

  // Acidic Load + Stimulant Load — computed from the rolling 6h
  // intake window. Elevated bands are HIGH-PRIORITY and unshifted to
  // the front so they survive the top-3 truncation below — the whole
  // point of this slice is to surface hydration-support recommendations
  // when the user's intake mix demands it, even when other signals
  // (heat, activity, etc.) are competing for chip slots. Moderate
  // bands are LOW-PRIORITY: they ride in `moderateLoad` and only
  // fill remaining slots after the primary reasons have been kept.
  const moderateLoad: PersonalizationReason[] = [];
  if (args.recentIntake && args.recentIntake.length > 0) {
    const loads = computeLoadSignals(args.recentIntake, args.nowMs);
    // Elevated → front of the queue so the chip is always shown.
    // Order: stimulant before acidic so when both are elevated,
    // "Stimulant Load Elevated" lands in slot 1 (matches the AI
    // coach's spoken priority).
    if (loads.acidic.band === 'elevated') {
      reasons.unshift({ key: 'acidicLoad', label: acidicLoadLabel('elevated') });
    } else if (loads.acidic.band === 'moderate') {
      moderateLoad.push({ key: 'acidicLoad', label: acidicLoadLabel('moderate') });
    }
    if (loads.stimulant.band === 'elevated') {
      reasons.unshift({ key: 'stimulantLoad', label: stimulantLoadLabel('elevated') });
    } else if (loads.stimulant.band === 'moderate') {
      moderateLoad.push({ key: 'stimulantLoad', label: stimulantLoadLabel('moderate') });
    }
  }

  // Cap to the 3 strongest reasons — UI is a single line. Moderate
  // load chips only fill remaining slots after the primary reasons,
  // and never displace higher-signal chips.
  const top = reasons.slice(0, 3);
  if (top.length < 3 && moderateLoad.length > 0) {
    const room = 3 - top.length;
    top.push(...moderateLoad.slice(0, room));
  }

  const summary =
    top.length === 0
      ? 'Tuned to your body, intake & environment'
      : 'Why this for you';

  return { signals, reasons: top, summary };
}
