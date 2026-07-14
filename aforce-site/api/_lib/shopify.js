/* =====================================================================
   AForce Headless — Storefront API client (server-side only)
   Thin, dependency-free GraphQL client (per spec §4.2). The Storefront
   token lives ONLY here, inside Vercel serverless functions — it is never
   sent to the browser. Product reads may be edge-cached; cart mutations
   never are (the calling function sets Cache-Control).
   ===================================================================== */
"use strict";

// Pin the Storefront API version in ONE place. Shopify versions sunset
// after ~12 months — calendar a quarterly review (spec §4.1).
const API_VERSION = "2026-07";

const STORE_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN || "";
const STOREFRONT_TOKEN = process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN || "";

function isConfigured() {
  return Boolean(STORE_DOMAIN && STOREFRONT_TOKEN);
}

/**
 * Execute a Storefront GraphQL query/mutation.
 * @param {string} query GraphQL document
 * @param {object} [variables]
 * @returns {Promise<object>} data
 * @throws Error with .status for non-200 / GraphQL errors
 */
async function storefront(query, variables) {
  if (!isConfigured()) {
    const e = new Error("Shopify Storefront API is not configured (missing SHOPIFY_STORE_DOMAIN / SHOPIFY_STOREFRONT_ACCESS_TOKEN).");
    e.status = 503;
    throw e;
  }
  const endpoint = `https://${STORE_DOMAIN}/api/${API_VERSION}/graphql.json`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": STOREFRONT_TOKEN,
      "Accept": "application/json"
    },
    body: JSON.stringify({ query, variables: variables || {} })
  });

  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch (_) { json = null; }

  if (!res.ok) {
    const e = new Error(`Storefront API HTTP ${res.status}`);
    e.status = res.status === 429 ? 429 : 502;
    throw e;
  }
  if (json && json.errors && json.errors.length) {
    const e = new Error(json.errors.map(x => x.message).join("; "));
    e.status = 502;
    throw e;
  }
  return (json && json.data) || {};
}

module.exports = { storefront, isConfigured, API_VERSION };
