/**
 * Elite Home — pure presentation resolver (E1, `elite_home_experience_enabled`).
 *
 * PRESENTATION ONLY. This module decides how the elevated Home *looks and moves*
 * for a given readiness band — accent colour, signal ordering, and whether the
 * arc/number animate. It NEVER computes, reads into, or alters the HydroState
 * score, the command, command eligibility, timing, or safety logic: it takes the
 * already-computed band label + score as inputs and returns display metadata.
 *
 * Colour source: the brand state palette exposed by `theme/afTokens.ts` (`af.*`),
 * NOT the off-limits `theme/statusColor.ts`. DEPLETED tints with brand Signal Red
 * `af.red` (#C1281B) — deliberately distinct from statusColor's DEPLETED red
 * (#FF2800), which this module must never reproduce or collide with.
 *
 * Extracted from the component (like `afPrimitives.logic.ts`) so the motion +
 * presentation DECISIONS are unit-testable in the node vitest environment.
 */
import { af } from '@/theme';

export type ReadinessBand = 'PEAK' | 'BALANCED' | 'RECOVERING' | 'DEPLETED';
export type SignalKey = 'hydration' | 'heat' | 'recovery';

export interface HomePresentation {
  band: ReadinessBand;
  /** Band-tinted accent — a brand `af.*` token string (never statusColor.ts). */
  accent: string;
  /** Order the three quiet signals lead in — most-relevant-first per band. */
  signalOrder: SignalKey[];
}

const DEFAULT_ORDER: SignalKey[] = ['hydration', 'heat', 'recovery'];

/** Coerce the engine's level string to a known band; unknown → BALANCED (safe, presentation-only). */
export function normalizeBand(level: string | null | undefined): ReadinessBand {
  const up = (level ?? '').toUpperCase();
  if (up === 'PEAK' || up === 'BALANCED' || up === 'RECOVERING' || up === 'DEPLETED') {
    return up as ReadinessBand;
  }
  return 'BALANCED';
}

/**
 * Map a readiness band → elevated-Home presentation. Accent leads the eye to the
 * band; signal order surfaces the signal that matters most for that band first.
 */
export function resolveHomePresentation(level: string | null | undefined): HomePresentation {
  const band = normalizeBand(level);
  switch (band) {
    case 'PEAK':
      return { band, accent: af.green, signalOrder: ['recovery', 'hydration', 'heat'] };
    case 'RECOVERING':
      return { band, accent: af.amber, signalOrder: ['recovery', 'hydration', 'heat'] };
    case 'DEPLETED':
      return { band, accent: af.red, signalOrder: ['hydration', 'heat', 'recovery'] };
    case 'BALANCED':
    default:
      return { band, accent: af.cyan, signalOrder: DEFAULT_ORDER };
  }
}

export interface ArcAnimationInput {
  /** Is the elite experience flag on? */
  elite: boolean;
  /** OS/user reduced-motion preference. */
  reducedMotion: boolean;
  /** Current (already-computed) readiness score. */
  score: number;
  /** Previous known score this session, or null on first mount. */
  prevScore: number | null;
}

export interface ArcAnimationPlan {
  /** Draw the ring fill in on mount (a reveal — reduced-motion turns it off). */
  animateRing: boolean;
  /** Count the NUMBER up between real values only — never from zero. */
  countUp: boolean;
  /** Start value for the number count-up (== score when there is no real prior). */
  fromScore: number;
}

/**
 * Decide the elevated arc/number motion. Rules (spec §1):
 *  - motion only when elite AND not reduced-motion AND the score is a real finite value;
 *  - the ring may reveal (draw in) on mount;
 *  - the NUMBER only counts between two real values (never animates from zero / from a
 *    stale-or-absent score) — so a first mount or an unavailable prior shows the value outright.
 */
export function resolveArcAnimation(i: ArcAnimationInput): ArcAnimationPlan {
  const validScore = Number.isFinite(i.score);
  const canMotion = i.elite && !i.reducedMotion && validScore;
  const hasRealPrev = i.prevScore != null && Number.isFinite(i.prevScore);
  return {
    animateRing: canMotion,
    countUp: canMotion && hasRealPrev && (i.prevScore as number) !== i.score,
    fromScore: hasRealPrev ? (i.prevScore as number) : i.score,
  };
}
