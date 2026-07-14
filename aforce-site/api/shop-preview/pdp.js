/* GET /shop-preview/[handle]  (rewritten here) — product detail page.
   Returns the same PDP shell for any handle; the client reads the handle from
   location.pathname and fetches /api/shop/product. Gated → hard 404 when off. */
"use strict";
const { PDP_HTML } = require("../_lib/pages");
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
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.end(PDP_HTML);
};
