/**
 * Product Recognition Service.
 *
 * Maps a raw scan payload (barcode digits, QR string, AForce slug)
 * back to a CompareProduct in the database. Returns ScannedProduct shape
 * so the UI never has to know about the raw catalog.
 *
 * The catalog is augmented with mock barcode + QR mappings here (rather
 * than baked into the catalog file) so that the comparison engine stays
 * physiology-only and isn't polluted with retail metadata.
 */

import { COMPARE_PRODUCTS } from '../data/productDatabase';
import type { CompareProduct } from '../types/comparison';
import type { ScannedProduct, ScanSource } from '../types/scan';
import type { FluidType } from '../types';
import { lookupBarcode } from './openFoodFactsService';

/** UPC / EAN / GS1 barcode → product id. */
const BARCODE_INDEX: Record<string, string> = {
  // AForce
  '850000000017': 'aforce_stick',
  '850000000024': 'aforce_rtd',
  '850000000031': 'aforce_canister',
  '850000000048': 'aforce_bulk_bag',
  '850000000055': 'aforce_berry_blast',
  '850000000062': 'aforce_watermelon_surge',
  '850000000079': 'aforce_soursop_edge',
  // Flavor × format SKU matrix
  '850000000086': 'aforce_sku_berry_stick',
  '850000000093': 'aforce_sku_watermelon_stick',
  '850000000109': 'aforce_sku_soursop_stick',
  '850000000116': 'aforce_sku_berry_rtd',
  '850000000123': 'aforce_sku_watermelon_rtd',
  '850000000130': 'aforce_sku_soursop_rtd',
  '850000000147': 'aforce_sku_berry_canister',
  '850000000154': 'aforce_sku_watermelon_canister',
  '850000000161': 'aforce_sku_soursop_canister',
  // Competitors
  '052000338874': 'gatorade',
  '850000111234': 'liquid_iv',
  '300875116111': 'pedialyte',
  '850000999333': 'lmnt',
  '857335003001': 'prime',
  '000000000000': 'water',
};

/** QR payload prefixes (AForce structured payload: "aforce://product/<id>"). */
const QR_PREFIX = 'aforce://product/';

/** AForce product slug → product id. */
const SLUG_INDEX: Record<string, string> = {
  stick: 'aforce_stick',
  rtd: 'aforce_rtd',
  canister: 'aforce_canister',
  bulk: 'aforce_bulk_bag',
  field_bag: 'aforce_bulk_bag',
  berry: 'aforce_berry_blast',
  berry_blast: 'aforce_berry_blast',
  watermelon: 'aforce_watermelon_surge',
  watermelon_surge: 'aforce_watermelon_surge',
  soursop: 'aforce_soursop_edge',
  soursop_edge: 'aforce_soursop_edge',
};

/** Mapping from CompareProduct id → loggable FluidType (when applicable). */
const PRODUCT_TO_FLUID: Record<string, FluidType> = {
  aforce_stick: 'aforce_stick',
  aforce_rtd: 'aforce_rtd',
  aforce_canister: 'aforce_canister',
  aforce_bulk_bag: 'aforce_bulk_bag',
  // Flavored 12-stick bags log as sticks for hydration tracking.
  aforce_berry_blast: 'aforce_stick',
  aforce_watermelon_surge: 'aforce_stick',
  aforce_soursop_edge: 'aforce_stick',
  // Flavor × format SKUs log against their physical format's FluidType.
  aforce_sku_berry_stick: 'aforce_stick',
  aforce_sku_watermelon_stick: 'aforce_stick',
  aforce_sku_soursop_stick: 'aforce_stick',
  aforce_sku_berry_rtd: 'aforce_rtd',
  aforce_sku_watermelon_rtd: 'aforce_rtd',
  aforce_sku_soursop_rtd: 'aforce_rtd',
  aforce_sku_berry_canister: 'aforce_canister',
  aforce_sku_watermelon_canister: 'aforce_canister',
  aforce_sku_soursop_canister: 'aforce_canister',
  water: 'water',
};

/**
 * Curated AForce shelf-SKU list for the Preview Scan tray's
 * "AForce Products" tab and the picker dropdown. Order = how chips
 * render (grouped by format: Stick → RTD → Canister).
 */
export const AFORCE_SHELF_SKUS: readonly string[] = [
  'aforce_sku_berry_stick',
  'aforce_sku_watermelon_stick',
  'aforce_sku_soursop_stick',
  'aforce_sku_berry_rtd',
  'aforce_sku_watermelon_rtd',
  'aforce_sku_soursop_rtd',
  'aforce_sku_berry_canister',
  'aforce_sku_watermelon_canister',
  'aforce_sku_soursop_canister',
];

function fromCatalog(productId: string): CompareProduct | undefined {
  return COMPARE_PRODUCTS.find((p) => p.id === productId);
}

function toScanned(product: CompareProduct): ScannedProduct {
  return {
    productId: product.id,
    productName: product.name,
    brand: product.brand,
    category: product.category,
    hydrationSpeed: product.hydrationSpeed,
    electrolyteDensity: product.electrolytes,
    sugarLevel: product.sugar,
    stimulantLevel: 0,
    recoveryFit: product.recoveryEfficiency,
    performanceFit: Math.round((product.hydrationSpeed + product.absorptionRate) / 2),
    isAForce: product.isAForce,
    fluidType: PRODUCT_TO_FLUID[product.id],
  };
}

/**
 * Resolve from a ScanSource. Returns undefined when nothing matches.
 *
 * Async because barcode + manual paths now fall back to the Open Food
 * Facts catalog when the local index misses, so the scanner can handle
 * any US beverage barcode (not just our curated list).
 */
export async function recognize(source: ScanSource): Promise<ScannedProduct | undefined> {
  const raw = (source.rawValue || '').trim();
  if (!raw) return undefined;

  // Direct AForce slug
  if (source.kind === 'aforce_product') {
    const productId = SLUG_INDEX[raw.toLowerCase()] ?? raw.toLowerCase();
    const p = fromCatalog(productId);
    return p ? toScanned(p) : undefined;
  }

  // QR
  if (source.kind === 'qr') {
    if (raw.startsWith(QR_PREFIX)) {
      const productId = raw.slice(QR_PREFIX.length);
      const p = fromCatalog(productId);
      return p ? toScanned(p) : undefined;
    }
    return undefined;
  }

  // Barcode — local catalog first (fast path), then Open Food Facts
  // for any unknown US beverage SKU.
  if (source.kind === 'barcode') {
    const productId = BARCODE_INDEX[raw];
    if (productId) {
      const p = fromCatalog(productId);
      if (p) return toScanned(p);
    }
    return await lookupBarcode(raw);
  }

  // Manual — local name match first, otherwise treat numeric input as
  // a barcode and pass to OFF (covers users typing in a UPC by hand).
  if (source.kind === 'manual') {
    const lowered = raw.toLowerCase();
    const p = COMPARE_PRODUCTS.find((it) =>
      it.name.toLowerCase().includes(lowered) ||
      it.brand.toLowerCase().includes(lowered)
    );
    if (p) return toScanned(p);
    if (/^[0-9]{6,14}$/.test(raw)) {
      return await lookupBarcode(raw);
    }
    return undefined;
  }

  // NFC — reserved. Treat payload as a slug for forward compatibility.
  if (source.kind === 'nfc') {
    const productId = SLUG_INDEX[raw.toLowerCase()] ?? raw.toLowerCase();
    const p = fromCatalog(productId);
    return p ? toScanned(p) : undefined;
  }

  return undefined;
}

/** All barcodes the demo can simulate (used by mock scan tray). */
export function listSimulatableBarcodes(): { code: string; productId: string; label: string }[] {
  return Object.entries(BARCODE_INDEX).map(([code, productId]) => {
    const p = fromCatalog(productId);
    return { code, productId, label: p?.name ?? productId };
  });
}
