import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { requireRealAuth } from "../middlewares/requireRealAuth";
import {
  CircleSharingError,
  listSharingGrants,
  updateSharingGrant,
  readCircleActivity,
} from "../lib/circleSharing";

const router = Router();
router.use(["/sharing", "/activity"], requireRealAuth, (_req, res, next) => {
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
const versionSchema = z.number().int().min(0).max(2147483646);
const updateSchema = z
  .object({
    fields: z
      .array(z.enum(["score", "state"]))
      .max(2)
      .refine((fields) => new Set(fields).size === fields.length),
    expectedVersion: versionSchema,
    acknowledgementVersion: z.string().optional(),
  })
  .strict();
function failure(res: import("express").Response, err: unknown) {
  if (err instanceof CircleSharingError)
    res.status(err.status).json({ error: err.code });
  else res.status(500).json({ error: "circle_sharing_failed" });
}
// Inspection and revoke remain available with rollout disabled.
router.get("/sharing", async (req, res) => {
  try {
    res.json({ grants: await listSharingGrants(req.userId!) });
  } catch (err) {
    failure(res, err);
  }
});
router.put("/sharing/:memberUserId", mutationLimiter, async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_body" });
    return;
  }
  try {
    res.json({
      grant: await updateSharingGrant(
        req.userId!,
        String(req.params.memberUserId),
        parsed.data,
      ),
    });
  } catch (err) {
    failure(res, err);
  }
});
router.delete("/sharing/:memberUserId", mutationLimiter, async (req, res) => {
  const parsed = z
    .object({ expectedVersion: versionSchema })
    .strict()
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_body" });
    return;
  }
  try {
    res.json({
      grant: await updateSharingGrant(
        req.userId!,
        String(req.params.memberUserId),
        { ...parsed.data, fields: [] },
      ),
    });
  } catch (err) {
    failure(res, err);
  }
});
router.get("/activity", async (req, res) => {
  try {
    res.json({ activity: await readCircleActivity(req.userId!) });
  } catch (err) {
    failure(res, err);
  }
});
export default router;
