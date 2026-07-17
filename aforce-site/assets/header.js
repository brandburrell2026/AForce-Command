/* =====================================================================
   AFORCE — UNIVERSAL HEADER BEHAVIOUR  (brief §6/§7)
   Progressive enhancement: the header and all links are real markup, so
   navigation works with JS disabled. This adds the mobile drawer toggle.

   Expected markup per page:
     <header class="afx-nav" id="afxNav"> logo · .afx-right(links + SHOP + CART)
        · <button class="afx-burger" id="afxBurger" aria-controls="afxDrawer"
             aria-expanded="false" aria-label="Open menu"> 3×span.afx-bar </button>
     </header>
     <div class="afx-drawer" id="afxDrawer" data-open="false">
        <div class="afx-backdrop" data-afx-close></div>
        <div class="afx-panel"> <nav> …6 links, SHOP last… </nav> </div>
     </div>
   ===================================================================== */
(function () {
  "use strict";

  var nav = document.getElementById("afxNav");
  var burger = document.getElementById("afxBurger");
  var drawer = document.getElementById("afxDrawer");
  if (!nav || !burger || !drawer) return;

  var panel = drawer.querySelector(".afx-panel");
  var root = document.documentElement;
  var DESKTOP = window.matchMedia("(min-width: 1024px)");

  function focusables() {
    return Array.prototype.filter.call(
      panel.querySelectorAll('a[href], button:not([disabled])'),
      function (el) { return el.offsetParent !== null; }
    );
  }
  function isOpen() { return drawer.getAttribute("data-open") === "true"; }

  function open() {
    if (isOpen()) return;
    var sbw = window.innerWidth - root.clientWidth;   // scrollbar width
    if (sbw > 0) root.style.paddingRight = sbw + "px"; // no sideways shift (§8)
    drawer.setAttribute("data-open", "true");
    burger.setAttribute("aria-expanded", "true");
    burger.setAttribute("aria-label", "Close menu");
    nav.classList.add("afx-open");
    root.classList.add("afx-locked");
    var f = focusables();
    if (f.length) f[0].focus();
  }

  function close(returnFocus) {
    if (!isOpen()) return;
    drawer.setAttribute("data-open", "false");
    burger.setAttribute("aria-expanded", "false");
    burger.setAttribute("aria-label", "Open menu");
    nav.classList.remove("afx-open");
    root.classList.remove("afx-locked");
    root.style.paddingRight = "";
    /* §7: focus ALWAYS returns to the hamburger (not to whatever was focused
       before — that is <body> when opened by keyboard). Skipped only when the
       page is navigating away, so we don't steal focus from the next page. */
    if (returnFocus !== false) burger.focus();
  }

  burger.addEventListener("click", function () { isOpen() ? close() : open(); });

  /* Close on: link selection (§7), backdrop tap (§7). */
  drawer.addEventListener("click", function (e) {
    if (e.target.closest("[data-afx-close]")) { close(); return; }   // backdrop
    if (e.target.closest("a")) { close(false); }                      // navigation
  });

  /* Escape (§7) + focus trap (§7/§19). The hamburger stays in the ring so it
     remains reachable and visible while open (§6). */
  document.addEventListener("keydown", function (e) {
    if (!isOpen()) return;
    if (e.key === "Escape") { e.preventDefault(); close(); return; }
    if (e.key !== "Tab") return;
    var ring = focusables().concat([burger]);
    if (!ring.length) return;
    var first = ring[0], last = ring[ring.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  /* Route change / bfcache restore (§7, §22): never return to a locked,
     drawer-covered page. */
  window.addEventListener("pagehide", function () { close(false); });
  window.addEventListener("popstate", function () { close(false); });

  /* Resizing up into desktop must not strand the drawer open. */
  function onBreakpoint(e) { if (e.matches) close(false); }
  DESKTOP.addEventListener ? DESKTOP.addEventListener("change", onBreakpoint)
                           : DESKTOP.addListener(onBreakpoint);
})();
