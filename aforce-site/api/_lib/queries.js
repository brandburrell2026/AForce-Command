/* =====================================================================
   Storefront GraphQL — read queries (PLP, PDP, collection/combos).
   sellingPlanGroups are read but NOT surfaced yet — the subscription
   toggle is Phase 3, gated on a verified selling-plan id (spec §6).
   ===================================================================== */
"use strict";

const PRODUCT_FIELDS = `
  id
  handle
  title
  description
  productType
  tags
  featuredImage { url altText width height }
  images(first: 6) { nodes { url altText width height } }
  priceRange { minVariantPrice { amount currencyCode } maxVariantPrice { amount currencyCode } }
  variants(first: 20) {
    nodes {
      id
      title
      availableForSale
      price { amount currencyCode }
      selectedOptions { name value }
    }
  }
`;

// PLP — list products (newest first). Combos come from COLLECTION query.
const PRODUCTS = `
  query Products($first: Int!) {
    products(first: $first, sortKey: BEST_SELLING) {
      nodes { ${PRODUCT_FIELDS} }
    }
  }
`;

// PDP — single product by handle.
const PRODUCT_BY_HANDLE = `
  query ProductByHandle($handle: String!) {
    product(handle: $handle) {
      ${PRODUCT_FIELDS}
      sellingPlanGroups(first: 5) { nodes { name } }
    }
  }
`;

// Combos — driven by a Shopify collection so combos can be reordered/
// swapped from admin without a deploy (spec §7). Handle via constant.
const COLLECTION_BY_HANDLE = `
  query CollectionByHandle($handle: String!, $first: Int!) {
    collection(handle: $handle) {
      id
      title
      products(first: $first) { nodes { ${PRODUCT_FIELDS} } }
    }
  }
`;

module.exports = { PRODUCTS, PRODUCT_BY_HANDLE, COLLECTION_BY_HANDLE };
