/**
 * Smart Capture — image-based hydration/recovery estimator.
 *
 * Accepts a single image (base64 data URL or raw base64) from the mobile
 * app's Smart Capture screen and returns five qualitative estimates that
 * power the existing AForce orb / signal cards:
 *
 *   • hydrationDemand        — how much fluid the depicted food/drink
 *                              demands from the body
 *   • recoveryLoad           — how taxing it is on recovery / sleep / etc.
 *   • stimulantLoad          — caffeine, taurine, guarana, etc.
 *   • acidicLoad             — citrus, vinegar, soda, alcohol pH burden
 *   • correctionRecommendation — what the user should drink next to
 *                              counter the load (oz + category from our
 *                              existing 13-category drink catalog, plus
 *                              a one-line rationale)
 *
 * Per product spec we DO NOT return calories, macros, or any nutritional
 * diagnostic data. The system prompt enforces this and the response Zod
 * schema rejects extra fields.
 *
 * Rate-limited (per IP) so a malicious client can't burn a fortune in
 * OpenAI credits — 12 captures / minute is plenty for the UX while
 * keeping the cost ceiling sane.
 *
 * NOTE: Route mounts its own express.json({ limit: '8mb' }) middleware
 * because the app-wide cap is 64kB (sized for the UserState snapshot)
 * and base64-encoded photos blow through that instantly.
 */

import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { incCounter } from "../observability/metrics";
import { findBlockedConcept } from "../lib/claimsGate";
import express from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { openai } from "@workspace/integrations-openai-ai-server";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

// ─── Schemas ──────────────────────────────────────────────────────────

const LoadLevel = z.enum(["low", "moderate", "high", "very_high"]);

/**
 * Drink categories supported by the existing catalog (mobile-side
 * `data/drinkCatalog.ts`). Kept in sync as a flat literal union here so
 * the server stays a single workspace package without importing app code.
 */
const CorrectionCategory = z.enum([
  "water",
  "bottled_water",
  "coffee",
  "tea",
  "pre_workout",
  "energy_drink",
  "sports_drink",
  "alcohol",
  "smoothie",
  "juice",
  "soda",
  "electrolyte",
  "custom",
]);

export const SmartCaptureResponse = z.object({
  // Short one-line label of what the model thinks it sees, e.g.
  // "Iced latte and croissant". Lets the UI show context, never
  // displayed as a diagnostic.
  itemSummary: z.string().min(1).max(120),

  hydrationDemand:  z.object({ level: LoadLevel, score: z.number().int().min(0).max(100), note: z.string().max(160) }),
  recoveryLoad:     z.object({ level: LoadLevel, score: z.number().int().min(0).max(100), note: z.string().max(160) }),
  stimulantLoad:    z.object({ level: LoadLevel, score: z.number().int().min(0).max(100), note: z.string().max(160) }),
  acidicLoad:       z.object({ level: LoadLevel, score: z.number().int().min(0).max(100), note: z.string().max(160) }),

  correctionRecommendation: z.object({
    drinkCategory: CorrectionCategory,
    drinkName: z.string().min(1).max(80),
    oz: z.number().int().min(4).max(64),
    rationale: z.string().max(220),
  }),
}).strict();

export type SmartCaptureResponseT = z.infer<typeof SmartCaptureResponse>;

const RequestBody = z.object({
  // Either a `data:image/...;base64,XXXX` URL or a raw base64 blob.
  imageBase64: z.string().min(64).max(8 * 1024 * 1024), // ~8MB ceiling
  // Optional MIME hint when the client sends raw base64.
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "image/heic"]).optional(),
});

// ─── System prompt ────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are AForce OS Smart Capture — a hydration & recovery analyst.

The user has photographed a beverage, food, supplement, or meal.

Your job: estimate FOUR loads that the depicted item places on the body,
and recommend ONE corrective drink the user should consume next.

The four loads:
  • hydrationDemand   — how much fluid the body needs to process this item
  • recoveryLoad      — how disruptive it is to sleep, soreness, and overall recovery
  • stimulantLoad     — caffeine, taurine, guarana, yohimbine, etc.
  • acidicLoad        — citrus, vinegar, soda, alcohol, fermented foods (pH burden)

For each, return:
  • level — one of: low, moderate, high, very_high
  • score — integer 0..100 (matches the level bucket: 0-25 low, 26-50 moderate,
            51-75 high, 76-100 very_high)
  • note  — one short sentence (≤160 chars), no medical/diagnostic language

Then return ONE correctionRecommendation:
  • drinkCategory must be one of: water, bottled_water, coffee, tea,
    pre_workout, energy_drink, sports_drink, alcohol, smoothie, juice,
    soda, electrolyte, custom
  • drinkName     — a short specific product or simple description (≤80 chars)
  • oz            — integer 4..64
  • rationale     — one short sentence (≤220 chars) explaining why

Hard rules — never violate:
  • DO NOT return calories, macros (carbs/protein/fat/sodium/sugar grams),
    glycemic numbers, or any nutritional diagnostic data.
  • DO NOT diagnose health conditions or claim medical effects.
  • If the image is unclear, blurry, or doesn't depict a food/drink, still
    return a best-effort guess with level=low across the board and a
    "couldn't identify clearly" note in itemSummary.
  • Respond with valid JSON ONLY matching the provided response_format.`;

// ─── Helpers ──────────────────────────────────────────────────────────

/**
 * Defensive scrub: even though the system prompt forbids nutritional
 * data and our Zod schema rejects unknown top-level keys, the model can
 * still leak calorie/macro talk inside the free-text fields
 * (`itemSummary`, `note`, `rationale`, `drinkName`). If we find any
 * forbidden term, we reject the response and force a retry — the
 * product spec promises "estimated hydration/recovery guidance only".
 *
 * Word-boundary matching keeps "lifesaver" from tripping "sav…", etc.
 */
const FORBIDDEN_NUTRITION = new RegExp(
  String.raw`\b(` +
    `calorie|calories|kcal|cal\b|` +
    `macros?|macronutrients?|` +
    `carb|carbs|carbohydrate|carbohydrates|` +
    `protein|proteins|` +
    `fats?\b|saturated\s+fat|trans\s+fat|` +
    `sugars?\b|added\s+sugar|sugar\s+grams|` +
    `sodium\s*(?:mg|grams?)|salt\s+grams?|` +
    `cholesterol|` +
    `fiber\s+grams?|` +
    `glycemic\s+(?:index|load)|` +
    `\d+\s*(?:kcal|cal|calories?|g\s+(?:protein|carb|fat|sugar))` +
  `)\b`,
  "i",
);

/** §42 block-severity scan over the same consumer-visible free-text fields. */
function containsBlockedClaim(result: SmartCaptureResponseT): string | null {
  const fields: string[] = [
    result.itemSummary,
    result.hydrationDemand.note,
    result.recoveryLoad.note,
    result.stimulantLoad.note,
    result.acidicLoad.note,
    result.correctionRecommendation.drinkName,
    result.correctionRecommendation.rationale,
  ];
  for (const f of fields) {
    const hit = findBlockedConcept(f);
    if (hit) return hit;
  }
  return null;
}

function containsForbiddenNutritionTalk(result: SmartCaptureResponseT): string | null {
  const fields: string[] = [
    result.itemSummary,
    result.hydrationDemand.note,
    result.recoveryLoad.note,
    result.stimulantLoad.note,
    result.acidicLoad.note,
    result.correctionRecommendation.drinkName,
    result.correctionRecommendation.rationale,
  ];
  for (const f of fields) {
    if (FORBIDDEN_NUTRITION.test(f)) return f;
  }
  return null;
}

function normalizeImageToDataUrl(input: string, mimeHint?: string): string | null {
  if (input.startsWith("data:")) {
    // Validate shape minimally: data:<mime>;base64,<payload>
    if (!/^data:image\/(jpeg|jpg|png|webp|heic);base64,/i.test(input)) return null;
    return input;
  }
  const mime = mimeHint ?? "image/jpeg";
  // Reject anything that doesn't look like base64
  if (!/^[A-Za-z0-9+/=\s]+$/.test(input)) return null;
  const clean = input.replace(/\s+/g, "");
  return `data:${mime};base64,${clean}`;
}

const JSON_SCHEMA = {
  name: "SmartCaptureResult",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      itemSummary: { type: "string" },
      hydrationDemand: {
        type: "object",
        additionalProperties: false,
        properties: {
          level: { type: "string", enum: ["low", "moderate", "high", "very_high"] },
          score: { type: "integer", minimum: 0, maximum: 100 },
          note: { type: "string" },
        },
        required: ["level", "score", "note"],
      },
      recoveryLoad: {
        type: "object",
        additionalProperties: false,
        properties: {
          level: { type: "string", enum: ["low", "moderate", "high", "very_high"] },
          score: { type: "integer", minimum: 0, maximum: 100 },
          note: { type: "string" },
        },
        required: ["level", "score", "note"],
      },
      stimulantLoad: {
        type: "object",
        additionalProperties: false,
        properties: {
          level: { type: "string", enum: ["low", "moderate", "high", "very_high"] },
          score: { type: "integer", minimum: 0, maximum: 100 },
          note: { type: "string" },
        },
        required: ["level", "score", "note"],
      },
      acidicLoad: {
        type: "object",
        additionalProperties: false,
        properties: {
          level: { type: "string", enum: ["low", "moderate", "high", "very_high"] },
          score: { type: "integer", minimum: 0, maximum: 100 },
          note: { type: "string" },
        },
        required: ["level", "score", "note"],
      },
      correctionRecommendation: {
        type: "object",
        additionalProperties: false,
        properties: {
          drinkCategory: {
            type: "string",
            enum: [
              "water", "bottled_water", "coffee", "tea", "pre_workout",
              "energy_drink", "sports_drink", "alcohol", "smoothie",
              "juice", "soda", "electrolyte", "custom",
            ],
          },
          drinkName: { type: "string" },
          oz: { type: "integer", minimum: 4, maximum: 64 },
          rationale: { type: "string" },
        },
        required: ["drinkCategory", "drinkName", "oz", "rationale"],
      },
    },
    required: [
      "itemSummary",
      "hydrationDemand",
      "recoveryLoad",
      "stimulantLoad",
      "acidicLoad",
      "correctionRecommendation",
    ],
  },
} as const;

// ─── Middleware ───────────────────────────────────────────────────────

// 12 captures/min/IP. Sized for the UX (a user is unlikely to photograph
// more than once every few seconds) while capping API spend.
const captureLimiter = rateLimit({
  windowMs: 60_000,
  limit: 12,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many Smart Capture requests. Please wait a minute." },
});

// ─── Route ────────────────────────────────────────────────────────────

router.post(
  "/smart-capture",
  // Wave-1 P0 hardening: user imagery must never leave the device
  // unauthenticated. Auth precedes rate limiting so anonymous traffic can
  // never reach the OpenAI call (or consume its budget).
  requireAuth,
  captureLimiter,
  // Route-scoped body parser — the app-wide cap is 64kB. This router is
  // mounted in app.ts BEFORE the global express.json() so this limit
  // actually takes effect.
  express.json({ limit: "8mb" }),
  async (req, res) => {
    const log = req.log ?? console;
    const parsed = RequestBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid request body", details: parsed.error.flatten() });
      return;
    }

    const dataUrl = normalizeImageToDataUrl(parsed.data.imageBase64, parsed.data.mimeType);
    if (!dataUrl) {
      res.status(400).json({ error: "image must be a valid base64 jpeg/png/webp/heic" });
      return;
    }

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-5.4",
        max_completion_tokens: 1024,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: "Analyze this photo per the Smart Capture rules." },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        response_format: { type: "json_schema", json_schema: JSON_SCHEMA },
      });

      const raw = completion.choices[0]?.message?.content;
      if (!raw) {
        log.warn?.("smart-capture: empty completion");
        res.status(502).json({ error: "AI returned an empty response. Please try again." });
        return;
      }

      let json: unknown;
      try {
        json = JSON.parse(raw);
      } catch {
        log.warn?.({ raw }, "smart-capture: non-JSON response");
        res.status(502).json({ error: "AI returned malformed data. Please try again." });
        return;
      }

      const result = SmartCaptureResponse.safeParse(json);
      if (!result.success) {
        log.warn?.({ issues: result.error.flatten() }, "smart-capture: schema mismatch");
        res.status(502).json({ error: "AI response failed validation. Please try again." });
        return;
      }

      // Defensive nutrition scrub — see FORBIDDEN_NUTRITION above.
      const leaked = containsForbiddenNutritionTalk(result.data);
      if (leaked) {
        log.warn?.({ leaked }, "smart-capture: forbidden nutrition talk detected, rejecting");
        res.status(502).json({
          error: "Smart Capture returned nutritional data, which is not supported. Please try again.",
        });
        return;
      }

      // §42 claims gate (Wave-2 PR5): the ONLY LLM-generated consumer text in
      // the product. Same free-text fields as the nutrition scrub; a
      // block-severity claim (medical/injury/causal/coercive) rejects the
      // response outright — fail closed, never rewrite.
      const claimHit = containsBlockedClaim(result.data);
      if (claimHit) {
        log.warn?.({ claimHit }, "smart-capture: claims gate rejected AI copy");
        incCounter("claims_gate_suppressions.smart_capture");
        res.status(502).json({
          error: "Smart Capture returned unsupported language. Please try again.",
        });
        return;
      }

      res.status(200).json(result.data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      log.error?.({ err: message }, "smart-capture: openai call failed");
      res.status(502).json({ error: "Smart Capture is temporarily unavailable. Please try again." });
    }
  },
);

// Router-level error handler — express.json() rejects oversize bodies
// with { type: "entity.too.large", status: 413 } and malformed JSON with
// { type: "entity.parse.failed" }. Default Express renders these as HTML
// which our JSON-only mobile client surfaces as a confusing parse error.
// Convert to clean JSON so users see "Photo is too large…" instead.
router.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (err && typeof err === "object" && "type" in err) {
    const e = err as { type?: string; status?: number };
    if (e.type === "entity.too.large") {
      res.status(413).json({ error: "Photo is too large. Please use a smaller image (under 8 MB)." });
      return;
    }
    if (e.type === "entity.parse.failed") {
      res.status(400).json({ error: "Invalid request body." });
      return;
    }
  }
  next(err);
});

export default router;
