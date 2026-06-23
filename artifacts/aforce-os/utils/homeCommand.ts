/**
 * utils/homeCommand.ts — Daily Home command resolver (spec Phase 3).
 *
 * PURE · RN-FREE · side-effect-free. Derives the SINGLE behavior-first
 * command rendered on the simplified Home screen from state that has
 * ALREADY been computed elsewhere. It only READS — it never logs, awards
 * points, mutates score, or fabricates completed behavior (Score-Protection).
 * It never recommends a product before water (Water-First): the water branch
 * is evaluated first and dominates whenever hydration is below optimal,
 * behind pace, or nothing has been logged yet.
 *
 * Priority order (spec Phase 3):
 *   1. water    — hydration correction / maintenance
 *   2. recovery — an open recovery window is the dominant need
 *   3. protocol — an actionable protocol step is available
 *   4. scan     — optional drink check-in (fallback only)
 *
 * Imports ONLY the import-free `getStatusBand` from theme/statusColor so the
 * module stays loadable under vitest (react-native value imports break the
 * test env). Do NOT add react / hooks / store / router / RN / theme-color
 * imports here.
 */
import { getStatusBand, type StatusBand } from '../theme/statusColor';

export type HomeCommandActionType =
  | 'log_water'
  | 'start_protocol'
  | 'scan_drink'
  | 'recover';

export type HomeCommandPriority = 'water' | 'recovery' | 'protocol' | 'scan';

export interface HomeCommand {
  eyebrow: string;
  title: string;
  body: string;
  ctaLabel: string;
  actionType: HomeCommandActionType;
  priority: HomeCommandPriority;
}

export interface HomeCommandInput {
  /** Live readiness / hydration score 0-100. */
  score: number;
  /** Real fluid logged today (oz). Score-Protection: completed behavior only. */
  unitsConsumedToday?: number;
  /**
   * Minutes since the last logged intake. `null` / `undefined` means nothing
   * has been logged yet today — treated as "behind pace" so water leads.
   */
  minutesSinceLastIntake?: number | null;
  /** Engine's social/recovery window flag (engine.social.inRecoveryWindow). */
  inRecoveryWindow?: boolean;
  /** Engine performance band — advisory only; recovery keys off the window. */
  performanceLevel?: 'PEAK' | 'BALANCED' | 'RECOVERING' | 'DEPLETED';
  /** True when an actionable protocol step is available to start right now. */
  protocolAvailable?: boolean;
}

/**
 * Minutes since last intake beyond which the user is "behind pace" so a water
 * maintenance command leads even at an optimal score. Matches the existing
 * ~60-minute recheck cadence used by the hydration status copy.
 */
export const BEHIND_PACE_MINUTES = 60;

function isBehindPace(
  unitsConsumedToday: number | undefined,
  minutesSinceLastIntake: number | null | undefined,
): boolean {
  // Nothing logged yet today → behind pace, so the water command leads. We
  // honor BOTH signals so the caller can supply either: if no real fluid has
  // been logged the water command must never be skipped (Water-First), and a
  // stale last-intake timestamp keeps water leading even once some is logged.
  if ((unitsConsumedToday ?? 0) <= 0) return true;
  if (minutesSinceLastIntake == null) return true;
  return minutesSinceLastIntake >= BEHIND_PACE_MINUTES;
}

/** Water command copy — severity-aware, but every variant leads with water. */
function waterCommand(band: StatusBand): HomeCommand {
  const correction = band === 'CRITICAL' || band === 'RISK';
  const oz = correction ? 20 : band === 'DECLINING' ? 16 : 12;
  const body =
    correction || band === 'DECLINING'
      ? `Start with ${oz} oz water before anything else.`
      : `Start with ${oz} oz water to stay on pace.`;
  return {
    eyebrow: 'HYDRATION COMMAND',
    title: 'Hydrate now',
    body,
    ctaLabel: 'LOG WATER',
    actionType: 'log_water',
    priority: 'water',
  };
}

const RECOVER_COMMAND: HomeCommand = {
  eyebrow: 'RECOVERY COMMAND',
  title: 'Recover now',
  body: 'Bring your system back into range before pushing harder.',
  ctaLabel: 'RECOVER NOW',
  actionType: 'recover',
  priority: 'recovery',
};

const PROTOCOL_COMMAND: HomeCommand = {
  eyebrow: "TODAY'S PROTOCOL",
  title: 'Start your protocol',
  body: 'Follow the next step and keep your readiness protected.',
  ctaLabel: 'START PROTOCOL',
  actionType: 'start_protocol',
  priority: 'protocol',
};

const SCAN_COMMAND: HomeCommand = {
  eyebrow: 'CHECK-IN',
  title: 'Scan your drink',
  body: "Confirm what you're drinking before it affects your readiness.",
  ctaLabel: 'SCAN DRINK',
  actionType: 'scan_drink',
  priority: 'scan',
};

/**
 * Resolve the single Home command. Returns a fresh object every call; never
 * touches the input. Water-First: the water branch is checked first and wins
 * whenever hydration needs correction or upkeep, so a product-leaning command
 * can never appear before the user's hydration need has been evaluated.
 */
export function homeCommand(input: HomeCommandInput): HomeCommand {
  const band = getStatusBand(input.score);
  const belowOptimal = band !== 'OPTIMAL';
  const behindPace = isBehindPace(input.unitsConsumedToday, input.minutesSinceLastIntake);

  // 1) WATER FIRST — leads whenever hydration needs correction or upkeep.
  if (belowOptimal || behindPace) {
    return waterCommand(band);
  }

  // 2) RECOVERY — score is optimal & on-pace, but a recovery window is open.
  if (input.inRecoveryWindow === true) {
    return { ...RECOVER_COMMAND };
  }

  // 3) PROTOCOL — an actionable protocol step is queued.
  if (input.protocolAvailable === true) {
    return { ...PROTOCOL_COMMAND };
  }

  // 4) SCAN — nothing urgent; offer an optional drink check-in.
  return { ...SCAN_COMMAND };
}
