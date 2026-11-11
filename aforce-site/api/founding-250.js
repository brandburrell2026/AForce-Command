/* Same-origin lead capture proxy. Secrets and Microsoft sending stay on Railway. */
"use strict";
const API_BASE = process.env.AFORCE_API_BASE || "https://aforce-command-production.up.railway.app";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SOURCES = new Set(["homepage", "shop-waitlist", "aforce-os", "founding-250"]);
const origins = new Set(["https://www.joinaforce.com", "https://joinaforce.com", "https://www.drinkaforce.com", "https://drinkaforce.com"]);
const attempts = new Map(); // Best-effort edge limit; API also independently rate-limits.
function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}
function parse(raw, req) {
  return String(req.headers["content-type"] || "").startsWith("application/x-www-form-urlencoded")
    ? Object.fromEntries(new URLSearchParams(raw)) : JSON.parse(raw || "{}");
}
async function readBody(req) {
  if (req.body != null) {
    const raw = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
    if (Buffer.byteLength(raw) > 2048) throw new Error("body_too_large");
    return typeof req.body === "object" ? req.body : parse(raw, req);
  }
  const chunks = []; let size = 0;
  for await (const chunk of req) {
    size += Buffer.byteLength(chunk);
    if (size > 2048) throw new Error("body_too_large");
    chunks.push(chunk);
  }
  return parse(Buffer.concat(chunks).toString("utf8"), req);
}
module.exports = async function handler(req, res) {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return json(res, 405, { error: "method_not_allowed" }); }
  const origin = req.headers.origin;
  // Permit this request's Vercel preview host, without accepting arbitrary origins.
  const previewOrigin = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "";
  if ((origin && !origins.has(origin) && origin !== previewOrigin) || req.headers["sec-fetch-site"] === "cross-site") {
    return json(res, 403, { error: "origin_not_allowed" });
  }
  const ip = req.headers["x-vercel-forwarded-for"] || req.socket?.remoteAddress || "unknown";
  const now = Date.now();
  if (attempts.size > 10000) for (const [key, value] of attempts) if (value.until <= now) attempts.delete(key);
  if (attempts.size > 10000) return json(res, 429, { error: "rate_limited" });
  const bucket = attempts.get(ip);
  const current = bucket && bucket.until > now ? bucket : { count: 0, until: now + 60000 };
  current.count++; attempts.set(ip, current);
  if (current.count > 5) { res.setHeader("Retry-After", "60"); return json(res, 429, { error: "rate_limited" }); }
  let body;
  try { body = await readBody(req); } catch (error) {
    return json(res, error.message === "body_too_large" ? 413 : 400, { error: "invalid_body" });
  }
  if (!body || typeof body !== "object" || Array.isArray(body) || body.website) return json(res, 400, { error: "invalid_body" });
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(email) || email.length > 254) return json(res, 400, { error: "invalid_email" });
  const source = SOURCES.has(body.source) ? body.source : "founding-250";
  try {
    const upstream = await fetch(`${API_BASE}/api/early-access`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, source }), signal: AbortSignal.timeout(12000),
    });
    const result = await upstream.json().catch(() => ({}));
    if (!upstream.ok || result.ok !== true) return json(res, upstream.status === 429 ? 429 : 502, { error: "capture_unavailable" });
    return json(res, 200, { ok: true });
  } catch { return json(res, 502, { error: "capture_unavailable" }); }
};
