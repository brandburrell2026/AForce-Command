/**
 * HydroScan lock-on (pure).
 *
 * What the camera screen says while it reads: Searching, Reading, Locked; the
 * four readout fields; the lock pill; and where the brackets sit. Every value
 * comes from what the reader actually resolved. A field the reader did not
 * resolve is null and the screen shows a dash: nothing here guesses.
 *
 * Founder direction 2026-11-23 (the "Scan. Confirm. Done." film). No liquid
 * level is estimated in this pass, so `level` is always null.
 */
import { formatOz, type Confidence, type Reading } from './labelEvidence';

export type LockStage = 'searching' | 'reading' | 'locked';

/** Searching until anything is read; Locked only when the reader has a result to show. */
export function lockStage(reading: Reading): LockStage {
  if (reading.status === 'ready') return 'locked';
  if (reading.samples > 0 || reading.barcodeCode != null) return 'reading';
  return 'searching';
}

export const STAGE_LABEL: Record<LockStage, string> = {
  searching: 'SEARCHING',
  reading: 'READING',
  locked: 'LOCKED',
};

/** 0 to 3 bars. Unknown is none; a likely read is two; a confirmed read is three. */
export function confidenceBars(c: Confidence): 0 | 2 | 3 {
  return c === 'confirmed' ? 3 : c === 'likely' ? 2 : 0;
}

export interface Readout {
  /** The brand, or the kind of drink, the reader resolved. */
  readonly drink: string | null;
  /** The package size as printed or matched. */
  readonly size: string | null;
  /** Not estimated in this pass. */
  readonly level: null;
  /** How it was matched, e.g. "BARCODE" or "LABEL". */
  readonly match: string | null;
  readonly bars: 0 | 2 | 3;
}

const DRINK_TYPE_WORD: Partial<Record<string, string>> = { water: 'WATER' };

export function readout(reading: Reading): Readout {
  const brand = reading.brand.value;
  const type = reading.drinkType.value;
  const drink = brand ? brand.toUpperCase() : type ? (DRINK_TYPE_WORD[type] ?? String(type).replace(/_/g, ' ').toUpperCase()) : null;
  const size = reading.volume.value != null ? formatOz(reading.volume.value).toUpperCase() : null;
  const named = brand ? reading.brand : reading.drinkType;
  const source = named.value != null ? named.source : null;
  const match = source === 'barcode' ? 'BARCODE' : source === 'label' ? 'LABEL' : source === 'user' ? 'YOU' : null;
  return { drink, size, level: null, match, bars: named.value != null ? confidenceBars(named.confidence) : 0 };
}

/** "Matched by barcode" / "Matched by label" for the card; null when the member chose it. */
export function matchedBy(reading: Reading): string | null {
  const named = reading.brand.value ? reading.brand : reading.drinkType;
  if (named.value == null) return null;
  if (named.source === 'barcode') return 'Matched by barcode';
  if (named.source === 'label') return 'Matched by label';
  if (named.source === 'user') return 'Chosen by you';
  return null;
}

/** "Locked · AFORCE · Watermelon" / "Locked · Water". */
export function lockPill(name: string): string {
  const parts = name.split(/\s*·\s*/).filter(Boolean);
  return ['Locked', ...parts].join(' · ');
}

// ─── Where the brackets sit ─────────────────────────────────────────

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

const inUnit = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1;
const validBox = (b: Box | null | undefined): b is Box =>
  !!b && inUnit(b.x) && inUnit(b.y) && inUnit(b.width) && inUnit(b.height) && b.width > 0 && b.height > 0;

/** The smallest box around every recognised line, padded a little. Null with fewer than two lines. */
export function unionOfLines(lines: readonly { readonly box?: Box }[] | null | undefined, pad = 0.06): Box | null {
  const boxes = (lines ?? []).map((l) => l.box).filter(validBox);
  if (boxes.length < 2) return null;
  let x0 = 1;
  let y0 = 1;
  let x1 = 0;
  let y1 = 0;
  for (const b of boxes) {
    x0 = Math.min(x0, b.x);
    y0 = Math.min(y0, b.y);
    x1 = Math.max(x1, b.x + b.width);
    y1 = Math.max(y1, b.y + b.height);
  }
  x0 = Math.max(0, x0 - pad);
  y0 = Math.max(0, y0 - pad);
  x1 = Math.min(1, x1 + pad);
  y1 = Math.min(1, y1 + pad);
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

/**
 * Bounds are used only when they are plausibly one drink held up to the
 * camera: not a sliver, not the whole frame, and over the middle of the
 * picture. Anything else returns null and the brackets stay where they are.
 */
export function reliableBounds(object: Box | null | undefined, lines?: readonly { readonly box?: Box }[] | null): Box | null {
  const candidate = validBox(object) ? object : unionOfLines(lines);
  if (!candidate) return null;
  const area = candidate.width * candidate.height;
  if (area < 0.03 || area > 0.8) return null;
  if (candidate.width < 0.08 || candidate.height < 0.12) return null;
  const cx = candidate.x + candidate.width / 2;
  const cy = candidate.y + candidate.height / 2;
  if (cx < 0.2 || cx > 0.8 || cy < 0.15 || cy > 0.85) return null;
  return candidate;
}

/**
 * A box in the picture (0..1, top-left origin) to points on a view that shows
 * the picture scaled to cover it, the way the camera preview does. The result
 * is clamped to the view.
 */
export function boxOnView(box: Box, imageAspect: number, view: { readonly width: number; readonly height: number }): Box | null {
  if (!validBox(box) || !(imageAspect > 0) || !(view.width > 0) || !(view.height > 0)) return null;
  const viewAspect = view.width / view.height;
  const shownW = viewAspect > imageAspect ? view.width : view.height * imageAspect;
  const shownH = viewAspect > imageAspect ? view.width / imageAspect : view.height;
  const offX = (view.width - shownW) / 2;
  const offY = (view.height - shownH) / 2;
  const x0 = Math.max(0, offX + box.x * shownW);
  const y0 = Math.max(0, offY + box.y * shownH);
  const x1 = Math.min(view.width, offX + (box.x + box.width) * shownW);
  const y1 = Math.min(view.height, offY + (box.y + box.height) * shownH);
  if (x1 - x0 < 24 || y1 - y0 < 24) return null;
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

/** Two reads of the same drink a second apart: close enough to call the camera steady. */
export function isSteady(prev: Box | null, next: Box | null, tolerance = 0.06): boolean | null {
  if (!prev || !next) return null;
  const d =
    Math.abs(prev.x - next.x) + Math.abs(prev.y - next.y) + Math.abs(prev.width - next.width) + Math.abs(prev.height - next.height);
  return d <= tolerance * 4;
}

/** The darkest picture the reader still calls light enough (0..1 mean brightness). */
export const MIN_BRIGHTNESS = 0.16;
export function hasLight(brightness: number | null | undefined): boolean | null {
  return typeof brightness === 'number' && Number.isFinite(brightness) ? brightness >= MIN_BRIGHTNESS : null;
}
