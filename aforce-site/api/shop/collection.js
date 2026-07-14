/* GET /api/shop/collection?handle=launch-combos — combos section (spec §7).
   Collection handle defaults to the launch-combos constant but can be
   overridden per request; drive the PLP combos row from ONE collection so
   combos reorder/swap from Shopify admin without a deploy. Edge-cached 5 min. */
"use strict";
const { storefront } = require("../_lib/shopify");
const { COLLECTION_BY_HANDLE } = require("../_lib/queries");
const { blockedIfDisabled, json } = require("../_lib/guard");

// Single source of truth for the combos collection handle.
const DEFAULT_COMBOS_COLLECTION = "launch-combos";

module.exports = async (req, res) => {
  if (blockedIfDisabled(req, res)) return;
  const handle = ((req.query && req.query.handle) || DEFAULT_COMBOS_COLLECTION).trim();
  const first = Math.min(24, Math.max(1, parseInt((req.query && req.query.first) || "12", 10) || 12));
  try {
    const data = await storefront(COLLECTION_BY_HANDLE, { handle, first });
    const collection = data.collection;
    // Missing collection is not an error — the PLP simply hides the combos row.
    json(res, 200, {
      collection: collection ? { title: collection.title, products: collection.products.nodes } : null
    }, 300);
  } catch (err) {
    json(res, err.status || 500, { error: err.message || "Failed to load collection" });
  }
};
