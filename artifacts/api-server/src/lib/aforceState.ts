/**
 * AForce OS user-state persistence layer.
 *
 * V1 single-user (DEFAULT_USER_ID). The first time a user touches the
 * app we seed a row from `defaultSeed()` so the client gets a sane
 * starting state instead of a sparse object.
 *
 * `getUserState` always returns a complete row; `updateUserState`
 * applies a partial patch and bumps `updated_at` so the WebSocket hub
 * can broadcast the change.
 */

import { db, aforceUserState, type AforceUserStateRow } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

export const DEFAULT_USER_ID = "default";

function defaultSeed(): Omit<AforceUserStateRow, "updatedAt"> {
  // Mirrors `artifacts/aforce-os/data/mockData.ts:defaultUserState` so
  // first-load behavior matches what the old in-memory mock produced.
  const lastIntake = new Date(Date.now() - 38 * 60 * 1000);
  const wake = new Date();
  wake.setHours(6, 30, 0, 0);
  return {
    userId: DEFAULT_USER_ID,
    unitsConsumedToday: 4,
    ozConsumedToday: 60,
    lastIntakeTime: lastIntake,
    lastIntakeType: "aforce_stick",
    symptomState: "none",
    symptoms: [],
    urineSignal: 3,
    energyState: "steady",
    heatLoad: 4,
    sweatRate: 3,
    activityLevel: 5,
    complianceStreak: 4,
    dailyTarget: 8,
    ozTarget: 96,
    isSnoozed: false,
    snoozeUntil: null,
    bodyWeightLbs: 180,
    isAwake: true,
    wakeTime: wake,
    overnightLossOz: 14,
    hasSeenMorningCommand: false,
    appleHealth: null,
    confirmationDelta: null,
    confirmationDeltaSetAt: null,
    clutchDecayBoostUntil: null,
    clutchActive: false,
    weatherTempC: null,
    weatherHumidity: null,
    weatherCity: null,
    weatherFetchedAt: null,
  };
}

export async function getUserState(userId: string = DEFAULT_USER_ID): Promise<AforceUserStateRow> {
  const [existing] = await db.select().from(aforceUserState).where(eq(aforceUserState.userId, userId)).limit(1);
  if (existing) return existing;

  const seed = defaultSeed();
  const [created] = await db
    .insert(aforceUserState)
    .values({ ...seed, userId })
    .onConflictDoNothing()
    .returning();
  if (created) return created;
  // Race: another request seeded it first — re-read.
  const [retry] = await db.select().from(aforceUserState).where(eq(aforceUserState.userId, userId)).limit(1);
  if (!retry) throw new Error("Failed to seed AForce user state");
  return retry;
}

export async function updateUserState(
  userId: string,
  patch: Partial<Omit<AforceUserStateRow, "userId" | "updatedAt">>,
): Promise<AforceUserStateRow> {
  // Ensure row exists (idempotent).
  await getUserState(userId);

  const [updated] = await db
    .update(aforceUserState)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(aforceUserState.userId, userId))
    .returning();
  if (!updated) throw new Error(`AForce user state not found for ${userId}`);
  return updated;
}

/**
 * Atomic intake increment — units +1, oz += amount, last-intake fields
 * set, snooze cleared. Performed in a single SQL UPDATE so concurrent
 * requests can't lose increments to a read-modify-write race.
 */
export async function incrementIntake(
  userId: string,
  ozAmount: number,
  fluidType: string,
  now: Date,
): Promise<AforceUserStateRow> {
  await getUserState(userId);
  const [updated] = await db
    .update(aforceUserState)
    .set({
      unitsConsumedToday: sql`${aforceUserState.unitsConsumedToday} + 1`,
      ozConsumedToday: sql`${aforceUserState.ozConsumedToday} + ${ozAmount}`,
      lastIntakeTime: now,
      lastIntakeType: fluidType,
      isSnoozed: false,
      snoozeUntil: null,
      hasSeenMorningCommand: true,
      updatedAt: now,
    })
    .where(eq(aforceUserState.userId, userId))
    .returning();
  if (!updated) throw new Error(`AForce user state not found for ${userId}`);
  return updated;
}
