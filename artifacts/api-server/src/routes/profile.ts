import { Router, type IRouter, type Request } from "express";
import { db, createDrizzleProfileRepo, type BaselineTargets } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";

/**
 * Adaptive Profile Engine™ routes (Section 18) — the server side of Contract
 * A. Thin persist layer over the pure `profileRepo`: the client runs the
 * decision logic (major vs minor, confidence, Evidence Engine™ copy) since
 * the engine + config/hydroStateModel.ts live in the app package; this route
 * only persists the result via the atomic `recordMajorChange` transaction.
 *
 * Mounted at `/api/aforce/profile`:
 *   GET  /api/aforce/profile          → current version + active baseline
 *   POST /api/aforce/profile/version  → mint a Profile Version™ (idempotent
 *                                       on (userId, clientChangeId))
 */
const repo = createDrizzleProfileRepo(db);

const router: IRouter = Router();

function userIdOf(req: Request): string | null {
  const uid = req.userId;
  return typeof uid === "string" && uid.length > 0 ? uid : null;
}

router.get("/", requireAuth, async (req, res) => {
  const userId = userIdOf(req);
  if (!userId) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  try {
    const [profile, baseline] = await Promise.all([
      repo.getCurrentProfile(userId),
      repo.getActiveBaseline(userId),
    ]);
    res.json({ profile, baseline });
  } catch (err) {
    req.log?.error({ err }, "profile:get failed");
    res.status(500).json({ error: "get_failed" });
  }
});

router.post("/version", requireAuth, async (req, res) => {
  const userId = userIdOf(req);
  if (!userId) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const snapshot = body.snapshot;
  const changedFields = body.changedFields;
  const explanation = body.explanation;
  const initialConfidence = body.initialConfidence;
  const clientChangeId = body.clientChangeId;
  // §20 recalibrated targets — optional; persisted verbatim on the new
  // baseline. Must be an object when present (the repo doesn't interpret it).
  const targets = body.targets;

  // Minimal validation — reject obviously malformed payloads before touching
  // the DB. The client is the single producer (its own engine output), so
  // this guards against corruption / bad retries, not adversarial input.
  if (
    typeof snapshot !== "object" ||
    snapshot === null ||
    !Array.isArray(changedFields) ||
    changedFields.some((f) => typeof f !== "string") ||
    changedFields.length === 0 ||
    typeof explanation !== "string" ||
    typeof initialConfidence !== "number" ||
    !Number.isFinite(initialConfidence) ||
    (clientChangeId !== undefined && typeof clientChangeId !== "string") ||
    (targets !== undefined &&
      targets !== null &&
      typeof targets !== "object")
  ) {
    res.status(400).json({ error: "invalid_payload" });
    return;
  }

  try {
    const result = await repo.recordMajorChange({
      userId,
      snapshot: snapshot as Record<string, unknown>,
      changedFields: changedFields as string[],
      explanation,
      initialConfidence,
      targets: (targets ?? null) as BaselineTargets | null,
      clientChangeId: clientChangeId as string | undefined,
    });
    res.status(result.minted ? 201 : 200).json(result);
  } catch (err) {
    req.log?.error({ err }, "profile:mint failed");
    res.status(500).json({ error: "mint_failed" });
  }
});

export default router;
