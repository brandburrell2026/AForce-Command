/**
 * POST /api/voice/tts
 *
 * Proxies to ElevenLabs text-to-speech so the mobile client never sees
 * the API key. Body: `{ text: string, voiceId: string }`. Streams the
 * MP3 audio back to the caller.
 *
 * Auth + rate-limit (Wave-2 PR1): TTS calls cost real money on
 * ElevenLabs. The only caller is the app's elevenLabsTts service (the
 * marketing site never calls this endpoint — the old comment claiming a
 * "marketing-tier path" was stale), so the route now requires a Clerk
 * session; the per-client rate limit stays as the second layer.
 */

import { Router, type IRouter, type Request, type Response } from "express";
import { serializeError } from "../lib/serializeError";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { logger } from "../lib/logger";
import { requireAuth } from "../middlewares/requireAuth";
import { findBlockedConcept } from "../lib/claimsGate";
import {
  ttsAudioCache,
  isCacheable,
  buildCacheKey,
  type TtsCacheStatus,
} from "../lib/ttsCache";

const router: IRouter = Router();

const BodySchema = z.object({
  text: z.string().min(1).max(800),
  voiceId: z.string().min(8).max(64),
  /**
   * Opt-in caching for static common phrases (Voice Check-In intro /
   * questions / acks). Defaults to "dynamic" so personalized lines always
   * hit ElevenLabs live and stay no-store.
   */
  cachePolicy: z.enum(["static", "dynamic"]).optional(),
  /** Logical phrase id; only allowlisted keys are eligible for caching. */
  phraseKey: z.string().min(1).max(64).optional(),
});

const ttsLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
});

router.post("/voice/tts", requireAuth, ttsLimiter, async (req: Request, res: Response) => {
  const apiKey = process.env["ELEVENLABS_API_KEY"];
  if (!apiKey) {
    res.status(503).json({ error: "tts_not_configured" });
    return;
  }

  const parsed = BodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_body", details: parsed.error.flatten() });
    return;
  }
  const { text, voiceId, cachePolicy, phraseKey } = parsed.data;

  // §42 claims gate (Wave-2 PR5): never synthesize blocked claim language,
  // regardless of which client sent it. Mirrors the app's speak() gate.
  const blockedConcept = findBlockedConcept(text);
  if (blockedConcept) {
    logger.warn({ blockedConcept }, "voice/tts: claims gate suppressed a line");
    res.status(422).json({ error: "claims_gate_suppressed" });
    return;
  }

  // Decide caching up front. Only explicit static opt-ins whose
  // (voiceId, phraseKey) pair is allowlisted are eligible; everything else
  // (the personalized closing line, ad-hoc playback) bypasses the cache and
  // stays no-store.
  const cacheEligible = isCacheable(cachePolicy, voiceId, phraseKey);
  const cacheKey = cacheEligible ? buildCacheKey(voiceId, phraseKey!, text) : null;

  const sendAudio = (buf: Buffer, status: TtsCacheStatus, contentType: string) => {
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Length", String(buf.byteLength));
    res.setHeader("X-TTS-Cache", status);
    // Cached static phrases may be re-used by the client; dynamic lines and
    // bypasses always stay no-store so personalized audio is never retained.
    res.setHeader(
      "Cache-Control",
      status === "BYPASS" ? "no-store" : "private, max-age=86400",
    );
    res.status(200).send(buf);
  };

  if (cacheKey) {
    const hit = ttsAudioCache.get(cacheKey);
    if (hit) {
      sendAudio(hit.audio, "HIT", hit.contentType);
      return;
    }
  }

  try {
    const upstream = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_turbo_v2_5",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.35,
            use_speaker_boost: true,
          },
        }),
      },
    );

    if (!upstream.ok) {
      const errText = await upstream.text().catch(() => "");
      req.log.warn({ status: upstream.status, errText }, "ElevenLabs TTS upstream error");
      res.status(upstream.status === 401 ? 503 : 502).json({ error: "tts_upstream_error" });
      return;
    }

    const arrayBuf = await upstream.arrayBuffer();
    const buf = Buffer.from(arrayBuf);

    if (cacheKey) {
      ttsAudioCache.set(cacheKey, { audio: buf, contentType: "audio/mpeg" });
      sendAudio(buf, "MISS", "audio/mpeg");
    } else {
      sendAudio(buf, "BYPASS", "audio/mpeg");
    }
  } catch (err) {
    logger.error({ err: serializeError(err) }, "voice/tts proxy failed");
    res.status(502).json({ error: "tts_request_failed" });
  }
});

export default router;
