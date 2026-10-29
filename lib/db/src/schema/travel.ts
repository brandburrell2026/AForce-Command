import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  integer,
  jsonb,
  timestamp,
  boolean,
  primaryKey,
  unique,
  foreignKey,
  index,
  check,
} from "drizzle-orm/pg-core";
export const aforceTravelAccounts = pgTable(
  "aforce_travel_accounts",
  {
    userId: text("user_id").primaryKey(),
    revision: integer("revision").notNull().default(0),
    trips: jsonb("trips").notNull().default([]),
    observations: jsonb("observations").notNull().default({}),
    linkCiphertext: text("link_ciphertext"),
    linkedAt: timestamp("linked_at", { withTimezone: true }),
    monitoring: boolean("monitoring").notNull().default(false),
    nextCheckAt: timestamp("next_check_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    leaseUntil: timestamp("lease_until", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check("aforce_travel_accounts_revision_check", sql`${t.revision}>=0`),
    check(
      "aforce_travel_accounts_trips_check",
      sql`jsonb_typeof(${t.trips})='array'`,
    ),
    check(
      "aforce_travel_accounts_observations_check",
      sql`jsonb_typeof(${t.observations})='object'`,
    ),
    index("aforce_travel_accounts_due_idx")
      .on(t.nextCheckAt)
      .where(sql`${t.monitoring}`),
  ],
);
export const aforceTravelDevices = pgTable(
  "aforce_travel_devices",
  {
    userId: text("user_id")
      .notNull()
      .references(() => aforceTravelAccounts.userId, { onDelete: "cascade" }),
    deviceId: text("device_id").notNull(),
    tokenCiphertext: text("token_ciphertext").notNull(),
    tokenHash: text("token_hash").notNull(),
    enabled: boolean("enabled").notNull().default(false),
    lastSentAt: timestamp("last_sent_at", { withTimezone: true }),
    sendLeaseUntil: timestamp("send_lease_until", { withTimezone: true }),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.deviceId] }),
    unique("aforce_travel_devices_token_hash_key").on(t.tokenHash),
  ],
);
export const aforceTravelAlerts = pgTable(
  "aforce_travel_alerts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    deviceId: text("device_id").notNull(),
    tripId: text("trip_id").notNull(),
    legId: text("leg_id").notNull(),
    eventKey: text("event_key").notNull(),
    state: text("state").notNull().default("queued"),
    attempts: integer("attempts").notNull().default(0),
    ticketId: text("ticket_id"),
    nextAt: timestamp("next_at", { withTimezone: true }).notNull().defaultNow(),
    leaseUntil: timestamp("lease_until", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    foreignKey({
      name: "aforce_travel_alerts_user_id_device_id_fkey",
      columns: [t.userId, t.deviceId],
      foreignColumns: [
        aforceTravelDevices.userId,
        aforceTravelDevices.deviceId,
      ],
    }).onDelete("cascade"),
    unique("aforce_travel_alerts_user_id_device_id_event_key_key").on(
      t.userId,
      t.deviceId,
      t.eventKey,
    ),
    check(
      "aforce_travel_alerts_state_check",
      sql`${t.state} in ('queued','sending','receipt','delivered','failed','superseded')`,
    ),
    index("aforce_travel_alerts_due_idx")
      .on(t.nextAt)
      .where(sql`${t.state} in ('queued','sending','receipt')`),
  ],
);
