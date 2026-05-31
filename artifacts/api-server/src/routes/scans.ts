import { Router, type IRouter, type Request } from "express";
import {
  db,
  createDrizzleHydroScanRepo,
  type HydroScanRecord,
} from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

/**
 * Persistence: durable, indexed by (userId, scannedAt DESC), idempotent
 * on (userId, clientScanId). The repo is pure — see lib/db/src/scanRepo.ts.
 *
 * The public request/response shape on this route is intentionally
 * preserved verbatim from the prior in-memory implementation so any
 * future mobile client expecting the old contract continues to work
 * unchanged. New richer fields land inside the persisted JSONB
 * `payload`, not in the response.
 */
const repo = createDrizzleHydroScanRepo(db);

/** Public response row — byte-for-byte the prior in-memory shape. */
interface ScanResponse {
  id: string;
  deviceId: string;
  loggedAt: string;
  source: "barcode" | "qr" | "manual" | "camera";
  rawValue: string;
  productId: string | null;
  productName: string;
  brand: string | null;
  verdict: string;
  fitScore: number;
  scoreBefore: number;
  scoreAfter: number;
  performanceState: string;
  recommendedProductId: string | null;
}

const PUBLIC_SOURCES = ["barcode", "qr", "manual", "camera"] as const;
type PublicSource = (typeof PUBLIC_SOURCES)[number];

/**
 * Owner of a scan request is the authenticated Clerk user (`req.userId`),
 * populated by `requireAuth`. We deliberately do NOT read the client-supplied
 * `x-device-id` header for authorization: trusting it allowed any caller to
 * read or write another user's scans by spoofing the header (IDOR). All
 * persistence is now keyed by the verified user id only.
 */
function userIdOf(req: Request): string | null {
  const uid = req.userId;
  if (typeof uid !== "string") return null;
  const trimmed = uid.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function coercePublicSource(v: unknown): PublicSource {
  return (PUBLIC_SOURCES as readonly string[]).includes(v as string)
    ? (v as PublicSource)
    : "manual";
}

function toResponse(rec: HydroScanRecord): ScanResponse {
  const payload = (rec.payload ?? {}) as {
    scoreBefore?: number;
    scoreAfter?: number;
    /** Original `loggedAt` string from the POST body, stashed verbatim
     *  so the GET response echoes the client's exact input — matching
     *  the legacy in-memory store's "no normalization" behavior. */
    loggedAtRaw?: string;
  };
  return {
    id: rec.clientScanId,
    deviceId: rec.userId,
    loggedAt:
      typeof payload.loggedAtRaw === "string"
        ? payload.loggedAtRaw
        : rec.scannedAt.toISOString(),
    source: coercePublicSource(rec.sourceKind),
    rawValue: rec.rawValue,
    productId: rec.productId,
    productName: rec.productName,
    brand: rec.brand,
    verdict: rec.verdict,
    fitScore: rec.currentFitScore,
    scoreBefore: typeof payload.scoreBefore === "number" ? payload.scoreBefore : 0,
    scoreAfter: typeof payload.scoreAfter === "number" ? payload.scoreAfter : 0,
    performanceState: rec.evaluatedAgainstState,
    recommendedProductId: rec.aforceEquivalentId,
  };
}

router.get("/scans", requireAuth, async (req, res) => {
  const userId = userIdOf(req);
  if (!userId) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  // Replicate the legacy in-memory route's exact limit math, including
  // its quirks: parseInt failures default to 50, the upper bound is
  // hard-capped at 200, and *negative* values flow through to a tail-
  // trimming slice (legacy used Array.prototype.slice(0, N), which for
  // N<0 returns "all but the last |N| items"). The legacy in-memory
  // store capped per-device history at 500 rows; we fetch that same
  // ceiling from the repo so a negative slice over large histories
  // matches what the old store would have produced.
  //
  // Ordering contract (codified, NOT a drift from any documented
  // legacy contract): rows are returned `scannedAt` DESC. The legacy
  // store happened to return insertion order because it prepended on
  // append; that was an in-memory artifact, not a public contract.
  // The DB-backed repo is indexed by `(user_id, scanned_at)` and that
  // ordering is now the durable contract for this endpoint.
  const limit = Math.min(
    Number.parseInt(String(req.query.limit ?? "50"), 10) || 50,
    200,
  );
  const LEGACY_MAX_PER_DEVICE = 500;
  try {
    const rows = await repo.listForUser(userId, {
      limit: LEGACY_MAX_PER_DEVICE,
    });
    const sliced = rows.slice(0, limit);
    res.json({ scans: sliced.map(toResponse) });
  } catch (err) {
    req.log?.error({ err }, "scans:list failed");
    res.status(500).json({ error: "list_failed" });
  }
});

router.post("/scans", requireAuth, async (req, res) => {
  const userId = userIdOf(req);
  if (!userId) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  const body = req.body ?? {};
  // Legacy semantics: any string `id` — including the empty string —
  // was accepted verbatim. Only a non-string triggered generation.
  const clientScanId =
    typeof body.id === "string"
      ? body.id
      : `scan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const loggedAtRaw =
    typeof body.loggedAt === "string" ? body.loggedAt : new Date().toISOString();
  // The persisted `scannedAt` column needs a valid Date for index +
  // ordering; if the client sends garbage we fall back to now() for
  // *storage*, but the response echoes `loggedAtRaw` from the payload
  // unchanged so the public contract stays byte-identical to legacy.
  const scannedAt = new Date(loggedAtRaw);
  const safeScannedAt = Number.isNaN(scannedAt.getTime()) ? new Date() : scannedAt;

  try {
    const stored = await repo.insert({
      userId,
      clientScanId,
      scannedAt: safeScannedAt,
      sourceKind: coercePublicSource(body.source),
      rawValue: typeof body.rawValue === "string" ? body.rawValue : "",
      productId: typeof body.productId === "string" ? body.productId : null,
      productName:
        typeof body.productName === "string" ? body.productName : "Unknown",
      brand: typeof body.brand === "string" ? body.brand : null,
      category: typeof body.category === "string" ? body.category : null,
      isAForce: body.isAForce === true,
      verdict: typeof body.verdict === "string" ? body.verdict : "unknown",
      currentFitScore: typeof body.fitScore === "number" ? body.fitScore : 0,
      efficiency: typeof body.efficiency === "number" ? body.efficiency : 0,
      efficiencyLabel:
        typeof body.efficiencyLabel === "string" ? body.efficiencyLabel : "",
      evaluatedAgainstState:
        typeof body.performanceState === "string"
          ? body.performanceState
          : "RECOVERING",
      aforceEquivalentId:
        typeof body.recommendedProductId === "string"
          ? body.recommendedProductId
          : null,
      // Preserve the entire submitted body verbatim — including the
      // legacy `scoreBefore` / `scoreAfter` fields, the original
      // `loggedAt` string (so the response can echo it unchanged),
      // and any future additions the client may carry — so nothing
      // is dropped on the way into history.
      payload: { ...body, loggedAtRaw },
    });
    res.status(201).json({ scan: toResponse(stored) });
  } catch (err) {
    req.log?.error({ err }, "scans:insert failed");
    res.status(500).json({ error: "insert_failed" });
  }
});

export default router;
