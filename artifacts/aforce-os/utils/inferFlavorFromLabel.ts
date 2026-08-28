/**
 * Map a user-facing flavor label (e.g. "Berry Blast + Dulse 12 oz")
 * back to the canonical `ProductFlavor` token used by the hydration
 * scoring engine. Substring-based so both the short variant name
 * ("Berry Blast") and the full PRODUCT_FLAVORS label
 * ("Berry Blast + Dulse") resolve to the same flavor.
 *
 * Used by the store's `logIntake` to translate the (since-retired
 * FlavorPickerModal's) label format — records minted in that shape persist
 * choice into the right flavor key before calling `computeEventImpact`,
 * which is what unlocks the Heat Guard / Soursop bonuses.
 */

import type { ProductFlavor } from '../types';

export function inferFlavorFromLabel(label?: string): ProductFlavor | undefined {
  if (!label) return undefined;
  const lower = label.toLowerCase();
  if (lower.includes('berry')) return 'berry';
  if (lower.includes('watermelon')) return 'watermelon';
  if (lower.includes('soursop')) return 'soursop';
  return undefined;
}
