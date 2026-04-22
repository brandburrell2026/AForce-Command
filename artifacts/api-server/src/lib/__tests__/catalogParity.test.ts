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
import { STORE_SKUS, STORE_BUNDLES } from '../../../../aforce-os/data/pricing';

/**
 * The client splits its catalog into two collections — atomic per-flavor
 * SKUs (STORE_SKUS) and flavor-agnostic bundles (STORE_BUNDLES). The
 * server flattens both into one priceable map, so parity is enforced
 * across the union of the two.
 */
describe('storeCatalog ↔ aforce-os/data/pricing parity', () => {
  const clientEntries: { id: string; priceCents: number }[] = [
    ...STORE_SKUS.map((s) => ({ id: s.id, priceCents: s.priceCents })),
    ...STORE_BUNDLES.map((b) => ({ id: b.id, priceCents: b.priceCents })),
  ];

  it('every client SKU/bundle exists on the server with the exact same price', () => {
    for (const entry of clientEntries) {
      const serverEntry = STORE_CATALOG[entry.id];
      expect(serverEntry, `client id "${entry.id}" is missing from STORE_CATALOG`).toBeDefined();
      expect(serverEntry!.unitAmountCents).toBe(entry.priceCents);
    }
  });

  it('every server entry exists on the client (no orphan server entries)', () => {
    const clientIds = new Set(clientEntries.map((e) => e.id));
    for (const id of Object.keys(STORE_CATALOG)) {
      expect(clientIds.has(id), `server entry "${id}" has no matching client SKU/bundle`).toBe(true);
    }
  });

  it('catalog sizes match', () => {
    expect(Object.keys(STORE_CATALOG)).toHaveLength(clientEntries.length);
  });
});
