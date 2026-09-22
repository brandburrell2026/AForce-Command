import type { PictureRef } from 'expo-camera';
import { requireOptionalNativeModule } from 'expo';

export type SkinIAImageFeatureState =
  | 'PASS' | 'DIMENSIONS_UNUSABLE' | 'NO_FACE' | 'MULTIPLE_FACES'
  | 'FACE_TOO_SMALL' | 'NOT_FRONTAL' | 'FACE_NOT_CLEAR'
  | 'TOO_DARK' | 'OVEREXPOSED' | 'BLURRY' | 'UNAVAILABLE';

export type SkinIAImageMetrics = Readonly<{
  cheekBrightness: number;
  cheekRedness: number;
  surfaceShine: number;
  cheekTexture: number;
  brightEdgeDensity: number;
  clippingFraction: number;
}>;

export type SkinIAImageFeatureResult =
  | Readonly<{ state: 'PASS'; metrics: SkinIAImageMetrics }>
  | Readonly<{ state: Exclude<SkinIAImageFeatureState, 'PASS'> }>;

type NativeSkinIAImageFeatures = {
  extractAsync(picture: PictureRef): Promise<unknown>;
};

const module = requireOptionalNativeModule<NativeSkinIAImageFeatures>('SkinIAImageFeatures');

const metricKeys = [
  'cheekBrightness', 'cheekRedness', 'surfaceShine', 'cheekTexture',
  'brightEdgeDensity', 'clippingFraction',
] as const;

const failureStates = new Set<SkinIAImageFeatureState>([
  'DIMENSIONS_UNUSABLE', 'NO_FACE', 'MULTIPLE_FACES', 'FACE_TOO_SMALL',
  'NOT_FRONTAL', 'FACE_NOT_CLEAR', 'TOO_DARK', 'OVEREXPOSED', 'BLURRY', 'UNAVAILABLE',
]);

export function parseSkinIAImageFeatureResult(value: unknown): SkinIAImageFeatureResult {
  if (!value || typeof value !== 'object') return { state: 'UNAVAILABLE' };
  const raw = value as Record<string, unknown>;
  if (raw.state !== 'PASS') {
    return typeof raw.state === 'string' && failureStates.has(raw.state as SkinIAImageFeatureState)
      ? { state: raw.state as Exclude<SkinIAImageFeatureState, 'PASS'> }
      : { state: 'UNAVAILABLE' };
  }
  if (!raw.metrics || typeof raw.metrics !== 'object') return { state: 'UNAVAILABLE' };
  const metrics = raw.metrics as Record<string, unknown>;
  if (!metricKeys.every((key) => typeof metrics[key] === 'number' && Number.isFinite(metrics[key]))) {
    return { state: 'UNAVAILABLE' };
  }
  return {
    state: 'PASS',
    metrics: Object.freeze({
      cheekBrightness: metrics.cheekBrightness as number,
      cheekRedness: metrics.cheekRedness as number,
      surfaceShine: metrics.surfaceShine as number,
      cheekTexture: metrics.cheekTexture as number,
      brightEdgeDensity: metrics.brightEdgeDensity as number,
      clippingFraction: metrics.clippingFraction as number,
    }),
  };
}

/** Consumes an Expo Camera PictureRef without creating a URI or JS pixel array. */
export async function extractSkinIAImageFeatures(picture: PictureRef): Promise<SkinIAImageFeatureResult> {
  if (!module) return { state: 'UNAVAILABLE' }; // Existing TestFlight binaries lack this module.
  try {
    return parseSkinIAImageFeatureResult(await module.extractAsync(picture));
  } catch {
    return { state: 'UNAVAILABLE' };
  }
}
