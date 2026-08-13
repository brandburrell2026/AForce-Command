/**
 * Shared WCAG 2.2 relative-luminance contrast math for the colour guards.
 *
 * Extracted so the AA floor is measured by ONE implementation: `afTokens.test.ts`
 * pins the token ramp, and `components/home/__tests__/homePresentation.test.ts`
 * pins the band-accent TEXT variants against the same numbers. Two copies of this
 * math is how a "passes AA" claim quietly stops being true in one of them.
 *
 * Leading underscore + no `.test.ts` suffix keeps vitest from collecting this as
 * a suite. Solid `#RGB` / `#RRGGBB` input only — every caller passes a token literal.
 */

export function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

export function relLuminance([r, g, b]: [number, number, number]): number {
  const f = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const [R, G, B] = [f(r), f(g), f(b)];
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

export function contrast(a: string, b: string): number {
  const la = relLuminance(hexToRgb(a));
  const lb = relLuminance(hexToRgb(b));
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}
