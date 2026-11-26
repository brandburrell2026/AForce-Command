/**
 * AFORCE packaging facts the HydroScan label reader needs, per SKU and format.
 *
 * Every value here must be copied from the APPROVED PACKAGING by the founders.
 * Nothing is filled in from the placeholder numbers elsewhere in the repo
 * (`BARCODE_INDEX`, `data/pricing.ts` use `85000000xxxx` sequences that are
 * not registered UPCs, and the two tables disagree).
 *
 * A product is VERIFIED only when all three fields are present. Until then the
 * reader marks an AFORCE match "unverified" and the benchmark may not count it.
 */

export type PackagingField = 'unitUpc' | 'netContents' | 'frontLabelText';

export interface AforcePackaging {
  /** Store SKU id in `data/pricing.ts`, when one exists. */
  readonly skuId: string | null;
  /** Catalog id in `data/productDatabase.ts` the reader resolves to. */
  readonly catalogId: string;
  readonly name: string;
  readonly format: 'stick' | 'rtd' | 'canister' | 'bulk';
  /** UPC/GTIN printed on the single unit a member holds (one can, one stick carton, one canister). */
  readonly unitUpc: string | null;
  /** Exact net contents as printed: fl oz (and mL) for a can; net weight for powder. */
  readonly netContents: string | null;
  /** Exact front-label text as printed, line by line. */
  readonly frontLabelText: string | null;
}

const row = (
  skuId: string | null,
  catalogId: string,
  name: string,
  format: AforcePackaging['format'],
  unitUpc: string | null = null,
): AforcePackaging => ({
  skuId,
  catalogId,
  name,
  format,
  unitUpc,
  netContents: null,
  frontLabelText: null,
});

/**
 * Unit UPCs supplied by the founder on 2026-11-25: the 20-count stick carton
 * and the single can for each flavor. Canisters and the FIELD BAG have none
 * yet. Net contents and front-label text are still missing for every row, so
 * nothing here is verified.
 */
export const AFORCE_PACKAGING: readonly AforcePackaging[] = [
  row('sku_stick_berry', 'aforce_sku_berry_stick', 'Berry Blast + Dulse · Hydration Sticks', 'stick', '860014045011'),
  row('sku_stick_watermelon', 'aforce_sku_watermelon_stick', 'Watermelon + Chlorella · Hydration Sticks', 'stick', '860014380716'),
  row('sku_stick_soursop', 'aforce_sku_soursop_stick', 'Soursop + Seamoss · Hydration Sticks', 'stick', '860014045028'),
  row('sku_rtd_berry_12', 'aforce_sku_berry_rtd', 'Berry Blast + Dulse · RTD can', 'rtd', '860014380709'),
  row('sku_rtd_watermelon_12', 'aforce_sku_watermelon_rtd', 'Watermelon + Chlorella · RTD can', 'rtd', '860014045004'),
  row('sku_rtd_soursop_12', 'aforce_sku_soursop_rtd', 'Soursop + Seamoss · RTD can', 'rtd', '860014045042'),
  row('sku_can_berry', 'aforce_sku_berry_canister', 'Berry Blast + Dulse · Canister', 'canister'),
  row('sku_can_watermelon', 'aforce_sku_watermelon_canister', 'Watermelon + Chlorella · Canister', 'canister'),
  row('sku_can_soursop', 'aforce_sku_soursop_canister', 'Soursop + Seamoss · Canister', 'canister'),
  row(null, 'aforce_bulk_bag', 'FIELD BAG', 'bulk'),
];

const FIELDS: readonly PackagingField[] = ['unitUpc', 'netContents', 'frontLabelText'];

export interface PackagingStatus {
  readonly verified: boolean;
  readonly missing: readonly PackagingField[];
}

/**
 * Status for an AFORCE catalog id. An id with no row here (the generic format
 * and flavor rows) is unverified with every field missing: it is not a package
 * a member can hold.
 */
export function aforcePackagingStatus(catalogId: string): PackagingStatus {
  const found = AFORCE_PACKAGING.find((p) => p.catalogId === catalogId);
  if (!found) return { verified: false, missing: FIELDS };
  const missing = FIELDS.filter((f) => !found[f] || !found[f]!.trim());
  return { verified: missing.length === 0, missing };
}
