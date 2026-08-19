import { Router, type IRouter } from "express";
import { serializeError } from "../../lib/serializeError";
import { getUserState } from "../../lib/aforceState";
import { triggerWhoopRefreshIfStale } from "../../lib/whoopForegroundRefresh";
import { logger } from "../../lib/logger";
import { resolveUserId } from "./shared";

const router: IRouter = Router();

// ─── GET /state ────────────────────────────────────────────────────────────────
router.get("/state", async (req, res) => {
  try {
    const userId = resolveUserId(req);
    const row = await getUserState(userId);
    res.json({ userState: row, serverTime: new Date().toISOString() });
    // WHOOP sweep redesign (2026-08-19): the app's own state read doubles as
    // the "member is active" signal. Fire-and-forget AFTER the response —
    // stale-and-eligible connections refresh, fresh ones cost one control-row
    // read, and this line can never fail or slow the response.
    triggerWhoopRefreshIfStale(userId);
  } catch (err) {
    logger.error({ err: serializeError(err) }, "GET /aforce/state failed");
    res.status(500).json({ error: "state_fetch_failed" });
  }
});

export default router;
