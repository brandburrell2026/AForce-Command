import type { SkinIAImageMetrics } from '../modules/skinia-image-features';
import type { SkinIAPhase1Observation } from './skiniaPhase1Policy';

/**
 * Unvalidated engineering signals, never member-facing observations. These
 * thresholds are sensitivity probes for internal QA, not confidence cutoffs.
 * Face-region pixel features are derived on-device and raw pixels never enter JS.
 */
export type SkinIAExperimentalCandidate = Readonly<{
  observation: SkinIAPhase1Observation;
  confidence: 'LOW';
  source: 'EXPERIMENTAL_RELATIVE_PIXEL_FEATURES';
}>;

const relativeIncrease = (current: number, baseline: number, minAbsolute: number, minRelative: number) =>
  current - baseline >= Math.max(minAbsolute, Math.abs(baseline) * minRelative);

/**
 * Produces candidate labels from two comparable, accepted captures. It cannot
 * establish clinical/wellness truth and cannot pass the member result gate.
 */
export function deriveSkinIAExperimentalCandidates(
  current: SkinIAImageMetrics,
  baseline: SkinIAImageMetrics | null,
): readonly SkinIAExperimentalCandidate[] {
  if (!baseline) return Object.freeze([]);
  const labels: SkinIAPhase1Observation[] = [];
  if (relativeIncrease(current.cheekRedness, baseline.cheekRedness, 0.025, 0.18)) labels.push('VISIBLE_REDNESS');
  if (relativeIncrease(current.surfaceShine, baseline.surfaceShine, 0.015, 0.35)) labels.push('VISIBLE_SURFACE_SHINE');
  if (relativeIncrease(current.cheekTexture, baseline.cheekTexture, 2.0, 0.25)) labels.push('VISIBLE_TEXTURE');
  if (relativeIncrease(current.brightEdgeDensity, baseline.brightEdgeDensity, 0.025, 0.50)) labels.push('VISIBLE_FLAKING');
  if (baseline.surfaceShine - current.surfaceShine >= 0.015 &&
      relativeIncrease(current.cheekTexture, baseline.cheekTexture, 2.0, 0.25)) labels.push('VISIBLE_DRYNESS');
  return Object.freeze(labels.map((observation) => Object.freeze({
    observation, confidence: 'LOW' as const, source: 'EXPERIMENTAL_RELATIVE_PIXEL_FEATURES' as const,
  })));
}
