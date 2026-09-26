import type { SkinIAImageFeatureResult, SkinIAImageMetrics } from '../modules/skinia-image-features';
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

const METRIC_KEYS = Object.freeze([
  'cheekBrightness', 'cheekRedness', 'surfaceShine', 'cheekTexture',
  'brightEdgeDensity', 'clippingFraction',
] as const satisfies readonly (keyof SkinIAImageMetrics)[]);

const hasFiniteMetrics = (metrics: SkinIAImageMetrics) =>
  METRIC_KEYS.every((key) => Number.isFinite(metrics[key]));

/**
 * Versioned, baseline-free measurements for method development only. These
 * numbers are native pixel probes, not scores for the named appearance labels,
 * calibrated probabilities, confidence bands, or member findings. In
 * particular, bright edges are not evidence of flakes and bright pixels are
 * not evidence of skin-surface shine without controlled validation.
 */
export const SKINIA_QA_PROBE_REVISION = 'NATIVE_ABSOLUTE_PIXEL_PROBES_V0_1' as const;

export type SkinIABaselineFreeQaProbes = Readonly<{
  revision: typeof SKINIA_QA_PROBE_REVISION;
  status: 'UNVALIDATED_QA_PROBES';
  redColorIndex: number;
  brightPixelFraction: number;
  brightEdgeFraction: number;
}>;

export function deriveSkinIABaselineFreeQaProbes(
  result: SkinIAImageFeatureResult,
): SkinIABaselineFreeQaProbes | null {
  if (result.state !== 'PASS') return null;
  const { metrics } = result;
  if (!hasFiniteMetrics(metrics) ||
      metrics.cheekBrightness < 0 || metrics.cheekBrightness > 255 ||
      metrics.cheekRedness < -0.5 || metrics.cheekRedness > 1 ||
      metrics.cheekTexture < 0 || metrics.cheekTexture > 255 ||
      metrics.surfaceShine < 0 || metrics.surfaceShine > 1 ||
      metrics.brightEdgeDensity < 0 || metrics.brightEdgeDensity > 1 ||
      metrics.clippingFraction < 0 || metrics.clippingFraction > 1) return null;
  return Object.freeze({
    revision: SKINIA_QA_PROBE_REVISION,
    status: 'UNVALIDATED_QA_PROBES',
    redColorIndex: metrics.cheekRedness,
    brightPixelFraction: metrics.surfaceShine,
    brightEdgeFraction: metrics.brightEdgeDensity,
  });
}

/**
 * Produces candidate labels from two comparable, accepted captures. It cannot
 * establish clinical/wellness truth and cannot pass the member result gate.
 */
export function deriveSkinIAExperimentalCandidates(
  current: SkinIAImageMetrics,
  baseline: SkinIAImageMetrics | null,
): readonly SkinIAExperimentalCandidate[] {
  if (!baseline || !hasFiniteMetrics(current) || !hasFiniteMetrics(baseline)) return Object.freeze([]);
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
