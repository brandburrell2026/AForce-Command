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

import { pgTable, text, integer, real, boolean, timestamp, jsonb, serial, bigint, index, uniqueIndex } from "drizzle-orm/pg-core";

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
  /**
   * Multi-provider biometric snapshots, keyed by `HealthProviderId`
   * (e.g. 'whoop' | 'samsung_health' | 'oura' | 'apple_health' …).
   * Each entry mirrors the mobile `ProviderSnapshot` shape — only
   * the fields a given provider actually exposes are populated;
   * absent fields stay null so the server can be honest about
   * what's connected. `appleHealth` above is the legacy single-
   * provider column kept for backward compatibility; new wiring
   * should write here instead.
   *
   * Hidden-infra: the server-side Hydration Demand adapter reads
   * freshest-wins sleep across providers from this blob. No UI
   * writes to it yet.
   */
  biometrics: jsonb("biometrics").$type<Record<string, {
    providerId: string;
    restingHeartRate?: number | null;
    hrvSdnn?: number | null;
    sleepHoursLastNight?: number | null;
    stepsToday?: number | null;
    workoutMinutesToday?: number | null;
    strain?: number | null;
    recoveryPct?: number | null;
    readinessScore?: number | null;
    stressScore?: number | null;
    trainingLoad?: number | null;
    fetchedAt: number;
  }> | null>(),
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

/**
 * Append-only longitudinal score snapshot. Drives the Hydration
 * Journal — chart of score over time, daily rollups, and PDF export.
 *
 * Written client-side after each engine refresh, debounced to ~5 min
 * (or on band change). Engine still lives on the client so the
 * captured `score` + `level` are authoritative for that moment in time.
 */
export const aforceScoreSnapshots = pgTable(
  "aforce_score_snapshots",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    score: integer("score").notNull(),
    level: text("level").notNull(), // 'PEAK' | 'BALANCED' | 'RECOVERING' | 'DEPLETED'
    ozConsumedToday: real("oz_consumed_today").notNull().default(0),
    aforceUnitsToday: integer("aforce_units_today").notNull().default(0),
    unitsConsumedToday: integer("units_consumed_today").notNull().default(0),
    sodiumDeliveredMg: real("sodium_delivered_mg").notNull().default(0),
    sodiumLostMg: real("sodium_lost_mg").notNull().default(0),
    deficitPct: real("deficit_pct").notNull().default(0),
    clutchActive: boolean("clutch_active").notNull().default(false),
    socialActive: boolean("social_active").notNull().default(false),
    autopilotActive: boolean("autopilot_active").notNull().default(false),
    reason: text("reason").notNull().default(""),
    // Recovery Layer — nullable, written only when `spec_recovery` is on.
    // See artifacts/aforce-os/services/recoveryEngine.ts for derivation.
    recoveryScore: integer("recovery_score"),
    pressureScore: integer("pressure_score"),
    recoveryTrend: text("recovery_trend"), // 'rising' | 'stable' | 'declining'
    recoveryFingerprint: text("recovery_fingerprint"), // 8-char hex
    recoveryStory: text("recovery_story"),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userTimeIdx: index("aforce_snap_user_time_idx").on(t.userId, t.capturedAt),
  }),
);

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
  // Spec #7 — referral loop. Stable per-user invite code issued on first
  // request (8 chars, ambiguity-safe alphabet). Nullable until first
  // GET /api/referrals/me call so existing rows don't need a backfill.
  // Globally unique so a code can map back to exactly one referrer.
  referralCode: text("referral_code").unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ─── Referral attribution (spec #7) ──────────────────────────────────────── */
/**
 * One row per successfully claimed referral. (referee_user_id) is UNIQUE
 * so each new user can attribute to at most one referrer for life;
 * self-claims are blocked in the route handler.
 *
 * Reward economy is intentionally NOT modeled here yet — this slice is
 * social-only (referrer leaderboard count). Future slices may add a
 * reward ledger that joins on this table.
 */
export const aforceReferralClaims = pgTable(
  "aforce_referral_claims",
  {
    id: serial("id").primaryKey(),
    referrerUserId: text("referrer_user_id").notNull(),
    refereeUserId: text("referee_user_id").notNull(),
    codeUsed: text("code_used").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    refereeUq: uniqueIndex("aforce_referral_claims_referee_uq").on(t.refereeUserId),
    referrerIdx: index("aforce_referral_claims_referrer_idx").on(t.referrerUserId),
  }),
);

export type AforceReferralClaimRow = typeof aforceReferralClaims.$inferSelect;
export type InsertAforceReferralClaim = typeof aforceReferralClaims.$inferInsert;

export type AforceUserStateRow = typeof aforceUserState.$inferSelect;
export type InsertAforceUserState = typeof aforceUserState.$inferInsert;
export type AforceIntakeLogRow = typeof aforceIntakeLogs.$inferSelect;
export type AforceConfirmationRow = typeof aforceConfirmations.$inferSelect;
export type AforceUserRow = typeof aforceUsers.$inferSelect;
export type InsertAforceUser = typeof aforceUsers.$inferInsert;
export type AforceScoreSnapshotRow = typeof aforceScoreSnapshots.$inferSelect;
export type InsertAforceScoreSnapshot = typeof aforceScoreSnapshots.$inferInsert;

/**
 * Append-only badge unlock log. The catalog itself lives in code
 * (`achievementsCatalog.ts`) — this table only records WHEN each user
 * first satisfied the unlock criteria so we can render the badge as
 * unlocked + show the unlock date.
 *
 * `code` is the catalog id ('first_sip', 'streak_7', etc). The
 * (user_id, code) pair is enforced UNIQUE at the DB level so the
 * insert path can use ON CONFLICT DO NOTHING and stay race-safe under
 * concurrent unlock-on-read calls.
 */
export const aforceAchievements = pgTable(
  "aforce_achievements",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    code: text("code").notNull(),
    unlockedAt: timestamp("unlocked_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userCodeUq: uniqueIndex("aforce_ach_user_code_uq").on(t.userId, t.code),
  }),
);

export type AforceAchievementRow = typeof aforceAchievements.$inferSelect;
export type InsertAforceAchievement = typeof aforceAchievements.$inferInsert;

/* ─── Territory battles (regional rivalries) ──────────────────────────────── */
/**
 * Per-user persisted view of active battles. Battles are surfaced from
 * MOCK_BATTLES on first read if a user has none — preserves the demo
 * experience while making support/open mutations real and durable.
 */
export const aforceBattles = pgTable(
  "aforce_battles",
  {
    id: text("id").primaryKey(),
    ownerUserId: text("owner_user_id").notNull(),
    side1RegionId: text("side1_region_id").notNull(),
    side2RegionId: text("side2_region_id").notNull(),
    side1Score: integer("side1_score").notNull().default(50),
    side2Score: integer("side2_score").notNull().default(50),
    hoursRemaining: integer("hours_remaining").notNull().default(24),
    leader: text("leader").notNull().default("tie"),
    trend: text("trend").notNull().default("flat"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    ownerIdx: index("aforce_battles_owner_idx").on(t.ownerUserId),
  }),
);

export type AforceBattleRow = typeof aforceBattles.$inferSelect;
export type InsertAforceBattle = typeof aforceBattles.$inferInsert;

/* ─── AForce Circles ──────────────────────────────────────────────────────── */
/**
 * Members of a user's private circle. (owner_user_id, member_user_id) is
 * the natural key — a member appears once per owner.
 */
export const aforceCircleUsers = pgTable(
  "aforce_circle_users",
  {
    id: serial("id").primaryKey(),
    ownerUserId: text("owner_user_id").notNull(),
    memberUserId: text("member_user_id").notNull(),
    name: text("name").notNull(),
    initials: text("initials").notNull(),
    city: text("city"),
    group: text("group").notNull().default("friends"),
    status: text("status").notNull().default("active"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    ownerMemberUq: uniqueIndex("aforce_circle_users_owner_member_uq").on(
      t.ownerUserId,
      t.memberUserId,
    ),
  }),
);

export type AforceCircleUserRow = typeof aforceCircleUsers.$inferSelect;
export type InsertAforceCircleUser = typeof aforceCircleUsers.$inferInsert;

/**
 * Latest shared status per circle member, scoped to the viewing owner.
 * Mutated by the server when a member's status snapshot publishes;
 * read-only for the client.
 */
export const aforceCircleStatuses = pgTable(
  "aforce_circle_statuses",
  {
    id: serial("id").primaryKey(),
    ownerUserId: text("owner_user_id").notNull(),
    memberUserId: text("member_user_id").notNull(),
    score: integer("score").notNull().default(0),
    state: text("state").notNull().default("Balanced"),
    streakDays: integer("streak_days").notNull().default(0),
    protocolComplete: boolean("protocol_complete").notNull().default(false),
    trend: text("trend").notNull().default("flat"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    ownerMemberUq: uniqueIndex("aforce_circle_statuses_owner_member_uq").on(
      t.ownerUserId,
      t.memberUserId,
    ),
  }),
);

export type AforceCircleStatusRow = typeof aforceCircleStatuses.$inferSelect;
export type InsertAforceCircleStatus = typeof aforceCircleStatuses.$inferInsert;

export const aforceCircleChallenges = pgTable(
  "aforce_circle_challenges",
  {
    id: text("id").primaryKey(),
    ownerUserId: text("owner_user_id").notNull(),
    fromUserId: text("from_user_id").notNull(),
    toUserId: text("to_user_id"),
    kind: text("kind").notNull(),
    targetScore: integer("target_score"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    status: text("status").notNull().default("open"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    ownerIdx: index("aforce_circle_challenges_owner_idx").on(t.ownerUserId),
  }),
);

export type AforceCircleChallengeRow = typeof aforceCircleChallenges.$inferSelect;
export type InsertAforceCircleChallenge = typeof aforceCircleChallenges.$inferInsert;

export const aforceCircleNotifications = pgTable(
  "aforce_circle_notifications",
  {
    id: text("id").primaryKey(),
    ownerUserId: text("owner_user_id").notNull(),
    kind: text("kind").notNull(),
    fromUserId: text("from_user_id").notNull(),
    message: text("message").notNull(),
    read: boolean("read").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    ownerIdx: index("aforce_circle_notifications_owner_idx").on(t.ownerUserId),
  }),
);

export type AforceCircleNotificationRow = typeof aforceCircleNotifications.$inferSelect;
export type InsertAforceCircleNotification = typeof aforceCircleNotifications.$inferInsert;

/* ─── Privacy settings ────────────────────────────────────────────────────── */
/**
 * Per-user privacy preferences. `fields` is a JSONB blob mirroring the
 * client `PrivacySettings.fields` shape so we can add new toggles
 * without a migration.
 */
export const aforcePrivacy = pgTable("aforce_privacy", {
  userId: text("user_id").primaryKey(),
  scope: text("scope").notNull().default("circle"),
  fields: jsonb("fields").$type<{
    score: boolean;
    state: boolean;
    streak: boolean;
    protocol: boolean;
    trend: boolean;
  }>().notNull().default({
    score: true,
    state: true,
    streak: true,
    protocol: true,
    trend: true,
  }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AforcePrivacyRow = typeof aforcePrivacy.$inferSelect;
export type InsertAforcePrivacy = typeof aforcePrivacy.$inferInsert;

/* ─── HydroScan history (append-only) ─────────────────────────────────────── */
/**
 * Append-only HydroScan history. One row per scan, ordered by
 * `scannedAt`. Stores the rich `ScanResult` payload defined in
 * `artifacts/aforce-os/types/scan.ts` as JSONB so the row remains
 * forward-compatible with personalization / superfood / supportive-note
 * additions to the type without a migration.
 *
 * The flat columns (`verdict`, `currentFitScore`, `productId`,
 * `evaluatedAgainstState`, `isAForce`) are denormalized copies of
 * fields inside `payload` so list/filter queries can run without
 * unpacking JSONB on every row.
 *
 * Indexed by `(user_id, scanned_at DESC)` so per-user history pulls
 * its newest rows first without a sort over the table.
 *
 * Hidden-infra only — no route or UI consumes this table today.
 */
export const aforceHydroScans = pgTable(
  "aforce_hydro_scans",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    /** Stable client-supplied id (e.g. `scan_<ts>_<rand>`); UNIQUE so
     *  retries from the mobile client are idempotent. */
    clientScanId: text("client_scan_id").notNull(),
    scannedAt: timestamp("scanned_at", { withTimezone: true }).notNull(),
    sourceKind: text("source_kind").notNull(), // barcode | qr | aforce_product | nfc | manual
    rawValue: text("raw_value").notNull().default(""),
    productId: text("product_id"),
    productName: text("product_name").notNull(),
    brand: text("brand"),
    category: text("category"),
    isAForce: boolean("is_aforce").notNull().default(false),
    verdict: text("verdict").notNull(), // optimal | strong | acceptable | suboptimal | avoid
    currentFitScore: integer("current_fit_score").notNull(),
    efficiency: real("efficiency").notNull(),
    efficiencyLabel: text("efficiency_label").notNull().default(""),
    evaluatedAgainstState: text("evaluated_against_state").notNull(),
    aforceEquivalentId: text("aforce_equivalent_id"),
    /** Full ScanResult shape. Authoritative — flat columns are
     *  denormalized read accelerators. */
    payload: jsonb("payload").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userTimeIdx: index("aforce_hydro_scans_user_time_idx").on(
      t.userId,
      t.scannedAt,
    ),
    userClientUq: uniqueIndex("aforce_hydro_scans_user_client_uq").on(
      t.userId,
      t.clientScanId,
    ),
  }),
);

export type AforceHydroScanRow = typeof aforceHydroScans.$inferSelect;
export type InsertAforceHydroScan = typeof aforceHydroScans.$inferInsert;

/* ─── Hydration Demand snapshots (append-only) ────────────────────────────── */
/**
 * Append-only history of Hydration Demand Engine computations. One
 * row per snapshot, ordered by `computedAt`. Stores the canonical
 * `HydrationDemandInputs` and `HydrationDemandOutputs` from
 * `@workspace/demand-engine` as JSONB so the row remains forward-
 * compatible with new input/output fields without a migration.
 *
 * The flat columns (`targetOz`, `remainingOz`, `load`, `command`,
 * `source`) are denormalized copies of fields inside `inputs` /
 * `outputs` so list / filter queries can run without unpacking
 * JSONB on every row.
 *
 * Idempotency: `(user_id, client_snapshot_id)` is UNIQUE so an
 * accidental retry from the mobile client (or a re-fired admin
 * debug call) returns the original row instead of duplicating.
 * The route layer generates `client_snapshot_id` server-side when
 * the caller doesn't supply one — every row therefore carries a
 * stable id.
 *
 * Indexed by `(user_id, computed_at DESC)` so per-user history
 * pulls its newest rows first without a sort over the table.
 *
 * Hidden-infra only — no UI consumes this table today.
 */
export const aforceDemandSnapshots = pgTable(
  "aforce_demand_snapshots",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    /** Stable per-(user, snapshot) id used for idempotent retries. */
    clientSnapshotId: text("client_snapshot_id").notNull(),
    /** Where the snapshot came from — drives admin filtering.
     *  Examples: 'admin_debug' | 'mobile_self' | 'background_job'. */
    source: text("source").notNull().default("admin_debug"),
    /** Wall-clock when the engine was run (caller-supplied when known,
     *  else server-set). Used for ordering and longitudinal charts. */
    computedAt: timestamp("computed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** Full `HydrationDemandInputs` shape — authoritative. */
    inputs: jsonb("inputs").notNull(),
    /** Full `HydrationDemandOutputs` shape — authoritative. */
    outputs: jsonb("outputs").notNull(),
    // Denormalized read accelerators (copies of fields in outputs).
    targetOz: integer("target_oz").notNull(),
    remainingOz: integer("remaining_oz").notNull(),
    load: text("load").notNull(), // 'low' | 'moderate' | 'high'
    command: text("command").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userTimeIdx: index("aforce_demand_snap_user_time_idx").on(
      t.userId,
      t.computedAt,
    ),
    userClientUq: uniqueIndex("aforce_demand_snap_user_client_uq").on(
      t.userId,
      t.clientSnapshotId,
    ),
  }),
);

export type AforceDemandSnapshotRow = typeof aforceDemandSnapshots.$inferSelect;
export type InsertAforceDemandSnapshot = typeof aforceDemandSnapshots.$inferInsert;

/**
 * WHOOP OAuth2 tokens — server-side per-user persistence so the
 * server can refresh and pull biometrics autonomously, independent
 * of the mobile client's SecureStore.
 *
 * One row per `(userId)` — a user has at most one WHOOP connection.
 * `expiresAt` is `timestamptz` for native DB ordering / index range
 * scans; the in-app `WhoopTokens` shape converts to/from epoch ms
 * at the store boundary.
 *
 * The refresh token rotates per WHOOP's OAuth contract: every
 * successful refresh writes a new `refreshToken` here. `accessToken`
 * is short-lived (~1 hour) and refreshed proactively within a 60s
 * skew window by the server token manager.
 *
 * Hidden-infra: no UI/route writes here yet. PR #14 lands the
 * schema + store + manager; the OAuth callback route and the
 * biometrics fetch worker land in follow-up PRs.
 *
 * Note: tokens are stored as-is. Postgres at-rest encryption is the
 * baseline; if/when we add envelope encryption (KMS / pgcrypto) it
 * will be a transparent change at the store boundary.
 */
export const aforceWhoopTokens = pgTable(
  "aforce_whoop_tokens",
  {
    userId: text("user_id").primaryKey(),
    accessToken: text("access_token").notNull(),
    refreshToken: text("refresh_token").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    /** Space-separated scopes the user granted (e.g. 'offline read:recovery …').
     *  Null when the WHOOP token endpoint didn't echo `scope` back. */
    scope: text("scope"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    // Composite index supporting keyset pagination over the fetch
    // sweep: `WHERE (updated_at, user_id) > ($1, $2) ORDER BY
    // updated_at, user_id LIMIT N`. user_id is included in the index
    // (not just the sort) so duplicate updated_at values (possible
    // after bulk imports — DEFAULT NOW() collisions at ms resolution)
    // get a stable tie-break and the keyset boundary stays correct.
    // Without this index, the sweep page query degrades to a full
    // table sort once the row count gets non-trivial.
    updatedUserIdx: index("aforce_whoop_tokens_updated_user_idx").on(
      t.updatedAt,
      t.userId,
    ),
  }),
);

export type AforceWhoopTokensRow = typeof aforceWhoopTokens.$inferSelect;
export type InsertAforceWhoopTokens = typeof aforceWhoopTokens.$inferInsert;
