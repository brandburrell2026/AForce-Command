import {
  boolean,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/** Explicit, directional consent; empty rows retain optimistic-concurrency versions. */
export const aforceCircleSharingGrants = pgTable(
  "aforce_circle_sharing_grants",
  {
    sourceUserId: text("source_user_id").notNull(),
    recipientUserId: text("recipient_user_id").notNull(),
    allowScore: boolean("allow_score").notNull().default(false),
    allowState: boolean("allow_state").notNull().default(false),
    version: integer("version").notNull().default(1),
    acknowledgementVersion: text("acknowledgement_version"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.sourceUserId, t.recipientUserId] })],
);
