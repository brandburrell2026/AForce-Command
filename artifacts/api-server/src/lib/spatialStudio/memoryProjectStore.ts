import type {
  SpatialStudioProjectInput,
  SpatialStudioProjectMeta,
  SpatialStudioProjectRecord,
  SpatialStudioProjectStore,
  SpatialStudioUpsertResult,
} from "@workspace/db";

interface StoredRow {
  userId: string;
  id: string;
  input: SpatialStudioProjectInput;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

/** Process-local store with the repo's exact semantics, for tests. */
export function createMemorySpatialStudioStore(now: () => Date = () => new Date()): SpatialStudioProjectStore {
  const rows = new Map<string, StoredRow>();
  const key = (userId: string, id: string) => `${userId}\u0000${id}`;
  const meta = (row: StoredRow): SpatialStudioProjectMeta => ({
    id: row.id,
    name: row.input.name,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    fixtureCount: row.input.fixtureCount,
    assetCount: row.input.assetCount,
    bytes: row.input.bytes,
    thumbnail: row.input.thumbnail,
  });

  return {
    async list(userId) {
      return [...rows.values()]
        .filter((r) => r.userId === userId && r.deletedAt === null)
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
        .map(meta);
    },
    async get(userId, id): Promise<SpatialStudioProjectRecord | null> {
      const row = rows.get(key(userId, id));
      return row && row.deletedAt === null ? { ...meta(row), document: row.input.document } : null;
    },
    async upsert(userId, id, input, expectedUpdatedAt): Promise<SpatialStudioUpsertResult> {
      const existing = rows.get(key(userId, id));
      const at = now();
      if (existing && existing.deletedAt === null) {
        if (expectedUpdatedAt !== null && new Date(expectedUpdatedAt).getTime() !== existing.updatedAt.getTime()) {
          return { kind: "conflict", current: meta(existing) };
        }
        existing.input = input;
        existing.updatedAt = at;
        return { kind: "updated", meta: meta(existing) };
      }
      const row: StoredRow = { userId, id, input, createdAt: at, updatedAt: at, deletedAt: null };
      rows.set(key(userId, id), row);
      return { kind: "created", meta: meta(row) };
    },
    async softDelete(userId, id) {
      const row = rows.get(key(userId, id));
      if (!row || row.deletedAt !== null) return false;
      row.deletedAt = now();
      return true;
    },
    async purgeUser(userId) {
      let n = 0;
      for (const [k, row] of rows) {
        if (row.userId === userId) {
          rows.delete(k);
          n += 1;
        }
      }
      return n;
    },
  };
}
