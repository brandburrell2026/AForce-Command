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
  try {
    const data = await storefront(CART_CREATE, { lines });
    const r = data.cartCreate || {};
    if (r.userErrors && r.userErrors.length) return json(res, 422, { error: r.userErrors[0].message });
    json(res, 200, { cart: r.cart });
  } catch (err) {
    json(res, err.status || 500, { error: err.message || "Failed to create cart" });
  }
};
