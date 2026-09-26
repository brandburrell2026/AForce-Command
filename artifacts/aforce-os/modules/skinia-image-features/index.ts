import type { PictureRef } from 'expo-camera';
import { requireOptionalNativeModule } from 'expo';

export type SkinIAImageFeatureState =
  | 'PASS' | 'DIMENSIONS_UNUSABLE' | 'NO_FACE' | 'MULTIPLE_FACES'
  | 'FACE_TOO_SMALL' | 'NOT_FRONTAL' | 'FACE_NOT_CLEAR' | 'REGIONS_UNUSABLE'
  | 'TOO_DARK' | 'OVEREXPOSED' | 'BLURRY' | 'UNAVAILABLE';

export type SkinIAImageMetrics = Readonly<{
  cheekBrightness: number;
  cheekRedness: number;
  surfaceShine: number;
  cheekTexture: number;
  brightEdgeDensity: number;
  clippingFraction: number;
}>;

export const SKINIA_QA_SAMPLE_ZONES_REVISION = 'FACE_BOX_SAMPLE_ZONES_V0_1' as const;

export type SkinIAQaZoneMetrics = Readonly<{
  sampleCount: number;
  brightness: number;
  redColorIndex: number;
  brightPixelFraction: number;
  edgeMagnitude: number;
  brightEdgeFraction: number;
  clippingFraction: number;
}>;

/** Coarse face-box sampling zones; not a skin label, score, or finding. */
export type SkinIAQaSampleZones = Readonly<{
  revision: typeof SKINIA_QA_SAMPLE_ZONES_REVISION;
  forehead: SkinIAQaZoneMetrics;
  leftCheek: SkinIAQaZoneMetrics;
  rightCheek: SkinIAQaZoneMetrics;
  nose: SkinIAQaZoneMetrics;
  chin: SkinIAQaZoneMetrics;
}>;

export type SkinIAImageFeatureResult =
  | Readonly<{ state: 'PASS'; metrics: SkinIAImageMetrics; qaSampleZones?: SkinIAQaSampleZones }>
  | Readonly<{ state: Exclude<SkinIAImageFeatureState, 'PASS'> }>;

type NativeSkinIAImageFeatures = {
  extractAsync(picture: PictureRef): Promise<unknown>;
};

const module = requireOptionalNativeModule<NativeSkinIAImageFeatures>('SkinIAImageFeatures');

const metricKeys = [
  'cheekBrightness', 'cheekRedness', 'surfaceShine', 'cheekTexture',
  'brightEdgeDensity', 'clippingFraction',
] as const;

const zoneKeys = ['forehead', 'leftCheek', 'rightCheek', 'nose', 'chin'] as const;

function isNumberInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

function parseQaZone(value: unknown): SkinIAQaZoneMetrics | null {
  if (!value || typeof value !== 'object') return null;
  const zone = value as Record<string, unknown>;
  if (!Number.isSafeInteger(zone.sampleCount) || (zone.sampleCount as number) < 32 ||
      (zone.sampleCount as number) > 640 * 640 ||
      !isNumberInRange(zone.brightness, 0, 255) ||
      !isNumberInRange(zone.redColorIndex, -0.5, 1) ||
      !isNumberInRange(zone.brightPixelFraction, 0, 1) ||
      !isNumberInRange(zone.edgeMagnitude, 0, 255) ||
      !isNumberInRange(zone.brightEdgeFraction, 0, 1) ||
      !isNumberInRange(zone.clippingFraction, 0, 1)) return null;
  return Object.freeze({
    sampleCount: zone.sampleCount as number,
    brightness: zone.brightness,
    redColorIndex: zone.redColorIndex,
    brightPixelFraction: zone.brightPixelFraction,
    edgeMagnitude: zone.edgeMagnitude,
    brightEdgeFraction: zone.brightEdgeFraction,
    clippingFraction: zone.clippingFraction,
  });
}

function parseQaSampleZones(value: unknown): SkinIAQaSampleZones | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  if (raw.revision !== SKINIA_QA_SAMPLE_ZONES_REVISION) return null;
  const parsed = zoneKeys.map((key) => parseQaZone(raw[key]));
  if (parsed.some((zone) => zone === null)) return null;
  return Object.freeze({
    revision: SKINIA_QA_SAMPLE_ZONES_REVISION,
    forehead: parsed[0]!, leftCheek: parsed[1]!, rightCheek: parsed[2]!,
    nose: parsed[3]!, chin: parsed[4]!,
  });
}

const failureStates = new Set<SkinIAImageFeatureState>([
  'DIMENSIONS_UNUSABLE', 'NO_FACE', 'MULTIPLE_FACES', 'FACE_TOO_SMALL',
  'NOT_FRONTAL', 'FACE_NOT_CLEAR', 'REGIONS_UNUSABLE',
  'TOO_DARK', 'OVEREXPOSED', 'BLURRY', 'UNAVAILABLE',
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
  const hasQaSampleZones = Object.prototype.hasOwnProperty.call(raw, 'qaSampleZones');
  const qaSampleZones = hasQaSampleZones ? parseQaSampleZones(raw.qaSampleZones) : undefined;
  if (hasQaSampleZones && !qaSampleZones) return { state: 'UNAVAILABLE' };
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
    ...(qaSampleZones ? { qaSampleZones } : {}),
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
