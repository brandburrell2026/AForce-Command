/**
 * Quote engine — picks a contextually-correct AForce quote.
 *
 * Selection is deterministic from context (same context → same quote)
 * with a half-hour rotation key so the line refreshes throughout the
 * day without churning on every render.
 *
 * Pool priority (highest first):
 *   1. socialModeActive          → SOCIAL    (overrides everything — moment-of-truth)
 *   2. level === DEPLETED        → COMMAND   (urgency: tell them what to do)
 *   3. RECOVERING + recent action→ RESULT    (acknowledge what they just did)
 *   4. morning window (5–11h)    → COMMAND   (start the day)
 *   5. night window (21–4h)      → IDENTITY  (who you are)
 *   6. PEAK + streak ≥ 3         → IDENTITY  (reward)
 *   7. default                   → PRODUCT   (steady-state brand)
 */

import {
  COMMAND_QUOTES,
  RESULT_QUOTES,
  IDENTITY_QUOTES,
  PRODUCT_QUOTES,
  SOCIAL_QUOTES,
} from '../data/quotes';
import type { PerformanceLevel } from '../types';
import type { Quote, QuoteReason, SelectedQuote } from '../types/quote';

export interface QuoteContext {
  /** Current hydration / performance level. */
  level: PerformanceLevel;
  /** Is the user currently in social mode? */
  socialModeActive: boolean;
  /** Local hour of day, 0–23. */
  hourOfDay: number;
  /** Minutes since the last logged AForce intake (null if never). */
  minutesSinceLastIntake: number | null;
  /** Compliance streak in days. */
  streakDays: number;
}

interface PoolPick {
  pool: Quote[];
  reason: QuoteReason;
}

/**
 * Defensive normalization — clamps each context field into its valid
 * range so an upstream bug (NaN, null, garbage string) can never cause
 * the engine to throw or return undefined.
 */
function normalize(ctx: Partial<QuoteContext>): QuoteContext {
  const validLevels: PerformanceLevel[] = ['PEAK', 'BALANCED', 'RECOVERING', 'DEPLETED'];
  const level = ctx.level && validLevels.includes(ctx.level) ? ctx.level : 'BALANCED';
  const hourRaw = Number.isFinite(ctx.hourOfDay) ? Math.floor(ctx.hourOfDay as number) : 12;
  const hourOfDay = ((hourRaw % 24) + 24) % 24;
  const streakDays = Math.max(0, Math.floor(Number.isFinite(ctx.streakDays) ? (ctx.streakDays as number) : 0));
  const minutesSinceLastIntake =
    ctx.minutesSinceLastIntake != null && Number.isFinite(ctx.minutesSinceLastIntake)
      ? Math.max(0, Math.floor(ctx.minutesSinceLastIntake))
      : null;
  return {
    level,
    socialModeActive: Boolean(ctx.socialModeActive),
    hourOfDay,
    minutesSinceLastIntake,
    streakDays,
  };
}

function pickPool(ctx: QuoteContext): PoolPick {
  if (ctx.socialModeActive) return { pool: SOCIAL_QUOTES, reason: 'social_mode' };
  if (ctx.level === 'DEPLETED') return { pool: COMMAND_QUOTES, reason: 'depleted' };
  if (
    ctx.level === 'RECOVERING' &&
    ctx.minutesSinceLastIntake != null &&
    ctx.minutesSinceLastIntake < 30
  ) {
    return { pool: RESULT_QUOTES, reason: 'recent_action_recovering' };
  }
  if (ctx.hourOfDay >= 5 && ctx.hourOfDay < 11) {
    return { pool: COMMAND_QUOTES, reason: 'morning' };
  }
  if (ctx.hourOfDay >= 21 || ctx.hourOfDay < 4) {
    return { pool: IDENTITY_QUOTES, reason: 'night' };
  }
  if (ctx.level === 'PEAK' && ctx.streakDays >= 3) {
    return { pool: IDENTITY_QUOTES, reason: 'peak_streak' };
  }
  return { pool: PRODUCT_QUOTES, reason: 'default' };
}

/**
 * Stable rotation hash — same context+halfHour ⇒ same index. Mixing in
 * level, streak, and social flag prevents two adjacent contexts from
 * collapsing onto the same quote on the same half-hour boundary.
 */
function rotationIndex(ctx: QuoteContext, poolLen: number): number {
  const halfHour = ctx.hourOfDay * 2;
  const levelCode = ctx.level.charCodeAt(0);
  const social = ctx.socialModeActive ? 0x5a5a : 0;
  let h = (halfHour * 31 + ctx.streakDays * 17 + levelCode + social) >>> 0;
  // xorshift mix to spread short input domains evenly across pool length
  h ^= h << 13; h >>>= 0;
  h ^= h >> 17;
  h ^= h << 5;  h >>>= 0;
  return h % poolLen;
}

/**
 * Pick a single quote for the given live context. Always returns a
 * defined, in-pool quote — never throws.
 */
export function selectQuote(ctx: Partial<QuoteContext>): SelectedQuote {
  const norm = normalize(ctx);
  const { pool, reason } = pickPool(norm);
  const idx = rotationIndex(norm, pool.length);
  const q = pool[idx];
  return { ...q, reason };
}

/**
 * Convenience: derive QuoteContext from the live store shapes used by
 * the home screen. Keeps the wiring out of the component.
 */
export function buildQuoteContext(args: {
  level: PerformanceLevel;
  socialModeActive: boolean;
  lastIntakeTime: Date | null | undefined;
  streakDays: number;
  now?: Date;
}): QuoteContext {
  const now = args.now ?? new Date();
  const minutesSinceLastIntake =
    args.lastIntakeTime instanceof Date && !Number.isNaN(args.lastIntakeTime.getTime())
      ? Math.max(0, Math.floor((now.getTime() - args.lastIntakeTime.getTime()) / 60_000))
      : null;
  return normalize({
    level: args.level,
    socialModeActive: args.socialModeActive,
    hourOfDay: now.getHours(),
    minutesSinceLastIntake,
    streakDays: args.streakDays,
  });
}
