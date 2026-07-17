/* =====================================================================
   AFORCE COMMERCE ADAPTER  (brief §12 — the Shopify boundary)

   ONE documented seam between the AFORCE storefront and the commerce
   engine. The UI asks for business operations ("create a cart", "give me
   the checkout URL"); it never constructs Shopify URLs itself. Shopify
   satisfies those operations today; a future AFORCE backend can replace
   the implementation below without touching the Shop UI.

   SECURITY (§14)
   - Calls same-origin /api/cart/* only. No Shopify token ever reaches the
     browser; the Storefront token lives server-side in the Vercel
     functions (aforce-site/api/_lib/shopify.js).
   - Every checkout destination is validated against an allowlist before
     navigation, so a tampered/unexpected URL cannot become an open
     redirect.

   WHY THIS EXISTS — the subscription defect it fixes (§11)
   The Shop previously checked out via a cart permalink:
       /cart/{variantId}:{qty}?selling_plan={planId}
   Shopify's own documentation ("Create cart permalinks" → Limitations)
   states verbatim: "Selling plans don't work with cart permalinks".
   The parameter is ignored, so AutoPilot silently arrived at checkout as a
   ONE-TIME order while the customer was shown "per month" and "cancel
   anytime". docs/AFORCE_SHOP_BACKEND_SPEC.md §M.1 chose permalinks because
   "Static on Vercel, so /cart/add.js cannot run" — that constraint no
   longer holds now that aforce-site/api/cart/* exists as serverless
   functions.

   A subscription is therefore created with the supported Storefront Cart
   API (cartCreate + sellingPlanId), and we REFUSE to hand off unless the
   returned cart proves the plan was actually applied.
   ===================================================================== */
(function (root) {
  "use strict";

  /* Hosts we will navigate a customer to. Anything else is refused. */
  var ALLOWED_CHECKOUT_HOSTS = [
    "shop.drinkaforce.com",
    "aforce-v2.myshopify.com",
    "checkout.shopify.com"
  ];

  var STORE_ORIGIN = "https://shop.drinkaforce.com";

  /* Shopify GIDs. Kept HERE, not in the UI — the UI knows numeric ids only. */
  function variantGID(numericId) { return "gid://shopify/ProductVariant/" + String(numericId); }
  function planGID(numericId) { return "gid://shopify/SellingPlan/" + String(numericId); }

  function isAllowedCheckoutURL(url) {
    try {
      var u = new URL(url, STORE_ORIGIN);
      if (u.protocol !== "https:") return false;
      return ALLOWED_CHECKOUT_HOSTS.indexOf(u.hostname) !== -1;
    } catch (e) { return false; }
  }

  function postJSON(path, body) {
    return fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
      credentials: "same-origin"
    }).then(function (res) {
      return res.text().then(function (t) {
        var data = null;
        try { data = t ? JSON.parse(t) : null; } catch (e) { data = null; }
        if (!res.ok) {
          var err = new Error((data && data.error) || ("Request failed (" + res.status + ")"));
          err.status = res.status;
          throw err;
        }
        return data;
      });
    });
  }

  /* ---- Operation: create a cart -------------------------------------
     lines:      [{ variantId, quantity, sellingPlanId? }]  (numeric ids)
     attributes: plain object of order context, e.g. { Protocol: "…" }
     Resolves to a normalised cart, or throws. */
  function createCart(lines, attributes) {
    var payload = (lines || []).map(function (l) {
      var line = { merchandiseId: variantGID(l.variantId), quantity: Math.max(1, l.quantity | 0) };
      if (l.sellingPlanId) line.sellingPlanId = planGID(l.sellingPlanId);
      return line;
    });
    var attrs = Object.keys(attributes || {}).map(function (k) {
      return { key: String(k), value: String(attributes[k]) };
    });
    return postJSON("/api/cart/create", { lines: payload, attributes: attrs }).then(function (data) {
      var cart = data && data.cart;
      if (!cart || !cart.checkoutUrl) throw new Error("Cart was not created.");
      return normalise(cart);
    });
  }

  /* Normalise the Shopify shape into something the UI can hold without
     knowing Shopify. Crucially this surfaces `sellingPlanId` per line —
     the PROOF that a subscription was applied, straight from Shopify. */
  function normalise(cart) {
    var nodes = (cart.lines && cart.lines.nodes) || [];
    return {
      id: cart.id,
      checkoutUrl: cart.checkoutUrl,
      totalQuantity: cart.totalQuantity,
      subtotal: cart.cost && cart.cost.subtotalAmount ? cart.cost.subtotalAmount.amount : null,
      lines: nodes.map(function (n) {
        var alloc = n.sellingPlanAllocation && n.sellingPlanAllocation.sellingPlan;
        return {
          id: n.id,
          quantity: n.quantity,
          variantId: n.merchandise && n.merchandise.id,
          title: n.merchandise && n.merchandise.title,
          /* null when Shopify did NOT apply a selling plan to this line */
          sellingPlanId: alloc ? alloc.id : null,
          sellingPlanName: alloc ? alloc.name : null
        };
      })
    };
  }

  /* ---- Operation: checkout ------------------------------------------
     Returns a validated checkout URL, or throws. Never navigates itself —
     the caller decides when to commit. */
  function checkoutURLFor(cart) {
    if (!cart || !cart.checkoutUrl) throw new Error("No checkout URL.");
    if (!isAllowedCheckoutURL(cart.checkoutUrl)) {
      /* Refuse rather than redirect somewhere unapproved (§11/§14). */
      throw new Error("Checkout destination was not recognised.");
    }
    return cart.checkoutUrl;
  }

  /* Did Shopify actually apply the plan we asked for? §11 forbids claiming
     AutoPilot when checkout would receive a one-time order. */
  function subscriptionApplied(cart, expectedPlanNumericId) {
    if (!cart || !cart.lines || !cart.lines.length) return false;
    var want = planGID(expectedPlanNumericId);
    return cart.lines.every(function (l) { return l.sellingPlanId === want; });
  }

  /* ---- One-time permalink (supported, and still correct) -------------
     Shopify DOES support variant:qty + attributes on permalinks. This is a
     legitimate path for non-subscription orders and needs no API/token.
     It must NEVER be used for a subscription — see the header note. */
  function oneTimePermalink(variantId, quantity, attributes) {
    var qty = Math.min(10, Math.max(1, quantity | 0));
    var url = STORE_ORIGIN + "/cart/" + String(variantId) + ":" + qty;
    var attrs = attributes || {};
    var qs = Object.keys(attrs).map(function (k) {
      return "attributes[" + encodeURIComponent(k) + "]=" + encodeURIComponent(attrs[k]);
    }).join("&");
    if (qs) url += "?" + qs;
    return isAllowedCheckoutURL(url) ? url : null;
  }

  root.AForceCommerce = {
    createCart: createCart,
    checkoutURLFor: checkoutURLFor,
    subscriptionApplied: subscriptionApplied,
    oneTimePermalink: oneTimePermalink,
    isAllowedCheckoutURL: isAllowedCheckoutURL,
    _variantGID: variantGID,
    _planGID: planGID
  };
})(window);
