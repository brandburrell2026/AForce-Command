/* GET /api/cart/get?id=...  — hydrate the drawer from the aforce_cart_id cookie.
   Shopify carts expire (~10 days idle); a null cart tells the client to clear
   the cookie and start fresh (spec §5.1). Never cached. */
"use strict";
const { storefront } = require("../_lib/shopify");
const { CART_QUERY } = require("../_lib/mutations");
const { blockedIfDisabled, json } = require("../_lib/guard");

module.exports = async (req, res) => {
  if (blockedIfDisabled(req, res)) return;
  const id = (req.query && req.query.id || "").trim();
  if (!id) return json(res, 400, { error: "Missing cart id" });
  try {
    const data = await storefront(CART_QUERY, { id });
    json(res, 200, { cart: data.cart || null }); // null => expired/completed
  } catch (err) {
    json(res, err.status || 500, { error: err.message || "Failed to load cart" });
  }
};
