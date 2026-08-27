/**
 * Privacy settings — per-user share scope + per-field toggles.
 *
 * Mounted under `/api/privacy`. The Expo client (`services/privacyService.ts`)
 * is the only consumer.
 *
 *   GET  /             → current PrivacySettings (auto-seeds defaults)
 *   PUT  /scope        → { scope } → updated PrivacySettings
 *   PUT  /field        → { field, on } → updated PrivacySettings
 *
 * One row per user keyed on req.userId. Defaults match
 * `mockCircleData.DEFAULT_PRIVACY` so the first GET returns the same
 * shape the in-memory mock used to hand out.
 */

import { Router, type IRouter, type Request } from "express";
import { z } from "zod";
import { db, aforcePrivacy } from "@workspace/db";
import { eq } from "drizzle-orm";
import { DEFAULT_USER_ID } from "../lib/aforceState";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.use(requireAuth);

function resolveUserId(req: Request): string {
  return req.userId ?? DEFAULT_USER_ID;
}

const SCOPES = ["private", "circle", "team_coach", "public_card"] as const;
const FIELDS = ["score", "state", "streak", "protocol", "trend"] as const;

type ScopeT = (typeof SCOPES)[number];
type FieldT = (typeof FIELDS)[number];

interface PrivacyResponse {
  scope: ScopeT;
  fields: { score: boolean; state: boolean; streak: boolean; protocol: boolean; trend: boolean };
}

const DEFAULTS: PrivacyResponse = {
  // Founder ruling 2026-08-27: PRIVATE by default (mirrors
  // mockCircleData.DEFAULT_PRIVACY). Existing rows are untouched.
  scope: "private",
  fields: { score: true, state: true, streak: true, protocol: true, trend: true },
};

function rowToWire(row: typeof aforcePrivacy.$inferSelect): PrivacyResponse {
  // Shape `fields` defensively in case an older row is missing a key.
  const f = row.fields ?? DEFAULTS.fields;
  return {
    scope: (row.scope as ScopeT) ?? "circle",
    fields: {
      score: f.score ?? true,
      state: f.state ?? true,
      streak: f.streak ?? true,
      protocol: f.protocol ?? true,
      trend: f.trend ?? true,
    },
  };
}

async function loadOrSeed(userId: string): Promise<PrivacyResponse> {
  const [existing] = await db
    .select()
    .from(aforcePrivacy)
    .where(eq(aforcePrivacy.userId, userId))
    .limit(1);
  if (existing) return rowToWire(existing);

  const [inserted] = await db
    .insert(aforcePrivacy)
    .values({
      userId,
      scope: DEFAULTS.scope,
      fields: DEFAULTS.fields,
    })
    .onConflictDoNothing({ target: aforcePrivacy.userId })
    .returning();

  if (inserted) return rowToWire(inserted);

  // Concurrent seed by another request — re-read.
  const [retry] = await db
    .select()
    .from(aforcePrivacy)
    .where(eq(aforcePrivacy.userId, userId))
    .limit(1);
  return retry ? rowToWire(retry) : DEFAULTS;
}

/* ─── GET / ───────────────────────────────────────────────────────────────── */
router.get("/", async (req, res) => {
  try {
    const userId = resolveUserId(req);
    const privacy = await loadOrSeed(userId);
    res.json({ privacy });
  } catch (err) {
    req.log.error({ err }, "GET /privacy failed");
    res.status(500).json({ error: "privacy_fetch_failed" });
  }
});

/* ─── PUT /scope ──────────────────────────────────────────────────────────── */
const setScopeSchema = z.object({ scope: z.enum(SCOPES) });

router.put("/scope", async (req, res) => {
  try {
    const userId = resolveUserId(req);
    const parsed = setScopeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_body", issues: parsed.error.issues });
      return;
    }
    // Make sure a row exists, then update.
    await loadOrSeed(userId);
    const [row] = await db
      .update(aforcePrivacy)
      .set({ scope: parsed.data.scope, updatedAt: new Date() })
      .where(eq(aforcePrivacy.userId, userId))
      .returning();
    if (!row) {
      res.status(500).json({ error: "privacy_scope_update_failed" });
      return;
    }
    res.json({ privacy: rowToWire(row) });
  } catch (err) {
    req.log.error({ err }, "PUT /privacy/scope failed");
    res.status(500).json({ error: "privacy_scope_update_failed" });
  }
});

/* ─── PUT /field ──────────────────────────────────────────────────────────── */
const setFieldSchema = z.object({
  field: z.enum(FIELDS),
  on: z.boolean(),
});

router.put("/field", async (req, res) => {
  try {
    const userId = resolveUserId(req);
    const parsed = setFieldSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_body", issues: parsed.error.issues });
      return;
    }
    const { field, on } = parsed.data;

    const current = await loadOrSeed(userId);
    const nextFields = { ...current.fields, [field]: on } as PrivacyResponse["fields"];

    const [row] = await db
      .update(aforcePrivacy)
      .set({ fields: nextFields, updatedAt: new Date() })
      .where(eq(aforcePrivacy.userId, userId))
      .returning();
    if (!row) {
      res.status(500).json({ error: "privacy_field_update_failed" });
      return;
    }
    res.json({ privacy: rowToWire(row) });
  } catch (err) {
    req.log.error({ err }, "PUT /privacy/field failed");
    res.status(500).json({ error: "privacy_field_update_failed" });
  }
});

// Field name suppression for type narrowing of FieldT (kept for future use).
export type _PrivacyFieldKey = FieldT;

export default router;
