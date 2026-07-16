/* GET /shop-preview  (rewritten here) — product listing page.
   Served THROUGH this function so the SHOP_PREVIEW_ENABLED gate yields a hard
   404 when off. No static /shop-preview file exists — nothing to reach when hidden. */
"use strict";
const { PLP_HTML } = require("../_lib/pages");
const { enabled } = require("../_lib/guard");

module.exports = (req, res) => {
  if (!enabled()) {
    res.statusCode = 404;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    res.end("Not found");
    return;
  }
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");        // shell bootstraps client fetches
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.end(PLP_HTML);
};
