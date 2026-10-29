import { Router, raw } from "express";
import rateLimit from "express-rate-limit";
import { verifyWebhook } from "@clerk/express/webhooks";
import { z } from "zod";
import { defaultTravelRepository } from "../lib/travel/repository";
/** This signature-verified machine endpoint stays available when the pilot is
 * disabled. Identity deletion must stop alerts and remove cloud travel records. */
export function buildTravelIdentityEventsRouter(
  repository = defaultTravelRepository,
) {
  const router = Router();
  router.use(raw({ type: "application/json", limit: "16kb" }));
  router.use((_req, res, next) => {
    res.setHeader("Cache-Control", "private, no-store");
    next();
  });
  router.use(
    rateLimit({
      windowMs: 60000,
      limit: 60,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );
  router.post("/", async (req, res) => {
    if (!process.env["CLERK_WEBHOOK_SIGNING_SECRET"]?.startsWith("whsec_")) {
      res.status(503).json({ error: "identity_events_not_configured" });
      return;
    }
    let event: Awaited<ReturnType<typeof verifyWebhook>>;
    try {
      event = await verifyWebhook(req);
    } catch {
      res.status(401).json({ error: "invalid_signature" });
      return;
    }
    if (event.type !== "user.deleted") {
      res.json({ received: true });
      return;
    }
    const parsed = z
      .object({
        id: z
          .string()
          .regex(/^user_[A-Za-z0-9]+$/)
          .max(128),
      })
      .safeParse(event.data);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_identity_event" });
      return;
    }
    try {
      const repo = await repository();
      if (!(await repo.ready())) throw new Error("schema");
      await repo.purge(parsed.data.id);
      res.json({ received: true });
    } catch {
      res.status(503).json({ error: "travel_cleanup_pending" });
    }
  });
  return router;
}
export default buildTravelIdentityEventsRouter();
