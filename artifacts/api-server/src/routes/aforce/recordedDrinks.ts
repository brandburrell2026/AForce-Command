/**
 * Record drinks that do not have an approved HydroState rule yet.
 *
 * This route must remain separate from `/intake`. It writes no user state,
 * emits no state broadcast, and never becomes score evidence. That keeps the
 * product promise exact: only water moves HydroState today.
 */
import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { aforceRecordedDrinks, db } from "@workspace/db";
import { intakeLimiter } from "../../middlewares/rateLimits";
import { logger } from "../../lib/logger";
import { resolveUserId } from "./shared";
import { recordedDrinkSchema } from "./recordedDrinksContract";

const router: IRouter = Router();

router.post("/drinks", intakeLimiter, async (req, res) => {
  const parsed = recordedDrinkSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "recorded_drink_invalid" });

  try {
    const userId = resolveUserId(req);
    const body = parsed.data;
    const [inserted] = await db
      .insert(aforceRecordedDrinks)
      .values({ userId, ...body })
      .onConflictDoNothing({
        target: [aforceRecordedDrinks.userId, aforceRecordedDrinks.clientEventId],
      })
      .returning();

    if (inserted) return res.status(201).json({ drink: inserted });

    // A retry with the same client key is already a successful save. Return
    // the original row instead of manufacturing another record.
    if (body.clientEventId) {
      const [existing] = await db
        .select()
        .from(aforceRecordedDrinks)
        .where(and(
          eq(aforceRecordedDrinks.userId, userId),
          eq(aforceRecordedDrinks.clientEventId, body.clientEventId),
        ))
        .limit(1);
      if (existing) return res.json({ drink: existing, replayed: true });
    }
    throw new Error("recorded_drink_insert_failed");
  } catch (err) {
    logger.error({ err }, "POST /aforce/drinks failed");
    return res.status(500).json({ error: "recorded_drink_write_failed" });
  }
});

router.get("/drinks", async (req, res) => {
  const limit = z.coerce.number().int().min(1).max(100).catch(25).parse(req.query["limit"]);
  try {
    const userId = resolveUserId(req);
    const drinks = await db
      .select()
      .from(aforceRecordedDrinks)
      .where(eq(aforceRecordedDrinks.userId, userId))
      .orderBy(desc(aforceRecordedDrinks.recordedAt))
      .limit(limit);
    return res.json({ drinks });
  } catch (err) {
    logger.error({ err }, "GET /aforce/drinks failed");
    return res.status(500).json({ error: "recorded_drinks_read_failed" });
  }
});

export default router;
