/* =====================================================================
   Founding 250 — email capture.

   The page's submit handler used to be a clearly-marked placeholder that
   console.log'd the address and resolved {ok:true}, so a member saw
   "claimed" while their email went nowhere. This function replaces that
   with a real capture by forwarding to the api-server's existing
   /api/early-access endpoint (which persists the row, de-duplicates on
   email, sends the member a confirmation, and is readable by the founder
   through its admin CSV export).

   Server-to-server on purpose: the browser never talks to the api-server
   directly, so no CORS allowlist entry and no api-server domain config
   has to change.
   ===================================================================== */
"use strict";

const API_BASE =
  process.env.AFORCE_API_BASE || "https://aforce-command-production.up.railway.app";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "method_not_allowed" });

  const body = await readBody(req);
  const email = String(body.email || "").trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return json(res, 400, { error: "invalid_email" });
  }

  try {
    const upstream = await fetch(`${API_BASE}/api/early-access`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // `source` is what separates Founding 250 signups from every other
      // early-access entry in the admin export.
      body: JSON.stringify({ email, source: "founding-250" }),
    });
    if (!upstream.ok) {
      // Never report success we did not get — the member would believe
      // they hold a spot that was never recorded.
      return json(res, 502, { error: "capture_unavailable" });
    }
    return json(res, 200, { ok: true });
  } catch {
    return json(res, 502, { error: "capture_unavailable" });
  }
};
