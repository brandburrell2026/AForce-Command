/* POST /api/cart/create  body: { lines: [{ merchandiseId, quantity, sellingPlanId? }] }
   First add-to-cart → cartCreate. Returns the cart (incl. checkoutUrl). */
"use strict";
const { storefront } = require("../_lib/shopify");
const { CART_CREATE } = require("../_lib/mutations");
const { blockedIfDisabled, json, readBody } = require("../_lib/guard");

module.exports = async (req, res) => {
  if (blockedIfDisabled(req, res)) return;
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
  const body = await readBody(req);
  const lines = Array.isArray(body.lines) ? body.lines : [];
  /* Sanitise attributes: Shopify expects [{key,value}] of strings. Reject
     anything else rather than forwarding unvalidated client input (§14). */
  const attributes = Array.isArray(body.attributes)
    ? body.attributes
        .filter((a) => a && typeof a.key === "string" && typeof a.value === "string")
        .slice(0, 20)
        .map((a) => ({ key: a.key.slice(0, 200), value: a.value.slice(0, 500) }))
    : undefined;
  try {
    const data = await storefront(CART_CREATE, { lines, attributes });
    const r = data.cartCreate || {};
    if (r.userErrors && r.userErrors.length) return json(res, 422, { error: r.userErrors[0].message });
    json(res, 200, { cart: r.cart });
  } catch (err) {
    json(res, err.status || 500, { error: err.message || "Failed to create cart" });
  }
};
