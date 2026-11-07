import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { and, eq, or, sql } from "drizzle-orm";
import {
  db,
  aforceCircleSharingGrants as grants,
  aforceCircleUsers as members,
} from "@workspace/db";

export type SharingField = "score" | "state";
type Transaction = Pick<NodePgDatabase<Record<string, never>>, "execute" | "select" | "insert" | "update">;
export class CircleSharingError extends Error {
  constructor(
    public code: string,
    public status: number,
  ) {
    super(code);
  }
}
// A pilot-wide lifecycle lock coordinates grants with health deletion. Pair locks
// additionally define the connection lifecycle boundary, including reconnects.
export async function lockSharingLifecycle(tx: Transaction) {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended('circle-sharing-lifecycle', 0))`,
  );
}
export async function lockCirclePair(
  tx: Transaction,
  first: string,
  second: string,
) {
  await lockSharingLifecycle(tx);
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${"circle-pair:" + JSON.stringify([first, second].sort())}, 0))`,
  );
}
export async function sharingTableExists(tx: Pick<Transaction, "execute">) {
  const result = await tx.execute(
    sql`select to_regclass('public.aforce_circle_sharing_grants') is not null as present`,
  );
  return result.rows[0]?.present === true;
}
const revokedValues = () => ({
  allowScore: false,
  allowState: false,
  acknowledgementVersion: null,
  version: sql`${grants.version} + 1`,
  updatedAt: new Date(),
});
/** Caller holds pair lock. Safe before additive sharing migration is installed. */
export async function clearCirclePairSharing(
  tx: Transaction,
  first: string,
  second: string,
) {
  if (!(await sharingTableExists(tx))) return;
  const tombstones = [
    { sourceUserId: first, recipientUserId: second, version: 1 },
  ];
  if (first !== second)
    tombstones.push({
      sourceUserId: second,
      recipientUserId: first,
      version: 1,
    });
  await tx
    .insert(grants)
    .values(tombstones)
    .onConflictDoUpdate({
      target: [grants.sourceUserId, grants.recipientUserId],
      set: revokedValues(),
    });
}
/** Enroll inside health deletion's transaction; tombstones defeat stale saves. */
export async function clearCircleSharingForUser(
  tx: Transaction,
  userId: string,
) {
  await lockSharingLifecycle(tx);
  if (!(await sharingTableExists(tx))) return;
  // Existing pairs without a grant also need tombstones: invalidate stale first
  // saves (expectedVersion=0) queued before this health deletion.
  const connections = await tx
    .select()
    .from(members)
    .where(
      or(eq(members.ownerUserId, userId), eq(members.memberUserId, userId)),
    );
  const peers = new Set(
    connections.map((row) =>
      row.ownerUserId === userId ? row.memberUserId : row.ownerUserId,
    ),
  );
  for (const peer of peers) await clearCirclePairSharing(tx, userId, peer);
  await tx
    .update(grants)
    .set(revokedValues())
    .where(
      or(eq(grants.sourceUserId, userId), eq(grants.recipientUserId, userId)),
    );
}
export function grantToWire(row: typeof grants.$inferSelect) {
  return {
    memberUserId: row.recipientUserId,
    fields: [
      row.allowScore ? "score" : null,
      row.allowState ? "state" : null,
    ].filter((field): field is SharingField => field !== null),
    version: row.version,
    acknowledgementVersion: row.acknowledgementVersion,
  };
}
export async function listSharingGrants(userId: string) {
  if (!(await sharingTableExists(db))) return [];
  const rows = await db
    .select()
    .from(grants)
    .where(eq(grants.sourceUserId, userId));
  return rows.map(grantToWire);
}
export async function updateSharingGrant(
  userId: string,
  memberUserId: string,
  input: {
    fields: SharingField[];
    expectedVersion: number;
    acknowledgementVersion?: string;
  },
) {
  // v1.7 retires score/state grants permanently. Revocation remains available
  // so callers can remove stale legacy consent without needing a feature flag.
  if (input.fields.length)
    throw new CircleSharingError("legacy_circle_sharing_retired", 410);
  if (userId === memberUserId)
    throw new CircleSharingError("member_not_available", 404);
  return db.transaction(async (tx) => {
    await lockCirclePair(tx, userId, memberUserId);
    if (!(await sharingTableExists(tx))) {
      return {
        memberUserId,
        fields: [] as SharingField[],
        version: 0,
        acknowledgementVersion: null,
      };
    }
    const [current] = await tx
      .select()
      .from(grants)
      .where(
        and(
          eq(grants.sourceUserId, userId),
          eq(grants.recipientUserId, memberUserId),
        ),
      );
    if ((current?.version ?? 0) !== input.expectedVersion)
      throw new CircleSharingError("sharing_version_conflict", 409);
    const values = {
      sourceUserId: userId,
      recipientUserId: memberUserId,
      allowScore: input.fields.includes("score"),
      allowState: input.fields.includes("state"),
      version: (current?.version ?? 0) + 1,
      acknowledgementVersion: null,
      updatedAt: new Date(),
    };
    const [row] = await tx
      .insert(grants)
      .values(values)
      .onConflictDoUpdate({
        target: [grants.sourceUserId, grants.recipientUserId],
        set: values,
      })
      .returning();
    return grantToWire(row);
  });
}

/**
 * Legacy score/state activity is intentionally unavailable in Circle v1.7.
 * Return an empty projection rather than reading records, even if historical
 * grants remain in the database while migration tombstones are applied.
 */
export async function readCircleActivity(_userId: string) {
  return [] as Array<never>;
}
