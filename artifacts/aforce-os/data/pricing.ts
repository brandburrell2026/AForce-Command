/**
 * AForce Shopping Store — pricing catalog.
 *
 * One SKU per (format × flavor) combination plus per-format bundle and
 * subscription pricing. The store renders three layers off this catalog:
 *
 *   1. Per-SKU one-time price
 *   2. Per-SKU subscription price (bold, the saving vs one-time is shown)
 *   3. Per-format bundle quantities (3-pack sticks, 24-pack RTD, etc.)
 *
 * Each SKU also carries lightweight product intelligence (use case +
 * protocol role + the performance state it's recommended for) so the
 * store can show "Recommended for RECOVERING" tags and be more than a
 * commodity grid.
 *
 * All prices are USD cents (integer math) — formatted via formatPrice().
 */

import type { FluidType, ProductFlavor, PerformanceLevel } from "../types";

export type StoreFormatId = Extract<
  FluidType,
  "aforce_stick" | "aforce_rtd" | "aforce_canister" | "aforce_bulk_bag"
>;

/** Coarse marketing category — drives the "USE CASE" tag on each card. */
export type ProductUseCase = "Daily" | "Recovery" | "Heat" | "Field";

/** What this product *does* in the protocol. Renders as "Protocol Role". */
export type ProductProtocolRole =
  | "baseline_hydration"   // sticks — daily mineral baseline
  | "field_grade_hydration"// RTD — grab-and-go, on-deck
  | "daily_protocol_fuel"  // canister — programmed daily
  | "team_bulk";           // bulk bag (not in store today)

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
  /** Price in USD cents (one-time). */
  priceCents: number;
  /** Subscription unit price in USD cents (Subscribe & Save). */
  subscriptionPriceCents: number;
  /** Optional MSRP / strike-through, in cents. */
  compareAtCents?: number;
  /** UPC, for traceability and barcode reuse. */
  upc?: string;
  /** Short marketing line. */
  blurb: string;

  // ─── Product intelligence ──────────────────────────────────────────────
  useCase: ProductUseCase;
  protocolRole: ProductProtocolRole;
  /** Performance states this SKU is the recommended tool for. */
  recommendedFor: PerformanceLevel[];
  /** Optional emphasis chip ("Best Value", "Most Popular", etc). */
  badge?: "Best Value" | "Most Popular" | "Performance Bundle";
}

/**
 * Per-format bulk bundles. Each bundle multiplies a base SKU N×, charges
 * a flat lower price, and exposes the implied savings vs buying singles.
 * Bundles are flavor-agnostic — at checkout the user picks a flavor split.
 */
export interface StoreBundle {
  id: string;
  formatId: StoreFormatId;
  /** "3-pack", "6-pack", "24-pack", "2-pack", "3-pack". */
  label: string;
  /** How many of the base SKU this bundle equals. */
  multiplier: number;
  /** Flat bundle price in cents. */
  priceCents: number;
  /** Optional emphasis. */
  badge?: "Best Value" | "Bulk";
}

// ─── Catalog ────────────────────────────────────────────────────────────────
// Base prices (single packs):
//   Sticks    — $34.99 / 12 ct      sub $29.99
//   RTD 12pk  — $47.99               sub $39.99
//   Canister  — $59.99 / 30 srv      sub $49.99
export const STORE_SKUS: StoreSKU[] = [
  // ─── Sticks ─────────────────────────────────────────────────────────────
  {
    id: "sku_stick_berry",
    formatId: "aforce_stick",
    flavor: "berry",
    title: "Berry Blast + Dulse",
    formatLabel: "Hydration Sticks · 12 ct",
    servingsPerPack: 12,
    ozPerServing: 12,
    priceCents: 3499,
    subscriptionPriceCents: 2999,
    upc: "850000000055",
    blurb: "Antioxidant push. Mineral-dense recovery.",
    useCase: "Recovery",
    protocolRole: "baseline_hydration",
    recommendedFor: ["RECOVERING"],
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
    subscriptionPriceCents: 2999,
    upc: "850000000062",
    blurb: "Heat absorption. Detox and clean output.",
    useCase: "Heat",
    protocolRole: "baseline_hydration",
    recommendedFor: ["BALANCED", "PEAK"],
    badge: "Most Popular",
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
    subscriptionPriceCents: 2999,
    upc: "850000000079",
    blurb: "Full-spectrum recovery. Maximum support.",
    useCase: "Recovery",
    protocolRole: "baseline_hydration",
    recommendedFor: ["DEPLETED"],
  },

  // ─── RTD cans ──────────────────────────────────────────────────────────
  {
    id: "sku_rtd_berry_12",
    formatId: "aforce_rtd",
    flavor: "berry",
    title: "Berry Blast RTD",
    formatLabel: "RTD Can · 12-pack (12 oz)",
    servingsPerPack: 12,
    ozPerServing: 12,
    priceCents: 4799,
    subscriptionPriceCents: 3999,
    compareAtCents: 5388, // $4.49 × 12
    upc: "850000000017",
    blurb: "Field-grade ready-to-drink. Berry profile.",
    useCase: "Recovery",
    protocolRole: "field_grade_hydration",
    recommendedFor: ["RECOVERING"],
  },
  {
    id: "sku_rtd_watermelon_12",
    formatId: "aforce_rtd",
    flavor: "watermelon",
    title: "Watermelon Surge RTD",
    formatLabel: "RTD Can · 12-pack (12 oz)",
    servingsPerPack: 12,
    ozPerServing: 12,
    priceCents: 4799,
    subscriptionPriceCents: 3999,
    compareAtCents: 5388,
    upc: "850000000024",
    blurb: "Crush heat. Crack open and go.",
    useCase: "Heat",
    protocolRole: "field_grade_hydration",
    recommendedFor: ["BALANCED", "PEAK"],
    badge: "Most Popular",
  },
  {
    id: "sku_rtd_soursop_12",
    formatId: "aforce_rtd",
    flavor: "soursop",
    title: "Soursop Edge RTD",
    formatLabel: "RTD Can · 12-pack (12 oz)",
    servingsPerPack: 12,
    ozPerServing: 12,
    priceCents: 4799,
    subscriptionPriceCents: 3999,
    compareAtCents: 5388,
    upc: "850000000031",
    blurb: "Recovery in your hand. 12 oz can.",
    useCase: "Recovery",
    protocolRole: "field_grade_hydration",
    recommendedFor: ["DEPLETED"],
  },

  // ─── Canisters — best-per-serving value ────────────────────────────────
  {
    id: "sku_can_berry",
    formatId: "aforce_canister",
    flavor: "berry",
    title: "Berry Blast Canister",
    formatLabel: "Canister · 30 servings",
    servingsPerPack: 30,
    ozPerServing: 18,
    priceCents: 5999,
    subscriptionPriceCents: 4999,
    upc: "850000000086",
    blurb: "Daily protocol fuel. Best per-serving value.",
    useCase: "Daily",
    protocolRole: "daily_protocol_fuel",
    recommendedFor: ["RECOVERING"],
    badge: "Best Value",
  },
  {
    id: "sku_can_watermelon",
    formatId: "aforce_canister",
    flavor: "watermelon",
    title: "Watermelon Surge Canister",
    formatLabel: "Canister · 30 servings",
    servingsPerPack: 30,
    ozPerServing: 18,
    priceCents: 5999,
    subscriptionPriceCents: 4999,
    upc: "850000000093",
    blurb: "Daily protocol fuel. Heat-load tuned.",
    useCase: "Daily",
    protocolRole: "daily_protocol_fuel",
    recommendedFor: ["BALANCED", "PEAK"],
    badge: "Best Value",
  },
  {
    id: "sku_can_soursop",
    formatId: "aforce_canister",
    flavor: "soursop",
    title: "Soursop Edge Canister",
    formatLabel: "Canister · 30 servings",
    servingsPerPack: 30,
    ozPerServing: 18,
    priceCents: 5999,
    subscriptionPriceCents: 4999,
    upc: "850000000109",
    blurb: "Daily protocol fuel. Full-spectrum minerals.",
    useCase: "Daily",
    protocolRole: "daily_protocol_fuel",
    recommendedFor: ["DEPLETED"],
    badge: "Best Value",
  },
];

// ─── Bundles ────────────────────────────────────────────────────────────────
export const STORE_BUNDLES: StoreBundle[] = [
  // Sticks
  {
    id: "bundle_stick_3",
    formatId: "aforce_stick",
    label: "3-Pack Bundle",
    multiplier: 3,
    priceCents: 8999, // vs 3 × 3499 = 10497  → save $14.98
  },
  {
    id: "bundle_stick_6",
    formatId: "aforce_stick",
    label: "6-Pack Bulk",
    multiplier: 6,
    priceCents: 16999, // vs 6 × 3499 = 20994 → save $39.95
    badge: "Best Value",
  },
  // RTD
  {
    id: "bundle_rtd_24",
    formatId: "aforce_rtd",
    label: "24-Pack",
    multiplier: 2,    // two 12-packs
    priceCents: 8999, // vs 2 × 4799 = 9598   → save $5.99
    badge: "Bulk",
  },
  // Canisters
  {
    id: "bundle_can_2",
    formatId: "aforce_canister",
    label: "2-Pack",
    multiplier: 2,
    priceCents: 10999, // vs 2 × 5999 = 11998 → save $9.99
  },
  {
    id: "bundle_can_3",
    formatId: "aforce_canister",
    label: "3-Pack",
    multiplier: 3,
    priceCents: 14999, // vs 3 × 5999 = 17997 → save $29.98
    badge: "Best Value",
  },
];

export function findSku(id: string): StoreSKU | undefined {
  return STORE_SKUS.find((s) => s.id === id);
}

export function findBundle(id: string): StoreBundle | undefined {
  return STORE_BUNDLES.find((b) => b.id === id);
}

export function bundlesForFormat(formatId: StoreFormatId): StoreBundle[] {
  return STORE_BUNDLES.filter((b) => b.formatId === formatId);
}

export function formatPrice(cents: number): string {
  const dollars = Math.floor(cents / 100);
  const remainder = cents % 100;
  return `$${dollars}.${remainder.toString().padStart(2, "0")}`;
}

export function pricePerServingCents(sku: StoreSKU): number {
  return Math.round(sku.priceCents / sku.servingsPerPack);
}
