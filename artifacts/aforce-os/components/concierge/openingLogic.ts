/**
 * AForce Concierge — opening logic (pure, RN-free, unit-tested).
 *
 * The opening shows the app's CURRENT approved move, not a generated briefing:
 *   Your next move. → [engine command, verbatim] → one sentence why → Why this? · Ask
 * plus ONE relevant suggested question (the rest on demand). Design review
 * 2026-10-05: one action, one reason, no stack of boxes, no engineering words.
 */
import type { ConciergeClientContext } from '@/services/concierge/conciergeTypes';

export const SUGGESTED_KEYS = ['focus', 'ritual', 'target', 'sleep', 'workout', 'tour'] as const;
export type SuggestedKey = (typeof SUGGESTED_KEYS)[number];

/**
 * The single question most useful right now, from the same context the server
 * sees. Never infers a body state: "nothing logged" picks the ritual question
 * because logging is the next useful habit, not because the member is low.
 */
export function pickSuggestedQuestion(ctx: Pick<ConciergeClientContext, 'intake' | 'hydroState' | 'localTime' | 'providers'>): SuggestedKey {
  if (!ctx.intake.loggedToday) return 'ritual';
  if (ctx.hydroState && (ctx.hydroState.level === 'RECOVERING' || ctx.hydroState.level === 'DEPLETED')) return 'target';
  if (ctx.localTime.hour >= 19 || ctx.localTime.hour < 5) return 'sleep';
  if (ctx.localTime.hour >= 5 && ctx.localTime.hour < 10) return 'workout';
  return 'focus';
}

/** First sentence of the engine explanation — one reason, not a paragraph. */
export function firstSentence(text: string | null | undefined): string | null {
  if (!text) return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  const m = trimmed.match(/^[^.!?]+[.!?]/);
  return (m ? m[0] : trimmed).trim();
}

/** Recheck window copy input: null when the engine has no clock for this command. */
export function recheckMinutesFrom(ctx: Pick<ConciergeClientContext, 'command'>): number | null {
  const m = ctx.command?.recheckInMinutes;
  return typeof m === 'number' && Number.isFinite(m) && m > 0 ? m : null;
}
