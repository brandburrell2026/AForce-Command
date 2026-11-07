import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * An intentional, directional share of one Moment with one active Circle
 * member. This table never accepts hydration, score, state, goal, or health
 * fields: a recipient sees only the Moment title and scheduled time.
 */
export const aforceCircleMomentShares = pgTable(
  "aforce_circle_moment_shares",
  {
    id: text("id").primaryKey(),
    sourceUserId: text("source_user_id").notNull(),
    recipientUserId: text("recipient_user_id").notNull(),
    momentId: text("moment_id").notNull(),
    title: text("title").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => ({
    sourceRecipientMomentUq: uniqueIndex(
      "aforce_circle_moment_shares_source_recipient_moment_uq",
    ).on(t.sourceUserId, t.recipientUserId, t.momentId),
    recipientActiveIdx: index("aforce_circle_moment_shares_recipient_active_idx").on(
      t.recipientUserId,
      t.revokedAt,
      t.startsAt,
    ),
  }),
);

export type AforceCircleMomentShareRow = typeof aforceCircleMomentShares.$inferSelect;
