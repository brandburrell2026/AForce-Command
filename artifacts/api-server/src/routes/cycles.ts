import { Router, type IRouter, type Request } from "express";
import {
  appendCycle,
  listCycles,
  getStats,
  type CycleRecord,
} from "../lib/store";

const router: IRouter = Router();

function deviceIdOf(req: Request): string | null {
  const raw = req.header("x-device-id");
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed.length < 6 || trimmed.length > 128) return null;
  return trimmed;
}

router.get("/cycles", (req, res) => {
  const deviceId = deviceIdOf(req);
  if (!deviceId) {
    res.status(400).json({ error: "missing or invalid x-device-id header" });
    return;
  }
  const limit = Math.min(
    Number.parseInt(String(req.query.limit ?? "50"), 10) || 50,
    200,
  );
  res.json({ cycles: listCycles(deviceId, limit), stats: getStats(deviceId) });
});

router.post("/cycles", (req, res) => {
  const deviceId = deviceIdOf(req);
  if (!deviceId) {
    res.status(400).json({ error: "missing or invalid x-device-id header" });
    return;
  }
  const body = req.body ?? {};
  const record: CycleRecord = {
    id: typeof body.id === "string" ? body.id : `cyc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    deviceId,
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
