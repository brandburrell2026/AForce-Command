#!/usr/bin/env node
/* =====================================================================
   ONE-OFF: fetch Shopify product / variant / selling-plan IDs for the
   shop builder's VARIANTS map. NOT shipped to the site (repo-root only).

   Reads credentials from the environment — NEVER hard-code them and this
   script NEVER prints the token or secret. Only product/variant/plan IDs
   (which are safe to share) are printed.

   Usage (credentials stay in YOUR shell — nothing is committed):
     SHOPIFY_CLIENT_ID=... SHOPIFY_CLIENT_SECRET=... \
       node scripts/fetch-shopify-ids.mjs

   If your app exposes a fixed Admin API token instead of a
   client-credentials grant, run:
     SHOPIFY_ADMIN_TOKEN=shpat_... node scripts/fetch-shopify-ids.mjs

   Requires Node 18+ (global fetch).
   ===================================================================== */

const STORE = process.env.SHOPIFY_STORE || "aforce-v2.myshopify.com";
const API_VERSION = "2026-07";

/* gid://shopify/ProductVariant/123456 -> "123456" (for cart permalinks) */
const numericId = (gid) => String(gid || "").split("/").pop();

async function getToken() {
  if (process.env.SHOPIFY_ADMIN_TOKEN) return process.env.SHOPIFY_ADMIN_TOKEN;

  const client_id = process.env.SHOPIFY_CLIENT_ID;
  const client_secret = process.env.SHOPIFY_CLIENT_SECRET;
  if (!client_id || !client_secret) {
    console.error(
      "Missing credentials. Set SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET " +
      "(or SHOPIFY_ADMIN_TOKEN) in your environment."
    );
    process.exit(1);
  }

  // OAuth client-credentials grant.
  const res = await fetch(`https://${STORE}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ grant_type: "client_credentials", client_id, client_secret }),
  });
  if (!res.ok) {
    console.error(`Token exchange failed: ${res.status} ${res.statusText}`);
    console.error(
      "If the app uses a fixed Admin API token rather than a client-credentials " +
      "grant, re-run with SHOPIFY_ADMIN_TOKEN=shpat_... instead."
    );
    process.exit(1);
  }
  const json = await res.json();
  if (!json.access_token) {
    console.error("No access_token in the grant response.");
    process.exit(1);
  }
  return json.access_token; // held only in memory; never printed
}

async function gql(token, query) {
  const res = await fetch(`https://${STORE}/admin/api/${API_VERSION}/graphql.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
    body: JSON.stringify({ query }),
  });
  const json = await res.json();
  if (json.errors) {
    console.error("GraphQL errors:", JSON.stringify(json.errors, null, 2));
    process.exit(1);
  }
  return json.data;
}

const PRODUCTS_Q = `
{
  products(first: 100) {
    nodes {
      handle
      title
      variants(first: 100) {
        nodes {
          id
          title
          price
          selectedOptions { name value }
        }
      }
    }
  }
}`;

const PLANS_Q = `
{
  sellingPlanGroups(first: 50) {
    nodes {
      name
      sellingPlans(first: 50) {
        nodes { id name }
      }
    }
  }
}`;

(async () => {
  const token = await getToken();

  const products = (await gql(token, PRODUCTS_Q)).products.nodes;
  const groups = (await gql(token, PLANS_Q)).sellingPlanGroups.nodes;

  console.log("\n=== PRODUCTS / VARIANTS (numeric variant IDs for permalinks) ===");
  for (const p of products) {
    console.log(`\n# ${p.title}  (${p.handle})`);
    for (const v of p.variants.nodes) {
      const opts = v.selectedOptions.map((o) => `${o.name}=${o.value}`).join(" · ");
      console.log(`  ${numericId(v.id).padEnd(16)}  $${v.price}  ${opts}`);
    }
  }

  console.log("\n=== SELLING PLAN GROUPS ===");
  if (!groups.length) console.log("  (none)");
  for (const g of groups) {
    for (const sp of g.sellingPlans.nodes) {
      console.log(`  group="${g.name}"  plan="${sp.name}"  id=${numericId(sp.id)}`);
    }
  }

  console.log("\nDone. No token/secret was printed. Paste the tables above back to wire VARIANTS.");
})().catch((e) => {
  console.error("Unexpected error:", e && e.message ? e.message : e);
  process.exit(1);
});
