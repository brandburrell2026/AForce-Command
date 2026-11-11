/**
 * AForce Spatial Studio — saved activation designs, per account.
 *
 * One row per project, keyed by (user_id, id) so the client-generated id
 * only has to be unique per member and no member can occupy another's id.
 * `document` is the studio's scene document (fixtures, style, uploaded
 * images as data URLs), validated by api-server on write and re-normalized
 * by the studio on read. Soft-deleted rows keep `deleted_at` so an
 * accidental delete can be recovered by hand; account deletion hard-purges
 * every row through the cascade.
 *
 * Data class: design documents and uploaded brand/product imagery. No
 * health data. Schema evolution: additive only, applied with
 * `drizzle-kit push` (see docs/SCHEMA_DRIFT.md); the matching SQL lives in
 * migrations/20261022_spatial_studio_projects.sql.
 */
import { index, integer, jsonb, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

export const aforceSpatialStudioProjects = pgTable(
  "aforce_spatial_studio_projects",
  {
    userId: text("user_id").notNull(),
    id: text("id").notNull(),
    name: text("name").notNull(),
    document: jsonb("document").$type<Record<string, unknown>>().notNull(),
    /** Small JPEG data URL captured from the canvas at save time. */
    thumbnail: text("thumbnail"),
    /** Serialized document size, for listings and quotas. */
    bytes: integer("bytes").notNull().default(0),
    fixtureCount: integer("fixture_count").notNull().default(0),
    assetCount: integer("asset_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.id] }),
    userUpdatedIdx: index("aforce_spatial_studio_projects_user_updated_idx").on(t.userId, t.updatedAt),
  }),
);

export type AforceSpatialStudioProjectRow = typeof aforceSpatialStudioProjects.$inferSelect;
