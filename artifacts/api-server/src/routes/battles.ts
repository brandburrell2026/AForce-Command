/**
 * Territory battles — per-user persisted view of regional rivalries.
 *
 * Mounted under `/api/battles`. The Expo client (`services/battleService.ts`)
 * is the only consumer.
 *
 *   GET  /                  → list the user's own battles
 *   POST /                  → open a fresh battle between two regions
 *   POST /:id/support       → bump one side's score by 1
 *
 * Battles are SCOPED PER USER (owner_user_id = req.userId) so each
 * user's interactions stay isolated; the underlying region catalog is
 * static and lives client-side in `mockTerritoryData.ts`.
 *
 * This route used to seed `SEED_BATTLES` into a real user's rows on
 * first read. Fabricated rivalries written into real user data become
 * indistinguishable from real ones forever, which the Constitution
 * forbids ("observation never diagnosis", "trust over attention"), so
 * the write is gone and the seed set is now a READ-SIDE EXCLUSION only:
 * rows already written by the old behavior stay in the database but are
 * never served again. Nothing is deleted and no migration is required.
 */

import { Router, type IRouter, type Request } from "express";
import { z } from "zod";
import { db, aforceBattles } from "@workspace/db";
import { and, eq, asc, notInArray } from "drizzle-orm";
import { DEFAULT_USER_ID } from "../lib/aforceState";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.use(requireAuth);

function resolveUserId(req: Request): string {
  return req.userId ?? DEFAULT_USER_ID;
}

/* ─── Legacy seed set — read-side exclusion list, never written ───────────── */
interface SeedBattle {
  id: string;
  side1RegionId: string;
  side2RegionId: string;
  side1Score: number;
  side2Score: number;
  hoursRemaining: number;
  leader: "side1" | "side2" | "tie";
  trend: "up" | "flat" | "down";
}

const SEED_BATTLES: ReadonlyArray<SeedBattle> = [
  { id: "b_mia_nyc",    side1RegionId: "city_miami_fl", side2RegionId: "city_nyc_ny", side1Score: 86, side2Score: 88, hoursRemaining: 11, leader: "side2", trend: "up"   },
  { id: "b_fl_ca",      side1RegionId: "state_fl",      side2RegionId: "state_ca",    side1Score: 84, side2Score: 83, hoursRemaining: 22, leader: "side1", trend: "flat" },
  { id: "b_pulse_apex", side1RegionId: "team_pulse",    side2RegionId: "team_apex",   side1Score: 89, side2Score: 86, hoursRemaining:  6, leader: "side1", trend: "up"   },
];

// Seeded rows were stored user-prefixed (`<userId>:b_mia_nyc`), so the
// exclusion list has to be rebuilt per caller. User-opened battles carry a
// `b_<timestamp>` id and never collide with these.
function seededBattleIds(userId: string): string[] {
  return SEED_BATTLES.map((b) => `${userId}:${b.id}`);
}

interface BattleResponse {
  id: string;
  side1RegionId: string;
  side2RegionId: string;
  side1Score: number;
  side2Score: number;
  hoursRemaining: number;
  leader: "side1" | "side2" | "tie";
  trend: "up" | "flat" | "down";
}

function rowToBattle(row: typeof aforceBattles.$inferSelect): BattleResponse {
  return {
    id: row.id,
    side1RegionId: row.side1RegionId,
    side2RegionId: row.side2RegionId,
    side1Score: row.side1Score,
    side2Score: row.side2Score,
    hoursRemaining: row.hoursRemaining,
    leader: row.leader as BattleResponse["leader"],
    trend: row.trend as BattleResponse["trend"],
  };
}

function deriveLeader(s1: number, s2: number): "side1" | "side2" | "tie" {
  if (s1 === s2) return "tie";
  return s1 > s2 ? "side1" : "side2";
}

/* ─── GET / ───────────────────────────────────────────────────────────────── */
router.get("/", async (req, res) => {
  try {
    const userId = resolveUserId(req);
    const rows = await db
      .select()
      .from(aforceBattles)
      .where(
        and(
          eq(aforceBattles.ownerUserId, userId),
          notInArray(aforceBattles.id, seededBattleIds(userId)),
        ),
      )
      .orderBy(asc(aforceBattles.hoursRemaining));
    res.json({ battles: rows.map(rowToBattle) });
  } catch (err) {
    req.log.error({ err }, "GET /battles failed");
    res.status(500).json({ error: "battles_fetch_failed" });
  }
});

/* ─── POST / — open a new battle ──────────────────────────────────────────── */
const openBattleSchema = z.object({
  side1RegionId: z.string().min(1).max(64),
  side2RegionId: z.string().min(1).max(64),
});

router.post("/", async (req, res) => {
  try {
    const userId = resolveUserId(req);
    const parsed = openBattleSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_body", issues: parsed.error.issues });
      return;
    }
    const { side1RegionId, side2RegionId } = parsed.data;
    if (side1RegionId === side2RegionId) {
      res.status(400).json({ error: "same_side" });
      return;
    }
    const id = `${userId}:b_${Date.now()}`;
    const [row] = await db
      .insert(aforceBattles)
      .values({
        id,
        ownerUserId: userId,
        side1RegionId,
        side2RegionId,
        side1Score: 50,
        side2Score: 50,
        hoursRemaining: 24,
        leader: "tie",
        trend: "flat",
      })
      .returning();
    if (!row) {
      res.status(500).json({ error: "battle_open_failed" });
      return;
    }
    res.status(201).json({ battle: rowToBattle(row) });
  } catch (err) {
    req.log.error({ err }, "POST /battles failed");
    res.status(500).json({ error: "battle_open_failed" });
  }
});

/* ─── POST /:id/support ───────────────────────────────────────────────────── */
const supportSchema = z.object({
  side: z.enum(["side1", "side2"]),
});

router.post("/:id/support", async (req, res) => {
  try {
    const userId = resolveUserId(req);
    const id = String(req.params["id"] ?? "");
    if (!id) {
      res.status(400).json({ error: "missing_id" });
      return;
    }
    const parsed = supportSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_body", issues: parsed.error.issues });
      return;
    }
    const { side } = parsed.data;

    // Read-modify-write under the user scope so two users supporting
    // distinct battles never collide. Single-user concurrency is bounded
    // by client (single device) so we don't need a row lock here.
    const [existing] = await db
      .select()
      .from(aforceBattles)
      .where(and(eq(aforceBattles.ownerUserId, userId), eq(aforceBattles.id, id)))
      .limit(1);
    if (!existing) {
      res.status(404).json({ error: "battle_not_found" });
      return;
    }

    const nextS1 = side === "side1" ? Math.min(100, existing.side1Score + 1) : existing.side1Score;
    const nextS2 = side === "side2" ? Math.min(100, existing.side2Score + 1) : existing.side2Score;
    const nextLeader = deriveLeader(nextS1, nextS2);

    const [row] = await db
      .update(aforceBattles)
      .set({
        side1Score: nextS1,
        side2Score: nextS2,
        leader: nextLeader,
        updatedAt: new Date(),
      })
      .where(and(eq(aforceBattles.ownerUserId, userId), eq(aforceBattles.id, id)))
      .returning();

    if (!row) {
      res.status(500).json({ error: "battle_support_failed" });
      return;
    }
    res.json({ battle: rowToBattle(row) });
  } catch (err) {
    req.log.error({ err }, "POST /battles/:id/support failed");
    res.status(500).json({ error: "battle_support_failed" });
  }
});

export default router;
