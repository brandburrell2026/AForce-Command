/**
 * POST /api/voice/tts
 *
 * Proxies to ElevenLabs text-to-speech so the mobile client never sees
 * the API key. Body: `{ text: string, voiceId: string }`. Streams the
 * MP3 audio back to the caller.
 *
 * Light rate-limit applied via the existing checkout limiter pattern to
 * prevent abuse — TTS calls cost real money on ElevenLabs, so we cap
 * how often a single client can hit this even though we don't require
 * auth (voice playback should still work on the marketing-tier paths).
 */

import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const BodySchema = z.object({
  text: z.string().min(1).max(800),
  voiceId: z.string().min(8).max(64),
});

const ttsLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
});

router.post("/voice/tts", ttsLimiter, async (req: Request, res: Response) => {
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
  const { text, voiceId } = parsed.data;

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
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Length", String(buf.byteLength));
    res.setHeader("Cache-Control", "no-store");
    res.status(200).send(buf);
  } catch (err) {
    logger.error({ err }, "voice/tts proxy failed");
    res.status(502).json({ error: "tts_request_failed" });
  }
});

export default router;
