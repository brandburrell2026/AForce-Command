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

  /* a11y (WCAG 4.1.2): the drawer already behaves as a modal (backdrop, scroll
     lock, Escape, focus trap) — expose it as one to assistive tech. Set here,
     in the one shared script, so every page gets it. aria-modal is safe
     because the panel gains its own in-dialog close control below (the burger
     lives OUTSIDE the drawer, which aria-modal would otherwise make
     unreachable for screen-reader users). */
  drawer.setAttribute("role", "dialog");
  drawer.setAttribute("aria-modal", "true");
  drawer.setAttribute("aria-label", "Site menu");

  /* In-dialog close: last focusable item in the panel. Visually hidden until
     keyboard focus (see .afx-drawer-close in header.css) so the approved
     drawer design is unchanged for sighted mouse/touch users. */
  var drawerClose = document.createElement("button");
  drawerClose.type = "button";
  drawerClose.className = "afx-drawer-close";
  drawerClose.textContent = "Close menu";
  drawerClose.setAttribute("data-afx-close", ""); // handled by the existing close delegate
  panel.appendChild(drawerClose);

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

/* =====================================================================
   Background-video pause control (WCAG 2.2.2) — progressive enhancement.
   Every autoplaying, looping background video gets a quiet pause/play
   toggle (see .afx-vid-toggle in header.css). Under prefers-reduced-motion
   the videos are paused outright instead (each page's CSS already swaps
   most of them to stills), so no control is injected. Runs standalone —
   independent of the header markup above.
   ===================================================================== */
(function () {
  "use strict";
  var vids = document.querySelectorAll("video[autoplay]");
  if (!vids.length) return;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var ICON_PAUSE = '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><rect x="3" y="2" width="3.5" height="12" rx="1"/><rect x="9.5" y="2" width="3.5" height="12" rx="1"/></svg>';
  var ICON_PLAY = '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M4.5 2.6c0-.8.9-1.3 1.6-.9l8 5.4c.6.4.6 1.4 0 1.8l-8 5.4c-.7.4-1.6-.1-1.6-.9V2.6z"/></svg>';
  Array.prototype.forEach.call(vids, function (v) {
    if (reduce) { try { v.pause(); } catch (_) { /* non-fatal */ } return; }
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "afx-vid-toggle";
    function sync() {
      var paused = v.paused;
      btn.setAttribute("aria-label", paused ? "Play background video" : "Pause background video");
      btn.innerHTML = paused ? ICON_PLAY : ICON_PAUSE;
    }
    btn.addEventListener("click", function () {
      if (v.paused) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
      else { v.pause(); }
      sync();
    });
    v.addEventListener("play", sync);
    v.addEventListener("pause", sync);
    sync();
    /* Sibling of the video inside its (positioned) hero container — every
       background video here is absolutely positioned, so the parent is
       guaranteed to be a positioned box for the button to anchor to. */
    v.parentNode.insertBefore(btn, v.nextSibling);
  });
})();
