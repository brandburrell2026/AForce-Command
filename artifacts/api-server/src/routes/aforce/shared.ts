import { type Request } from "express";
import { db, aforceAchievements } from "@workspace/db";
import { DEFAULT_USER_ID } from "../../lib/aforceState";
import { publish } from "../../lib/aforceHub";

// Resolve the userId set by requireAuth, with a defensive fallback so a
// misconfigured deployment never crashes the route.
export function resolveUserId(req: Request): string {
  return req.userId ?? DEFAULT_USER_ID;
}

export function broadcastState(userId: string, row: unknown) {
  publish(userId, { type: "state", userState: row });
}

const ACH_CODES = [
  "first_sip", "streak_3", "streak_7", "streak_30",
  "sodium_master", "heat_survivor", "recovery_rookie", "social_sentinel",
  "aforce_convert", "hydration_engineer", "pdf_pioneer", "sensor_sync",
] as const;
type AchCode = (typeof ACH_CODES)[number];

export { ACH_CODES };
export type { AchCode };

/**
 * Insert an unlock row, ignoring duplicates. Returns true if this call
 * was the one that actually persisted the unlock (used to drive the
 * client's haptic / toast).
 */
export async function unlockAchievementCode(userId: string, code: AchCode): Promise<boolean> {
  // Atomic upsert: relies on the (user_id, code) UNIQUE index. If a
  // concurrent request already inserted, ON CONFLICT swallows it and
  // returning() yields zero rows, which we surface as newlyUnlocked=false.
  const inserted = await db
    .insert(aforceAchievements)
    .values({ userId, code })
    .onConflictDoNothing({ target: [aforceAchievements.userId, aforceAchievements.code] })
    .returning({ id: aforceAchievements.id });
  return inserted.length > 0;
}
