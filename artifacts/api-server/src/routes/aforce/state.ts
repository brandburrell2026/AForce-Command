import { Router, type IRouter } from "express";
import { getUserState } from "../../lib/aforceState";
import { logger } from "../../lib/logger";
import { resolveUserId } from "./shared";

const router: IRouter = Router();

// ─── GET /state ────────────────────────────────────────────────────────────────
router.get("/state", async (req, res) => {
  try {
    const userId = resolveUserId(req);
    const row = await getUserState(userId);
    res.json({ userState: row, serverTime: new Date().toISOString() });
  } catch (err) {
    logger.error({ err }, "GET /aforce/state failed");
    res.status(500).json({ error: "state_fetch_failed" });
  }
});

export default router;
