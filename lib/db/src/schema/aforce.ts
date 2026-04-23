/**
 * AForce OS persistence schema.
 *
 * V1 is single-user (no auth) — userId="default" everywhere. Auth +
 * multi-user lands in a follow-up; the table layout is already shaped
 * for it (every row carries `user_id`).
 *
 * Tables:
 *   aforce_user_state    — one row per user with the latest UserState snapshot
 *   aforce_intake_logs   — append-only intake log (water/stick/aforce/etc)
 *   aforce_confirmations — append-only ±3 confirmation answers
 */

import { pgTable, text, integer, real, boolean, timestamp, jsonb, serial } from "drizzle-orm/pg-core";

export const aforceUserState = pgTable("aforce_user_state", {
  userId: text("user_id").primaryKey(),
  unitsConsumedToday: integer("units_consumed_today").notNull().default(0),
  ozConsumedToday: real("oz_consumed_today").notNull().default(0),
  // T6 follow-up: count of AForce-format intakes today (stick / RTD /
  // canister / bulk_bag). Drives the "AForce protocol bonus" in the
  // scoring engine so picking an AForce product visibly out-scores
  // plain water.
  aforceUnitsToday: integer("aforce_units_today").notNull().default(0),
  lastIntakeTime: timestamp("last_intake_time", { withTimezone: true }).notNull().defaultNow(),
  lastIntakeType: text("last_intake_type").notNull().default("water"),
  symptomState: text("symptom_state").notNull().default("none"),
  symptoms: jsonb("symptoms").$type<string[]>().notNull().default([]),
  urineSignal: integer("urine_signal").notNull().default(3),
  energyState: text("energy_state").notNull().default("steady"),
  heatLoad: integer("heat_load").notNull().default(4),
  sweatRate: integer("sweat_rate").notNull().default(3),
  activityLevel: integer("activity_level").notNull().default(5),
  complianceStreak: integer("compliance_streak").notNull().default(0),
  dailyTarget: integer("daily_target").notNull().default(8),
  ozTarget: real("oz_target").notNull().default(96),
  isSnoozed: boolean("is_snoozed").notNull().default(false),
  snoozeUntil: timestamp("snooze_until", { withTimezone: true }),
  bodyWeightLbs: real("body_weight_lbs").notNull().default(180),
  isAwake: boolean("is_awake").notNull().default(true),
  wakeTime: timestamp("wake_time", { withTimezone: true }),
  overnightLossOz: real("overnight_loss_oz").notNull().default(0),
  hasSeenMorningCommand: boolean("has_seen_morning_command").notNull().default(false),
  appleHealth: jsonb("apple_health").$type<{
    restingHeartRate: number | null;
    hrvSdnn: number | null;
    stepsToday: number | null;
    sleepHoursLastNight: number | null;
    fetchedAt: number;
  } | null>(),
  // Confirmation loop (T2)
  confirmationDelta: integer("confirmation_delta"),
  confirmationDeltaSetAt: timestamp("confirmation_delta_set_at", { withTimezone: true }),
  // Clutch decay miss boost (T3)
  clutchDecayBoostUntil: timestamp("clutch_decay_boost_until", { withTimezone: true }),
  clutchActive: boolean("clutch_active").notNull().default(false),
  // Real-world weather (T6) — when null the engine falls back to its
  // heatLoad-derived placeholder so the score still renders.
  weatherTempC: real("weather_temp_c"),
  weatherHumidity: real("weather_humidity"),
  weatherCity: text("weather_city"),
  weatherFetchedAt: timestamp("weather_fetched_at", { withTimezone: true }),
  // Multi-language support: ISO 639-1 code (en/es/fr/de/pt/it). Drives
  // i18next on the client and locale-aware voice playback (Expo Speech).
  language: text("language").notNull().default("en"),
  // Social Mode (alcohol mitigation + hydration control). Persisted as
  // JSONB so the shape can evolve without a migration. `null` = mode
  // never activated; `{active:true,...}` = currently drinking;
  // `{active:false, endedAt:<ts>}` = Recovery Mode window. Dates are
  // stored as ISO strings (the client normalizes back to Date).
  // Per-event intake history (rolling 24h). Drives the per-event
  // hydration scoring engine — flavor-aware impacts, 20-min absorption
  // cap, delayed absorption curves. Stored as JSONB so the shape can
  // evolve without a migration.
  intakeEvents: jsonb("intake_events").$type<{
    id: string;
    fluidType: string;
    flavor?: string;
    oz: number;
    loggedAt: string;
    baseImpact: number;
    capAdjusted: number;
    immediate: number;
    delayed: number;
    delayedDurationMin: number;
    heatGuardActiveAtLog: boolean;
    scoreBeforeAtLog: number;
  }[]>().notNull().default([]),
  socialMode: jsonb("social_mode").$type<{
    active: boolean;
    startedAt: string;
    drinks: {
      id: string;
      type: string;
      loggedAt: string;
      multiplier: number;
      hydrated: boolean | null;
      abv?: number;
      oz?: number;
    }[];
    lastHydrationPromptAt?: string;
    endedAt?: string;
    sex?: "male" | "female" | "unspecified";
    ateRecently?: boolean;
  } | null>(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const aforceIntakeLogs = pgTable("aforce_intake_logs", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  fluidType: text("fluid_type").notNull(),
  ozAmount: real("oz_amount").notNull(),
  scoreBefore: integer("score_before").notNull(),
  scoreAfter: integer("score_after").notNull(),
  loggedAt: timestamp("logged_at", { withTimezone: true }).notNull().defaultNow(),
});

export const aforceConfirmations = pgTable("aforce_confirmations", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  followed: boolean("followed").notNull(),
  inClutch: boolean("in_clutch").notNull().default(false),
  loggedAt: timestamp("logged_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Per-user account row keyed by Clerk user id. Holds the Stripe linkage
 * + the currently entitled plan id so the api-server's /api/entitlement
 * endpoint can answer in O(1) without round-tripping to Stripe.
 *
 * Stripe webhook (`/api/stripe/webhook`) is the source of truth for
 * `planId` and `subscriptionStatus` — the client only reads.
 */
export const aforceUsers = pgTable("aforce_users", {
  // Clerk's user id (`user_xxx`). Same value the per-user-state tables
  // store under `userId`, so all aforce_* rows for one human carry an
  // identical id.
  id: text("id").primaryKey(),
  email: text("email"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  // Current entitled plan id. Defaults to 'core' (free tier).
  planId: text("plan_id").notNull().default("core"),
  // Stripe subscription.status mirror: trialing | active | past_due |
  // canceled | incomplete | incomplete_expired | unpaid | paused.
  // 'none' for users that have never subscribed.
  subscriptionStatus: text("subscription_status").notNull().default("none"),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AforceUserStateRow = typeof aforceUserState.$inferSelect;
export type InsertAforceUserState = typeof aforceUserState.$inferInsert;
export type AforceIntakeLogRow = typeof aforceIntakeLogs.$inferSelect;
export type AforceConfirmationRow = typeof aforceConfirmations.$inferSelect;
export type AforceUserRow = typeof aforceUsers.$inferSelect;
export type InsertAforceUser = typeof aforceUsers.$inferInsert;
