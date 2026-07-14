/* POST /api/cart/remove  body: { cartId, lineIds: [id] } */
"use strict";
const { storefront } = require("../_lib/shopify");
const { CART_LINES_REMOVE } = require("../_lib/mutations");
const { blockedIfDisabled, json, readBody } = require("../_lib/guard");

module.exports = async (req, res) => {
  if (blockedIfDisabled(req, res)) return;
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
  const body = await readBody(req);
  if (!body.cartId) return json(res, 400, { error: "Missing cartId" });
  const lineIds = Array.isArray(body.lineIds) ? body.lineIds : [];
  try {
    const data = await storefront(CART_LINES_REMOVE, { cartId: body.cartId, lineIds });
    const r = data.cartLinesRemove || {};
    if (r.userErrors && r.userErrors.length) return json(res, 422, { error: r.userErrors[0].message });
    json(res, 200, { cart: r.cart });
  } catch (err) {
    json(res, err.status || 500, { error: err.message || "Failed to remove from cart" });
  }
};
