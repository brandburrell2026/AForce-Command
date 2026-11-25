/**
 * Resolves a barcode (digits only) to the candidate the label engine uses, and
 * says whether the product has its own logging flow (AFORCE and the app's
 * loggable catalog products), in which case the Scan screen's existing result
 * flow takes over. Only the barcode digits or a catalog id are ever looked up;
 * recognised label text never reaches this module.
 */
import { recognize } from '../../services/productRecognitionService';
import type { ScannedProduct, ScanSource } from '../../types/scan';
import type { DrinkCategoryId } from '../../data/drinkCatalog';
import type { BarcodeCandidate } from './labelEvidence';

const KNOWN_CATEGORY: Partial<Record<ScannedProduct['category'], DrinkCategoryId>> = {
  plain_water: 'water',
  electrolyte_mix: 'electrolyte',
  medical_oral_rehydration: 'electrolyte',
  sports_drink: 'sports_drink',
};

export interface ResolvedBarcode {
  readonly candidate: BarcodeCandidate;
  /** Set when the product logs through its own flow; the screen's result card takes over. */
  readonly handOff: ScanSource | null;
}

/** The app's catalog is reliable. A public record is not, and its default category is a guess. */
export function candidateFromProduct(code: string, p: ScannedProduct | undefined): ResolvedBarcode {
  if (!p) return { candidate: { code, product: null }, handOff: null };
  const reliable = !p.productId.startsWith('off_');
  const category = reliable || p.category !== 'sports_drink' ? KNOWN_CATEGORY[p.category] ?? null : null;
  return {
    candidate: { code, product: { id: p.productId, name: p.productName, brand: p.brand, category, reliable } },
    handOff: reliable && p.fluidType ? { kind: 'barcode', rawValue: code } : null,
  };
}

export async function resolveBarcodeCandidate(code: string): Promise<ResolvedBarcode> {
  try {
    return candidateFromProduct(code, await recognize({ kind: 'barcode', rawValue: code }));
  } catch {
    return candidateFromProduct(code, undefined);
  }
}

/** A catalog product (by id) that logs through its own flow, or null. */
export async function loggableCatalogSource(productId: string): Promise<ScanSource | null> {
  try {
    const p = await recognize({ kind: 'aforce_product', rawValue: productId });
    return p?.fluidType ? { kind: 'aforce_product', rawValue: productId } : null;
  } catch {
    return null;
  }
}
