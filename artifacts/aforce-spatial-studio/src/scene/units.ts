/**
 * Scene units.
 *
 * The world unit is one foot. Event production in the US is specified in
 * feet and inches, and every dimension the user sees is feet. GLB export
 * (section 6) multiplies by METERS_PER_FOOT so downstream tools get meters.
 */
export const METERS_PER_FOOT = 0.3048;
export const FEET_PER_METER = 1 / METERS_PER_FOOT;

export function inches(n: number): number {
  return n / 12;
}

/** 12.5 -> 12' 6" */
export function formatFeet(ft: number): string {
  const sign = ft < 0 ? "-" : "";
  const abs = Math.abs(ft);
  let whole = Math.floor(abs);
  let inch = Math.round((abs - whole) * 12);
  if (inch === 12) {
    whole += 1;
    inch = 0;
  }
  return `${sign}${whole}' ${inch}"`;
}

/** 12 × 6 × 9 -> 12' 0" × 6' 0" × 9' 0" H */
export function formatFootprint(width: number, depth: number, height: number): string {
  return `${formatFeet(width)} × ${formatFeet(depth)} × ${formatFeet(height)} H`;
}

export function squareFeet(width: number, depth: number): number {
  return Math.round(width * depth);
}
