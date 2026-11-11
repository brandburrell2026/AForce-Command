import type { SkinIAImageFeatureResult, SkinIAImageMetrics } from '../modules/skinia-image-features';

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
