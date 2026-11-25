/**
 * When the AFORCE Live Activity should be showing (pure).
 *
 * One rule, read from the saved Moments: the activity runs while a One Breath
 * plan is locked in (Quiet) and has not been closed, and for no longer than
 * LIVE_ACTIVITY_MAX_MS after the later of Lock In and the Moment's start.
 * Everything else — a sealed plan, a draft, a returned or cancelled plan, an
 * abandoned one past its expiry, a signed-out member with no Moments — is
 * "none", which ends it.
 *
 * It decides WHEN, never WHAT: the activity is given no title, place, time or
 * score. Only the expiry instant leaves this function.
 */
import type { Moment } from '@/types/moments';
import { openOneBreathPlan, openPlanPhase } from './openPlan';

/** An abandoned Moment's card is treated as over after this long. */
export const LIVE_ACTIVITY_MAX_MS = 6 * 60 * 60 * 1000;

export type LiveActivityDecision =
  | { readonly kind: 'run'; readonly momentId: string; readonly staleAtMs: number }
  | { readonly kind: 'none' };

export function liveActivityDecision(moments: readonly Moment[], nowMs: number): LiveActivityDecision {
  const open = openOneBreathPlan(moments);
  if (!open || openPlanPhase(open) !== 'quiet') return { kind: 'none' };
  const lockedAt = Date.parse(open.preparation?.lockedInAtIso ?? '');
  if (!Number.isFinite(lockedAt)) return { kind: 'none' };
  const startAt = Date.parse(open.startAtIso);
  const from = Number.isFinite(startAt) ? Math.max(lockedAt, startAt) : lockedAt;
  const staleAtMs = from + LIVE_ACTIVITY_MAX_MS;
  if (nowMs >= staleAtMs) return { kind: 'none' };
  return { kind: 'run', momentId: open.id, staleAtMs };
}

/** Where a tap on the mark lands once the member is signed in. */
export function momentReturnRoute(moments: readonly Moment[], nowMs: number): '/one-breath' | '/moments-tab' {
  return liveActivityDecision(moments, nowMs).kind === 'run' ? '/one-breath' : '/moments-tab';
}
