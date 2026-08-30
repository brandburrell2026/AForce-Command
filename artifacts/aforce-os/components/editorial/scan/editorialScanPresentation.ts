/**
 * editorialScanPresentation — furniture for SCAN, The Tool (E6-B).
 *
 * Deliberately thin. Every VALUE on the Editorial Scan comes from the services
 * E6-B0 corrected — `hydrationScanService`, `comparisonEngine`, the provenance
 * system — reused rather than re-authored. This module adds no metric, no
 * threshold and no claim; it names things.
 *
 * FOUNDER PRODUCT LAW (2026-08-30): Scan is The Tool, not The Diagnostician.
 * The member must be able to tell OBSERVED from LOOKED UP from CALCULATED from
 * MEMBER STATE from CONTEXTUALIZED — without the screen becoming a technical
 * audit. That is what the vocabulary below is for.
 */
import type { AttributeProvenance } from '@/types/comparison';

/**
 * The five provenance classes, as the member reads them.
 *
 * These are the section eyebrows, not annotations on every value: the screen
 * groups by class so the distinction is structural. A reader never has to
 * decode a legend.
 */
export const CLASS_LABEL = {
  observed: 'READ FROM THE LABEL',
  lookedUp: 'ON FILE',
  calculated: 'CALCULATED',
  memberState: 'YOUR CURRENT STATE',
  contextualized: 'CONTEXTUALIZED',
} as const;

/**
 * Per-attribute evidence quality, in plain words (founder ruling D3).
 *
 * `verified` is reserved and currently unreachable — no catalog row has a
 * panel, COA or published label on file, AForce's own products included. The
 * label exists so the day a real source lands the vocabulary is already there,
 * never so an estimate can be dressed as a measurement.
 */
export const PROVENANCE_LABEL: Record<AttributeProvenance, string> = {
  verified: 'Verified',
  estimated: 'Estimated',
  unknown: 'Not on file',
};

/**
 * The posture that travels with PRODUCT MATCH (founder ruling D1).
 *
 * The match is a deterministic evaluation of product information against the
 * member's already-existing canonical context. It is NOT an intrinsic product
 * grade and NOT a measurement of the member — so the number never renders
 * alone. The law test pins that this qualifier accompanies it.
 */
export function matchQualifier(): string {
  return 'Contextualized for this Moment';
}

/**
 * How much of the comparison was actually backed by data.
 *
 * Returned as a sentence rather than a ratio glyph so a thin comparison reads
 * as thin. Null when everything was known — there is nothing to disclose, and
 * a "5 of 5" badge on every complete scan is noise.
 */
export function coverageNote(known: number, total: number): string | null {
  if (known >= total) return null;
  if (known === 0) return 'No product characteristics on file to compare.';
  return `Compared on ${known} of ${total} product characteristics.`;
}

/**
 * The scanned symbol, described honestly (founder ruling D2).
 *
 * The camera is a live barcode decoder: it takes no photograph, stores none
 * and transmits none. This is the only OBSERVED fact the screen has, and
 * naming the symbol is what keeps the viewfinder from reading as capture.
 */
export function observedLabel(kind: string): string {
  switch (kind) {
    case 'barcode':
      return 'Barcode read';
    case 'qr':
      return 'QR code read';
    case 'manual':
      return 'Entered by name';
    case 'aforce_product':
    case 'nfc':
      return 'Product code read';
    default:
      return 'Code read';
  }
}
