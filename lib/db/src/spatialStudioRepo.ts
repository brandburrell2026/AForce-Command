/**
 * AForce Spatial Studio — project repository.
 *
 * `SpatialStudioProjectStore` is the one interface the api-server routes
 * talk to; `createSpatialStudioRepo(db)` is the Drizzle implementation and
 * api-server keeps an in-memory one for tests. Every query is scoped by
 * `userId`: another member's project id reads as "not found".
 */
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { aforceSpatialStudioProjects } from "./schema/spatialStudio";

export interface SpatialStudioProjectMeta {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  fixtureCount: number;
  assetCount: number;
  bytes: number;
  thumbnail: string | null;
}

export interface SpatialStudioProjectRecord extends SpatialStudioProjectMeta {
  document: Record<string, unknown>;
}

export interface SpatialStudioProjectInput {
  name: string;
  document: Record<string, unknown>;
  thumbnail: string | null;
  bytes: number;
  fixtureCount: number;
  assetCount: number;
}

export type SpatialStudioUpsertResult =
  | { kind: "created" | "updated"; meta: SpatialStudioProjectMeta }
  /** The row changed since the client last read it; `current` is what is stored now. */
  | { kind: "conflict"; current: SpatialStudioProjectMeta };

export interface SpatialStudioProjectStore {
  list(userId: string): Promise<SpatialStudioProjectMeta[]>;
  get(userId: string, id: string): Promise<SpatialStudioProjectRecord | null>;
  /**
   * Create or overwrite. When `expectedUpdatedAt` is given and the stored
   * row is newer, nothing is written and the result is a conflict.
   */
  upsert(
    userId: string,
    id: string,
    input: SpatialStudioProjectInput,
    expectedUpdatedAt: string | null,
  ): Promise<SpatialStudioUpsertResult>;
  softDelete(userId: string, id: string): Promise<boolean>;
  /** Account-deletion cascade: hard delete of every row, soft-deleted ones included. */
  purgeUser(userId: string): Promise<number>;
}

const iso = (d: Date | string): string => (d instanceof Date ? d.toISOString() : new Date(d).toISOString());

type Row = typeof aforceSpatialStudioProjects.$inferSelect;

function toMeta(row: Row): SpatialStudioProjectMeta {
  return {
    id: row.id,
    name: row.name,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    fixtureCount: row.fixtureCount,
    assetCount: row.assetCount,
    bytes: row.bytes,
    thumbnail: row.thumbnail,
  };
}

export function createSpatialStudioRepo(
  dbx: NodePgDatabase<Record<string, unknown>>,
): SpatialStudioProjectStore {
  const live = (userId: string, id?: string) =>
    id === undefined
      ? and(eq(aforceSpatialStudioProjects.userId, userId), isNull(aforceSpatialStudioProjects.deletedAt))
      : and(
          eq(aforceSpatialStudioProjects.userId, userId),
          eq(aforceSpatialStudioProjects.id, id),
          isNull(aforceSpatialStudioProjects.deletedAt),
        );

  return {
    async list(userId) {
      const rows = await dbx
        .select({
          userId: aforceSpatialStudioProjects.userId,
          id: aforceSpatialStudioProjects.id,
          name: aforceSpatialStudioProjects.name,
          thumbnail: aforceSpatialStudioProjects.thumbnail,
          bytes: aforceSpatialStudioProjects.bytes,
          fixtureCount: aforceSpatialStudioProjects.fixtureCount,
          assetCount: aforceSpatialStudioProjects.assetCount,
          createdAt: aforceSpatialStudioProjects.createdAt,
          updatedAt: aforceSpatialStudioProjects.updatedAt,
          deletedAt: aforceSpatialStudioProjects.deletedAt,
          // The listing never needs the document; keep it out of the wire.
          document: sql<Record<string, unknown>>`'{}'::jsonb`,
        })
        .from(aforceSpatialStudioProjects)
        .where(live(userId))
        .orderBy(desc(aforceSpatialStudioProjects.updatedAt));
      return rows.map(toMeta);
    },

    async get(userId, id) {
      const [row] = await dbx.select().from(aforceSpatialStudioProjects).where(live(userId, id)).limit(1);
      return row ? { ...toMeta(row), document: row.document } : null;
    },

    async upsert(userId, id, input, expectedUpdatedAt) {
      const [existing] = await dbx
        .select()
        .from(aforceSpatialStudioProjects)
        .where(and(eq(aforceSpatialStudioProjects.userId, userId), eq(aforceSpatialStudioProjects.id, id)))
        .limit(1);
      const now = new Date();

      if (existing && existing.deletedAt === null) {
        if (expectedUpdatedAt !== null && new Date(expectedUpdatedAt).getTime() !== existing.updatedAt.getTime()) {
          return { kind: "conflict", current: toMeta(existing) };
        }
        const [row] = await dbx
          .update(aforceSpatialStudioProjects)
          .set({ ...input, updatedAt: now })
          .where(and(eq(aforceSpatialStudioProjects.userId, userId), eq(aforceSpatialStudioProjects.id, id)))
          .returning();
        return { kind: "updated", meta: toMeta(row!) };
      }

      if (existing) {
        // Soft-deleted row with the same id: revive it as a fresh project.
        const [row] = await dbx
          .update(aforceSpatialStudioProjects)
          .set({ ...input, createdAt: now, updatedAt: now, deletedAt: null })
          .where(and(eq(aforceSpatialStudioProjects.userId, userId), eq(aforceSpatialStudioProjects.id, id)))
          .returning();
        return { kind: "created", meta: toMeta(row!) };
      }

      const [row] = await dbx
        .insert(aforceSpatialStudioProjects)
        .values({ userId, id, ...input, createdAt: now, updatedAt: now })
        .returning();
      return { kind: "created", meta: toMeta(row!) };
    },

    async softDelete(userId, id) {
      const rows = await dbx
        .update(aforceSpatialStudioProjects)
        .set({ deletedAt: new Date() })
        .where(live(userId, id))
        .returning({ id: aforceSpatialStudioProjects.id });
      return rows.length > 0;
    },

    async purgeUser(userId) {
      const rows = await dbx
        .delete(aforceSpatialStudioProjects)
        .where(eq(aforceSpatialStudioProjects.userId, userId))
        .returning({ id: aforceSpatialStudioProjects.id });
      return rows.length;
    },
  };
}
