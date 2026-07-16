/* GET /api/shop/product?handle=... — PDP. Edge-cached 5 min. */
"use strict";
const { storefront } = require("../_lib/shopify");
const { PRODUCT_BY_HANDLE } = require("../_lib/queries");
const { blockedIfDisabled, json } = require("../_lib/guard");

module.exports = async (req, res) => {
  if (blockedIfDisabled(req, res)) return;
  const handle = (req.query && req.query.handle || "").trim();
  if (!handle) return json(res, 400, { error: "Missing handle" });
  try {
    const data = await storefront(PRODUCT_BY_HANDLE, { handle });
    if (!data.product) return json(res, 404, { error: "Product not found" });
    json(res, 200, { product: data.product }, 300);
  } catch (err) {
    json(res, err.status || 500, { error: err.message || "Failed to load product" });
  }
};
