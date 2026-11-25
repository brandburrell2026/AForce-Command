/**
 * HydroScan label evidence engine (pure: no React, no native, no I/O).
 *
 * Founder-approved 2026-11-21: the flagged HydroScan reader reads the visible
 * label text of a drink on the device, next to the barcode. This module turns
 * the recognised text lines of successive samples of ONE package into a drink
 * reading: brand, product, variant, drink type and package volume, each with a
 * value, a confidence and a source.
 *
 * Rules this file keeps (each one is pinned by labelEvidence.test.ts):
 *  - A guess is never `confirmed`. Label-only values are `likely` until a
 *    second sample agrees; the member's own answer is `confirmed`.
 *  - Look-alikes are explicit signals, never guessed: regular vs zero sugar,
 *    caffeinated vs caffeine free, alcoholic vs non-alcoholic. Any alcohol
 *    ambiguity becomes a question.
 *  - Net contents ("20 FL OZ (591 mL)") is kept apart from nutrition serving
 *    size ("Serving size 12 fl oz") and servings per container. A multipack is
 *    detected, the unit size is the container, and the member is asked.
 *  - Names are matched against the app's own catalogs only (COMPARE_PRODUCTS
 *    and data/drinkCatalog.ts). Category-only is a valid result.
 *  - One short question at a time; a reliable barcode match stands on its own
 *    when the label is unreadable.
 *  - Nothing here keeps raw label text. A sample is reduced to what it
 *    supports (catalog names seen, signals, volumes) and the lines are dropped.
 */
import { CATALOG_DRINKS, DRINK_CATEGORIES, type DrinkCategoryId } from '../../data/drinkCatalog';
import { COMPARE_PRODUCTS } from '../../data/productDatabase';
import { aforcePackagingStatus } from '../../data/aforcePackaging';

// ─── Public types ───────────────────────────────────────────────────

export type Confidence = 'confirmed' | 'likely' | 'unknown';
export type EvidenceSource = 'barcode' | 'label' | 'user';

export interface Field<T> {
  readonly value: T | null;
  readonly confidence: Confidence;
  readonly source: EvidenceSource | null;
}

/** One recognised line of text. The box is normalised 0..1, as the platforms give it. */
export interface LabelLine {
  readonly text: string;
  /** 0..1 when the platform reports it. */
  readonly confidence?: number;
  readonly box?: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
}

export interface BarcodeProduct {
  readonly id: string;
  readonly name: string;
  readonly brand?: string | null;
  /** The app's drink category, when the lookup could map one. */
  readonly category?: DrinkCategoryId | null;
  /** True for the app's own catalog; false for a crowd-sourced public record. */
  readonly reliable: boolean;
}

/** A barcode that was read, and the product it matched (null: read, but no match). */
export interface BarcodeCandidate {
  readonly code: string;
  readonly product: BarcodeProduct | null;
}

export interface SampleInput {
  /** The lines of one label frame. Omit for a barcode-only update. */
  readonly lines?: readonly LabelLine[];
  readonly barcode?: BarcodeCandidate;
}

export const HINTS = [
  'Try the front label',
  'Tilt to reduce glare',
  'Show the size on the label',
  'Turn to the barcode',
] as const;
export type Hint = (typeof HINTS)[number];

export type QuestionId = 'alcohol' | 'barcode-conflict' | 'product' | 'multipack' | 'volume' | 'category';

export interface QuestionChoice {
  readonly id: string;
  readonly label: string;
  /** What choosing it records. Internal to the engine; the UI shows `label`. */
  readonly patch: Overrides;
}

export interface Question {
  readonly id: QuestionId;
  readonly text: string;
  readonly choices: readonly QuestionChoice[];
}

/** The member's own answers. They outrank every other source. */
export interface Overrides {
  /** A catalog entry id, or 'none' for "something else". */
  readonly entryId?: string;
  readonly drinkType?: DrinkCategoryId;
  readonly volumeOz?: number | null;
  readonly alcohol?: 'alcoholic' | 'non_alcoholic';
  readonly conflictChoice?: 'barcode' | 'label';
}

export interface Reading {
  readonly brand: Field<string>;
  readonly product: Field<string>;
  readonly variant: Field<string>;
  readonly drinkType: Field<DrinkCategoryId>;
  /** Package volume in fluid ounces (the container, never a serving). */
  readonly volume: Field<number>;
  readonly traits: {
    readonly sugar: Field<'regular' | 'zero'>;
    readonly caffeine: Field<'caffeinated' | 'free'>;
    readonly alcohol: Field<'alcoholic' | 'non_alcoholic'>;
  };
  readonly multipack: { readonly detected: boolean; readonly count: number | null; readonly unitOz: number | null };
  /** Bottled water the label calls sparkling, seltzer or mineral: saved as sparkling water, not plain water. */
  readonly sparkling: boolean;
  /** A flavour is named on the label. A flavoured water is not plain water. */
  readonly flavored: boolean;
  /** From the nutrition panel. Informational: never used as the package volume. */
  readonly serving: { readonly oz: number | null; readonly perContainer: number | null };
  /** The catalog id of the matched product, for a hand-off to the product's own flow. */
  readonly catalogProductId: string | null;
  /** True when the name came from the app's compare catalog (AFORCE and named rivals). */
  readonly catalogSource: 'drink' | 'compare' | null;
  /**
   * AFORCE matches only: false until the founders supply the unit UPC, net
   * contents and front-label text for that product. Null for anything else.
   */
  readonly packagingVerified: boolean | null;
  readonly barcodeCode: string | null;
  readonly question: Question | null;
  readonly hint: Hint | null;
  readonly status: 'reading' | 'question' | 'ready';
  readonly samples: number;
}

interface Observation {
  readonly brands: readonly string[];
  readonly vocab: readonly string[];
  readonly genericIds: readonly string[];
  readonly categories: readonly DrinkCategoryId[];
  readonly sugarZero: string | null;
  readonly sugarRegular: boolean;
  readonly caffeineFree: boolean;
  readonly caffeinated: boolean;
  readonly alcStrong: boolean;
  readonly alcWeak: boolean;
  readonly nonAlc: boolean;
  readonly alcLow: boolean;
  readonly sparkling: boolean;
  readonly flavors: readonly string[];
  readonly net: readonly { readonly oz: number; readonly weight: number; readonly dual: boolean }[];
  readonly multipack: { readonly count: number | null; readonly unitOz: number | null } | null;
  readonly servingOz: number | null;
  readonly servingsPerContainer: number | null;
  readonly lowConfidence: boolean;
  readonly backOfPack: boolean;
  readonly lineCount: number;
}

export interface EvidenceState {
  readonly barcode: BarcodeCandidate | null;
  readonly observations: readonly Observation[];
  /** Label frames seen for this package (not capped). */
  readonly samples: number;
  readonly overrides: Overrides;
}

// ─── Constants ──────────────────────────────────────────────────────

const MAX_OBSERVATIONS = 12;
/** Frames to wait for a size on the label before showing what we have. */
export const SIZE_WAIT_SAMPLES = 3;
/** Frames after which a single clear read of the identity is shown. */
export const SINGLE_READ_SAMPLES = 4;
const MIN_NET_OZ = 1.5;
const MAX_NET_OZ = 128;
const ML_PER_OZ = 29.5735;

export const formatOz = (oz: number): string => {
  const r = Math.round(oz * 10) / 10;
  return `${Number.isInteger(r) ? r : r.toFixed(1)} fl oz`;
};

// ─── Text helpers ───────────────────────────────────────────────────

const upper = (s: string) => s.toUpperCase().replace(/[’‘`´]/g, "'").replace(/\s+/g, ' ').trim();
const tokensOf = (s: string): string[] => upper(s).replace(/'/g, '').split(/[^A-Z0-9]+/).filter(Boolean);
const hasPhrase = (hay: string, phrase: string) => ` ${hay} `.includes(` ${phrase} `);

// ─── Catalog index (the app's own catalogs only) ────────────────────

type CatalogSource = 'drink' | 'compare';

interface Entry {
  readonly id: string;
  readonly src: CatalogSource;
  readonly brand: string | null;
  readonly name: string;
  readonly category: DrinkCategoryId;
  readonly distinct: readonly string[];
  readonly sugar: 'zero' | 'regular' | null;
  readonly splitFamily: boolean;
}

const COMPARE_CATEGORY: Record<string, DrinkCategoryId> = {
  electrolyte_mix: 'electrolyte',
  medical_oral_rehydration: 'electrolyte',
  sports_drink: 'sports_drink',
  plain_water: 'water',
};

/** Spellings a label uses for a brand the catalog names another way. */
const BRAND_ALIASES: Record<string, readonly string[]> = {
  'coca-cola': ['COKE'],
  'mountain dew': ['MTN DEW'],
  aforce: ['A FORCE', 'AFORCE OS'],
  bodyarmor: ['BODY ARMOR'],
  'alani nu': ['ALANI'],
  'red bull': ['REDBULL'],
  'liquid iv': ['LIQUID I V'],
};

const TRAIT_TOKENS = new Set(['ZERO', 'DIET', 'LIGHT', 'SUGAR', 'FREE', 'CLASSIC', 'ORIGINAL', 'REGULAR', 'THE', 'AND', 'OF']);

interface Index {
  readonly entries: readonly Entry[];
  readonly brands: readonly { readonly name: string; readonly phrases: readonly string[]; readonly tokens: ReadonlySet<string> }[];
  readonly generic: readonly { readonly id: string; readonly name: string; readonly category: DrinkCategoryId; readonly tokens: readonly string[] }[];
  readonly vocab: ReadonlySet<string>;
}

let cachedIndex: Index | null = null;

function buildIndex(): Index {
  const raw: { id: string; src: CatalogSource; brand: string | null; name: string; category: DrinkCategoryId }[] = [];
  for (const d of CATALOG_DRINKS) {
    raw.push({ id: d.id, src: 'drink', brand: d.brand ?? null, name: d.name, category: d.categoryId });
  }
  const drinkBrands = new Set(CATALOG_DRINKS.filter((d) => d.brand).map((d) => d.brand!.toLowerCase()));
  const drinkNames = new Set(CATALOG_DRINKS.map((d) => tokensOf(d.name).join(' ')));
  for (const p of COMPARE_PRODUCTS) {
    if (p.brand.toLowerCase() === 'water') continue;
    const nameKey = tokensOf(p.name).join(' ');
    const brandKey = tokensOf(p.brand).join(' ');
    // The catalog's own rows win: a brand-only compare row would only duplicate them.
    if (drinkNames.has(nameKey)) continue;
    if (drinkBrands.has(p.brand.toLowerCase()) && nameKey === brandKey) continue;
    raw.push({
      id: p.id,
      src: 'compare',
      brand: p.brand,
      name: p.name,
      category: COMPARE_CATEGORY[p.category] ?? 'custom',
    });
  }

  const brandNames = new Map<string, string>();
  for (const r of raw) if (r.brand && !brandNames.has(r.brand.toLowerCase())) brandNames.set(r.brand.toLowerCase(), r.brand);

  const isZero = (name: string) => {
    const t = tokensOf(name);
    return t.includes('ZERO') || t.includes('DIET') || (t.includes('SUGAR') && t.includes('FREE'));
  };
  const zeroBrands = new Set(raw.filter((r) => r.brand && isZero(r.name)).map((r) => r.brand!.toLowerCase()));
  const regularBrands = new Set(raw.filter((r) => r.brand && !isZero(r.name)).map((r) => r.brand!.toLowerCase()));

  const entries: Entry[] = [];
  const generic: Index['generic'][number][] = [];
  const vocab = new Set<string>();
  for (const r of raw) {
    const cleanName = r.name.replace(/\([^)]*\)/g, ' ');
    const nameTokens = tokensOf(cleanName);
    nameTokens.forEach((t) => vocab.add(t));
    if (!r.brand) {
      generic.push({ id: r.id, name: r.name.replace(/\s*\([^)]*\)/g, '').trim(), category: r.category, tokens: nameTokens });
      continue;
    }
    const key = r.brand.toLowerCase();
    const brandTokens = new Set(tokensOf(r.brand));
    const aliasTokens = new Set((BRAND_ALIASES[key] ?? []).flatMap((a) => tokensOf(a)));
    brandTokens.forEach((t) => vocab.add(t));
    aliasTokens.forEach((t) => vocab.add(t));
    const distinct = nameTokens.filter((t) => !brandTokens.has(t) && !aliasTokens.has(t) && !TRAIT_TOKENS.has(t));
    const zero = isZero(r.name);
    const split = zeroBrands.has(key) && regularBrands.has(key);
    entries.push({
      id: r.id,
      src: r.src,
      brand: r.brand,
      name: r.name,
      category: r.category,
      distinct,
      sugar: zero ? 'zero' : split ? 'regular' : null,
      splitFamily: split,
    });
  }
  const brands = [...brandNames.entries()].map(([key, name]) => {
    const phrases = [tokensOf(name).join(' '), ...(BRAND_ALIASES[key] ?? []).map((a) => tokensOf(a).join(' '))];
    return { name, phrases, tokens: new Set(phrases.flatMap((p) => p.split(' '))) };
  });
  return { entries, brands, generic, vocab };
}

const index = (): Index => (cachedIndex ??= buildIndex());

// ─── Signals ────────────────────────────────────────────────────────

const FLAVORS = [
  'FRUIT PUNCH', 'COOL BLUE', 'GLACIER FREEZE', 'LEMON LIME', 'PASSION FRUIT', 'WATERMELON', 'STRAWBERRY',
  'RASPBERRY', 'BLUEBERRY', 'BLACKBERRY', 'POMEGRANATE', 'GRAPEFRUIT', 'PINEAPPLE', 'CUCUMBER', 'TROPICAL',
  'CHERRY', 'VANILLA', 'ORANGE', 'SOURSOP', 'COCONUT', 'CITRUS', 'GINGER', 'MANGO', 'PEACH', 'GRAPE', 'BERRY',
  'LEMON', 'LIME', 'APPLE', 'MINT', 'KIWI',
] as const;

interface CategoryKeyword { readonly phrases: readonly string[]; readonly category: DrinkCategoryId }
/** Ordered: the first matching rows win ties. Alcohol is decided separately. */
const CATEGORY_KEYWORDS: readonly CategoryKeyword[] = [
  { phrases: ['ENERGY DRINK', 'ENERGY SHOT'], category: 'energy_drink' },
  { phrases: ['PRE WORKOUT', 'PREWORKOUT'], category: 'pre_workout' },
  { phrases: ['ELECTROLYTE', 'ELECTROLYTES', 'ORAL REHYDRATION', 'REHYDRATION'], category: 'electrolyte' },
  { phrases: ['SPORTS DRINK', 'SPORT DRINK', 'THIRST QUENCHER', 'ISOTONIC'], category: 'sports_drink' },
  { phrases: ['COLD BREW', 'COFFEE', 'ESPRESSO', 'LATTE', 'MOCHA', 'CAPPUCCINO'], category: 'coffee' },
  { phrases: ['ICED TEA', 'GREEN TEA', 'BLACK TEA', 'HERBAL TEA', 'OOLONG', 'MATCHA'], category: 'tea' },
  { phrases: ['SPARKLING WATER', 'SPARKLING MINERAL', 'CARBONATED WATER', 'SELTZER WATER', 'CLUB SODA', 'MINERAL WATER', 'SPARKLING'], category: 'bottled_water' },
  { phrases: ['SPRING WATER', 'PURIFIED WATER', 'DRINKING WATER', 'ALKALINE WATER', 'DISTILLED WATER', 'ARTESIAN WATER'], category: 'bottled_water' },
  { phrases: ['SODA', 'SOFT DRINK', 'COLA', 'ROOT BEER', 'GINGER ALE', 'CREAM SODA', 'LEMON LIME'], category: 'soda' },
  { phrases: ['SMOOTHIE'], category: 'smoothie' },
  { phrases: ['JUICE', 'NOT FROM CONCENTRATE'], category: 'juice' },
];

/** Largest size offered as "one can or bottle" of a multipack when the label does not print the unit size. */
const MAX_SINGLE_UNIT_OZ = 34;

const NET_MARKER = /\bNET\b(?!\s*(?:WT|WEIGHT))|\bNET\s+CONTENTS?\b|\bCONTENTS\b|\bNET\s+VOL/;
const NET_WEIGHT = /\bNET\s*(?:WT|WEIGHT)\b/;
const SERVING_MARKER = /SERV(?:ING)?S?\.?\s*SIZE|\bPER\s+SERVING\b|\bAMOUNT\s+PER\b|\bPER\s+\d+(?:\.\d+)?\s*(?:FL\.?\s*)?OZ|\bSERVING\b/;
const SERVINGS_PER = /SERVINGS?\s+PER\s+(?:CONTAINER|BOTTLE|CAN|PACKAGE|PACK)\W*(?:ABOUT\s*)?(\d+(?:[.,]\d+)?)/;
const VOLUME_RE = /(?<![\d.,])(\d{1,2},\d{3}|\d{1,4}(?:[.,]\d{1,2})?)\s*(FL\.?\s*OZ\.?|FLUID\s+OUNCES?|OUNCES?|OZ\.?|M\s?L|CL|L(?:ITE?RS?|ITRES?)?)(?![A-Z])/g;
const BACK_OF_PACK = /NUTRITION FACTS|SUPPLEMENT FACTS|INGREDIENTS|SERVING SIZE|SERVINGS PER|DISTRIBUTED BY|MANUFACTURED/;

const toOz = (n: number, unit: string): number => {
  const u = unit.replace(/[\s.]/g, '');
  if (u === 'ML') return n / ML_PER_OZ;
  if (u === 'CL') return (n * 10) / ML_PER_OZ;
  if (u.startsWith('L')) return (n * 1000) / ML_PER_OZ;
  return n; // FLOZ, OZ, OUNCE(S), FLUIDOUNCE(S)
};
// "1,000" is a thousands separator; "12,5" is a decimal comma.
const parseNumber = (s: string) => Number.parseFloat(/^\d{1,2},\d{3}$/.test(s) ? s.replace(',', '') : s.replace(',', '.'));
const round1 = (n: number) => Math.round(n * 10) / 10;
const plausible = (oz: number) => oz >= MIN_NET_OZ && oz <= MAX_NET_OZ;

interface RawVolume { readonly oz: number; readonly unit: 'oz' | 'ml'; readonly index: number }

function volumesIn(line: string): RawVolume[] {
  // "(1 PT 4 OZ)" style compounds would read "4 OZ" as a size.
  const cleaned = line
    .replace(/\(\s*\d+\s*(?:PT|QT|PINT|QUART)S?\.?[^)]*\)/g, ' ')
    .replace(/\b\d+\s*(?:PT|QT)\.?\s+\d+(?:\.\d+)?\s*(?:FL\.?\s*)?OZ\.?/g, ' ');
  const out: RawVolume[] = [];
  for (const m of cleaned.matchAll(VOLUME_RE)) {
    const n = parseNumber(m[1]!);
    if (!Number.isFinite(n) || n <= 0) continue;
    const unit = m[2]!.replace(/[\s.]/g, '');
    out.push({ oz: toOz(n, m[2]!), unit: unit === 'ML' || unit === 'CL' || unit.startsWith('L') ? 'ml' : 'oz', index: m.index ?? 0 });
  }
  return out;
}

interface VolumeFacts {
  net: { oz: number; weight: number; dual: boolean }[];
  multipack: { count: number | null; unitOz: number | null } | null;
  servingOz: number | null;
  servingsPerContainer: number | null;
}

function parseVolumeFacts(lines: readonly string[]): VolumeFacts {
  const facts: VolumeFacts = { net: [], multipack: null, servingOz: null, servingsPerContainer: null };
  let pendingServing = 0;
  const note = (count: number | null, unit: number | null) => {
    const prev = facts.multipack;
    facts.multipack = {
      count: count ?? prev?.count ?? null,
      unitOz: unit ?? prev?.unitOz ?? null,
    };
  };

  for (const rawLine of lines) {
    const u = upper(rawLine);
    if (!u) continue;

    const spc = SERVINGS_PER.exec(u);
    if (spc && facts.servingsPerContainer == null) {
      const n = parseNumber(spc[1]!);
      if (Number.isFinite(n) && n > 0 && n < 100) facts.servingsPerContainer = n;
    }

    // Multipack signals first, so a pack's unit size is never read as the net.
    let packUnit: number | null = null;
    const times = /\b(\d{1,3})\s*[X×]\s*(\d{1,3}(?:[.,]\d+)?)\s*(FL\.?\s*OZ|OZ|ML|L)\b/.exec(u);
    const dashed = /\b(\d{1,3})\s*[-–]\s*(\d{1,3}(?:[.,]\d+)?)\s*(FL\.?\s*OZ|OZ|ML)\b/.exec(u);
    const packWord = /\b(\d{1,3})\s*[- ]?\s*(PACK|PK|CT|COUNT|CANS|BOTTLES)\b/.exec(u);
    const caseOf = /\bCASE\s+OF\s+(\d{1,3})\b/.exec(u);
    const pm = times ?? dashed;
    if (pm) {
      const count = Number.parseInt(pm[1]!, 10);
      const unitOz = toOz(parseNumber(pm[2]!), pm[3]!);
      if (count >= 2 && count <= 48 && plausible(unitOz)) {
        note(count, round1(unitOz));
        packUnit = unitOz;
      }
    } else if (packWord || caseOf) {
      const count = Number.parseInt((packWord ?? caseOf)![1]!, 10);
      if (count >= 2 && count <= 48) note(count, null);
    }

    const vols = volumesIn(u);
    const serving = SERVING_MARKER.test(u);
    if (serving) {
      const first = vols.find((v) => plausible(v.oz));
      if (first && facts.servingOz == null) facts.servingOz = round1(first.oz);
      pendingServing = first ? 0 : 1;
      continue;
    }
    if (vols.length === 0) {
      pendingServing = Math.max(0, pendingServing - 1);
      continue;
    }
    const netMarked = NET_MARKER.test(u);
    if (pendingServing > 0 && !netMarked) {
      const first = vols.find((v) => plausible(v.oz));
      if (first && facts.servingOz == null) facts.servingOz = round1(first.oz);
      pendingServing = 0;
      continue;
    }
    pendingServing = 0;
    if (NET_WEIGHT.test(u)) continue; // a weight, not a drink volume

    const oz = vols.filter((v) => v.unit === 'oz' && plausible(v.oz));
    const ml = vols.filter((v) => v.unit === 'ml' && plausible(v.oz));
    // The pack's unit size is already recorded; a lone net total (count × unit) is dropped later.
    if (packUnit != null && [...oz, ...ml].every((v) => Math.abs(v.oz - packUnit!) / packUnit! < 0.04)) continue;
    const weight = netMarked ? 3 : 1;
    const seen: number[] = [];
    for (const a of oz) {
      const dualMl = ml.find((b) => Math.abs(a.oz - b.oz) / a.oz <= 0.04);
      facts.net.push({ oz: round1(a.oz), weight, dual: !!dualMl });
      seen.push(a.oz);
    }
    for (const b of ml) {
      if (seen.some((o) => Math.abs(o - b.oz) / o <= 0.04)) continue; // the metric twin of an oz size
      facts.net.push({ oz: round1(b.oz), weight, dual: false });
    }
  }
  return facts;
}

function alcoholSignals(text: string) {
  let t = text;
  let nonAlc = false;
  const NON = /NON[\s-]?ALCOHOLIC|ALCOHOL[\s-]?FREE|NO\s+ALCOHOL|ZERO\s+ALCOHOL|DEALCOHOLI[SZ]ED|N\/A\s+BEER|\b0\.0\s?%/g;
  if (NON.test(t)) {
    nonAlc = true;
    t = t.replace(NON, ' ');
  }
  let strong = false;
  let low = false;
  const abv = [
    ...t.matchAll(/(\d{1,2}(?:[.,]\d{1,2})?)\s?%\s*(?:ALC|ABV|ALCOHOL|BY\s+VOL|VOL)/g),
    ...t.matchAll(/\bABV\b\s*:?\s*(\d{1,2}(?:[.,]\d{1,2})?)/g),
  ];
  for (const m of abv) {
    const v = parseNumber(m[1]!);
    if (v >= 1) strong = true;
    else if (v > 0) low = true;
    else nonAlc = true;
  }
  if (/GOVERNMENT\s+WARNING/.test(t) || (/SURGEON\s+GENERAL/.test(t) && /ALCOHOLIC\s+BEVERAGES/.test(t))) strong = true;
  if (/\bHARD\s+(?:SELTZER|CIDER|LEMONADE|TEA|ICED\s+TEA|KOMBUCHA|COFFEE)\b/.test(t)) strong = true;
  const scrubbed = t.replace(/\b(?:ROOT|GINGER|BIRCH|CREAM)\s+BEER\b/g, ' ');
  const weak =
    /\b(?:BEER|LAGER|PILSNER|STOUT|IPA|PALE\s+ALE|WINE|CHARDONNAY|CABERNET|MERLOT|PROSECCO|CHAMPAGNE|VODKA|WHISK(?:E)?Y|TEQUILA|RUM|BOURBON|GIN|LIQUEUR|SPIRITS?|MALT\s+BEVERAGE|COCKTAIL|ALCOHOLIC|ALCOHOL|ALC\.?\s*\/\s*VOL)\b/.test(
      scrubbed,
    );
  return { strong, weak: weak && !strong, nonAlc, low };
}

function observe(lines: readonly LabelLine[]): Observation {
  const idx = index();
  const texts = lines.map((l) => upper(l.text)).filter(Boolean);
  const all = texts.join(' | ');
  const toks = tokensOf(all);
  const hay = toks.join(' ');
  const compact = toks.join('');

  const brands: string[] = [];
  for (const b of idx.brands) {
    const hit = b.phrases.some((p) => {
      if (hasPhrase(hay, p)) return true;
      const parts = p.split(' ');
      const c = parts.join('');
      return parts.length >= 2 && c.length >= 7 && compact.includes(c);
    });
    if (hit) brands.push(b.name);
  }
  const vocab = [...new Set(toks.filter((t) => idx.vocab.has(t)))];
  const genericIds = idx.generic.filter((g) => g.tokens.length >= 2 && g.tokens.every((t) => hay.split(' ').includes(t))).map((g) => g.id);

  const categories: DrinkCategoryId[] = [];
  for (const k of CATEGORY_KEYWORDS) {
    if (k.phrases.some((p) => hasPhrase(hay, p)) && !categories.includes(k.category)) categories.push(k.category);
  }
  // A cola brand or a juice line on a soda ("5% juice") must not outvote the stronger words.
  if (categories.includes('soda') && categories.includes('juice')) categories.splice(categories.indexOf('juice'), 1);

  let sugarZero: string | null = null;
  const zeroSugar = /ZERO\s+SUGAR/.test(all) ? 'Zero Sugar' : /SUGAR[\s-]?FREE/.test(all) ? 'Sugar Free' : /\bDIET\b/.test(all) ? 'Diet'
    : /NO\s+SUGAR(?!\s+ADDED)/.test(all) ? 'Zero Sugar' : /\bZERO\b/.test(all) ? 'Zero' : null;
  sugarZero = zeroSugar;
  const sugarRegular = /\b(?:CLASSIC|ORIGINAL|REGULAR|FULL\s+SUGAR)\b/.test(all);

  let caffeineFree = /CAFFEINE[\s-]?FREE|\bDECAF(?:FEINATED)?\b|NO\s+CAFFEINE/.test(all);
  let caffeinated = /\bCAFFEINATED\b|CONTAINS\s+CAFFEINE|WITH\s+CAFFEINE/.test(all);
  for (const m of all.matchAll(/(\d{1,3})\s?MG\s+(?:OF\s+)?CAFFEINE|CAFFEINE\s*:?\s*(\d{1,3})\s?MG/g)) {
    const n = Number.parseInt(m[1] ?? m[2] ?? '', 10);
    if (n === 0) caffeineFree = true;
    else if (n > 0) caffeinated = true;
  }

  const alc = alcoholSignals(all);

  const flavors: string[] = [];
  for (const l of texts) {
    const lt = tokensOf(l);
    if (lt.length === 0 || lt.length > 5) continue;
    const lh = lt.join(' ');
    for (const f of FLAVORS) {
      if (hasPhrase(lh, f) && !flavors.includes(f) && !flavors.some((x) => x.includes(f))) flavors.push(f);
    }
  }

  const facts = parseVolumeFacts(lines.map((l) => l.text));
  const confs = lines.map((l) => l.confidence).filter((c): c is number => typeof c === 'number');
  const lowConfidence = confs.length > 0 && confs.reduce((a, b) => a + b, 0) / confs.length < 0.5;

  return {
    brands,
    vocab,
    genericIds,
    categories,
    sugarZero,
    sugarRegular,
    caffeineFree,
    caffeinated,
    alcStrong: alc.strong,
    alcWeak: alc.weak,
    nonAlc: alc.nonAlc,
    alcLow: alc.low,
    sparkling: /\b(?:SPARKLING|SELTZER|CARBONATED|CLUB\s+SODA|MINERAL\s+WATER)\b/.test(all) && !alc.strong,
    flavors,
    net: facts.net,
    multipack: facts.multipack,
    servingOz: facts.servingOz,
    servingsPerContainer: facts.servingsPerContainer,
    lowConfidence,
    backOfPack: BACK_OF_PACK.test(all),
    lineCount: texts.length,
  };
}

// ─── State ──────────────────────────────────────────────────────────

export function createEvidence(): EvidenceState {
  return { barcode: null, observations: [], samples: 0, overrides: {} };
}

function dominantBrand(observations: readonly Observation[]): { name: string; count: number } | null {
  const tally = new Map<string, number>();
  for (const o of observations) for (const b of o.brands) tally.set(b, (tally.get(b) ?? 0) + 1);
  let best: { name: string; count: number } | null = null;
  for (const [name, count] of tally) {
    if (!best || count > best.count || (count === best.count && name.length > best.name.length)) best = { name, count };
  }
  return best;
}

/**
 * Adds one sample of the package in view. Resets first when a different drink
 * is clearly in view: a different barcode, or label text whose brand
 * contradicts the brand accumulated so far.
 */
export function addSample(state: EvidenceState, sample: SampleInput): EvidenceState {
  let next = state;
  const obs = sample.lines ? observe(sample.lines) : null;

  if (sample.barcode && next.barcode && sample.barcode.code !== next.barcode.code) {
    next = createEvidence();
  } else if (obs && obs.brands.length > 0) {
    const dom = dominantBrand(next.observations);
    if (dom && !obs.brands.includes(dom.name)) next = createEvidence();
  }

  const observations = obs ? [...next.observations, obs].slice(-MAX_OBSERVATIONS) : next.observations;
  return {
    barcode: sample.barcode ?? next.barcode,
    observations,
    samples: next.samples + (obs ? 1 : 0),
    overrides: next.overrides,
  };
}

/** Records the member's own answer or edit. It outranks every other source. */
export function applyOverride(state: EvidenceState, patch: Overrides): EvidenceState {
  return { ...state, overrides: { ...state.overrides, ...patch } };
}

/** Applies a choice of the question currently asked. Unknown ids change nothing. */
export function answerQuestion(state: EvidenceState, questionId: QuestionId, choiceId: string): EvidenceState {
  const q = readEvidence(state).question;
  if (!q || q.id !== questionId) return state;
  const choice = q.choices.find((c) => c.id === choiceId);
  return choice ? applyOverride(state, choice.patch) : state;
}

// ─── Reading ────────────────────────────────────────────────────────

const UNKNOWN: Field<never> = { value: null, confidence: 'unknown', source: null };
const field = <T>(value: T, confidence: Confidence, source: EvidenceSource): Field<T> => ({ value, confidence, source });
const confByCount = (n: number): Confidence => (n >= 2 ? 'confirmed' : 'likely');

const SUGARY: ReadonlySet<DrinkCategoryId> = new Set(['soda', 'sports_drink', 'energy_drink']);
const CAFFEINATED_CATEGORIES: ReadonlySet<DrinkCategoryId> = new Set(['soda', 'energy_drink', 'coffee', 'tea', 'pre_workout']);

interface LabelIdentity {
  brand: string | null;
  entry: Entry | null;
  ambiguity: Entry[];
  category: DrinkCategoryId | null;
  count: number;
}

const titleCase = (s: string) => s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
const categoryLabel = (c: DrinkCategoryId) => DRINK_CATEGORIES[c].label;

function sugarOf(name: string): 'zero' | 'regular' | null {
  const t = tokensOf(name);
  if (t.includes('ZERO') || t.includes('DIET') || (t.includes('SUGAR') && t.includes('FREE'))) return 'zero';
  if (t.includes('CLASSIC') || t.includes('ORIGINAL') || t.includes('REGULAR')) return 'regular';
  return null;
}

function resolveLabelIdentity(obs: readonly Observation[], overrides: Overrides): LabelIdentity {
  const idx = index();
  const dom = dominantBrand(obs);
  const vocab = new Set(obs.flatMap((o) => o.vocab));
  const zeroSeen = obs.some((o) => o.sugarZero);
  const regularSeen = obs.some((o) => o.sugarRegular);
  const caffeineFree = obs.some((o) => o.caffeineFree);

  // Category by keyword weight (number of samples that carry it).
  const catCount = new Map<DrinkCategoryId, number>();
  for (const o of obs) for (const c of o.categories) catCount.set(c, (catCount.get(c) ?? 0) + 1);

  const none: LabelIdentity = { brand: null, entry: null, ambiguity: [], category: null, count: 0 };
  if (dom) {
    const cands = idx.entries.filter((e) => e.brand === dom.name);
    const present = (e: Entry) => e.distinct.filter((t) => vocab.has(t)).length;
    const missing = (e: Entry) => e.distinct.length - present(e);
    // A zero-sugar label contradicts any sugary-category row that is not itself a zero row.
    const conflicting = (e: Entry) =>
      (zeroSeen && !regularSeen && e.sugar !== 'zero' && (e.sugar === 'regular' || SUGARY.has(e.category))) ||
      (regularSeen && !zeroSeen && e.sugar === 'zero') ||
      (caffeineFree && CAFFEINATED_CATEGORIES.has(e.category));
    const eligible = cands.filter((e) => !conflicting(e));
    const supported = eligible.filter((e) => {
      if (missing(e) > 0) return false;
      if (e.sugar === 'zero') return zeroSeen;
      if (e.splitFamily) return regularSeen || e.distinct.length > 0;
      return true;
    });
    const score = (e: Entry) => present(e) * 2 - missing(e) * 0.5;
    const sorted = (list: Entry[]) => [...list].sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name));

    let entry: Entry | null = null;
    let ambiguity: Entry[] = [];
    if (overrides.entryId && overrides.entryId !== 'none') {
      entry = cands.find((e) => e.id === overrides.entryId) ?? null;
    } else if (overrides.entryId === 'none') {
      entry = null;
    } else if (supported.length === 1) {
      entry = supported[0]!;
    } else if (supported.length > 1) {
      const s = sorted(supported);
      if (score(s[0]!) - score(s[1]!) >= 1.5) entry = s[0]!;
      else ambiguity = s.filter((e) => score(s[0]!) - score(e) < 1.5).slice(0, 4);
    } else if (eligible.length >= 2) {
      ambiguity = sorted(eligible).slice(0, 4);
    }
    const category = entry?.category ?? (ambiguity.length > 0 && ambiguity.every((e) => e.category === ambiguity[0]!.category) ? ambiguity[0]!.category : cands[0]?.category ?? null);
    return { brand: dom.name, entry, ambiguity, category: category ?? null, count: dom.count };
  }

  // No brand: a catalog name without a brand, then the category words.
  const genericCount = new Map<string, number>();
  for (const o of obs) for (const g of o.genericIds) genericCount.set(g, (genericCount.get(g) ?? 0) + 1);
  const bestGeneric = [...genericCount.entries()].sort((a, b) => b[1] - a[1])[0];
  if (bestGeneric) {
    const g = idx.generic.find((x) => x.id === bestGeneric[0]);
    if (g) {
      const entry: Entry = { id: g.id, src: 'drink', brand: null, name: g.name, category: g.category, distinct: [], sugar: null, splitFamily: false };
      return { brand: null, entry, ambiguity: [], category: g.category, count: bestGeneric[1] };
    }
  }
  const ranked = [...catCount.entries()].sort((a, b) => b[1] - a[1]);
  if (ranked.length > 0) {
    const top = ranked[0]!;
    const tied = ranked.filter((r) => r[1] === top[1]);
    if (tied.length === 1) return { ...none, category: top[0], count: top[1] };
    // Several kinds of drink are named equally: the engine will ask.
    return { ...none, category: null, count: top[1] };
  }
  return none;
}

function barcodeIdentity(bp: BarcodeProduct) {
  const category = bp.category ?? null;
  return {
    brand: bp.brand ?? null,
    name: bp.name,
    category,
    sugar: sugarOf(bp.name),
    id: bp.id,
  };
}

function variantParts(obs: readonly Observation[]) {
  const sugarWords = obs.map((o) => o.sugarZero).filter((x): x is string => !!x);
  const zero = sugarWords.length > 0;
  const regular = obs.some((o) => o.sugarRegular);
  const caffeineFree = obs.some((o) => o.caffeineFree);
  const caffeinated = obs.some((o) => o.caffeinated);
  const flavorCount = new Map<string, number>();
  for (const o of obs) for (const f of o.flavors) flavorCount.set(f, (flavorCount.get(f) ?? 0) + 1);
  const rankedFlavors = [...flavorCount.entries()].sort((a, b) => b[1] - a[1]);
  const flavor =
    rankedFlavors.length > 0 && (rankedFlavors.length === 1 || rankedFlavors[0]![1] > rankedFlavors[1]![1])
      ? rankedFlavors[0]!
      : null;
  return { zero, zeroWord: sugarWords[0] ?? null, regular, caffeineFree, caffeinated, flavor };
}

/** Reads what the samples add up to. Pure: the same state always gives the same reading. */
export function readEvidence(state: EvidenceState): Reading {
  const { observations: obs, overrides, barcode } = state;
  const bp = barcode?.product ?? null;
  const bId = bp ? barcodeIdentity(bp) : null;
  const label = resolveLabelIdentity(obs, overrides);
  const vp = variantParts(obs);

  const questionsAllowed = obs.length >= 2 || !!barcode || Object.keys(overrides).length > 0;
  let question: Question | null = null;
  const ask = (q: Question) => {
    if (!question && questionsAllowed) question = q;
  };

  // ── alcohol ────────────────────────────────────────────────────────
  const strong = obs.some((o) => o.alcStrong);
  const weak = obs.some((o) => o.alcWeak);
  const nonAlc = obs.some((o) => o.nonAlc);
  const low = obs.some((o) => o.alcLow);
  const alcoholCount = obs.filter((o) => o.alcStrong || o.nonAlc).length;
  const catalogCategory = label.entry?.category ?? bId?.category ?? null;
  const nonAlcoholCatalog = catalogCategory != null && catalogCategory !== 'alcohol';
  let alcohol: Field<'alcoholic' | 'non_alcoholic'> = UNKNOWN;
  let alcoholQuestion = false;
  if (overrides.alcohol) {
    alcohol = field(overrides.alcohol, 'confirmed', 'user');
  } else if (strong && nonAlc) {
    alcoholQuestion = true;
  } else if (strong) {
    if (nonAlcoholCatalog && label.entry?.category !== 'alcohol') alcoholQuestion = true;
    else alcohol = field('alcoholic', confByCount(alcoholCount), 'label');
  } else if (low && !nonAlc) {
    alcoholQuestion = true;
  } else if (nonAlc) {
    alcohol = field('non_alcoholic', confByCount(alcoholCount), 'label');
  } else if (weak) {
    alcoholQuestion = true;
  } else if (bId?.category === 'alcohol') {
    alcoholQuestion = true; // a barcode says alcohol but nothing on the label says how much
  }
  if (alcoholQuestion) {
    ask({
      id: 'alcohol',
      text: 'Does this drink contain alcohol?',
      choices: [
        { id: 'alcoholic', label: 'Yes, it has alcohol', patch: { alcohol: 'alcoholic' } },
        { id: 'non_alcoholic', label: 'No alcohol', patch: { alcohol: 'non_alcoholic' } },
      ],
    });
  }

  // ── sugar and caffeine traits ──────────────────────────────────────
  let sugar: Field<'regular' | 'zero'> = UNKNOWN;
  const zeroCount = obs.filter((o) => o.sugarZero).length;
  const regularCount = obs.filter((o) => o.sugarRegular).length;
  if (vp.zero && vp.regular) sugar = UNKNOWN; // both on the label: leave it to the member
  else if (vp.zero) sugar = field('zero', confByCount(zeroCount), 'label');
  else if (vp.regular) sugar = field('regular', confByCount(regularCount), 'label');
  else if (bId?.sugar) sugar = field(bId.sugar, bp!.reliable ? 'confirmed' : 'likely', 'barcode');
  if (overrides.conflictChoice === 'barcode') sugar = bId?.sugar ? field(bId.sugar, 'confirmed', 'user') : UNKNOWN;

  let caffeine: Field<'caffeinated' | 'free'> = UNKNOWN;
  if (vp.caffeineFree && !vp.caffeinated) caffeine = field('free', confByCount(obs.filter((o) => o.caffeineFree).length), 'label');
  else if (vp.caffeinated && !vp.caffeineFree) caffeine = field('caffeinated', confByCount(obs.filter((o) => o.caffeinated).length), 'label');

  // ── barcode vs label ───────────────────────────────────────────────
  const normBrand = (s: string | null | undefined) => (s ? tokensOf(s).join(' ') : '');
  let conflict: { a: string; b: string; aFull: string; bFull: string } | null = null;
  if (bId && label.brand && !overrides.conflictChoice && !overrides.entryId) {
    const brandClash = bId.brand != null && normBrand(bId.brand) !== '' && normBrand(bId.brand) !== normBrand(label.brand);
    const labelSugar = vp.zero && !vp.regular ? 'zero' : vp.regular && !vp.zero ? 'regular' : null;
    const sugarClash = labelSugar != null && bId.sugar != null && labelSugar !== bId.sugar;
    if (brandClash) {
      const labelName = label.entry?.name ?? label.brand;
      conflict = { a: bId.name, b: labelName, aFull: bId.name, bFull: labelName };
    } else if (sugarClash) {
      const word = (s: 'zero' | 'regular') => (s === 'zero' ? vp.zeroWord ?? 'Zero Sugar' : 'Original');
      const labelName = label.entry?.name ?? `${label.brand} ${word(labelSugar!)}`;
      conflict = { a: word(bId.sugar!), b: word(labelSugar!), aFull: bId.name, bFull: labelName };
    }
  }
  if (conflict) {
    const c = conflict;
    ask({
      id: 'barcode-conflict',
      text: `The barcode matches ${c.a}. The label says ${c.b}. Which one is this?`,
      choices: [
        { id: 'barcode', label: c.aFull, patch: { conflictChoice: 'barcode' } },
        { id: 'label', label: c.bFull, patch: { conflictChoice: 'label' } },
      ],
    });
  }

  // ── identity ───────────────────────────────────────────────────────
  const choseLabel = overrides.conflictChoice === 'label';
  const useBarcode = !!bId && !choseLabel && !(overrides.entryId && overrides.entryId !== 'none');
  const useLabel = !useBarcode;
  let brand: Field<string> = UNKNOWN;
  let product: Field<string> = UNKNOWN;
  let drinkType: Field<DrinkCategoryId> = UNKNOWN;
  let catalogProductId: string | null = null;
  let catalogSource: 'drink' | 'compare' | null = null;
  let identitySamples = 0;
  let identityFrom: EvidenceSource | null = null;

  const userEntry = overrides.entryId && overrides.entryId !== 'none' ? index().entries.find((e) => e.id === overrides.entryId) ?? null : null;
  if (userEntry) {
    brand = userEntry.brand ? field(userEntry.brand, 'confirmed', 'user') : UNKNOWN;
    product = field(userEntry.name, 'confirmed', 'user');
    drinkType = field(userEntry.category, 'confirmed', 'user');
    catalogProductId = userEntry.id;
    catalogSource = userEntry.src;
    identityFrom = 'user';
  } else if (useBarcode && bId) {
    const conf: Confidence = bp!.reliable ? 'confirmed' : 'likely';
    brand = bId.brand ? field(bId.brand, conf, 'barcode') : UNKNOWN;
    product = field(bId.name, conf, 'barcode');
    if (bId.category) drinkType = field(bId.category, conf, 'barcode');
    catalogProductId = bp!.reliable ? bId.id : null;
    catalogSource = bp!.reliable ? 'compare' : null;
    identityFrom = 'barcode';
    if (drinkType.value == null && label.category) {
      drinkType = field(label.category, confByCount(label.count), 'label');
    }
  } else if (useLabel) {
    identityFrom = label.brand || label.category || label.entry ? 'label' : null;
    identitySamples = label.count;
    const conf = confByCount(label.count);
    if (label.brand) brand = field(label.brand, conf, 'label');
    if (label.entry) {
      // A sugary-category name with no explicit sugar word is a likely read at best.
      const capped = SUGARY.has(label.entry.category) && !vp.zero && !vp.regular && !label.entry.splitFamily && !!label.brand;
      product = field(label.entry.name, capped ? 'likely' : conf, 'label');
      catalogProductId = label.entry.id;
      catalogSource = label.entry.src;
    }
    if (label.category) drinkType = field(label.category, conf, 'label');
  }
  if (overrides.conflictChoice && (overrides.conflictChoice === 'barcode' ? !!bId : !!label.brand)) {
    // The member chose a side of the conflict: that side is theirs now.
    identityFrom = 'user';
    if (brand.value) brand = field(brand.value, 'confirmed', 'user');
    if (product.value) product = field(product.value, 'confirmed', 'user');
    if (drinkType.value) drinkType = field(drinkType.value, 'confirmed', 'user');
  }

  // Product ambiguity inside a brand.
  if (!userEntry && useLabel && label.ambiguity.length > 1 && !overrides.entryId) {
    ask({
      id: 'product',
      text: 'Which one is this?',
      choices: [
        ...label.ambiguity.map((e) => ({ id: e.id, label: e.name, patch: { entryId: e.id } as Overrides })),
        { id: 'none', label: 'Something else', patch: { entryId: 'none' } },
      ],
    });
  }

  // Alcohol decides the category, never a guess.
  if (!overrides.drinkType) {
    if (alcohol.value === 'alcoholic') drinkType = field('alcohol', alcohol.confidence, alcohol.source ?? 'label');
    else if (alcohol.value === 'non_alcoholic' && (drinkType.value === 'alcohol' || (drinkType.value == null && weak))) {
      drinkType = field('custom', alcohol.confidence === 'confirmed' ? 'likely' : alcohol.confidence, alcohol.source ?? 'label');
    }
  } else {
    drinkType = field(overrides.drinkType, 'confirmed', 'user');
  }

  // Several kinds of drink named equally and no brand: ask which.
  if (drinkType.value == null && !label.brand && !bId) {
    const catCount = new Map<DrinkCategoryId, number>();
    for (const o of obs) for (const c of o.categories) catCount.set(c, (catCount.get(c) ?? 0) + 1);
    const ranked = [...catCount.entries()].sort((a, b) => b[1] - a[1]);
    if (ranked.length > 1 && ranked[0]![1] === ranked[1]![1]) {
      ask({
        id: 'category',
        text: 'What kind of drink is this?',
        choices: ranked.filter((r) => r[1] === ranked[0]![1]).slice(0, 3).map(([c]) => ({
          id: c,
          label: categoryLabel(c),
          patch: { drinkType: c },
        })),
      });
    }
  }

  // ── variant ────────────────────────────────────────────────────────
  const parts: string[] = [];
  let variantConf: Confidence = 'likely';
  let variantSource: EvidenceSource = 'label';
  const labelUsed = overrides.conflictChoice !== 'barcode';
  if (labelUsed) {
    if (vp.flavor && !(product.value ?? '').toUpperCase().includes(vp.flavor[0])) parts.push(titleCase(vp.flavor[0]));
    if (sugar.value === 'zero') parts.push(vp.zeroWord ?? 'Zero Sugar');
    else if (sugar.value === 'regular' && sugar.source === 'label') parts.push('Original');
    if (caffeine.value === 'free') parts.push('Caffeine Free');
    if (parts.length > 0) {
      const counts = [vp.flavor ? vp.flavor[1] : 99, sugar.source === 'label' ? (sugar.value === 'zero' ? zeroCount : regularCount) : 99, caffeine.value ? obs.filter((o) => o.caffeineFree || o.caffeinated).length : 99];
      variantConf = confByCount(Math.min(...counts));
    }
  }
  if (parts.length === 0 && identityFrom === 'barcode' && bId?.sugar === 'zero') {
    parts.push('Zero Sugar');
    variantConf = bp!.reliable ? 'confirmed' : 'likely';
    variantSource = 'barcode';
  }
  const variant: Field<string> = parts.length > 0 ? field(parts.join(' · '), variantConf, variantSource) : UNKNOWN;

  // Barcode-less product that the label contradicts: a caffeine-free or zero-sugar read
  // of a brand whose catalog row says otherwise leaves the product open (set above).

  // ── volume ─────────────────────────────────────────────────────────
  let volume: Field<number> = UNKNOWN;
  const packs = obs.map((o) => o.multipack).filter((m): m is NonNullable<Observation['multipack']> => !!m);
  const packCount = packs.map((p) => p.count).find((c): c is number => c != null) ?? null;
  const packUnit = packs.map((p) => p.unitOz).find((u): u is number => u != null) ?? null;
  const multipack = { detected: packs.length > 0, count: packCount, unitOz: packUnit };

  // Merge candidates within 3%.
  const cands: { oz: number; weight: number; samples: number; dual: boolean; marked: boolean }[] = [];
  for (const o of obs) {
    const perSample = new Set<number>();
    for (const n of o.net) {
      if (packCount != null && packUnit != null && Math.abs(n.oz - packCount * packUnit) / (packCount * packUnit) < 0.04) continue;
      let c = cands.find((x) => Math.abs(x.oz - n.oz) / x.oz < 0.03);
      if (!c) {
        c = { oz: n.oz, weight: 0, samples: 0, dual: false, marked: false };
        cands.push(c);
      }
      c.weight += n.weight;
      c.dual = c.dual || n.dual;
      c.marked = c.marked || n.weight >= 3;
      if (!perSample.has(c.oz)) {
        c.samples += 1;
        perSample.add(c.oz);
      }
    }
  }
  cands.sort((a, b) => b.weight - a.weight || b.oz - a.oz);

  let volumeAsk: Question | null = null;
  if (overrides.volumeOz !== undefined) {
    volume = overrides.volumeOz === null ? UNKNOWN : field(overrides.volumeOz, 'confirmed', 'user');
  } else if (multipack.detected) {
    // With no "N x size" text, a lone size may be the whole pack: only a single-serve size is offered as one unit.
    const unit = packUnit ?? (cands.length === 1 && cands[0]!.oz <= MAX_SINGLE_UNIT_OZ ? cands[0]!.oz : null);
    if (unit != null) {
      volume = field(unit, 'likely', 'label');
      const countText = packCount != null ? `${packCount}-pack` : 'multipack';
      volumeAsk = {
        id: 'multipack',
        text: `This looks like a ${countText}. Did you drink one ${formatOz(unit)} can or bottle?`,
        choices: [
          { id: 'one', label: `One ${formatOz(unit)}`, patch: { volumeOz: unit } },
          { id: 'other', label: 'A different size', patch: { volumeOz: null } },
        ],
      };
    }
  } else if (cands.length > 0) {
    const top = cands[0]!;
    const second = cands[1];
    if (second && second.weight >= top.weight * 0.6 && Math.abs(second.oz - top.oz) / top.oz > 0.05) {
      volumeAsk = {
        id: 'volume',
        text: 'Which size is the whole container?',
        choices: [top, second].sort((a, b) => a.oz - b.oz).map((c) => ({ id: String(c.oz), label: formatOz(c.oz), patch: { volumeOz: c.oz } })),
      };
    } else {
      // One sample is never `confirmed`, however clearly it is printed.
      const sure = top.samples >= 2;
      volume = field(top.oz, sure ? 'confirmed' : 'likely', 'label');
    }
  }
  if (volumeAsk) ask(volumeAsk);

  // ── status ─────────────────────────────────────────────────────────
  const identityKnown = drinkType.value != null;
  const solid =
    identityFrom === 'barcode' ||
    identityFrom === 'user' ||
    !!overrides.drinkType ||
    identitySamples >= 2 ||
    (identitySamples >= 1 && state.samples >= SINGLE_READ_SAMPLES);
  const sizeSettled =
    volume.value != null || state.samples >= SIZE_WAIT_SAMPLES || overrides.volumeOz !== undefined || !!overrides.drinkType;
  const q = question as Question | null;
  const ready = !q && identityKnown && solid && sizeSettled;
  const status: Reading['status'] = q ? 'question' : ready ? 'ready' : 'reading';

  const hint = status === 'reading' ? chooseHint(state, { identityKnown, volumeKnown: volume.value != null, hasBarcode: !!barcode }) : null;

  return {
    brand,
    product,
    variant,
    drinkType,
    volume,
    traits: { sugar, caffeine, alcohol },
    multipack,
    sparkling: obs.some((o) => o.sparkling),
    flavored: !!vp.flavor,
    serving: {
      oz: obs.map((o) => o.servingOz).find((v): v is number => v != null) ?? null,
      perContainer: obs.map((o) => o.servingsPerContainer).find((v): v is number => v != null) ?? null,
    },
    catalogProductId,
    catalogSource,
    packagingVerified:
      catalogProductId && COMPARE_PRODUCTS.some((p) => p.id === catalogProductId && p.isAForce)
        ? aforcePackagingStatus(catalogProductId).verified
        : null,
    barcodeCode: barcode?.code ?? null,
    question: q,
    hint,
    status,
    samples: state.samples,
  };
}

function chooseHint(
  state: EvidenceState,
  ctx: { identityKnown: boolean; volumeKnown: boolean; hasBarcode: boolean },
): Hint | null {
  const obs = state.observations;
  const last = obs[obs.length - 1];
  if (!last) return null;
  if (ctx.identityKnown) {
    return !ctx.volumeKnown && state.samples >= SIZE_WAIT_SAMPLES ? 'Show the size on the label' : null;
  }
  if (last.backOfPack) return 'Try the front label';
  if (last.lowConfidence) return 'Tilt to reduce glare';
  if (last.lineCount === 0) return state.samples >= SINGLE_READ_SAMPLES ? 'Turn to the barcode' : 'Try the front label';
  // Text is readable but names nothing we know.
  return state.samples >= SINGLE_READ_SAMPLES && !ctx.hasBarcode ? 'Turn to the barcode' : 'Try the front label';
}

// ─── Display ────────────────────────────────────────────────────────

/** The name a drink is saved under. Plain, from what the reading holds; never invented. */
export function displayNameFor(reading: Reading): string {
  const brand = reading.brand.value;
  const product = reading.product.value;
  const variant = reading.variant.value;
  const base = product ?? brand ?? (reading.drinkType.value ? categoryDisplay(reading) : 'Drink');
  // The app's own catalog names are already full names ("Coke Zero"). A public
  // record often leaves the brand out of the product name.
  const withBrand =
    product && brand && !reading.catalogSource && !product.toLowerCase().includes(brand.toLowerCase())
      ? `${brand} ${product}`
      : base;
  // A sparkling water must carry the word, or the drink rail would count it as plain water.
  const named =
    reading.sparkling && (reading.drinkType.value === 'water' || reading.drinkType.value === 'bottled_water') && !/sparkling|seltzer|carbonated|mineral/i.test(withBrand)
      ? `${withBrand} sparkling`
      : withBrand;
  // A flavoured water must carry the word too, for the same reason.
  const isWater = reading.drinkType.value === 'water' || reading.drinkType.value === 'bottled_water';
  const plainGuard = (n: string) => (isWater && reading.flavored && !/flavou?red|sparkling|seltzer|carbonated|mineral|club soda|tonic/i.test(n) ? `${n} flavored` : n);
  if (!variant) return plainGuard(named);
  const redundant = (part: string): boolean => {
    if (/^(zero|diet|sugar free)/i.test(part)) return /zero|diet|sugar.?free/i.test(withBrand);
    if (/^original/i.test(part)) return /classic|original|regular/i.test(withBrand);
    return withBrand.toLowerCase().includes(part.toLowerCase());
  };
  const extra = variant.split(' · ').filter((p) => !redundant(p));
  return plainGuard(extra.length > 0 ? `${named} ${extra.join(' ')}` : named);
}

function categoryDisplay(reading: Reading): string {
  const c = reading.drinkType.value!;
  if (c === 'bottled_water') return reading.sparkling ? 'Sparkling water' : 'Bottled water';
  return categoryLabel(c);
}
