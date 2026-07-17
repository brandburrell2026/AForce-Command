/* =====================================================================
   AFORCE — "YOUR RITUAL" BASKET CONTROLLER  (brief §9/§15)

   Headless state + operations for the multi-product basket. The UI layer
   subscribes via onChange and renders; it never talks to Shopify directly.
   All commerce goes through AForceCommerce (the §12 boundary).

   Authority model (§15): Shopify's returned cart is the source of truth. We
   apply an OPTIMISTIC snapshot for instant feedback, then reconcile with the
   server response and ROLL BACK on failure. A single in-flight mutation at a
   time (queued) prevents double-adds from rapid taps.

   Line identity (§9): variantId + sellingPlanId. Shopify itself merges an add
   whose (variant, plan) matches an existing line, and keeps different plans as
   separate lines — so we trust the server's line set rather than merging
   client-side.

   Persistence (§9): the cart id survives refresh + back via localStorage; on
   load we re-hydrate from Shopify. A null cart (expired/completed) starts fresh.
   ===================================================================== */
(function (root) {
  "use strict";

  var STORAGE_KEY = "aforce_cart_id";
  var UNDO_MS = 6000;

  function AForceBasket(commerce) {
    this.C = commerce;
    this.cart = null;            // normalised cart from Shopify (authoritative)
    this.cartId = readId();
    this.busy = false;           // a mutation is in flight
    this._queue = [];            // serialise mutations (§15 no double-add)
    this._undo = null;           // { line, timer }
    this._subs = [];
    this.lastError = null;
  }

  function readId() { try { return localStorage.getItem(STORAGE_KEY) || null; } catch (e) { return null; } }
  function writeId(id) { try { id ? localStorage.setItem(STORAGE_KEY, id) : localStorage.removeItem(STORAGE_KEY); } catch (e) {} }

  var P = AForceBasket.prototype;

  P.onChange = function (fn) { this._subs.push(fn); return this; };
  P._emit = function () { var self = this; this._subs.forEach(function (fn) { try { fn(self); } catch (e) {} }); };

  /* Derived views the UI reads ---------------------------------------- */
  P.lines = function () { return this.cart ? this.cart.lines : []; };
  P.count = function () { return this.lines().reduce(function (n, l) { return n + l.quantity; }, 0); };
  P.subtotal = function () { return this.cart ? this.cart.subtotal : null; };
  P.isEmpty = function () { return this.count() === 0; };
  /* §6/§9: COMMAND INCLUDED whenever ANY line carries a selling plan (AutoPilot). */
  P.hasAutoPilot = function () { return this.lines().some(function (l) { return !!l.sellingPlanId; }); };
  P.checkoutUrl = function () { return this.cart ? this.cart.checkoutUrl : null; };
  P.canUndo = function () { return !!this._undo; };

  /* Hydrate on load (§9 persistence). Resolves whether or not a cart exists. */
  P.hydrate = function () {
    var self = this;
    if (!this.cartId) { this._emit(); return Promise.resolve(this); }
    return this.C.getCart(this.cartId).then(function (cart) {
      if (!cart) { self.cartId = null; writeId(null); }   // expired/completed → fresh
      else { self.cart = cart; }
      self._emit();
      return self;
    }).catch(function () { self._emit(); return self; });
  };

  /* Serialise every mutation so rapid taps can't race (§15). */
  P._run = function (task) {
    var self = this;
    var p = new Promise(function (resolve) {
      self._queue.push(function () {
        self.busy = true; self.lastError = null; self._emit();
        return task().then(function (r) { return r; })
          .catch(function (err) { self.lastError = (err && err.message) || "Something went wrong."; throw err; })
          .then(function (r) { self.busy = false; self._emit(); resolve(r); },
                function (err) { self.busy = false; self._emit(); resolve({ error: err }); });
      });
      if (self._queue.length === 1) self._drain();
    });
    return p;
  };
  P._drain = function () {
    var self = this;
    if (!this._queue.length) return;
    this._queue[0]().then(function () { self._queue.shift(); self._drain(); });
  };

  /* ADD (§9) — create the cart on first line, else add to it. Trust the
     returned cart's line set (Shopify handles merge/keep-separate). */
  P.add = function (item) {
    var self = this;
    var line = { variantId: item.variantId, quantity: item.quantity || 1, sellingPlanId: item.sellingPlanId || null };
    return this._run(function () {
      var op = self.cartId
        ? self.C.addLines(self.cartId, [line])
        : self.C.createCart([line], item.attributes || {});
      return op.then(function (cart) {
        self.cart = cart; self.cartId = cart.id; writeId(cart.id); return cart;
      });
    });
  };

  /* UPDATE quantity (§9). qty 0 removes. Optimistic, reconciled on response. */
  P.setQuantity = function (lineId, qty) {
    var self = this;
    if (!this.cartId) return Promise.resolve({ error: new Error("No cart") });
    if (qty <= 0) return this.remove(lineId);
    var snapshot = this._snapshot();
    var l = this._find(lineId); if (l) { l.quantity = qty; this._emit(); }  // optimistic
    return this._run(function () {
      return self.C.updateLine(self.cartId, lineId, qty).then(function (cart) { self.cart = cart; return cart; })
        .catch(function (err) { self._restore(snapshot); throw err; });     // rollback (§15)
    });
  };

  /* REMOVE with UNDO (§9). Stash the removed line so UNDO re-adds it exactly. */
  P.remove = function (lineId) {
    var self = this;
    if (!this.cartId) return Promise.resolve({ error: new Error("No cart") });
    var removed = this._find(lineId);
    var snapshot = this._snapshot();
    return this._run(function () {
      return self.C.removeLines(self.cartId, [lineId]).then(function (cart) {
        self.cart = cart;
        if (removed) self._armUndo(removed);
        return cart;
      }).catch(function (err) { self._restore(snapshot); throw err; });
    });
  };

  P._armUndo = function (removed) {
    var self = this;
    if (this._undo && this._undo.timer) clearTimeout(this._undo.timer);
    this._undo = {
      line: { variantId: gidToNumeric(removed.variantId), quantity: removed.quantity, sellingPlanId: gidToNumeric(removed.sellingPlanId) },
      label: removed.productTitle || removed.title,
      timer: setTimeout(function () { self._undo = null; self._emit(); }, UNDO_MS)
    };
  };
  P.undo = function () {
    if (!this._undo) return Promise.resolve(this);
    var line = this._undo.line;
    if (this._undo.timer) clearTimeout(this._undo.timer);
    this._undo = null;
    return this.add(line);   // re-adds the exact variant+plan+qty
  };
  P.dismissUndo = function () {
    if (this._undo && this._undo.timer) clearTimeout(this._undo.timer);
    this._undo = null; this._emit();
  };

  /* CHECKOUT (§9/§11) — hand off to the validated Shopify checkout URL.
     Returns the URL; the caller navigates. Throws if the cart is empty or the
     destination isn't allow-listed. */
  P.checkout = function () {
    if (this.isEmpty()) throw new Error("Your ritual is empty.");
    return this.C.checkoutURLFor(this.cart);
  };

  /* helpers */
  P._find = function (lineId) { var ls = this.lines(); for (var i = 0; i < ls.length; i++) if (ls[i].id === lineId) return ls[i]; return null; };
  P._snapshot = function () { return this.cart ? JSON.parse(JSON.stringify(this.cart)) : null; };
  P._restore = function (snap) { this.cart = snap; this._emit(); };

  function gidToNumeric(gid) { if (!gid) return null; var s = String(gid); return s.indexOf("gid://") === 0 ? s.split("/").pop() : s; }

  root.AForceBasket = AForceBasket;
})(window);
