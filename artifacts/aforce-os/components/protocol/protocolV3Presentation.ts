/**
 * protocolV3Presentation — pure presentation decisions for the flag-gated
 * Protocol V3 dashboard (`protocol_v3_dashboard_enabled`, founder comps
 * 2026-08-11). Same honest-data contract as components/home/homeV3Presentation:
 * formatters render only what they are given, missing readings render an em
 * dash, and nothing here reads the store or the clock (callers pass `now`).
 */

import { LIVE_WINDOW_MS } from '@/components/home/homeV3Presentation';

/** The "no reading" mark. Exported so callers test against the formatters'
 *  own answer instead of re-deciding what "missing" looks like. */
export const EM_DASH = '—';

/** 57.6 → "58 bpm" (leading-space unit rule, RC-2 #586); null/invalid → "—". */
export function formatBpm(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value) || value <= 0) return EM_DASH;
  return `${Math.round(value)} bpm`;
}

/**
 * Hydration progress from the REAL oz fields. Returns null when no target is
 * set (the bar renders nothing rather than a made-up denominator).
 */
export function hydrationProgress(
  ozConsumed: number,
  ozTarget: number,
): { consumed: number; target: number; fraction: number } | null {
  if (!Number.isFinite(ozTarget) || ozTarget <= 0) return null;
  const consumed = Math.max(0, Math.round(ozConsumed));
  const target = Math.round(ozTarget);
  return { consumed, target, fraction: Math.max(0, Math.min(1, consumed / target)) };
}

/**
 * The "Live" pill for the recovery-signals section — true only within the
 * shared freshness window of the freshest honest biometric timestamp (the
 * same rule the Home V3 chip uses). Future/absent timestamps are never live.
 */
export function signalsAreLive(freshestFetchedAtMs: number | null, now: number): boolean {
  return (
    freshestFetchedAtMs != null &&
    now - freshestFetchedAtMs >= 0 &&
    now - freshestFetchedAtMs <= LIVE_WINDOW_MS
  );
}

/**
 * Has ANY of the given already-formatted signal values a real reading behind
 * it? Wave 5: a section of bordered tiles each showing a bare em dash reads as
 * a failed render rather than an honest "nothing has reported yet", so the
 * screen swaps the tiles for one sentence when this is false. Takes the
 * formatters' output so the definition of "missing" lives in exactly one place.
 */
export function anySignalReported(...values: string[]): boolean {
  return values.some((v) => v !== EM_DASH);
}

/** Protocol-completion ring fraction — clamped, 0 when the plan is empty. */
export function ringFraction(completed: number, total: number): number {
  if (!Number.isFinite(total) || total <= 0) return 0;
  return Math.max(0, Math.min(1, completed / total));
}

/**
 * Should the RITUAL PROGRESSION moment fire? (Wave-5 motion + haptics pass.)
 *
 * The founder's rule is "do not vibrate frequently", so this is deliberately
 * narrow — it is the difference between acknowledging progress and buzzing
 * whenever the screen re-derives its state:
 *
 *  - `prev === null` means this is the first render, which establishes the
 *    baseline. Arriving on Protocol with four steps already done is not
 *    progress that just happened.
 *  - only an INCREASE counts. A step un-completing (a correction, a day
 *    rollover, a re-derivation from fresher store state) is not a win.
 *  - a re-render at the same count is silent, which is the common case: the
 *    derivation runs on every store change.
 *
 * Pure so the rule is proved by unit test rather than by reading an effect.
 */
export function shouldAcknowledgeProgress(prev: number | null, next: number): boolean {
  if (prev == null) return false;
  if (!Number.isFinite(prev) || !Number.isFinite(next)) return false;
  return next > prev;
}
