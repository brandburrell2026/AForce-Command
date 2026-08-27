/**
 * quantities — COR-001's typed units-and-quantities layer (directive §4).
 *
 * (Named `quantities` because `utils/units.ts` is the pre-existing display
 * unit-PREFERENCE module — different concern, untouched.)
 *
 * ONE source of conversion truth. Raw numbers with ambiguous units must not
 * cross domain boundaries: construct a branded quantity at the boundary
 * (`oz(60)`, `lb(240)`) and convert explicitly. A branded quantity is still
 * assignable TO `number` (display, math), but a bare number can never pose
 * as a quantity without passing a constructor's validation.
 *
 * Constructors are STRICT like `withAlpha` (loud in dev/test, where every
 * input is code-level): non-finite throws, negative magnitude throws.
 * `fraction01FromScale10` is the deliberate exception — it CLAMPS, because
 * its inputs arrive from server/store profile fields at runtime and a junk
 * value must degrade safely (presentation is still fronted by the S1-2
 * qualifier, so a clamped extreme can never present as LIVE).
 *
 * The conversion constants moved here from services/sweatRateEngine.ts
 * byte-identically; the engine now imports them back — values unchanged,
 * source of truth singular (founder formula freeze respected).
 */

declare const UnitBrand: unique symbol;
type Branded<B extends string> = number & { readonly [UnitBrand]: B };

export type Oz = Branded<'Oz'>;
export type Ml = Branded<'Ml'>;
export type L = Branded<'L'>;
export type Lb = Branded<'Lb'>;
export type Kg = Branded<'Kg'>;
export type Mg = Branded<'Mg'>;
export type Min = Branded<'Min'>;
export type Hr = Branded<'Hr'>;
export type LPerHr = Branded<'LPerHr'>;
/** A normalized 0–1 factor (dimensionless drive/intensity input). */
export type Fraction01 = Branded<'Fraction01'>;

// ─── Canonical conversion constants (moved verbatim from sweatRateEngine) ───
export const KG_PER_LB = 0.45359237;
export const L_PER_OZ = 0.0295735;
export const OZ_PER_L = 1 / L_PER_OZ; // 33.814
export const CM_PER_IN = 2.54;
export const ML_PER_L = 1000;
export const MIN_PER_HR = 60;

function quantity<B extends string>(unit: B, n: number): Branded<B> {
  if (typeof n !== 'number' || !Number.isFinite(n)) {
    throw new TypeError(`units.${unit.toLowerCase()}: expected a finite number, received ${String(n)}`);
  }
  if (n < 0) {
    throw new RangeError(`units.${unit.toLowerCase()}: a quantity magnitude cannot be negative (${n})`);
  }
  return n as Branded<B>;
}

export const oz = (n: number): Oz => quantity('Oz', n);
export const ml = (n: number): Ml => quantity('Ml', n);
export const liters = (n: number): L => quantity('L', n);
export const lb = (n: number): Lb => quantity('Lb', n);
export const kg = (n: number): Kg => quantity('Kg', n);
export const mg = (n: number): Mg => quantity('Mg', n);
export const minutes = (n: number): Min => quantity('Min', n);
export const hours = (n: number): Hr => quantity('Hr', n);

// ─── Explicit conversions ───────────────────────────────────────────────────
export const ozToL = (v: Oz): L => (v * L_PER_OZ) as L;
export const lToOz = (v: L): Oz => (v * OZ_PER_L) as Oz;
export const mlToL = (v: Ml): L => (v / ML_PER_L) as L;
export const lToMl = (v: L): Ml => (v * ML_PER_L) as Ml;
export const lbToKg = (v: Lb): Kg => (v * KG_PER_LB) as Kg;
export const kgToLb = (v: Kg): Lb => (v / KG_PER_LB) as Lb;
export const minToHr = (v: Min): Hr => (v / MIN_PER_HR) as Hr;
export const hrToMin = (v: Hr): Min => (v * MIN_PER_HR) as Min;
export const lPerHr = (lossL: L, over: Hr): LPerHr => {
  if (over <= 0) throw new RangeError(`units.lPerHr: duration must be positive (${over})`);
  return (lossL / over) as LPerHr;
};

/**
 * Founder ruling 2026-08-27 (COR-001 close-out, approved with this layer):
 * profile drive fields (`sweatRate`, `activityLevel`, `heatLoad`) are stored
 * on a 0–10 scale (realApi defaults 3/5/4) — NOT 0–1. The old `clamp01`
 * read saturated every real-scale value to 1.0, which is the exact
 * mechanism behind the 600 oz / 30,000 mg card. This is the ONLY sanctioned
 * bridge from that scale to a normalized factor.
 */
export function fraction01FromScale10(n: number): Fraction01 {
  if (typeof n !== 'number' || Number.isNaN(n)) {
    throw new TypeError(`units.fraction01FromScale10: expected a number, received ${String(n)}`);
  }
  if (!Number.isFinite(n)) {
    throw new TypeError(`units.fraction01FromScale10: expected a finite number, received ${String(n)}`);
  }
  const f = n / 10;
  return (f < 0 ? 0 : f > 1 ? 1 : f) as Fraction01;
}

/** Clamp an already-normalized factor into [0,1] (finite required). */
export function fraction01(n: number): Fraction01 {
  if (typeof n !== 'number' || !Number.isFinite(n)) {
    throw new TypeError(`units.fraction01: expected a finite number, received ${String(n)}`);
  }
  return (n < 0 ? 0 : n > 1 ? 1 : n) as Fraction01;
}
