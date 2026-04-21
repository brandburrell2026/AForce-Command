import { Router, type IRouter, type Request } from "express";
import {
  appendScan,
  listScans,
  type ScanRecord,
} from "../lib/store";

const router: IRouter = Router();

function deviceIdOf(req: Request): string | null {
  const raw = req.header("x-device-id");
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed.length < 6 || trimmed.length > 128) return null;
  return trimmed;
}

router.get("/scans", (req, res) => {
  const deviceId = deviceIdOf(req);
  if (!deviceId) {
    res.status(400).json({ error: "missing or invalid x-device-id header" });
    return;
  }
  const limit = Math.min(
    Number.parseInt(String(req.query.limit ?? "50"), 10) || 50,
    200,
  );
  res.json({ scans: listScans(deviceId, limit) });
});

router.post("/scans", (req, res) => {
  const deviceId = deviceIdOf(req);
  if (!deviceId) {
    res.status(400).json({ error: "missing or invalid x-device-id header" });
    return;
  }
  const body = req.body ?? {};
  const record: ScanRecord = {
    id: typeof body.id === "string" ? body.id : `scan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    deviceId,
    loggedAt: typeof body.loggedAt === "string" ? body.loggedAt : new Date().toISOString(),
    source: ["barcode", "qr", "manual", "camera"].includes(body.source) ? body.source : "manual",
    rawValue: typeof body.rawValue === "string" ? body.rawValue : "",
    productId: typeof body.productId === "string" ? body.productId : null,
    productName: typeof body.productName === "string" ? body.productName : "Unknown",
    brand: typeof body.brand === "string" ? body.brand : null,
    verdict: typeof body.verdict === "string" ? body.verdict : "unknown",
    fitScore: typeof body.fitScore === "number" ? body.fitScore : 0,
    scoreBefore: typeof body.scoreBefore === "number" ? body.scoreBefore : 0,
    scoreAfter: typeof body.scoreAfter === "number" ? body.scoreAfter : 0,
    performanceState: typeof body.performanceState === "string" ? body.performanceState : "RECOVERING",
    recommendedProductId: typeof body.recommendedProductId === "string" ? body.recommendedProductId : null,
  };
  appendScan(record);
  res.status(201).json({ scan: record });
});

export default router;
