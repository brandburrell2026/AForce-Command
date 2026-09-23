/**
 * Technical capture eligibility for SkinIA Visual Check.
 *
 * This gate checks only non-biological technical metadata returned by the
 * native in-memory capture reference. It does not inspect pixels, identify a
 * face, extract skin features, or make an observation.
 */

export type SkinIATechnicalQuality =
  | Readonly<{ state: 'PASS'; reason: 'TECHNICAL_METADATA_ACCEPTED' }>
  | Readonly<{ state: 'CAPTURE_QUALITY_INSUFFICIENT'; reason: 'CAPTURE_NOT_READY' | 'DIMENSIONS_UNUSABLE' | 'ASPECT_RATIO_UNUSABLE' }>;

const MIN_EDGE_PIXELS = 320;
// Modern full-screen portrait captures can be taller than 16:9. Reject only
// extreme shapes here; the native face, exposure, and blur gates still run.
const MAX_LONG_TO_SHORT_RATIO = 2.5;

export function assessSkinIATechnicalQuality(input: {
  cameraReady: boolean;
  width: number;
  height: number;
}): SkinIATechnicalQuality {
  if (!input.cameraReady) return Object.freeze({ state: 'CAPTURE_QUALITY_INSUFFICIENT', reason: 'CAPTURE_NOT_READY' });
  if (!Number.isFinite(input.width) || !Number.isFinite(input.height) || input.width < MIN_EDGE_PIXELS || input.height < MIN_EDGE_PIXELS) {
    return Object.freeze({ state: 'CAPTURE_QUALITY_INSUFFICIENT', reason: 'DIMENSIONS_UNUSABLE' });
  }
  const longToShortRatio = Math.max(input.width, input.height) / Math.min(input.width, input.height);
  if (longToShortRatio > MAX_LONG_TO_SHORT_RATIO) {
    return Object.freeze({ state: 'CAPTURE_QUALITY_INSUFFICIENT', reason: 'ASPECT_RATIO_UNUSABLE' });
  }
  return Object.freeze({ state: 'PASS', reason: 'TECHNICAL_METADATA_ACCEPTED' });
}
