/**
 * Early-access signup capture + admin readout.
 *
 * Mounted under `/api/early-access`.
 *
 *   POST /                       → public: record an email + source
 *   GET  /admin/list             → admin JSON list (email, source, createdAt)
 *   GET  /admin/export.csv       → admin CSV download
 *   GET  /admin                  → admin minimal HTML view
 *
 * Admin routes are gated by requireAdmin (Clerk role / metadata, with
 * an optional ADMIN_EMAILS bootstrap fallback).
 * The public POST is rate-limited to keep bots from filling the table.
 */

import { Router, type IRouter } from "express";
import rateLimit from "express-rate-limit";
import { desc, sql } from "drizzle-orm";
import { z } from "zod";
import { db, earlyAccessSignups } from "@workspace/db";
import { requireAdmin } from "../middlewares/requireAdmin";
import { sendEmailAndForget } from "../lib/mailer";

const router: IRouter = Router();

const SignupBody = z.object({
  email: z.string().email().max(254).transform((s) => s.trim().toLowerCase()),
  source: z.string().min(1).max(64).default("unknown"),
});

const signupLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: () => process.env["NODE_ENV"] === "test",
  message: { error: "rate_limited", scope: "early_access_signup" },
});

// Short "you're on the list" confirmation. Intentionally plain — the sibling
// welcome-email task owns richer onboarding content. Fire-and-forget so a mail
// provider outage cannot block the 200 response.
function sendEarlyAccessConfirmation(email: string): void {
  sendEmailAndForget({
    to: email,
    subject: "You're on the AForce early-access list",
    text:
      "Thanks for signing up for AForce early access.\n\n" +
      "You're on the list — we'll be in touch as soon as your spot opens up.\n\n" +
      "— The AForce team",
    html:
      `<div style="font:14px/1.5 -apple-system,system-ui,sans-serif;color:#111">` +
      `<p>Thanks for signing up for <strong>AForce</strong> early access.</p>` +
      `<p>You're on the list — we'll be in touch as soon as your spot opens up.</p>` +
      `<p style="color:#666">— The AForce team</p>` +
      `</div>`,
  });
}

// Internal notification. The founder wants every signup to land in one
// inbox (SIGNUP_NOTIFY_EMAIL, default info@alkalineforce.com) rather than
// only in the admin export, so a Founding 250 claim is seen the day it
// happens. Fire-and-forget for the same reason as the confirmation above:
// a mail-provider outage must not fail the member's signup.
const NOTIFY_TO = process.env["SIGNUP_NOTIFY_EMAIL"] ?? "info@alkalineforce.com";

function notifyTeamOfSignup(email: string, source: string): void {
  sendEmailAndForget({
    to: NOTIFY_TO,
    subject: `New ${source} signup: ${email}`,
    text:
      `A new early-access signup was recorded.\n\n` +
      `Email:  ${email}\n` +
      `Source: ${source}\n\n` +
      `The full list is available from the admin export.\n`,
    html:
      `<div style="font:14px/1.5 -apple-system,system-ui,sans-serif;color:#111">` +
      `<p>A new early-access signup was recorded.</p>` +
      `<p><strong>Email:</strong> ${email}<br><strong>Source:</strong> ${source}</p>` +
      `<p style="color:#666">The full list is available from the admin export.</p>` +
      `</div>`,
  });
}

// ─── POST / — public signup capture ──────────────────────────────────────────
router.post("/", signupLimiter, async (req, res): Promise<void> => {
  const parsed = SignupBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_input" });
    return;
  }
  try {
    // .returning() yields the inserted row only when there was no conflict, so
    // an empty array means "duplicate email — row already existed". We use
    // that signal to suppress resending the confirmation email.
    const inserted = await db
      .insert(earlyAccessSignups)
      .values({ email: parsed.data.email, source: parsed.data.source })
      .onConflictDoNothing({ target: earlyAccessSignups.email })
      .returning({ id: earlyAccessSignups.id });

    if (inserted.length > 0) {
      sendEarlyAccessConfirmation(parsed.data.email);
      notifyTeamOfSignup(parsed.data.email, parsed.data.source);
    }

    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "POST /early-access failed");
    res.status(500).json({ error: "signup_failed" });
  }
});

// All routes below require admin.
router.use("/admin", requireAdmin);

// ─── GET /admin/list — JSON list, newest first ───────────────────────────────
router.get("/admin/list", async (req, res): Promise<void> => {
  try {
    const rows = await db
      .select({
        id: earlyAccessSignups.id,
        email: earlyAccessSignups.email,
        source: earlyAccessSignups.source,
        createdAt: earlyAccessSignups.createdAt,
      })
      .from(earlyAccessSignups)
      .orderBy(desc(earlyAccessSignups.createdAt))
      .limit(10000);
    res.json({
      count: rows.length,
      signups: rows.map((r) => ({
        id: r.id,
        email: r.email,
        source: r.source,
        createdAt: r.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    req.log.error({ err }, "GET /early-access/admin/list failed");
    res.status(500).json({ error: "list_failed" });
  }
});

// RFC 4180-ish CSV cell escaper: wrap in quotes when the cell contains
// quote/comma/CR/LF, and double any internal quotes.
function csvCell(v: string): string {
  if (/[",\r\n]/.test(v)) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

// ─── GET /admin/export.csv — CSV download ────────────────────────────────────
router.get("/admin/export.csv", async (req, res): Promise<void> => {
  try {
    const rows = await db
      .select({
        email: earlyAccessSignups.email,
        source: earlyAccessSignups.source,
        createdAt: earlyAccessSignups.createdAt,
      })
      .from(earlyAccessSignups)
      .orderBy(desc(earlyAccessSignups.createdAt));

    const header = "email,source,createdAt\n";
    const body = rows
      .map(
        (r) =>
          `${csvCell(r.email)},${csvCell(r.source)},${csvCell(
            r.createdAt.toISOString(),
          )}`,
      )
      .join("\n");

    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="early-access-signups-${stamp}.csv"`,
    );
    res.setHeader("Cache-Control", "no-store");
    res.send(header + body + (body ? "\n" : ""));
  } catch (err) {
    req.log.error({ err }, "GET /early-access/admin/export.csv failed");
    res.status(500).json({ error: "export_failed" });
  }
});

// HTML escaper for the minimal admin view.
function htmlEscape(v: string): string {
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ─── GET /admin — minimal HTML view ──────────────────────────────────────────
router.get("/admin", async (req, res): Promise<void> => {
  try {
    const rows = await db
      .select({
        email: earlyAccessSignups.email,
        source: earlyAccessSignups.source,
        createdAt: earlyAccessSignups.createdAt,
      })
      .from(earlyAccessSignups)
      .orderBy(desc(earlyAccessSignups.createdAt))
      .limit(1000);

    const [totalRow] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(earlyAccessSignups);
    const total = totalRow?.n ?? 0;

    const tableRows = rows
      .map(
        (r) => `<tr>
          <td>${htmlEscape(r.email)}</td>
          <td>${htmlEscape(r.source)}</td>
          <td>${htmlEscape(r.createdAt.toISOString())}</td>
        </tr>`,
      )
      .join("");

    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Early-access signups · AForce admin</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    :root { color-scheme: dark; }
    body {
      margin: 0; padding: 32px;
      font: 14px/1.5 -apple-system, system-ui, sans-serif;
      background: #000; color: #fff;
    }
    h1 { font-size: 18px; margin: 0 0 4px; letter-spacing: 0.02em; }
    .meta { color: #888; font-size: 12px; margin-bottom: 24px; }
    .actions { margin-bottom: 16px; }
    a.btn {
      display: inline-block; padding: 8px 14px;
      background: #C1281B; color: #F5F0E8; text-decoration: none;
      font-weight: 600; border-radius: 4px;
    }
    table { width: 100%; border-collapse: collapse; }
    th, td {
      text-align: left; padding: 8px 12px;
      border-bottom: 1px solid #1a1a1a;
      font-variant-numeric: tabular-nums;
    }
    th {
      font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em;
      color: #888; font-weight: 500;
    }
    td:nth-child(3) { color: #888; font-size: 12px; white-space: nowrap; }
    .empty { color: #666; padding: 32px 0; text-align: center; }
  </style>
</head>
<body>
  <h1>Early-access signups</h1>
  <div class="meta">${total} total · showing ${rows.length}</div>
  <div class="actions">
    <a class="btn" href="/api/early-access/admin/export.csv">Download CSV</a>
  </div>
  ${
    rows.length === 0
      ? `<div class="empty">No signups yet.</div>`
      : `<table>
          <thead><tr><th>Email</th><th>Source</th><th>Created at</th></tr></thead>
          <tbody>${tableRows}</tbody>
        </table>`
  }
</body>
</html>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.send(html);
  } catch (err) {
    req.log.error({ err }, "GET /early-access/admin failed");
    res.status(500).json({ error: "admin_view_failed" });
  }
});

export default router;
