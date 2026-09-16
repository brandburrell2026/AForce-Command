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
const MIN_ASPECT_RATIO = 0.55;
const MAX_ASPECT_RATIO = 1.8;

export function assessSkinIATechnicalQuality(input: {
  cameraReady: boolean;
  width: number;
  height: number;
}): SkinIATechnicalQuality {
  if (!input.cameraReady) return Object.freeze({ state: 'CAPTURE_QUALITY_INSUFFICIENT', reason: 'CAPTURE_NOT_READY' });
  if (!Number.isFinite(input.width) || !Number.isFinite(input.height) || input.width < MIN_EDGE_PIXELS || input.height < MIN_EDGE_PIXELS) {
    return Object.freeze({ state: 'CAPTURE_QUALITY_INSUFFICIENT', reason: 'DIMENSIONS_UNUSABLE' });
  }
  const aspectRatio = input.width / input.height;
  if (aspectRatio < MIN_ASPECT_RATIO || aspectRatio > MAX_ASPECT_RATIO) {
    return Object.freeze({ state: 'CAPTURE_QUALITY_INSUFFICIENT', reason: 'ASPECT_RATIO_UNUSABLE' });
  }
  return Object.freeze({ state: 'PASS', reason: 'TECHNICAL_METADATA_ACCEPTED' });
}
