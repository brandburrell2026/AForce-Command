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

import { pgTable, text, integer, real, boolean, timestamp, jsonb, serial, bigint, index, uniqueIndex, customType } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * Postgres `bytea` column — Drizzle doesn't ship a first-class bytea
 * helper, so we declare it via `customType`. Used for pgcrypto
 * ciphertext (see `aforceWhoopTokens.accessTokenEnc`).
 *
 * The driver returns `Buffer`; we type as `Uint8Array` (Buffer's
 * superclass) so callers can stay platform-agnostic. On the write
 * side we only ever pass these columns via raw `sql` template (e.g.
 * `pgp_sym_encrypt($t, $k)`) so a `toDriver` mapping is unused.
 */
const customBytea = customType<{ data: Uint8Array; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

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
    /** Epoch ms of the newest underlying OBSERVATION (ruling I, #562);
     *  distinct from fetchedAt (sync time). Absent on legacy blobs. */
    latestObservedAtMs?: number;
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

export const aforceIntakeLogs = pgTable(
  "aforce_intake_logs",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    fluidType: text("fluid_type").notNull(),
    ozAmount: real("oz_amount").notNull(),
    scoreBefore: integer("score_before").notNull(),
    scoreAfter: integer("score_after").notNull(),
    /** Stable client-supplied idempotency key (the offline-outbox event id).
     *  NULL for legacy/online writes (offline outbox flag off) — Postgres
     *  NULLS DISTINCT means those rows never collide, so the dedupe applies
     *  ONLY to keyed offline-outbox replays. Score-Protection on replay. */
    clientEventId: text("client_event_id"),
    // ── Lock §10 honesty + corrections (RC-L12, all nullable/additive) ──
    /** When set, this row is an auditable CORRECTION reversing the referenced
     *  log (append-only: the original row is never mutated or deleted). */
    correctsIntakeId: integer("corrects_intake_id"),
    /** 'mistake' | 'spill' | 'wrong_product' | 'duplicate' — why it was corrected. */
    correctionReason: text("correction_reason"),
    /** How the entry was captured: 'tap' | 'scan_log' | 'voice' | 'offline_replay' | 'sensor'. */
    entrySource: text("entry_source"),
    /** §10 minimal ladder: 'logged' (self-reported tap) | 'verified' (future). */
    confirmationLevel: text("confirmation_level"),
    loggedAt: timestamp("logged_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userClientUq: uniqueIndex("aforce_intake_logs_user_client_uq").on(
      t.userId,
      t.clientEventId,
    ),
  }),
);

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
    // ── Adaptive Profile Engine™ stamping (Section 18) ──────────────────
    // The active Profile Version™ / Baseline Version™ at the moment this
    // HydroState record was captured. NULLABLE with no default: existing
    // rows are never touched (historical preservation — brief #5), and a
    // snapshot written before a user has any profile version stays null.
    // New snapshots stamp the active ids so Performance Memory can always
    // answer "which profile was active when this was recorded?".
    profileVersionId: integer("profile_version_id"),
    baselineVersionId: integer("baseline_version_id"),
    // ── HydroState model-version stamp (D-08 / DR-009) ──────────────────
    // Which scoring-model version produced this snapshot. NULLABLE with no
    // default: historical rows are never touched, and a null reads as the
    // honest "not recorded" for pre-D-08 rows. New writes are stamped
    // centrally by lib/db/src/scoreSnapshotRepo.ts — routes can neither
    // supply nor omit it (founder Decision 5).
    hydroStateModelVersion: text("hydrostate_model_version"),
    /**
     * Per-factor score deltas captured at write time (additive instrumentation,
     * founder-approved 2026-08-18; design in
     * governance/SCORE-SNAPSHOT-INSTRUMENTATION-PROPOSAL.md). Keys are the
     * factor ids the canonical breakdown already computes, plus `raw` and
     * `clamped` so a row is self-checking. Values are DELTAS only — labels and
     * maxMagnitude (the proprietary weights) are never persisted. NULL means
     * "captured before instrumentation", never "all factors were zero".
     */
    factorDeltas: jsonb("factor_deltas").$type<Record<string, number>>(),
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
 * Per-user persisted view of active battles — only battles the user
 * actually opened. An earlier build seeded MOCK_BATTLES here on first
 * read; that write is gone (see routes/battles.ts) and any row it left
 * behind is excluded on read rather than deleted.
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
  // No DB-level default: a JSONB object default canonicalizes in Postgres
  // (whitespace + jsonb key ordering) and never string-matches drizzle-kit's
  // compact generated form, so `push` re-emitted SET DEFAULT on every run
  // (see docs/SCHEMA_DRIFT.md). The application owns the default instead —
  // the sole insert path (api-server routes/privacy.ts) always supplies
  // `fields`, so removing the DB default changes no runtime behavior.
  fields: jsonb("fields").$type<{
    score: boolean;
    state: boolean;
    streak: boolean;
    protocol: boolean;
    trend: boolean;
  }>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AforcePrivacyRow = typeof aforcePrivacy.$inferSelect;
export type InsertAforcePrivacy = typeof aforcePrivacy.$inferInsert;

/* ─── Internal analytics events (append-only, idempotent) ─────────────────── */
/**
 * INTERNAL analytics event sink. Append-only, written by the consent-
 * gated mobile dispatcher via POST /api/aforce/analytics. There is no
 * consumer-facing analytics surface — only restricted admins read
 * aggregates from this table.
 *
 * Privacy by design:
 *   - `analyticsId` is the PSEUDONYMOUS analytics identity generated
 *     client-side after consent. The Clerk user id is intentionally NOT
 *     stored here, so analytics rows cannot be trivially joined to a
 *     person. delete-my-data matches on this id (an unguessable random
 *     value only the owning device holds).
 *   - `eventId` is UNIQUE so retries / multi-flush are idempotent: the
 *     ingest path uses ON CONFLICT DO NOTHING and an event lands at most
 *     once.
 *
 * The envelope shape mirrors `@workspace/analytics-contract`
 * (AnalyticsEventEnvelope); `payload` stays JSONB so new event fields
 * are additive without a migration.
 */
export const aforceAnalyticsEvents = pgTable(
  "aforce_analytics_events",
  {
    id: serial("id").primaryKey(),
    eventId: text("event_id").notNull(),
    analyticsId: text("analytics_id").notNull(),
    eventType: text("event_type").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    schemaVersion: integer("schema_version").notNull().default(1),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    eventIdUq: uniqueIndex("aforce_analytics_events_event_id_uq").on(t.eventId),
    analyticsIdx: index("aforce_analytics_events_analytics_idx").on(t.analyticsId),
    typeTimeIdx: index("aforce_analytics_events_type_time_idx").on(
      t.eventType,
      t.occurredAt,
    ),
  }),
);

export type AforceAnalyticsEventRow = typeof aforceAnalyticsEvents.$inferSelect;
export type InsertAforceAnalyticsEvent = typeof aforceAnalyticsEvents.$inferInsert;

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
    verdict: text("verdict").notNull(), // optimal | strong | acceptable | suboptimal | avoid | uncomparable
    // Nullable (client ruling R3/D5, 2026-08-30): an uncomparable scan has NO
    // fit. The old NOT NULL forced the route to coerce null → 0, storing a
    // fabricated measurement. Requires `drizzle-kit push` at deploy
    // (ALTER ... DROP NOT NULL — non-destructive).
    currentFitScore: integer("current_fit_score"),
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
    /** pgcrypto-encrypted access token (`pgp_sym_encrypt` with the
     *  deployment's `WHOOP_TOKEN_ENCRYPTION_KEY`). Nullable so the
     *  rollout is purely additive — rows written before encryption
     *  is enabled stay readable via the plaintext column. Phase A of
     *  the encryption migration: writes are DUAL (plaintext + enc)
     *  when a key is configured; reads prefer enc and fall back to
     *  plaintext on decrypt failure or null enc. Phase B (future
     *  PR) will backfill enc, flip reads to enc-only, then drop the
     *  plaintext columns. */
    accessTokenEnc: customBytea("access_token_enc"),
    /** See accessTokenEnc — same lifecycle, same rollout phase. */
    refreshTokenEnc: customBytea("refresh_token_enc"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    /** Space-separated scopes the user granted (e.g. 'offline read:recovery …').
     *  Null when the WHOOP token endpoint didn't echo `scope` back. */
    scope: text("scope"),
    // ── WHOOP refresh control (2026-08-19, founder-approved additive migration;
    //    governance/WHOOP-SWEEP-REDESIGN.md). Scheduling state ONLY — these
    //    never affect token values, snapshot values, or scoring, and rows are
    //    never deleted automatically. NULLs mean "no failure history". ──
    /** Consecutive refresh failures. Cleared by any successful refresh/re-auth. */
    refreshFailureCount: integer("refresh_failure_count"),
    /** Automatic refresh must not retry before this instant (exponential
     *  backoff, 24h cap). */
    refreshBackoffUntil: timestamp("refresh_backoff_until", { withTimezone: true }),
    /** Latched after 8 consecutive failures: the member must re-authenticate;
     *  automatic retries stop until they do. */
    needsReauth: boolean("needs_reauth"),
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

/**
 * WHOOP OAuth in-flight state store — backs the PKCE / state handoff
 * between `/whoop/oauth/start` and `/whoop/oauth/callback`. Replaces
 * the per-process in-memory map so an authorize started on replica A
 * can be completed on replica B (the last gap on the auth path under
 * horizontal scale).
 *
 * Lifecycle: rows are written at `start` and DELETEd at `callback`
 * (single-use, atomic via DELETE ... RETURNING). Rows that go
 * unconsumed expire by TTL; consume returns null for expired rows
 * AND deletes them in the same statement so a stale state can never
 * be replayed. The TTL window is short (minutes), so a row count
 * staying small in steady state is the operational contract — a
 * background sweep helper is exposed for ops cleanup.
 */
export const aforceWhoopAuthStates = pgTable(
  "aforce_whoop_auth_states",
  {
    /** The random `state` param returned to the OAuth client and
     *  echoed back by the provider. Primary key — uniqueness is
     *  guaranteed by the issuer (cryptographic random) AND enforced
     *  here so put-collision is a hard error, not silent overwrite
     *  (matches in-memory contract: last-write-wins via UPSERT). */
    state: text("state").primaryKey(),
    /** PKCE verifier minted alongside this state. */
    codeVerifier: text("code_verifier").notNull(),
    /** Authenticated user who started the flow. */
    userId: text("user_id").notNull(),
    /** Insertion time; used for TTL on consume. */
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    // Supports the background expiry sweep:
    // `DELETE FROM aforce_whoop_auth_states WHERE created_at < $1`.
    createdIdx: index("aforce_whoop_auth_states_created_idx").on(t.createdAt),
  }),
);

export type AforceWhoopAuthStatesRow =
  typeof aforceWhoopAuthStates.$inferSelect;
export type InsertAforceWhoopAuthStates =
  typeof aforceWhoopAuthStates.$inferInsert;

/**
 * Garmin Connect OAuth2 token store — faithful mirror of
 * `aforceWhoopTokens` above. One row per `(userId)`; `expiresAt` is
 * `timestamptz`; refresh token rotates per Garmin's OAuth2 contract.
 *
 * DORMANT / hidden-infra: no UI or route writes here until
 * GARMIN_CLIENT_ID + GARMIN_CLIENT_SECRET + GARMIN_OAUTH_REDIRECT_URI
 * are configured (the OAuth router is only mounted then). Encryption
 * mirrors WHOOP Phase A: dual-write plaintext + `pgp_sym_encrypt` enc
 * columns when `GARMIN_TOKEN_ENCRYPTION_KEY` is set; reads prefer enc
 * and fall back to plaintext.
 */
export const aforceGarminTokens = pgTable(
  "aforce_garmin_tokens",
  {
    userId: text("user_id").primaryKey(),
    accessToken: text("access_token").notNull(),
    refreshToken: text("refresh_token").notNull(),
    /** pgcrypto-encrypted access token. Nullable so the rollout is
     *  purely additive (see aforceWhoopTokens.accessTokenEnc). */
    accessTokenEnc: customBytea("access_token_enc"),
    /** See accessTokenEnc — same lifecycle, same rollout phase. */
    refreshTokenEnc: customBytea("refresh_token_enc"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    /** Space-separated scopes the user granted. Null when Garmin's
     *  token endpoint didn't echo `scope` back. */
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
    // sweep, mirroring the WHOOP token table.
    updatedUserIdx: index("aforce_garmin_tokens_updated_user_idx").on(
      t.updatedAt,
      t.userId,
    ),
  }),
);

export type AforceGarminTokensRow = typeof aforceGarminTokens.$inferSelect;
export type InsertAforceGarminTokens = typeof aforceGarminTokens.$inferInsert;

/**
 * Garmin OAuth in-flight state store — backs the PKCE / state handoff
 * between `/garmin/oauth/start` and `/garmin/oauth/callback`. Faithful
 * mirror of `aforceWhoopAuthStates`: rows written at `start`, DELETEd
 * (single-use, atomic) at `callback`; unconsumed rows expire by TTL.
 */
export const aforceGarminAuthStates = pgTable(
  "aforce_garmin_auth_states",
  {
    /** The random `state` param returned to the OAuth client and
     *  echoed back by Garmin. Primary key. */
    state: text("state").primaryKey(),
    /** PKCE verifier minted alongside this state. */
    codeVerifier: text("code_verifier").notNull(),
    /** Authenticated user who started the flow. */
    userId: text("user_id").notNull(),
    /** Insertion time; used for TTL on consume. */
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    createdIdx: index("aforce_garmin_auth_states_created_idx").on(t.createdAt),
  }),
);

export type AforceGarminAuthStatesRow =
  typeof aforceGarminAuthStates.$inferSelect;
export type InsertAforceGarminAuthStates =
  typeof aforceGarminAuthStates.$inferInsert;

/**
 * Oura Ring OAuth2 token store — faithful mirror of `aforceWhoopTokens`
 * / `aforceGarminTokens` above. One row per `(userId)`; `expiresAt` is
 * `timestamptz`; refresh token rotates (single-use) per Oura's OAuth2
 * contract (https://cloud.ouraring.com/docs/authentication).
 *
 * Hidden-infra: no UI or route writes here until OURA_CLIENT_ID +
 * OURA_CLIENT_SECRET + OURA_OAUTH_REDIRECT_URI are configured (the
 * OAuth router is only mounted then). Encryption mirrors WHOOP/Garmin
 * Phase A: dual-write plaintext + `pgp_sym_encrypt` enc columns when
 * `OURA_TOKEN_ENCRYPTION_KEY` is set; reads prefer enc and fall back to
 * plaintext.
 */
export const aforceOuraTokens = pgTable(
  "aforce_oura_tokens",
  {
    userId: text("user_id").primaryKey(),
    accessToken: text("access_token").notNull(),
    refreshToken: text("refresh_token").notNull(),
    /** pgcrypto-encrypted access token. Nullable so the rollout is
     *  purely additive (see aforceWhoopTokens.accessTokenEnc). */
    accessTokenEnc: customBytea("access_token_enc"),
    /** See accessTokenEnc — same lifecycle, same rollout phase. */
    refreshTokenEnc: customBytea("refresh_token_enc"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    /** Space-separated scopes the user granted. Null when Oura's token
     *  endpoint didn't echo `scope` back. */
    scope: text("scope"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    // Composite index supporting keyset pagination over a future fetch
    // sweep, mirroring the WHOOP/Garmin token tables.
    updatedUserIdx: index("aforce_oura_tokens_updated_user_idx").on(
      t.updatedAt,
      t.userId,
    ),
  }),
);

export type AforceOuraTokensRow = typeof aforceOuraTokens.$inferSelect;
export type InsertAforceOuraTokens = typeof aforceOuraTokens.$inferInsert;

/**
 * Oura OAuth in-flight state store — backs the PKCE / state handoff
 * between `/oura/oauth/start` and `/oura/oauth/callback`. Faithful
 * mirror of `aforceWhoopAuthStates` / `aforceGarminAuthStates`: rows
 * written at `start`, DELETEd (single-use, atomic) at `callback`;
 * unconsumed rows expire by TTL.
 */
export const aforceOuraAuthStates = pgTable(
  "aforce_oura_auth_states",
  {
    /** The random `state` param returned to the OAuth client and
     *  echoed back by Oura. Primary key. */
    state: text("state").primaryKey(),
    /** PKCE verifier minted alongside this state. */
    codeVerifier: text("code_verifier").notNull(),
    /** Authenticated user who started the flow. */
    userId: text("user_id").notNull(),
    /** Insertion time; used for TTL on consume. */
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    createdIdx: index("aforce_oura_auth_states_created_idx").on(t.createdAt),
  }),
);

export type AforceOuraAuthStatesRow = typeof aforceOuraAuthStates.$inferSelect;
export type InsertAforceOuraAuthStates =
  typeof aforceOuraAuthStates.$inferInsert;

/**
 * Strava OAuth2 token store — faithful mirror of `aforceWhoopTokens` /
 * `aforceGarminTokens` / `aforceOuraTokens` above. One row per
 * `(userId)`; `expiresAt` is `timestamptz`; refresh token rotates per
 * Strava's OAuth2 contract (https://developers.strava.com/docs/authentication,
 * verified 2026-07 — "Applications should persist the refresh token
 * contained in the response, and always use the most recent refresh
 * token").
 *
 * Hidden-infra: no UI or route writes here until STRAVA_CLIENT_ID +
 * STRAVA_CLIENT_SECRET + STRAVA_OAUTH_REDIRECT_URI are configured (the
 * OAuth router is only mounted then). Encryption mirrors WHOOP/Garmin/
 * Oura Phase A: dual-write plaintext + `pgp_sym_encrypt` enc columns
 * when `STRAVA_TOKEN_ENCRYPTION_KEY` is set; reads prefer enc and fall
 * back to plaintext.
 *
 * Strava contributes ACTIVITY data only (see `stravaSnapshot.ts`) —
 * never recovery/sleep/HRV/readiness. This table only stores OAuth
 * tokens; it has no bearing on which biometric fields get populated.
 */
export const aforceStravaTokens = pgTable(
  "aforce_strava_tokens",
  {
    userId: text("user_id").primaryKey(),
    accessToken: text("access_token").notNull(),
    refreshToken: text("refresh_token").notNull(),
    /** pgcrypto-encrypted access token. Nullable so the rollout is
     *  purely additive (see aforceWhoopTokens.accessTokenEnc). */
    accessTokenEnc: customBytea("access_token_enc"),
    /** See accessTokenEnc — same lifecycle, same rollout phase. */
    refreshTokenEnc: customBytea("refresh_token_enc"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    /** Space-delimited scopes Strava echoes back in the token response
     *  (e.g. 'activity:read'). Null when omitted. */
    scope: text("scope"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    // Composite index supporting keyset pagination over a future fetch
    // sweep, mirroring the WHOOP/Garmin/Oura token tables.
    updatedUserIdx: index("aforce_strava_tokens_updated_user_idx").on(
      t.updatedAt,
      t.userId,
    ),
  }),
);

export type AforceStravaTokensRow = typeof aforceStravaTokens.$inferSelect;
export type InsertAforceStravaTokens = typeof aforceStravaTokens.$inferInsert;

/**
 * Strava OAuth in-flight state store — backs the CSRF handoff between
 * `/strava/oauth/start` and `/strava/oauth/callback`.
 *
 * UNLIKE `aforceWhoopAuthStates` / `aforceGarminAuthStates` /
 * `aforceOuraAuthStates`, this table has NO `codeVerifier` column.
 * Strava is a confidential OAuth2 client — the code->token exchange
 * requires `client_secret` and Strava's docs
 * (https://developers.strava.com/docs/authentication, verified
 * 2026-07) do not document or accept PKCE (`code_challenge` /
 * `code_verifier`) at all. Carrying a permanently-empty PKCE column
 * here would be a placeholder field, not a real security control —
 * the single-use `state` param (validated server-side) is the entire
 * CSRF defense for this integration, same role WHOOP/Garmin/Oura's
 * `state` plays, just without a PKCE companion.
 *
 * Lifecycle: rows are written at `start` and DELETEd at `callback`
 * (single-use, atomic via DELETE ... RETURNING); unconsumed rows
 * expire by TTL.
 */
export const aforceStravaAuthStates = pgTable(
  "aforce_strava_auth_states",
  {
    /** The random `state` param returned to the OAuth client and
     *  echoed back by Strava. Primary key. */
    state: text("state").primaryKey(),
    /** Authenticated user who started the flow. */
    userId: text("user_id").notNull(),
    /** Insertion time; used for TTL on consume. */
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    createdIdx: index("aforce_strava_auth_states_created_idx").on(
      t.createdAt,
    ),
  }),
);

export type AforceStravaAuthStatesRow =
  typeof aforceStravaAuthStates.$inferSelect;
export type InsertAforceStravaAuthStates =
  typeof aforceStravaAuthStates.$inferInsert;

/* ─── Adaptive Profile Engine™ / Profile Versioning™ (Section 18) ──────────── */
/**
 * The OS's user-specific calibration layer. Four tables work together:
 *
 *   aforce_user_profiles      — one row per user; MUTABLE pointer to the
 *                               currently-active profile + baseline version.
 *   aforce_profile_versions   — APPEND-ONLY immutable snapshots (v1, v2, v3…).
 *                               A major-variable change mints a new row.
 *   aforce_baseline_versions  — APPEND-ONLY baseline lifecycle with a
 *                               confidence scalar. Recalibration archives the
 *                               prior active row and opens a new one.
 *   aforce_profile_change_log — APPEND-ONLY audit + Evidence Engine™ string
 *                               for every change (major OR minor).
 *
 * Historical-preservation contract (brief #5): only aforce_user_profiles is
 * ever UPDATEd (it just moves pointers). Versions, baselines, and change-log
 * rows are NEVER updated or deleted — recalibration creates new rows and
 * affects FUTURE recommendations only. The mint path (version + change-log +
 * archive-prior-baseline + open-new-baseline + advance-pointer) MUST run in a
 * single transaction so a partial write can never split-brain the layer
 * (contract A in services/adaptiveProfileEngine.ts).
 */

/**
 * One row per user. The ONLY mutable table in the layer — it carries the
 * pointers to the currently-active version + baseline so HydroState /
 * Performance Memory writes can stamp them in O(1). Pointers are nullable
 * until the user's first profile version is minted.
 */
export const aforceUserProfiles = pgTable("aforce_user_profiles", {
  userId: text("user_id").primaryKey(),
  currentProfileVersionId: integer("current_profile_version_id"),
  currentBaselineVersionId: integer("current_baseline_version_id"),
  /** Surfaced as "View Last Calibration Date" (spec §18 User Control). */
  lastCalibrationAt: timestamp("last_calibration_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * APPEND-ONLY immutable Profile Version™ snapshots. Each major-variable
 * change mints a new row; `versionNumber` is the human-facing v1/v2/v3.
 * `snapshot` holds the full major-variable set at this version; `changedFields`
 * lists which variables triggered the mint.
 *
 * `clientChangeId` is the caller-supplied idempotency key (contract A): the
 * (user_id, client_change_id) UNIQUE index lets a retried POST return the
 * existing version instead of double-minting. NULL for server-originated
 * mints with no client key (NULLS DISTINCT — those never collide).
 */
export const aforceProfileVersions = pgTable(
  "aforce_profile_versions",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    versionNumber: integer("version_number").notNull(),
    snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull(),
    changedFields: jsonb("changed_fields").$type<string[]>().notNull().default([]),
    clientChangeId: text("client_change_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userVersionIdx: index("aforce_profile_versions_user_version_idx").on(
      t.userId,
      t.versionNumber,
    ),
    userClientUq: uniqueIndex("aforce_profile_versions_user_client_uq").on(
      t.userId,
      t.clientChangeId,
    ),
  }),
);

/**
 * APPEND-ONLY Baseline Version™ lifecycle. On recalibration the prior active
 * row is flipped to 'archived' (its `archivedAt` set) and a NEW row opens with
 * temporarily-lowered confidence; confidence rises as `observationCount`
 * accumulates (see config/hydroStateModel.ts BASELINE_CONFIDENCE). Rows are
 * never deleted — historical baselines are preserved forever.
 */
export const aforceBaselineVersions = pgTable(
  "aforce_baseline_versions",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    /** The profile version that opened this baseline. */
    profileVersionId: integer("profile_version_id").notNull(),
    /** 'active' | 'archived'. Exactly one 'active' row per user at a time. */
    status: text("status").notNull().default("active"),
    /** 0..1 confidence scalar; temporarily lowered on recalibration. */
    confidence: real("confidence").notNull(),
    observationCount: integer("observation_count").notNull().default(0),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    /**
     * Body Recalibration Engine™ (Section 20) — the five go-forward targets
     * recomputed when this baseline opened, owned by this baseline version.
     * NULLABLE: baselines minted before §20 (or where the client sent none)
     * stay null; archived baselines keep the targets they opened with.
     * Computed client-side from §19 inputs (see services/bodyRecalibrationEngine.ts).
     */
    targets: jsonb("targets").$type<{
      dailyHydrationTargetOz: number | null;
      electrolyteSodiumMg: number;
      recoveryWindowMin: number | null;
      recheckIntervalMin: number;
      envPressureSensitivity: number | null;
    } | null>(),
  },
  (t) => ({
    userStatusIdx: index("aforce_baseline_versions_user_status_idx").on(
      t.userId,
      t.status,
    ),
  }),
);

/**
 * APPEND-ONLY change log. One row per profile save that the engine classified
 * — `changeType` is 'major' (minted a version) or 'minor' (preference-only,
 * no version). `explanation` is the human-readable Evidence Engine™ string
 * shown to the user. Every recalibration must emit one (spec §18).
 */
export const aforceProfileChangeLog = pgTable(
  "aforce_profile_change_log",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    /** Resulting version; NULL for a minor edit that didn't bump a version. */
    profileVersionId: integer("profile_version_id"),
    baselineVersionId: integer("baseline_version_id"),
    changeType: text("change_type").notNull(), // 'major' | 'minor'
    changedFields: jsonb("changed_fields").$type<string[]>().notNull().default([]),
    explanation: text("explanation").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userTimeIdx: index("aforce_profile_change_log_user_time_idx").on(
      t.userId,
      t.createdAt,
    ),
  }),
);

export type AforceUserProfileRow = typeof aforceUserProfiles.$inferSelect;
export type InsertAforceUserProfile = typeof aforceUserProfiles.$inferInsert;
export type AforceProfileVersionRow = typeof aforceProfileVersions.$inferSelect;
export type InsertAforceProfileVersion = typeof aforceProfileVersions.$inferInsert;
export type AforceBaselineVersionRow = typeof aforceBaselineVersions.$inferSelect;
export type InsertAforceBaselineVersion = typeof aforceBaselineVersions.$inferInsert;
export type AforceProfileChangeLogRow = typeof aforceProfileChangeLog.$inferSelect;
export type InsertAforceProfileChangeLog = typeof aforceProfileChangeLog.$inferInsert;

/* ─── Stage 2 — Performance Knowledge Graph™ (§38, DR-003) ──────────────────
 * RESTORED 2026-07-26: these definitions were uncommitted schema work
 * destroyed by the reset-hard incident (CONTINUITY §6); reconstructed from
 * the surviving authoritative sources — types/knowledgeGraph.ts (GraphNode /
 * GraphEdge) and STAGE-2-GRAPH-SCHEMA-DEPLOYMENT-RUNBOOK.md (index
 * inventory, text ids, provenance_links GIN).
 *
 * APPEND-ORIENTED, application-enforced integrity (no FKs — repo convention).
 * NOT DEPLOYED: source-only until the runbook executes (R-21). No runtime
 * caller exists yet (Stage 2 is Partially Built — headless by design).
 * Ids are deterministic TEXT keys minted by the pure graph builder
 * (e.g. 'n:<family>:<hash>'), never serials — replay-safe.
 */
export const aforceGraphNodes = pgTable(
  "aforce_graph_nodes",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    family: text("family").notNull(),
    sourceEventId: text("source_event_id"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
    dayIndex: integer("day_index").notNull(),
    dayIndexBasis: text("day_index_basis").notNull(),
    profileVersionId: integer("profile_version_id"),
    baselineVersionId: integer("baseline_version_id"),
    modelVersion: text("model_version"),
    provenance: jsonb("provenance").$type<Record<string, unknown>>().notNull(),
    privacyClass: text("privacy_class").notNull(),
    retentionClass: text("retention_class").notNull(),
    quality: jsonb("quality").$type<Record<string, unknown>>().notNull(),
    invalidationStatus: text("invalidation_status").notNull().default("active"),
    invalidation: jsonb("invalidation").$type<Record<string, unknown>>().notNull(),
    audit: jsonb("audit").$type<Record<string, unknown>>().notNull(),
    attributes: jsonb("attributes").$type<Record<string, unknown>>().notNull().default({}),
  },
  (t) => ({
    userFamilyIdx: index("aforce_graph_nodes_user_family_idx").on(t.userId, t.family),
    userStatusIdx: index("aforce_graph_nodes_user_status_idx").on(t.userId, t.invalidationStatus),
    userOccurredIdx: index("aforce_graph_nodes_user_occurred_idx").on(t.userId, t.occurredAt),
    sourceEventIdx: index("aforce_graph_nodes_source_event_idx").on(t.sourceEventId),
  }),
);

export const aforceGraphEdges = pgTable(
  "aforce_graph_edges",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    family: text("family").notNull(),
    direction: text("direction").notNull(),
    sourceNodeId: text("source_node_id").notNull(),
    targetNodeId: text("target_node_id").notNull(),
    /** clientEventIds justifying this edge. Empty ⇒ unsupportable (§41). */
    provenanceLinks: jsonb("provenance_links").$type<string[]>().notNull().default([]),
    /** Full EvidenceAssessment — state/method/inputs/score; counter-evidence
     *  (contradictingCount) lives inside and is NEVER discarded (DR-003). */
    evidence: jsonb("evidence").$type<Record<string, unknown>>().notNull(),
    modelVersion: text("model_version").notNull(),
    privacyClass: text("privacy_class").notNull(),
    retentionClass: text("retention_class").notNull(),
    invalidationStatus: text("invalidation_status").notNull().default("active"),
    invalidation: jsonb("invalidation").$type<Record<string, unknown>>().notNull(),
    audit: jsonb("audit").$type<Record<string, unknown>>().notNull(),
  },
  (t) => ({
    userFamilyIdx: index("aforce_graph_edges_user_family_idx").on(t.userId, t.family),
    userStatusIdx: index("aforce_graph_edges_user_status_idx").on(t.userId, t.invalidationStatus),
    sourceNodeIdx: index("aforce_graph_edges_source_node_idx").on(t.sourceNodeId),
    targetNodeIdx: index("aforce_graph_edges_target_node_idx").on(t.targetNodeId),
    // Reverse-derivation lookup: "which edges depend on this event?" (§41
    // deletion propagation) — GIN over the provenance jsonb array.
    provenanceGin: index("aforce_graph_edges_provenance_gin").using("gin", t.provenanceLinks),
  }),
);

export type AforceGraphNodeRow = typeof aforceGraphNodes.$inferSelect;
export type AforceGraphEdgeRow = typeof aforceGraphEdges.$inferSelect;

/* ─── D-2 (PASS-3 slice 4c) — web Command entitlements bridge ────────────────
 * A Command subscription purchased on the marketing site (Shopify selling
 * plans) grants app entitlement here. Rows are written ONLY by the verified
 * Shopify webhook; matched to a user by lowercased email at entitlement
 * read time (userId back-filled on first match). Stripe remains the primary
 * rail; this is an additive OR — the fail-safe core downgrade still applies
 * when neither rail is active. */
/**
 * Wave-3 PR6 — webhook delivery ledger. One row per provider delivery:
 * duplicate suppression (unique on source+delivery id) AND the commerce
 * audit trail that was previously missing entirely. No payment data —
 * ids and topic only. Additive table; applied via drizzle-kit push.
 */
export const aforceWebhookDeliveries = pgTable(
  "aforce_webhook_deliveries",
  {
    id: serial("id").primaryKey(),
    source: text("source").notNull(), // 'stripe' | 'shopify'
    deliveryId: text("delivery_id").notNull(),
    topic: text("topic").notNull().default(""),
    action: text("action").notNull().default(""),
    externalRef: text("external_ref"),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    deliveryUq: uniqueIndex("aforce_webhook_deliveries_source_delivery_uq").on(t.source, t.deliveryId),
  }),
);

export const aforceWebEntitlements = pgTable(
  "aforce_web_entitlements",
  {
    id: serial("id").primaryKey(),
    /** Lowercased purchaser email from Shopify — the matching key. */
    email: text("email").notNull(),
    /** Back-filled on first successful entitlement match. */
    userId: text("user_id"),
    planId: text("plan_id").notNull(), // 'athlete' (Command) only, today
    source: text("source").notNull().default("shopify"),
    /** Shopify subscription-contract id — idempotency key per source. */
    externalRef: text("external_ref").notNull(),
    status: text("status").notNull(), // 'active' | 'cancelled'
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    sourceRefUq: uniqueIndex("aforce_web_entitlements_source_ref_uq").on(t.source, t.externalRef),
    emailIdx: index("aforce_web_entitlements_email_idx").on(t.email),
  }),
);
export type AforceWebEntitlementRow = typeof aforceWebEntitlements.$inferSelect;

/* ─── Canonical health records (Lane F3) ──────────────────────────────────────
 * The durable store for `@workspace/health-core`'s `CanonicalHealthRecord` —
 * every normalized record any provider (WHOOP / Oura / Garmin / Strava /
 * Apple Health / Health Connect) delivers, after dedupe, lands here keyed by
 * its own `deduplicationKey`.
 *
 * `id` IS the record's `deduplicationKey` (see @workspace/health-core
 * dedupe.buildDeduplicationKey) — not a surrogate serial. That key is already
 * a deterministic function of (userId, metricType, origin, externalId |
 * startTime/endTime), so it doubles as the natural idempotency key: a re-sync
 * of the same underlying reading always produces the same id, and `ON
 * CONFLICT (id) DO UPDATE` (gated on `synced_at` — newer sync wins, an older
 * replay can never clobber a fresher row) is what makes ingestion safe to
 * retry.
 *
 * Soft-delete only: `deletedAt` tombstones a provider's records on disconnect
 * (never a DELETE — historical readiness/recovery context must survive a
 * reconnect). A real DELETE happens exactly once, for every row, on the
 * account-deletion hook (`purgeUser`) — see healthRecordsRepo.ts.
 *
 * DORMANT: no runtime writer exists yet (F6/provider-kit lands the ingestion
 * path). This table + healthRecordsRepo.ts are the persistence contract that
 * lands ahead of it. `drizzle-kit push` applies additive schema directly —
 * this repo has no migration files (established convention, see
 * docs/SCHEMA_DRIFT.md).
 */
export const aforceHealthRecords = pgTable(
  "aforce_health_records",
  {
    /** = CanonicalHealthRecord.deduplicationKey. Deterministic, not a serial. */
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    /** The HealthProviderId that DELIVERED this record (chain hop N). */
    provider: text("provider").notNull(),
    /** The HealthOriginId that MEASURED it — equals `provider` for a direct
     *  pull; differs when relayed via HealthKit / Health Connect. */
    origin: text("origin").notNull(),
    metricType: text("metric_type").notNull(),
    /** Provider-native record id when one exists — strongest dedup input. */
    externalId: text("external_id"),
    /** HEALTH_RECORD_SCHEMA_VERSION at write time — lets future migrations
     *  reinterpret `value` without guessing the shape it was written under. */
    schemaVersion: integer("schema_version").notNull(),
    /** CanonicalHealthValue — number | string | SleepSessionValue |
     *  WorkoutValue | Record<string, unknown>, JSON-serialized verbatim. */
    value: jsonb("value").notNull(),
    unit: text("unit"),
    startUtc: timestamp("start_utc", { withTimezone: true }),
    endUtc: timestamp("end_utc", { withTimezone: true }),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
    syncedAt: timestamp("synced_at", { withTimezone: true }).notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }),
    /** REQUIRED (by contract, not by the DB) when metricType = 'hrv'. */
    hrvMethod: text("hrv_method"),
    /** Set only for metricType = 'provider_score'. Provider-attributed —
     *  never blended into an AForce score (Score-Protection). */
    scoreKind: text("score_kind"),
    confidence: text("confidence"), // 'high' | 'medium' | 'low' | 'unknown'
    /** ProvenanceHop[] — [origin, ...aggregators]; length 1 = direct. */
    provenanceChain: jsonb("provenance_chain").notNull(),
    /** Raw native origin identifier when delivered via an aggregator (HK
     *  sourceRevision bundle id / HC dataOrigin package name). */
    originalSource: text("original_source"),
    device: jsonb("device").$type<{
      manufacturer?: string;
      model?: string;
      hardwareVersion?: string;
      softwareVersion?: string;
    } | null>(),
    /** Tombstone — set on provider disconnect (soft-delete). NULL = live. */
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    // Primary read path: "this user's <metric> history, newest first."
    userMetricObservedIdx: index("aforce_health_records_user_metric_observed_idx").on(
      t.userId,
      t.metricType,
      t.observedAt.desc(),
    ),
    // Per-provider scoping (disconnect tombstone sweep, provider filters).
    userProviderIdx: index("aforce_health_records_user_provider_idx").on(
      t.userId,
      t.provider,
    ),
    // Partial index so the hot "live records only" path (the default for
    // listRecords) never has to scan tombstoned rows.
    liveOnlyIdx: index("aforce_health_records_live_only_idx")
      .on(t.userId, t.metricType, t.observedAt)
      .where(sql`${t.deletedAt} is null`),
  }),
);

export type AforceHealthRecordRow = typeof aforceHealthRecords.$inferSelect;
export type InsertAforceHealthRecord = typeof aforceHealthRecords.$inferInsert;
