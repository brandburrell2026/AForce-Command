import { Router, type IRouter } from "express";
import { serializeError } from "../../lib/serializeError";
import { getUserState } from "../../lib/aforceState";
import { triggerWhoopRefreshIfStale } from "../../lib/whoopForegroundRefresh";
import {
  parseClientHeader,
  evaluateClientSupport,
  clientPolicyPayload,
  CLIENT_HEADER,
} from "../../lib/clientVersion";
import { logger } from "../../lib/logger";
import { resolveUserId } from "./shared";

const router: IRouter = Router();

// ─── GET /state ────────────────────────────────────────────────────────────────
router.get("/state", async (req, res) => {
  try {
    const userId = resolveUserId(req);
    const row = await getUserState(userId);
    // ADDITIVE, ON THE BOOTSTRAP EVERY CLIENT ALREADY CALLS. A new endpoint
    // would be a second round trip and a second thing to fail; an unknown key
    // costs an old build nothing, because JSON readers ignore what they do
    // not destructure. Both minimums ship at 0, so this publishes a policy
    // that gates nobody — raising them is a separate founder decision.
    const clientIdentity = parseClientHeader(req.headers[CLIENT_HEADER]);
    res.json({
      userState: row,
      serverTime: new Date().toISOString(),
      clientPolicy: clientPolicyPayload(),
    });
    // TELEMETRY, AFTER the response and never able to affect it. This is the
    // "which builds are actually in the field" evidence that ruling R3's
    // sparse-retirement plan requires and that nothing could answer before.
    // A client that sends no header logs as `unknown` rather than being
    // omitted, so the unknown population is itself visible.
    logger.info(
      {
        userId,
        client: clientIdentity ?? "unknown",
        support: evaluateClientSupport(clientIdentity),
      },
      "aforce.client_version",
    );
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
