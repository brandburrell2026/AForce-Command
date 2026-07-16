/* GET /api/shop/products — PLP product list. Edge-cached 5 min (spec §4.3). */
"use strict";
const { storefront } = require("../_lib/shopify");
const { PRODUCTS } = require("../_lib/queries");
const { blockedIfDisabled, json } = require("../_lib/guard");

module.exports = async (req, res) => {
  if (blockedIfDisabled(req, res)) return;
  try {
    const first = Math.min(50, Math.max(1, parseInt((req.query && req.query.first) || "24", 10) || 24));
    const data = await storefront(PRODUCTS, { first });
    json(res, 200, { products: (data.products && data.products.nodes) || [] }, 300);
  } catch (err) {
    json(res, err.status || 500, { error: err.message || "Failed to load products" });
  }
};
