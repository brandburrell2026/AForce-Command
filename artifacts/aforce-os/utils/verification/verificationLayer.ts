/**
 * Verification Layer — signal-source positioning for AForce OS.
 *
 * The loop (Signal → Command → Action → Impact) is only as trustworthy as
 * the signal feeding it. This layer sits ABOVE the freshest-wins biometric
 * merge (utils/biometricsAggregator.ts) and answers one question: how much
 * confidence can we place in the signal driving a command right now?
 *
 * It does NOT change how per-metric values are merged — it grades the
 * SOURCE QUALITY behind them and exposes a graceful fallback chain:
 *
 *   Phantom devices  → Connected wearables → Phone + manual / self-report
 *   (highest conf.)                          (always-available floor)
 *
 * Design rules (locked):
 *   - Resolve to the highest-confidence source available.
 *   - Degrade gracefully downward — the loop must function at every tier.
 *   - Phone/manual self-report is the GUARANTEED floor: users with no
 *     Phantom and no wearables still get full functionality, just lower
 *     confidence. Phantom INCREASES confidence; it never creates a
 *     dependency.
 *
 * Pure module — no React Native, no clock, no I/O. Trivial to unit-test.
 */

import type { HealthProviderId } from '../../data/healthProviders';

/** Source tiers, ordered best → worst. */
export type SignalTier = 'phantom' | 'wearable' | 'phone';

/** Fixed priority order. Phone is the always-present floor. */
export const TIER_PRIORITY: SignalTier[] = ['phantom', 'wearable', 'phone'];

/** Base confidence weight per tier (0..1). */
export const TIER_CONFIDENCE: Record<SignalTier, number> = {
  phantom: 1,
  wearable: 0.7,
  phone: 0.4,
};

/** Extra confidence per corroborating wearable beyond the first. */
const WEARABLE_CORROBORATION_STEP = 0.05;
/** Cap on corroboration so wearable confidence can never reach phantom. */
const WEARABLE_CORROBORATION_MAX = 0.2;

export interface VerificationSources {
  /** A Phantom device is connected and reporting. */
  phantomConnected: boolean;
  /** Connected wearables currently contributing at least one signal. */
  wearableSources: HealthProviderId[];
}

export interface VerificationResolution {
  /** Highest-confidence tier currently available. */
  tier: SignalTier;
  /** 0..1 confidence weight for the resolved tier. */
  confidence: number;
  /** Fallback chain actually available, best → worst. */
  available: SignalTier[];
  /** Internal human-readable summary (debug / logging; not a UI string). */
  hint: string;
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Confidence for a tier, given how many wearables corroborate it. The
 * count only matters for the wearable tier; more independent wearables
 * reporting the same picture raises confidence, capped strictly below the
 * phantom tier.
 */
export function confidenceForTier(tier: SignalTier, wearableCount = 0): number {
  const base = TIER_CONFIDENCE[tier];
  if (tier !== 'wearable') return base;
  const extra = Math.min(
    Math.max(wearableCount - 1, 0) * WEARABLE_CORROBORATION_STEP,
    WEARABLE_CORROBORATION_MAX,
  );
  return round2(clamp01(base + extra));
}

/**
 * Resolve the current signal sources into the highest-confidence tier
 * plus the graceful fallback chain beneath it. Phone/manual self-report
 * is always included as the floor so the loop never goes dark.
 */
export function resolveVerification(
  sources: VerificationSources,
): VerificationResolution {
  // Dedupe so a provider listed twice can't inflate corroboration.
  const wearableCount = new Set(sources.wearableSources).size;
  const available: SignalTier[] = [];
  if (sources.phantomConnected) available.push('phantom');
  if (wearableCount > 0) available.push('wearable');
  // Self-report / manual is the guaranteed floor — always available.
  available.push('phone');

  const tier = available[0];
  const confidence = confidenceForTier(tier, wearableCount);

  let hint: string;
  switch (tier) {
    case 'phantom':
      hint = 'Phantom-verified signal';
      break;
    case 'wearable':
      hint =
        wearableCount === 1
          ? '1 wearable verifying'
          : `${wearableCount} wearables corroborating`;
      break;
    default:
      hint = 'Phone + self-report (full functionality)';
      break;
  }

  return { tier, confidence, available, hint };
}
