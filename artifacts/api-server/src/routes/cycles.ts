import { Router, type IRouter, type Request } from "express";
import { requireAuth } from "../middlewares/requireAuth";
import {
  appendCycle,
  listCycles,
  getStats,
  type CycleRecord,
} from "../lib/store";

const router: IRouter = Router();

/**
 * Owner of a cycle request is the authenticated Clerk user (`req.userId`),
 * populated by `requireAuth`. We deliberately do NOT read the client-supplied
 * `x-device-id` header for authorization: trusting it allowed any caller to
 * read or write another user's cycles by spoofing the header (IDOR). This
 * mirrors the fix already applied to `scans.ts` (its header documents the
 * same defect); the two routes share the same in-memory store shape, and
 * this closes the twin that had been left unremediated. All persistence is
 * keyed by the verified user id only.
 *
 * The store's `deviceId` key/field is now the verified user id (same as
 * scans.ts, where the response `deviceId` is `rec.userId`): the storage
 * SHAPE is unchanged so the eventual swap to a real per-user database stays
 * mechanical, only the KEY is now trustworthy.
 */
function userIdOf(req: Request): string | null {
  const uid = req.userId;
  if (typeof uid !== "string") return null;
  const trimmed = uid.trim();
  return trimmed.length > 0 ? trimmed : null;
}

router.get("/cycles", requireAuth, (req, res) => {
  const userId = userIdOf(req);
  if (!userId) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  const limit = Math.min(
    Number.parseInt(String(req.query.limit ?? "50"), 10) || 50,
    200,
  );
  res.json({ cycles: listCycles(userId, limit), stats: getStats(userId) });
});

router.post("/cycles", requireAuth, (req, res) => {
  const userId = userIdOf(req);
  if (!userId) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  const body = req.body ?? {};
  const record: CycleRecord = {
    id: typeof body.id === "string" ? body.id : `cyc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    deviceId: userId,
    loggedAt: typeof body.loggedAt === "string" ? body.loggedAt : new Date().toISOString(),
    fluidType: typeof body.fluidType === "string" ? body.fluidType : "unknown",
    ozAmount: typeof body.ozAmount === "number" ? body.ozAmount : 0,
    scoreBefore: typeof body.scoreBefore === "number" ? body.scoreBefore : 0,
    scoreAfter: typeof body.scoreAfter === "number" ? body.scoreAfter : 0,
    performanceState: typeof body.performanceState === "string" ? body.performanceState : "RECOVERING",
  };
  appendCycle(record);
  res.status(201).json({ cycle: record });
});

export default router;
