/**
 * Command category inference — the single shared seam that maps a live
 * performance state to a coaching command CATEGORY (VideoCommandType).
 *
 * Pure + RN-free (type-only imports erase at build) so it can be reused by
 * BOTH `services/videoEngine.ts` (video selection) and the Command Confidence™
 * adaptive-learning layer, and unit-tested under the vitest pure runner.
 *
 * Score-Protection: pure classification only — never reads into, awards, or
 * mutates any hydration / performance / recovery score.
 */
import type { PerformanceLevel } from '../../types';
import type { VideoCommandType } from '../../types/video';

/** A coaching command category (alias of the video taxonomy). */
export type CommandCategory = VideoCommandType;

/** Every category the taxonomy can express (stable order). */
export const COMMAND_CATEGORIES: readonly CommandCategory[] = [
  'hydration_urgent',
  'hydration_maintain',
  'recovery_reset',
  'performance_activation',
  'morning_reset',
];

const CATEGORY_SET: ReadonlySet<string> = new Set(COMMAND_CATEGORIES);

/** Narrowing guard: is an arbitrary value a known command category? */
export function isCommandCategory(v: unknown): v is CommandCategory {
  return typeof v === 'string' && CATEGORY_SET.has(v);
}

/** Command urgency band (mirrors `Command['urgencyLevel']`). */
export type CommandUrgency = 'low' | 'medium' | 'high' | 'critical';

export interface CategorizeCommandInput {
  level: PerformanceLevel;
  score: number;
  urgencyLevel?: CommandUrgency;
}

/**
 * Faithful re-home of `services/videoEngine.ts` `inferCommandType` so the video
 * engine and the learning layer classify a command identically. The video
 * engine handles `morning_reset` via a separate trigger in `matchVideo`; this
 * seam mirrors the four state-derived outcomes `inferCommandType` produced.
 *
 * Precedence is locked: critical urgency and depletion always resolve to
 * `hydration_urgent` (Water-First — never demoted below water).
 */
export function categorizeCommand(input: CategorizeCommandInput): CommandCategory {
  const { level, score, urgencyLevel } = input;
  if (urgencyLevel === 'critical') return 'hydration_urgent';
  if (level === 'DEPLETED' || score < 40) return 'hydration_urgent';
  if (level === 'RECOVERING' || score < 65) return 'recovery_reset';
  if (level === 'PEAK' && score >= 90) return 'performance_activation';
  return 'hydration_maintain';
}
