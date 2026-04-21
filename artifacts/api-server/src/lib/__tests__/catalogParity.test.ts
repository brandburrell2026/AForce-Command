/**
 * Catalog parity guard.
 *
 * The server keeps its own copy of the consumer SKU catalog so it can
 * authoritatively price carts. Whenever the client catalog
 * (artifacts/aforce-os/data/pricing.ts) changes, this test guarantees the
 * server mirror is updated to match — otherwise checkout totals would
 * silently disagree with what the user saw on the cart screen.
 */

import { describe, it, expect } from 'vitest';
import { STORE_CATALOG } from '../storeCatalog';
import { STORE_SKUS } from '../../../../aforce-os/data/pricing';

describe('storeCatalog ↔ aforce-os/data/pricing parity', () => {
  it('every client SKU exists on the server with the exact same price', () => {
    for (const sku of STORE_SKUS) {
      const serverEntry = STORE_CATALOG[sku.id];
      expect(serverEntry, `client SKU "${sku.id}" is missing from STORE_CATALOG`).toBeDefined();
      expect(serverEntry!.unitAmountCents).toBe(sku.priceCents);
    }
  });

  it('every server SKU exists on the client (no orphan server entries)', () => {
    const clientIds = new Set(STORE_SKUS.map((s) => s.id));
    for (const id of Object.keys(STORE_CATALOG)) {
      expect(clientIds.has(id), `server SKU "${id}" has no matching client SKU`).toBe(true);
    }
  });

  it('catalog sizes match', () => {
    expect(Object.keys(STORE_CATALOG)).toHaveLength(STORE_SKUS.length);
  });
});
