/* =====================================================================
   Storefront GraphQL — Cart API (spec §5). NOT the deprecated Checkout API.
   cartCreate / cartLinesAdd / cartLinesUpdate / cartLinesRemove + a read
   query to hydrate the drawer from the aforce_cart_id cookie.
   ===================================================================== */
"use strict";

const CART_FIELDS = `
  id
  checkoutUrl
  totalQuantity
  cost {
    subtotalAmount { amount currencyCode }
    totalAmount { amount currencyCode }
  }
  lines(first: 50) {
    nodes {
      id
      quantity
      cost { totalAmount { amount currencyCode } }
      merchandise {
        ... on ProductVariant {
          id
          title
          availableForSale
          image { url altText }
          price { amount currencyCode }
          product { title handle }
          selectedOptions { name value }
        }
      }
      sellingPlanAllocation { sellingPlan { id name } }
    }
  }
`;

const CART_QUERY = `
  query Cart($id: ID!) {
    cart(id: $id) { ${CART_FIELDS} }
  }
`;

/* $attributes carries the order context the Ritual Builder already sent on the
   cart permalink (Protocol / Formulation / Depth / Plan). Without it, moving
   the subscription path off permalinks would silently drop that data from the
   order. Optional — omitting it is valid. */
const CART_CREATE = `
  mutation CartCreate($lines: [CartLineInput!], $attributes: [AttributeInput!]) {
    cartCreate(input: { lines: $lines, attributes: $attributes }) {
      cart { ${CART_FIELDS} }
      userErrors { field message }
    }
  }
`;

const CART_LINES_ADD = `
  mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
    cartLinesAdd(cartId: $cartId, lines: $lines) {
      cart { ${CART_FIELDS} }
      userErrors { field message }
    }
  }
`;

const CART_LINES_UPDATE = `
  mutation CartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
    cartLinesUpdate(cartId: $cartId, lines: $lines) {
      cart { ${CART_FIELDS} }
      userErrors { field message }
    }
  }
`;

const CART_LINES_REMOVE = `
  mutation CartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
    cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
      cart { ${CART_FIELDS} }
      userErrors { field message }
    }
  }
`;

module.exports = { CART_QUERY, CART_CREATE, CART_LINES_ADD, CART_LINES_UPDATE, CART_LINES_REMOVE };
