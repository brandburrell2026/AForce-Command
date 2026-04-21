/**
 * AForce Shopping Store — pricing catalog.
 *
 * One SKU per (format × flavor) combination. Pricing reflects the Phase 1
 * launch lineup. Subscription pricing lives in subscriptionService.ts and
 * is intentionally separate from one-shot purchases here.
 *
 * All prices are USD cents (integer math) — formatted via formatPrice().
 */

import type { FluidType, ProductFlavor } from "../types";

export type StoreFormatId = Extract<
  FluidType,
  "aforce_stick" | "aforce_rtd" | "aforce_canister" | "aforce_bulk_bag"
>;

export interface StoreSKU {
  /** Stable SKU id (also used as cart key). */
  id: string;
  formatId: StoreFormatId;
  flavor: ProductFlavor;
  /** Human title shown on the card. */
  title: string;
  /** Format subtitle, e.g. "12-stick box". */
  formatLabel: string;
  /** Total servings in the package. */
  servingsPerPack: number;
  /** Oz per single serving when prepared. */
  ozPerServing: number;
  /** Price in USD cents. */
  priceCents: number;
  /** Optional MSRP / strike-through, in cents. */
  compareAtCents?: number;
  /** UPC, for traceability and barcode reuse. */
  upc?: string;
  /** Short marketing line. */
  blurb: string;
}

// ─── Catalog ────────────────────────────────────────────────────────────────
export const STORE_SKUS: StoreSKU[] = [
  // Sticks — $34.99 / 12 pack
  {
    id: "sku_stick_berry",
    formatId: "aforce_stick",
    flavor: "berry",
    title: "Berry Blast + Dulse",
    formatLabel: "Hydration Sticks · 12 ct",
    servingsPerPack: 12,
    ozPerServing: 12,
    priceCents: 3499,
    upc: "850000000055",
    blurb: "Antioxidant push. Mineral-dense recovery.",
  },
  {
    id: "sku_stick_watermelon",
    formatId: "aforce_stick",
    flavor: "watermelon",
    title: "Watermelon Surge + Chlorella",
    formatLabel: "Hydration Sticks · 12 ct",
    servingsPerPack: 12,
    ozPerServing: 12,
    priceCents: 3499,
    upc: "850000000062",
    blurb: "Heat absorption. Detox and clean output.",
  },
  {
    id: "sku_stick_soursop",
    formatId: "aforce_stick",
    flavor: "soursop",
    title: "Soursop Edge + Seamoss",
    formatLabel: "Hydration Sticks · 12 ct",
    servingsPerPack: 12,
    ozPerServing: 12,
    priceCents: 3499,
    upc: "850000000079",
    blurb: "Full-spectrum recovery. Maximum support.",
  },

  // RTD cans — $44.99 / 12-pack, $4.49 single
  {
    id: "sku_rtd_berry_12",
    formatId: "aforce_rtd",
    flavor: "berry",
    title: "Berry Blast RTD",
    formatLabel: "RTD Can · 12-pack (12 oz)",
    servingsPerPack: 12,
    ozPerServing: 12,
    priceCents: 4499,
    compareAtCents: 5388, // $4.49 × 12
    upc: "850000000017",
    blurb: "Field-grade ready-to-drink. Berry profile.",
  },
  {
    id: "sku_rtd_watermelon_12",
    formatId: "aforce_rtd",
    flavor: "watermelon",
    title: "Watermelon Surge RTD",
    formatLabel: "RTD Can · 12-pack (12 oz)",
    servingsPerPack: 12,
    ozPerServing: 12,
    priceCents: 4499,
    compareAtCents: 5388,
    upc: "850000000024",
    blurb: "Crush heat. Crack open and go.",
  },
  {
    id: "sku_rtd_soursop_12",
    formatId: "aforce_rtd",
    flavor: "soursop",
    title: "Soursop Edge RTD",
    formatLabel: "RTD Can · 12-pack (12 oz)",
    servingsPerPack: 12,
    ozPerServing: 12,
    priceCents: 4499,
    compareAtCents: 5388,
    upc: "850000000031",
    blurb: "Recovery in your hand. 12 oz can.",
  },

  // Canisters — $54.99 / 30 servings
  {
    id: "sku_can_berry",
    formatId: "aforce_canister",
    flavor: "berry",
    title: "Berry Blast Canister",
    formatLabel: "Canister · 30 servings",
    servingsPerPack: 30,
    ozPerServing: 18,
    priceCents: 5499,
    upc: "850000000086",
    blurb: "Daily protocol fuel. Best per-serving value.",
  },
  {
    id: "sku_can_watermelon",
    formatId: "aforce_canister",
    flavor: "watermelon",
    title: "Watermelon Surge Canister",
    formatLabel: "Canister · 30 servings",
    servingsPerPack: 30,
    ozPerServing: 18,
    priceCents: 5499,
    upc: "850000000093",
    blurb: "Daily protocol fuel. Heat-load tuned.",
  },
  {
    id: "sku_can_soursop",
    formatId: "aforce_canister",
    flavor: "soursop",
    title: "Soursop Edge Canister",
    formatLabel: "Canister · 30 servings",
    servingsPerPack: 30,
    ozPerServing: 18,
    priceCents: 5499,
    upc: "850000000109",
    blurb: "Daily protocol fuel. Full-spectrum minerals.",
  },

  // FIELD BAG — Soursop only today, $89.99 / 50 servings
  {
    id: "sku_bag_soursop",
    formatId: "aforce_bulk_bag",
    flavor: "soursop",
    title: "FIELD BAG · Soursop Edge",
    formatLabel: "Bulk Bag · 50 servings",
    servingsPerPack: 50,
    ozPerServing: 16,
    priceCents: 8999,
    upc: "850000000116",
    blurb: "Team / program format. $1.80 per serving.",
  },
];

export function findSku(id: string): StoreSKU | undefined {
  return STORE_SKUS.find((s) => s.id === id);
}

export function formatPrice(cents: number): string {
  const dollars = Math.floor(cents / 100);
  const remainder = cents % 100;
  return `$${dollars}.${remainder.toString().padStart(2, "0")}`;
}

export function pricePerServingCents(sku: StoreSKU): number {
  return Math.round(sku.priceCents / sku.servingsPerPack);
}
