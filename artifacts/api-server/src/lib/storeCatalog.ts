/**
 * Server-side mirror of the consumer Store SKU catalog.
 *
 * Mirrors `artifacts/aforce-os/data/pricing.ts` so the api-server can
 * authoritatively price cart line items at checkout. The client is never
 * trusted to send unit prices — it sends only `{ skuId, qty }` and the
 * server resolves the price + display name from this map.
 *
 * If a SKU is added/removed/repriced on the client, mirror it here.
 * (TODO: graduate this to a shared workspace package once we have a
 * second consumer of the catalog on the server side.)
 */

export interface ServerSkuEntry {
  /** Stripe display name. Kept short for the line-item label. */
  name: string;
  /** Per-unit price in USD cents. Authoritative — never accept from client. */
  unitAmountCents: number;
}

export const STORE_CATALOG: Record<string, ServerSkuEntry> = {
  // Sticks — $34.99 / 12 ct
  sku_stick_berry:        { name: 'Berry Blast + Dulse · 12 ct',      unitAmountCents: 3499 },
  sku_stick_watermelon:   { name: 'Watermelon Surge + Chlorella · 12 ct', unitAmountCents: 3499 },
  sku_stick_soursop:      { name: 'Soursop Edge + Seamoss · 12 ct',   unitAmountCents: 3499 },

  // RTD cans — $47.99 / 12-pack
  sku_rtd_berry_12:       { name: 'Berry Blast RTD · 12-pack',        unitAmountCents: 4799 },
  sku_rtd_watermelon_12:  { name: 'Watermelon Surge RTD · 12-pack',   unitAmountCents: 4799 },
  sku_rtd_soursop_12:     { name: 'Soursop Edge RTD · 12-pack',       unitAmountCents: 4799 },

  // Canisters — $59.99 / 30 servings
  sku_can_berry:          { name: 'Berry Blast Canister · 30 srv',    unitAmountCents: 5999 },
  sku_can_watermelon:     { name: 'Watermelon Surge Canister · 30 srv', unitAmountCents: 5999 },
  sku_can_soursop:        { name: 'Soursop Edge Canister · 30 srv',   unitAmountCents: 5999 },

  // ─── Bundles (flavor-agnostic at the catalog level — flavor mix is
  // chosen at fulfillment by the customer's profile or split selector). ──
  bundle_stick_3:  { name: 'Hydration Sticks · 3-Pack Bundle',   unitAmountCents: 8999 },
  bundle_stick_6:  { name: 'Hydration Sticks · 6-Pack Bulk',     unitAmountCents: 16999 },
  bundle_rtd_24:   { name: 'RTD · 24-Pack Bundle',               unitAmountCents: 8999 },
  bundle_can_2:    { name: 'Canister · 2-Pack Bundle',           unitAmountCents: 10999 },
  bundle_can_3:    { name: 'Canister · 3-Pack Bundle',           unitAmountCents: 14999 },

  // FIELD BAG / bulk bag intentionally removed for now — re-add alongside
  // the matching client SKU in artifacts/aforce-os/data/pricing.ts.
};

/** Same rules the client uses in CartScreen. Keep in lockstep. */
export const SHIPPING_THRESHOLD_CENTS = 5000;
export const SHIPPING_FLAT_CENTS = 599;
export const TAX_RATE = 0.0875;

export interface CartLineInput {
  skuId: string;
  qty: number;
}

export interface PricedLine {
  skuId: string;
  name: string;
  unitAmountCents: number;
  qty: number;
  lineSubtotalCents: number;
}

export interface PricedCart {
  lines: PricedLine[];
  subtotalCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
}

/**
 * Validate + price a client-submitted cart. Throws on any malformed input or
 * unknown SKU. Returns a fully-priced cart whose totals exactly match what
 * the CartScreen displays (same shipping threshold, same tax rate).
 */
export function priceCart(rawLines: unknown): PricedCart {
  if (!Array.isArray(rawLines) || rawLines.length === 0) {
    throw new Error('items must be a non-empty array');
  }

  const seen = new Set<string>();
  const lines: PricedLine[] = [];

  for (const raw of rawLines) {
    if (!raw || typeof raw !== 'object') throw new Error('each item must be an object');
    const { skuId, qty } = raw as Partial<CartLineInput>;
    if (typeof skuId !== 'string' || skuId.length === 0) {
      throw new Error('skuId is required');
    }
    if (seen.has(skuId)) throw new Error(`duplicate skuId "${skuId}"`);
    seen.add(skuId);

    if (typeof qty !== 'number' || !Number.isInteger(qty) || qty < 1 || qty > 99) {
      throw new Error(`qty for "${skuId}" must be an integer 1..99`);
    }

    const entry = STORE_CATALOG[skuId];
    if (!entry) throw new Error(`unknown skuId "${skuId}"`);

    lines.push({
      skuId,
      name: entry.name,
      unitAmountCents: entry.unitAmountCents,
      qty,
      lineSubtotalCents: entry.unitAmountCents * qty,
    });
  }

  const subtotalCents = lines.reduce((s, l) => s + l.lineSubtotalCents, 0);
  const shippingCents =
    subtotalCents === 0 || subtotalCents >= SHIPPING_THRESHOLD_CENTS ? 0 : SHIPPING_FLAT_CENTS;
  const taxCents = Math.round(subtotalCents * TAX_RATE);
  const totalCents = subtotalCents + shippingCents + taxCents;

  return { lines, subtotalCents, shippingCents, taxCents, totalCents };
}
