/**
 * homeV3Presentation — pure presentation decisions for the flag-gated Home V3
 * dashboard sections (`home_v3_dashboard_enabled`, founder comps 2026-08-10).
 *
 * HONEST-DATA CONTRACT (the reason this module exists):
 *  - Every formatter renders ONLY what it is given from existing store state.
 *    A missing reading renders an em dash ("—"), never an invented number.
 *  - The health chip claims "Live" only when the freshest biometric timestamp
 *    is genuinely recent (≤ LIVE_WINDOW_MS); otherwise it says "Synced", and
 *    with no connected source it tells the component to render nothing.
 *  - No clock times are fabricated anywhere: the Completed-today rows carry
 *    the derived period labels (Morning/Midday/Evening) from
 *    `deriveTodaysProtocol`, which this module does not re-derive.
 *
 * Pure functions only — no store reads, no Date.now() defaults (callers pass
 * `now`), so everything here is trivially unit-testable and can never widen
 * what the Home screen reads (Score-Protection: presentation only).
 */

import { HEALTH_PROVIDERS } from '@/data/healthProviders';
import type { HealthProviderId } from '@/data/healthProviders';

/** Freshness window within which the chip may claim "Live". */
export const LIVE_WINDOW_MS = 30 * 60 * 1000;

const EM_DASH = '—';

/** 7.68 → "7h 41m"; null/invalid → "—". */
export function formatSleepHours(hours: number | null | undefined): string {
  if (hours == null || !Number.isFinite(hours) || hours < 0) return EM_DASH;
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h ${m.toString().padStart(2, '0')}m`;
}

/** 64.7 → "65 ms" (leading-space unit rule, RC-2 #586); null → "—". */
export function formatHrvMs(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value) || value <= 0) return EM_DASH;
  return `${Math.round(value)} ms`;
}

/** Clamped whole-percent hydration ("97%"); target 0 → "—" (no target set). */
export function formatHydrationPct(unitsConsumed: number, dailyTarget: number): string {
  if (!Number.isFinite(dailyTarget) || dailyTarget <= 0) return EM_DASH;
  const pct = Math.round((Math.max(0, unitsConsumed) / dailyTarget) * 100);
  return `${Math.max(0, Math.min(999, pct))}%`;
}

export interface HealthChipView {
  /** e.g. "Apple Health" / "WHOOP" / "2 sources". */
  label: string;
  /** True only within LIVE_WINDOW_MS of the freshest honest timestamp. */
  live: boolean;
}

const PROVIDER_NAME: Record<string, string> = Object.fromEntries(
  HEALTH_PROVIDERS.map((p) => [p.id, p.name]),
);

/**
 * Health-connection chip. Returns null (render nothing) when no provider has
 * contributed data — the chip never implies a connection that doesn't exist.
 * Single source → that provider's real name; multiple → "N sources"
 * (apple_health wins the name when present, matching the comp).
 */
export function resolveHealthChip(input: {
  sources: HealthProviderId[];
  freshestFetchedAtMs: number | null;
  now: number;
}): HealthChipView | null {
  const { sources, freshestFetchedAtMs, now } = input;
  if (!sources.length) return null;
  const label = sources.includes('apple_health')
    ? PROVIDER_NAME['apple_health']!
    : sources.length === 1
      ? (PROVIDER_NAME[sources[0]!] ?? 'Health data')
      : `${sources.length} sources`;
  const live =
    freshestFetchedAtMs != null &&
    now - freshestFetchedAtMs >= 0 &&
    now - freshestFetchedAtMs <= LIVE_WINDOW_MS;
  return { label, live };
}

export type TrendDirection = 'rising' | 'falling' | 'flat';

/**
 * Session score-trend tile — returns the home.v3 i18n KEY suffix (the
 * component translates; this module stays i18n-free) plus whether the tile
 * renders in the positive accent.
 */
export function trendTile(direction: TrendDirection): { i18nKey: 'trend_rising' | 'trend_falling' | 'trend_steady'; positive: boolean } {
  if (direction === 'rising') return { i18nKey: 'trend_rising', positive: true };
  if (direction === 'falling') return { i18nKey: 'trend_falling', positive: false };
  return { i18nKey: 'trend_steady', positive: false };
}
