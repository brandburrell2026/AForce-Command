import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { requireRealAuth } from "../middlewares/requireRealAuth";
import {
  CircleMomentError,
  listIncomingMomentShares,
  revokeMomentShare,
  shareMoment,
} from "../lib/circleMoments";

const router = Router();
router.use("/moment-shares", requireRealAuth, (_req, res, next) => {
  res.setHeader("Cache-Control", "private, no-store");
  next();
});
const mutationLimiter = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: (req) => req.userId!,
  message: { error: "circle_rate_limited" },
});
const shareSchema = z
  .object({
    memberUserId: z.string().trim().min(1).max(256),
    momentId: z.string().trim().min(1).max(256),
    title: z.string().trim().min(1).max(120),
    startsAt: z.string().datetime({ offset: true }),
  })
  .strict();

function failure(res: import("express").Response, error: unknown) {
  if (error instanceof CircleMomentError)
    res.status(error.status).json({ error: error.code });
  else res.status(500).json({ error: "circle_moment_sharing_failed" });
}

router.get("/moment-shares", async (req, res) => {
  try {
    res.json({ shares: await listIncomingMomentShares(req.userId!) });
  } catch (error) {
    failure(res, error);
  }
});

router.post("/moment-shares", mutationLimiter, async (req, res) => {
  const parsed = shareSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_body" });
    return;
  }
  try {
    res.status(201).json({
      share: await shareMoment(req.userId!, {
        ...parsed.data,
        startsAt: new Date(parsed.data.startsAt),
      }),
    });
  } catch (error) {
    failure(res, error);
  }
});

router.delete("/moment-shares/:shareId", mutationLimiter, async (req, res) => {
  try {
    await revokeMomentShare(req.userId!, String(req.params.shareId));
    res.status(204).end();
  } catch (error) {
    failure(res, error);
  }
});

export default router;
