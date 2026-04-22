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

// Single source of truth for which fluid types are AForce-format
// products eligible for the protocol bonus. Server-side allow-list so
// arbitrary strings like "aforce_fake" don't slip the bonus.
export const AFORCE_FLUID_TYPES = [
  "aforce_stick",
  "aforce_rtd",
  "aforce_canister",
  "aforce_bulk_bag",
] as const;
export const ALL_FLUID_TYPES = ["water", ...AFORCE_FLUID_TYPES] as const;
export type FluidType = (typeof ALL_FLUID_TYPES)[number];
const AFORCE_SET: Set<string> = new Set(AFORCE_FLUID_TYPES);
export function isAforceFluid(fluidType: string): boolean {
  return AFORCE_SET.has(fluidType);
}

// UTC day key — used to detect a daily rollover. UTC is intentional for
// V1 (deterministic, no per-user TZ yet); switch to user-local once the
// profile carries a timezone.
function utcDayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Idempotently reset per-day counters when the row hasn't been touched
 * today (UTC).
 *
 * Race safety: the staleness check lives in the SQL `WHERE` clause —
 * `updated_at < date_trunc('day', now() AT TIME ZONE 'UTC')` — so the
 * UPDATE only fires when the row is actually stale at write time. A
 * second concurrent caller whose snapshot was stale but whose UPDATE
 * arrives after a fresh write will match 0 rows and become a no-op,
 * never clobbering today's counters back to zero. We then re-read to
 * return whichever state the winning writer left behind.
 */
async function applyDayRollover(userId: string, current: AforceUserStateRow): Promise<AforceUserStateRow> {
  const today = utcDayKey(new Date());
  if (utcDayKey(current.updatedAt) === today) return current;
  const reset = await db
    .update(aforceUserState)
    .set({
      unitsConsumedToday: 0,
      ozConsumedToday: 0,
      aforceUnitsToday: 0,
      hasSeenMorningCommand: false,
      updatedAt: new Date(),
    })
    .where(sql`${aforceUserState.userId} = ${userId}
              AND ${aforceUserState.updatedAt} < date_trunc('day', now() AT TIME ZONE 'UTC')`)
    .returning();
  if (reset[0]) return reset[0];
  // Conditional UPDATE matched 0 rows — another request already
  // rolled over (or wrote since). Re-read the authoritative row.
  const [fresh] = await db.select().from(aforceUserState).where(eq(aforceUserState.userId, userId)).limit(1);
  return fresh ?? current;
}

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
    aforceUnitsToday: 3,
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
  if (existing) return applyDayRollover(userId, existing);

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
  return applyDayRollover(userId, retry);
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
  const isAforce = isAforceFluid(fluidType);
  const [updated] = await db
    .update(aforceUserState)
    .set({
      unitsConsumedToday: sql`${aforceUserState.unitsConsumedToday} + 1`,
      ozConsumedToday: sql`${aforceUserState.ozConsumedToday} + ${ozAmount}`,
      aforceUnitsToday: isAforce
        ? sql`${aforceUserState.aforceUnitsToday} + 1`
        : aforceUserState.aforceUnitsToday,
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
