/* =====================================================================
   AForce Headless — CartProvider (vanilla, brand-native slide-out drawer).
   Mounts ONLY on /shop-preview pages (not global) until cutover.
   - cart id persisted in first-party cookie `aforce_cart_id` (30-day).
   - all Shopify calls go through /api/cart/* so the token stays server-side.
   - optimistic quantity/remove with rollback + toast on error.
   - checkout CTA → cart.checkoutUrl (Shopify checkout on shop.drinkaforce.com).
   Exposes window.AForceCart: { addLine, updateLine, removeLine, open, close, refresh, get }.
   ===================================================================== */
(function () {
  "use strict";

  var COOKIE = "aforce_cart_id";
  var COOKIE_DAYS = 30;
  var cart = null;         // last known server cart
  var loading = false;
  var els = {};

  /* ---------- cookie ---------- */
  function setCookie(v) {
    var d = new Date(); d.setTime(d.getTime() + COOKIE_DAYS * 864e5);
    document.cookie = COOKIE + "=" + encodeURIComponent(v) + ";expires=" + d.toUTCString() + ";path=/;SameSite=Lax";
  }
  function getCookie() {
    var m = document.cookie.match(new RegExp("(?:^|; )" + COOKIE + "=([^;]*)"));
    return m ? decodeURIComponent(m[1]) : null;
  }
  function clearCookie() { document.cookie = COOKIE + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/"; }

  /* ---------- api ---------- */
  function api(path, opts) {
    return fetch(path, Object.assign({ headers: { "Content-Type": "application/json" } }, opts))
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || ("HTTP " + r.status)); return j; }); });
  }

  /* ---------- money ---------- */
  function money(m) {
    if (!m) return "";
    var n = parseFloat(m.amount || 0);
    try { return new Intl.NumberFormat("en-US", { style: "currency", currency: m.currencyCode || "USD" }).format(n); }
    catch (e) { return "$" + n.toFixed(2); }
  }

  /* ---------- render ---------- */
  function count() { return cart && cart.totalQuantity ? cart.totalQuantity : 0; }
  function renderBadges() {
    document.querySelectorAll("[data-cart-count]").forEach(function (b) {
      var c = count(); b.textContent = c; b.setAttribute("data-empty", c ? "false" : "true");
    });
  }
  function esc(s) { return (s == null ? "" : String(s)).replace(/[&<>"]/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]; }); }

  function renderDrawer() {
    renderBadges();
    var body = els.body, foot = els.foot;
    if (!cart || !cart.lines || !cart.lines.nodes.length) {
      body.innerHTML = '<p class="cd-empty">Your cart is empty.</p>';
      foot.style.display = "none";
      return;
    }
    foot.style.display = "";
    body.innerHTML = cart.lines.nodes.map(function (ln) {
      var v = ln.merchandise || {};
      var plan = ln.sellingPlanAllocation && ln.sellingPlanAllocation.sellingPlan;
      var img = v.image ? '<img src="' + esc(v.image.url) + '" alt="' + esc(v.image.altText || "") + '">' : '<span class="cd-noimg"></span>';
      var opts = (v.selectedOptions || []).filter(function (o) { return o.value && o.value !== "Default Title"; })
        .map(function (o) { return esc(o.value); }).join(" · ");
      return '<div class="cd-line" data-line="' + esc(ln.id) + '">' +
        '<div class="cd-thumb">' + img + '</div>' +
        '<div class="cd-info">' +
        '<div class="cd-title">' + esc(v.product ? v.product.title : v.title) + '</div>' +
        (opts ? '<div class="cd-meta">' + opts + '</div>' : "") +
        (plan ? '<div class="cd-plan">' + esc(plan.name) + '</div>' : '<div class="cd-plan">One-time</div>') +
        '<div class="cd-qty">' +
        '<button type="button" data-qd aria-label="Decrease">–</button>' +
        '<span>' + ln.quantity + '</span>' +
        '<button type="button" data-qi aria-label="Increase">+</button>' +
        '<button type="button" class="cd-rm" data-rm>Remove</button>' +
        '</div>' +
        '</div>' +
        '<div class="cd-price">' + money(ln.cost && ln.cost.totalAmount) + '</div>' +
        '</div>';
    }).join("");
    els.subtotal.textContent = money(cart.cost && cart.cost.subtotalAmount);
    els.checkout.href = cart.checkoutUrl || "#";
    els.checkout.setAttribute("aria-disabled", cart.checkoutUrl ? "false" : "true");
  }

  /* ---------- toast ---------- */
  function toast(msg) {
    els.toast.textContent = msg; els.toast.classList.add("show");
    clearTimeout(toast._t); toast._t = setTimeout(function () { els.toast.classList.remove("show"); }, 3200);
  }

  /* ---------- mutations (optimistic where safe) ---------- */
  function setLoading(v) { loading = v; els.drawer.setAttribute("data-loading", v ? "true" : "false"); }

  function addLine(merchandiseId, quantity, opts) {
    quantity = quantity || 1; opts = opts || {};
    var line = { merchandiseId: merchandiseId, quantity: quantity };
    if (opts.sellingPlanId) line.sellingPlanId = opts.sellingPlanId;
    setLoading(true);
    var id = getCookie();
    var p = id
      ? api("/api/cart/add", { method: "POST", body: JSON.stringify({ cartId: id, lines: [line] }) })
      : api("/api/cart/create", { method: "POST", body: JSON.stringify({ lines: [line] }) });
    return p.then(function (j) {
      if (!id && j.cart) setCookie(j.cart.id);
      cart = j.cart; renderDrawer(); open(); toast("Added to cart");
    }).catch(function (e) {
      // A stale/expired cart id can make add fail — recreate once.
      if (id) { clearCookie(); return api("/api/cart/create", { method: "POST", body: JSON.stringify({ lines: [line] }) })
        .then(function (j) { if (j.cart) setCookie(j.cart.id); cart = j.cart; renderDrawer(); open(); toast("Added to cart"); })
        .catch(function (e2) { toast("Couldn't add — try again"); }); }
      toast("Couldn't add — try again");
    }).finally(function () { setLoading(false); });
  }

  function updateLine(lineId, quantity) {
    var id = getCookie(); if (!id) return Promise.resolve();
    if (quantity <= 0) return removeLine(lineId);
    // optimistic
    var prev = JSON.parse(JSON.stringify(cart));
    var ln = cart.lines.nodes.filter(function (l) { return l.id === lineId; })[0];
    if (ln) { ln.quantity = quantity; renderDrawer(); }
    setLoading(true);
    return api("/api/cart/update", { method: "POST", body: JSON.stringify({ cartId: id, lines: [{ id: lineId, quantity: quantity }] }) })
      .then(function (j) { cart = j.cart; renderDrawer(); })
      .catch(function () { cart = prev; renderDrawer(); toast("Couldn't update — reverted"); })
      .finally(function () { setLoading(false); });
  }

  function removeLine(lineId) {
    var id = getCookie(); if (!id) return Promise.resolve();
    var prev = JSON.parse(JSON.stringify(cart));
    cart.lines.nodes = cart.lines.nodes.filter(function (l) { return l.id !== lineId; }); renderDrawer();
    setLoading(true);
    return api("/api/cart/remove", { method: "POST", body: JSON.stringify({ cartId: id, lineIds: [lineId] }) })
      .then(function (j) { cart = j.cart; renderDrawer(); })
      .catch(function () { cart = prev; renderDrawer(); toast("Couldn't remove — reverted"); })
      .finally(function () { setLoading(false); });
  }

  function refresh() {
    var id = getCookie(); if (!id) { renderDrawer(); return Promise.resolve(); }
    return api("/api/cart/get?id=" + encodeURIComponent(id)).then(function (j) {
      if (!j.cart) { clearCookie(); cart = null; } else { cart = j.cart; }
      renderDrawer();
    }).catch(function () { /* keep last state */ });
  }

  /* ---------- drawer open/close ---------- */
  function open() { els.drawer.classList.add("open"); els.veil.classList.add("open"); document.body.style.overflow = "hidden"; }
  function close() { els.drawer.classList.remove("open"); els.veil.classList.remove("open"); document.body.style.overflow = ""; }

  /* ---------- mount ---------- */
  function mount() {
    var wrap = document.createElement("div");
    wrap.innerHTML =
      '<div class="cd-veil" data-cart-veil></div>' +
      '<aside class="cd-drawer" data-cart-drawer aria-label="Cart" data-loading="false">' +
      '<header class="cd-head"><span>Your Ritual</span><button type="button" class="cd-close" data-cart-close aria-label="Close cart">×</button></header>' +
      '<div class="cd-lines" data-cart-body></div>' +
      '<footer class="cd-foot" data-cart-foot>' +
      '<div class="cd-sub"><span>Subtotal</span><span data-cart-subtotal></span></div>' +
      '<p class="cd-ship">Shipping &amp; taxes calculated at checkout.</p>' +
      '<a class="cd-checkout" data-cart-checkout href="#">Checkout →</a>' +
      '</footer></aside>' +
      '<div class="cd-toast" data-cart-toast role="status"></div>';
    document.body.appendChild(wrap);
    els.veil = wrap.querySelector("[data-cart-veil]");
    els.drawer = wrap.querySelector("[data-cart-drawer]");
    els.body = wrap.querySelector("[data-cart-body]");
    els.foot = wrap.querySelector("[data-cart-foot]");
    els.subtotal = wrap.querySelector("[data-cart-subtotal]");
    els.checkout = wrap.querySelector("[data-cart-checkout]");
    els.toast = wrap.querySelector("[data-cart-toast]");

    els.veil.addEventListener("click", close);
    wrap.querySelector("[data-cart-close]").addEventListener("click", close);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });

    document.addEventListener("click", function (e) {
      if (e.target.closest("[data-cart-open]")) { e.preventDefault(); open(); }
      var line = e.target.closest(".cd-line"); if (!line) return;
      var id = line.getAttribute("data-line");
      var ln = cart && cart.lines.nodes.filter(function (l) { return l.id === id; })[0];
      if (!ln) return;
      if (e.target.closest("[data-qi]")) updateLine(id, ln.quantity + 1);
      else if (e.target.closest("[data-qd]")) updateLine(id, ln.quantity - 1);
      else if (e.target.closest("[data-rm]")) removeLine(id);
    });

    renderDrawer();
    refresh();
  }

  window.AForceCart = { addLine: addLine, updateLine: updateLine, removeLine: removeLine, open: open, close: close, refresh: refresh, get: function () { return cart; } };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount); else mount();
})();
