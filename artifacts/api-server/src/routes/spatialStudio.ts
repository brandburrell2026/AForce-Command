/**
 * POST /api/spatial-studio/edit
 *
 * Natural-language design edits for AForce Spatial Studio. The studio
 * sends a slim scene document (no image data) and an instruction; this
 * route asks Claude for a structured list of edit operations, validates
 * them against the document, and returns them for the client to apply as
 * one undo step. The client never holds the Anthropic key.
 *
 * Auth + rate limit: every call costs model tokens, so the route requires
 * a Clerk session (requireAuth; demo user outside production) and is
 * rate-limited per client as the second layer. 503 when the server has
 * no ANTHROPIC_API_KEY, so the studio can show "AI not configured".
 */
import { Router, type IRouter, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

import { sendApiError } from "../lib/apiError";
import { logger } from "../lib/logger";
import { serializeError } from "../lib/serializeError";
import { EditRequestSchema, EditResultSchema, validateOps } from "../lib/spatialStudio/editOps";
import { SYSTEM_PROMPT, buildMessages } from "../lib/spatialStudio/prompt";
import { requireAuth } from "../middlewares/requireAuth";
import { incCounter } from "../observability/metrics";

const router: IRouter = Router();

const DEFAULT_MODEL = "claude-opus-5-5";

const editLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
});

let client: Anthropic | null = null;

/** Lazily built so an unconfigured server still boots and answers 503 here. */
function getClient(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}

router.post("/spatial-studio/edit", requireAuth, editLimiter, async (req: Request, res: Response) => {
  if (!process.env["ANTHROPIC_API_KEY"]) {
    sendApiError(req, res, 503, "ai_unavailable");
    return;
  }

  const parsed = EditRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_request", issues: parsed.error.issues.slice(0, 5) });
    return;
  }
  const request = parsed.data;
  const model = process.env["SPATIAL_STUDIO_MODEL"] || DEFAULT_MODEL;

  try {
    const response = await getClient().messages.parse({
      model,
      max_tokens: 8000,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: buildMessages(request),
      output_config: {
        format: zodOutputFormat(EditResultSchema),
        effort: "medium",
      },
    });

    if (response.stop_reason === "refusal") {
      incCounter("spatial_studio.edit.refusal");
      res.json({
        summary: "The assistant declined this request.",
        ops: [],
        questions: [],
        warnings: [],
        refused: true,
        model: response.model,
      });
      return;
    }

    const result = response.parsed_output;
    if (!result) {
      incCounter("spatial_studio.edit.unparseable");
      sendApiError(req, res, 502, "ai_unparseable");
      return;
    }

    const { ops, warnings } = validateOps(request.doc, result.ops);
    incCounter("spatial_studio.edit.ok");
    res.json({
      summary: result.summary,
      ops,
      questions: result.questions,
      warnings,
      refused: false,
      model: response.model,
      usage: {
        input: response.usage.input_tokens,
        output: response.usage.output_tokens,
        cacheRead: response.usage.cache_read_input_tokens ?? 0,
      },
    });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      incCounter("spatial_studio.edit.upstream_429");
      sendApiError(req, res, 429, "ai_rate_limited");
      return;
    }
    if (err instanceof Anthropic.AuthenticationError) {
      logger.error("[spatial-studio] Anthropic rejected the configured API key");
      incCounter("spatial_studio.edit.upstream_auth");
      sendApiError(req, res, 503, "ai_unavailable");
      return;
    }
    if (err instanceof Anthropic.APIError) {
      logger.warn({ status: err.status, err: serializeError(err) }, "[spatial-studio] upstream API error");
      incCounter("spatial_studio.edit.upstream_error");
      sendApiError(req, res, 502, "ai_error");
      return;
    }
    logger.error({ err: serializeError(err) }, "[spatial-studio] edit failed");
    incCounter("spatial_studio.edit.error");
    sendApiError(req, res, 500, "internal_error");
  }
});

export default router;
