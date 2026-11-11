import {
  pgTable,
  text,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/** Bearer invitation secrets are returned once; only SHA-256 digests persist. */
export const aforceCircleInvitations = pgTable(
  "aforce_circle_invitations",
  {
    id: text("id").primaryKey(),
    ownerUserId: text("owner_user_id").notNull(),
    displayName: text("display_name").notNull(),
    group: text("group").notNull().default("friends"),
    codeHash: text("code_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    acceptedByUserId: text("accepted_by_user_id"),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => ({
    codeUq: uniqueIndex("aforce_circle_invitations_code_uq").on(t.codeHash),
    ownerIdx: index("aforce_circle_invitations_owner_idx").on(t.ownerUserId),
  }),
);
