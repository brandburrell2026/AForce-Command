/**
 * Marketing-site persistence.
 *
 * early_access_signups — captured by the marketing site's
 * EarlyAccessCapture component. One row per email; `source` records
 * which CTA on the page produced the signup ("hero_cta", "footer_cta",
 * etc.) so we can attribute conversions.
 */

import {
  pgTable,
  integer,
  serial,
  text,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const earlyAccessSignups = pgTable(
  "early_access_signups",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull(),
    source: text("source").notNull().default("unknown"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    emailUnique: uniqueIndex("early_access_signups_email_key").on(t.email),
    createdAtIdx: index("early_access_signups_created_at_idx").on(t.createdAt),
  }),
);

export type EarlyAccessSignupRow = typeof earlyAccessSignups.$inferSelect;

/** Durable internal notifications; acceptedAt means provider acceptance, not delivery. */
export const signupNotifications = pgTable("aforce_signup_notifications", {
  signupId: integer("signup_id").primaryKey().references(() => earlyAccessSignups.id, { onDelete: "cascade" }),
  attempts: integer("attempts").notNull().default(0),
  nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull().defaultNow(),
  leaseUntil: timestamp("lease_until", { withTimezone: true }),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  lastError: text("last_error"),
});
