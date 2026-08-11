/**
 * protocolV3Presentation — pure presentation decisions for the flag-gated
 * Protocol V3 dashboard (`protocol_v3_dashboard_enabled`, founder comps
 * 2026-08-11). Same honest-data contract as components/home/homeV3Presentation:
 * formatters render only what they are given, missing readings render an em
 * dash, and nothing here reads the store or the clock (callers pass `now`).
 */

import { LIVE_WINDOW_MS } from '@/components/home/homeV3Presentation';

const EM_DASH = '—';

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

/** Protocol-completion ring fraction — clamped, 0 when the plan is empty. */
export function ringFraction(completed: number, total: number): number {
  if (!Number.isFinite(total) || total <= 0) return 0;
  return Math.max(0, Math.min(1, completed / total));
}
