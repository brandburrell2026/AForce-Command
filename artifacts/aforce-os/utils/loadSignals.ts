/**
 * Acidic Load & Stimulant Load — personalization signals.
 *
 * The hydration engine already knows _how much_ a drink hydrates (via
 * the per-category hydrationCoefficient). What it does NOT know is how
 * much *acid* or *caffeine / stimulants* the user has been loading
 * onto their system over the recent window. Those two axes drive
 * different downstream advice:
 *
 *   - Acidic Load   → "Hydration support recommended."
 *   - Stimulant Load → "Hydration support recommended."
 *
 * ── Tone constraint ───────────────────────────────────────────────
 * Coffee is NEVER framed as bad. The chip says "Stimulant Load
 * Elevated", not "you drank too much coffee". The system tells the
 * user what their body needs (hydration support), not what they did
 * wrong. This file is the single source of truth for that phrasing —
 * any caller that surfaces these loads MUST use the headlines exported
 * here so we don't accidentally regress to judgmental copy.
 *
 * ── Computation ───────────────────────────────────────────────────
 * For a rolling 6h window:
 *   acidicScore   = Σ (event.oz × acidicWeight   for that category)
 *   stimulantScore = Σ (event.oz × stimulantWeight for that category)
 *
 * Thresholds (chosen to map a single typical serving to "low",
 * two-ish servings to "moderate", and three or more to "elevated"):
 *
 *   acidic:    0..8 → low      8..18 → moderate    >18 → elevated
 *   stimulant: 0..8 → low      8..18 → moderate    >18 → elevated
 *
 * Both axes share the same shape so the UI can render them with a
 * single chip component. Pure helper — no side effects, no I/O.
 */

import { DRINK_CATEGORIES, type DrinkCategoryId } from '../data/drinkCatalog';

export type LoadBand = 'low' | 'moderate' | 'elevated';

/** Minimal event shape — accepts anything with the fields we need. */
export interface LoadEvent {
  categoryId?: string;
  oz: number;
  loggedAt: Date | string | number;
}

/** Rolling window for "recent" intake, in hours. */
export const LOAD_WINDOW_HOURS = 6;
const LOAD_WINDOW_MS = LOAD_WINDOW_HOURS * 60 * 60 * 1000;

/** Score thresholds. See file header for rationale. */
const MODERATE_THRESHOLD = 8;
const ELEVATED_THRESHOLD = 18;

function bandFromScore(score: number): LoadBand {
  if (!Number.isFinite(score) || score <= MODERATE_THRESHOLD) return 'low';
  if (score <= ELEVATED_THRESHOLD) return 'moderate';
  return 'elevated';
}

function toMs(v: Date | string | number): number {
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'number') return v;
  const parsed = Date.parse(v);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function withinWindow(event: LoadEvent, now: number): boolean {
  const t = toMs(event.loggedAt);
  if (!Number.isFinite(t) || t <= 0) return false;
  return t >= now - LOAD_WINDOW_MS && t <= now;
}

function categoryOf(id: string | undefined) {
  if (!id) return undefined;
  return (DRINK_CATEGORIES as Record<string, { acidicWeight?: number; stimulantWeight?: number }>)[id];
}

function scoreLoad(
  events: LoadEvent[],
  axis: 'acidicWeight' | 'stimulantWeight',
  now: number,
): number {
  let total = 0;
  for (const e of events) {
    if (!withinWindow(e, now)) continue;
    const cat = categoryOf(e.categoryId);
    const w = cat?.[axis] ?? 0;
    if (!Number.isFinite(w) || w <= 0) continue;
    const oz = typeof e.oz === 'number' && Number.isFinite(e.oz) ? Math.max(0, e.oz) : 0;
    total += oz * w;
  }
  return total;
}

export interface LoadSignals {
  acidic: { band: LoadBand; score: number };
  stimulant: { band: LoadBand; score: number };
}

/**
 * Computes acidic + stimulant load over the rolling 6h window. Pure;
 * never throws on malformed input — bad events contribute zero.
 */
export function computeLoadSignals(
  events: LoadEvent[] | undefined,
  now: number = Date.now(),
): LoadSignals {
  const safe = Array.isArray(events) ? events : [];
  const acidicScore = scoreLoad(safe, 'acidicWeight', now);
  const stimulantScore = scoreLoad(safe, 'stimulantWeight', now);
  return {
    acidic: { band: bandFromScore(acidicScore), score: acidicScore },
    stimulant: { band: bandFromScore(stimulantScore), score: stimulantScore },
  };
}

// ── Display copy ───────────────────────────────────────────────────
// Canonical user-facing strings. Keep these in sync with the product
// brief — coffee is NEVER described negatively; framing is always
// "what your body needs" (hydration support), never "what you did".

const ACIDIC_LABEL: Record<LoadBand, string> = {
  low: 'Acidic Load Low',
  moderate: 'Acidic Load Moderate',
  elevated: 'Acidic Load Elevated',
};

const STIMULANT_LABEL: Record<LoadBand, string> = {
  low: 'Stimulant Load Low',
  moderate: 'Stimulant Load Moderate',
  elevated: 'Stimulant Load Elevated',
};

/** "Acidic Load Elevated" / "Acidic Load Moderate" / "Acidic Load Low". */
export function acidicLoadLabel(band: LoadBand): string {
  return ACIDIC_LABEL[band];
}

/** "Stimulant Load Elevated" / "Stimulant Load Moderate" / "Stimulant Load Low". */
export function stimulantLoadLabel(band: LoadBand): string {
  return STIMULANT_LABEL[band];
}

/**
 * Full two-sentence headline for the AI coach / banner copy. Returns
 * `null` for the 'low' band so the UI doesn't surface noise — only
 * 'moderate' and 'elevated' warrant a recommendation.
 */
export function acidicLoadHeadline(band: LoadBand): string | null {
  if (band === 'low') return null;
  return `${ACIDIC_LABEL[band]}. Hydration support recommended.`;
}

/**
 * Full two-sentence headline for the AI coach / banner copy. Returns
 * `null` for the 'low' band. Coffee is NEVER named here — the framing
 * is always the abstract "stimulant load" so the user feels informed,
 * not judged.
 */
export function stimulantLoadHeadline(band: LoadBand): string | null {
  if (band === 'low') return null;
  return `${STIMULANT_LABEL[band]}. Hydration support recommended.`;
}

/**
 * Convenience: every drink-catalog category id that contributes a
 * nonzero stimulant weight (used by the AI coach when suggesting
 * "after that <category>, here's some water"). Exported so the
 * coach copy stays consistent with the load math.
 */
export function isStimulantCategory(id: DrinkCategoryId): boolean {
  return (DRINK_CATEGORIES[id].stimulantWeight ?? 0) > 0;
}

/** Mirror of `isStimulantCategory` for acidic load. */
export function isAcidicCategory(id: DrinkCategoryId): boolean {
  return (DRINK_CATEGORIES[id].acidicWeight ?? 0) > 0;
}
