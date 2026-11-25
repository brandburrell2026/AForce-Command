import type { PictureRef } from 'expo-camera';
import { requireOptionalNativeModule } from 'expo';

/** One recognised line. The box is normalised 0..1 with a top-left origin. */
export type HydroScanTextLine = Readonly<{
  text: string;
  confidence?: number;
  box?: Readonly<{ x: number; y: number; width: number; height: number }>;
}>;

type NativeHydroScanLabelText = {
  recognizeAsync(picture: PictureRef): Promise<unknown>;
};

// Absent on web, in tests and in binaries built before this module existed.
const nativeModule = requireOptionalNativeModule<NativeHydroScanLabelText>('HydroScanLabelText');

const MAX_LINES = 120;
const MAX_TEXT = 200;

const unit = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;

/** Keeps only plain text, a 0..1 confidence and a 0..1 box. Anything else fails closed to null. */
export function parseHydroScanTextResult(value: unknown): HydroScanTextLine[] | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  if (raw.state !== 'OK' || !Array.isArray(raw.lines)) return null;
  const out: HydroScanTextLine[] = [];
  for (const item of raw.lines.slice(0, MAX_LINES)) {
    if (!item || typeof item !== 'object') continue;
    const l = item as Record<string, unknown>;
    if (typeof l.text !== 'string') continue;
    const text = l.text.slice(0, MAX_TEXT);
    const b = l.box as Record<string, unknown> | undefined;
    const box = b && unit(b.x) && unit(b.y) && unit(b.width) && unit(b.height)
      ? { x: b.x as number, y: b.y as number, width: b.width as number, height: b.height as number }
      : undefined;
    out.push({
      text,
      ...(unit(l.confidence) ? { confidence: l.confidence } : {}),
      ...(box ? { box } : {}),
    });
  }
  return out;
}

/** What one look at the drink gives back, beyond the text. Every field is optional. */
export type HydroScanFrame = Readonly<{
  lines: HydroScanTextLine[];
  /** The most prominent object, 0..1 with a top-left origin, when the platform finds one. */
  object: Readonly<{ x: number; y: number; width: number; height: number }> | null;
  /** Width over height of the picture the boxes refer to. */
  aspect: number | null;
  /** Mean brightness, 0..1. */
  brightness: number | null;
}>;

/** Text plus the optional box, shape and brightness. Fails closed to null like the text parser. */
export function parseHydroScanFrameResult(value: unknown): HydroScanFrame | null {
  const lines = parseHydroScanTextResult(value);
  if (!lines) return null;
  const raw = value as Record<string, unknown>;
  const o = raw.object as Record<string, unknown> | undefined;
  const object =
    o && unit(o.x) && unit(o.y) && unit(o.width) && unit(o.height) && (o.width as number) > 0 && (o.height as number) > 0
      ? { x: o.x as number, y: o.y as number, width: o.width as number, height: o.height as number }
      : null;
  const aspect = typeof raw.aspect === 'number' && Number.isFinite(raw.aspect) && raw.aspect > 0.2 && raw.aspect < 5 ? raw.aspect : null;
  const brightness = unit(raw.brightness) ? raw.brightness : null;
  return { lines, object, aspect, brightness };
}

export const hydroScanLabelTextAvailable = (): boolean => nativeModule != null;

/**
 * Recognises text in an in-memory Expo Camera PictureRef, on the device. Writes no
 * file, makes no network call and logs nothing. Returns null when the native module
 * is absent or fails, so the reader degrades to barcode-only. The caller still owns
 * the PictureRef and must release it.
 */
export async function recognizeLabelText(picture: PictureRef): Promise<HydroScanTextLine[] | null> {
  if (!nativeModule) return null;
  try {
    return parseHydroScanTextResult(await nativeModule.recognizeAsync(picture));
  } catch {
    return null;
  }
}

/**
 * The same on-device read as `recognizeLabelText`, with the box around the
 * drink, the picture's shape and its brightness when the platform reports
 * them. Same rules: no file, no network, nothing logged; null on any failure.
 */
export async function recognizeLabelFrame(picture: PictureRef): Promise<HydroScanFrame | null> {
  if (!nativeModule) return null;
  try {
    return parseHydroScanFrameResult(await nativeModule.recognizeAsync(picture));
  } catch {
    return null;
  }
}
