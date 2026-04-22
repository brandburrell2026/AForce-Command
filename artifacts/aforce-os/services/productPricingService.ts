/**
 * Product pricing service.
 *
 * Pure functions over the STORE_SKUS / STORE_BUNDLES catalog. Owns the
 * "Subscribe & Save" math, the per-bundle savings math, and the lookup
 * of the SKU recommended for a given performance state. UI components
 * call into this rather than re-deriving discount logic ad hoc.
 */

import {
  STORE_SKUS,
  STORE_BUNDLES,
  bundlesForFormat,
  formatPrice,
  pricePerServingCents,
  type StoreSKU,
  type StoreBundle,
  type StoreFormatId,
} from "../data/pricing";
import type { PerformanceLevel, ProductFlavor } from "../types";

// ─── Subscription math ──────────────────────────────────────────────────────

export interface SubscriptionPricing {
  oneTimeCents: number;
  subscriptionCents: number;
  /** Absolute savings in cents (always ≥ 0). */
  savingsCents: number;
  /** Fractional discount (0..1) — e.g. 0.15 = 15% off. */
  discountFraction: number;
  /** Pre-formatted "Save 15%" label for UI. */
  discountLabel: string;
}

export function getSubscriptionPricing(sku: StoreSKU): SubscriptionPricing {
  const oneTime = sku.priceCents;
  const sub = sku.subscriptionPriceCents;
  const savings = Math.max(0, oneTime - sub);
  const fraction = oneTime > 0 ? savings / oneTime : 0;
  const pct = Math.round(fraction * 100);
  return {
    oneTimeCents: oneTime,
    subscriptionCents: sub,
    savingsCents: savings,
    discountFraction: fraction,
    discountLabel: pct > 0 ? `Save ${pct}%` : "",
  };
}

// ─── Bundle math ────────────────────────────────────────────────────────────

export interface BundlePricing {
  bundle: StoreBundle;
  /** What N×base singles would cost — i.e. the "compare-at" baseline. */
  singlesCents: number;
  bundlePriceCents: number;
  savingsCents: number;
  savingsLabel: string;
  /** Effective per-unit cost when buying the bundle. */
  effectiveUnitCents: number;
}

export function getBundlePricing(
  bundle: StoreBundle,
  baseSku: StoreSKU,
): BundlePricing {
  if (bundle.formatId !== baseSku.formatId) {
    throw new Error(
      `bundle ${bundle.id} (${bundle.formatId}) does not match base sku ${baseSku.id} (${baseSku.formatId})`,
    );
  }
  const singles = baseSku.priceCents * bundle.multiplier;
  const savings = Math.max(0, singles - bundle.priceCents);
  return {
    bundle,
    singlesCents: singles,
    bundlePriceCents: bundle.priceCents,
    savingsCents: savings,
    savingsLabel: savings > 0 ? `Save ${formatPrice(savings)}` : "",
    effectiveUnitCents: Math.round(bundle.priceCents / bundle.multiplier),
  };
}

export function getBundlesForSku(sku: StoreSKU): BundlePricing[] {
  return bundlesForFormat(sku.formatId).map((b) => getBundlePricing(b, sku));
}

// ─── Recommendation ─────────────────────────────────────────────────────────

/** SKU(s) recommended for a given performance state, scoped to a format. */
export function recommendedSkusForState(
  state: PerformanceLevel,
  formatId?: StoreFormatId,
): StoreSKU[] {
  return STORE_SKUS.filter(
    (s) =>
      s.recommendedFor.includes(state) &&
      (formatId == null || s.formatId === formatId),
  );
}

/** Best single SKU for (state × format) — used for "Recommended for you". */
export function recommendedSkuFor(
  state: PerformanceLevel,
  formatId: StoreFormatId,
  fallbackFlavor?: ProductFlavor,
): StoreSKU | undefined {
  const matches = recommendedSkusForState(state, formatId);
  if (matches.length > 0) return matches[0];
  if (fallbackFlavor) {
    return STORE_SKUS.find(
      (s) => s.formatId === formatId && s.flavor === fallbackFlavor,
    );
  }
  return undefined;
}

// ─── Misc helpers exposed for UI ────────────────────────────────────────────

/** Convenience re-exports so screens import everything from one place. */
export {
  formatPrice,
  pricePerServingCents,
  STORE_SKUS,
  STORE_BUNDLES,
  bundlesForFormat,
};
