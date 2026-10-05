/**
 * AForce Concierge — conversation + preference persistence.
 *
 * Section 64 surface (Conversational Intelligence Architecture™). Three tables,
 * all keyed by the authenticated Clerk user id and never by device:
 *
 *   aforce_concierge_conversations — one row per chat thread.
 *   aforce_concierge_messages      — append-only turns; `content` carries the
 *                                    gated, structured assistant reply (or the
 *                                    member's own text) as JSONB.
 *   aforce_concierge_preferences   — the member's remembered preferences
 *                                    (goal / routine / tone / notes). Written
 *                                    ONLY after explicit consent (`consent_at`
 *                                    is set by the same request that first
 *                                    stores a preference). Kept separate from
 *                                    every health record on purpose: forgetting
 *                                    a preference never touches intake, scores
 *                                    or provider data.
 *
 * Governance: these rows are a NEW data class (conversation transcripts +
 * assistant preferences). The DATA-CLASSIFICATION-MATRIX row is proposed in
 * governance/proposals/PR-003-aforce-concierge.md and awaits Privacy/Legal
 * review; the production flag stays OFF until it clears.
 *
 * Deletion: `purgeConciergeUser` in `conciergeRepo.ts` is wired into
 * `runAccountDeletionCascade`, so account deletion removes every row here.
 *
 * Schema evolution: additive only, applied with `drizzle-kit push` by the
 * founder (see docs/SCHEMA_DRIFT.md). No DB-level JSONB defaults — the
 * application owns defaults (same reasoning as aforce_privacy).
 */
import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export type ConciergeMessageRole = "user" | "assistant" | "notice";

export const aforceConciergeConversations = pgTable(
  "aforce_concierge_conversations",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    /** Short label derived from the first member message (≤ 80 chars). */
    title: text("title"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userUpdatedIdx: index("aforce_concierge_conversations_user_updated_idx").on(
      t.userId,
      t.updatedAt,
    ),
  }),
);

export const aforceConciergeMessages = pgTable(
  "aforce_concierge_messages",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id").notNull(),
    /** Denormalised so a per-user purge never needs a join. */
    userId: text("user_id").notNull(),
    role: text("role").$type<ConciergeMessageRole>().notNull(),
    /** Structured turn payload — see api-server lib/concierge/types.ts. */
    content: jsonb("content").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    conversationCreatedIdx: index("aforce_concierge_messages_conversation_created_idx").on(
      t.conversationId,
      t.createdAt,
    ),
    userIdx: index("aforce_concierge_messages_user_idx").on(t.userId),
  }),
);

export interface ConciergePreferencesJson {
  primaryGoal?: string | null;
  routine?: string | null;
  /** Delivery persona only (voiceCatalog ids): rock | bb | surge | sage. */
  tone?: string | null;
  /** Free-form remembered notes the member explicitly asked to keep. */
  notes?: string[];
}

export const aforceConciergePreferences = pgTable("aforce_concierge_preferences", {
  userId: text("user_id").primaryKey(),
  prefs: jsonb("prefs").$type<ConciergePreferencesJson>().notNull(),
  /** Set when the member first consented to saving preferences; null = never. */
  consentAt: timestamp("consent_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AforceConciergeConversationRow = typeof aforceConciergeConversations.$inferSelect;
export type AforceConciergeMessageRow = typeof aforceConciergeMessages.$inferSelect;
export type AforceConciergePreferencesRow = typeof aforceConciergePreferences.$inferSelect;
