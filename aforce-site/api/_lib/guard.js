/* =====================================================================
   Feature-flag gate for the hidden headless build.
   SHOP_PREVIEW_ENABLED must be truthy or every /api/shop|cart route 404s.
   Middleware also gates the HTML routes; this is the belt-and-suspenders
   check inside the functions so no data (or the token path) is ever
   reachable in production before cutover.
   ===================================================================== */
"use strict";

function enabled() {
  const v = process.env.SHOP_PREVIEW_ENABLED;
  return v === "1" || v === "true" || v === "on";
}

/** Returns true if the request was handled (404 written). */
function blockedIfDisabled(req, res) {
  if (enabled()) return false;
  res.statusCode = 404;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ error: "Not found" }));
  return true;
}

function json(res, status, body, cacheSeconds) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  if (cacheSeconds && status === 200) {
    // Edge cache reads for `cacheSeconds`, serve stale while revalidating.
    res.setHeader("Cache-Control", `public, s-maxage=${cacheSeconds}, stale-while-revalidate=60`);
  } else {
    res.setHeader("Cache-Control", "private, no-store");
  }
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  return await new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => { data += c; });
    req.on("end", () => { try { resolve(data ? JSON.parse(data) : {}); } catch (_) { resolve({}); } });
    req.on("error", () => resolve({}));
  });
}

module.exports = { enabled, blockedIfDisabled, json, readBody };
