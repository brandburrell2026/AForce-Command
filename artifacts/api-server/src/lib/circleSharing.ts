import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { and, eq, or, sql } from "drizzle-orm";
import {
  db,
  aforceCircleSharingGrants as grants,
  aforceCircleUsers as members,
} from "@workspace/db";

export const SHARING_ACKNOWLEDGEMENT = "circle-sharing-v1";
export const sharingEnabled = () =>
  process.env["CIRCLE_SHARING_ENABLED"] === "true";
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
  if (input.fields.length && !sharingEnabled())
    throw new CircleSharingError("circle_sharing_unavailable", 503);
  if (userId === memberUserId)
    throw new CircleSharingError("member_not_available", 404);
  return db.transaction(async (tx) => {
    await lockCirclePair(tx, userId, memberUserId);
    if (!(await sharingTableExists(tx))) {
      if (input.fields.length)
        throw new CircleSharingError("circle_sharing_unavailable", 503);
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
    if (input.fields.length) {
      if (!sharingEnabled())
        throw new CircleSharingError("circle_sharing_unavailable", 503);
      if (input.acknowledgementVersion !== SHARING_ACKNOWLEDGEMENT)
        throw new CircleSharingError("sharing_acknowledgement_required", 400);
      const connections = await tx
        .select()
        .from(members)
        .where(
          or(
            and(
              eq(members.ownerUserId, userId),
              eq(members.memberUserId, memberUserId),
            ),
            and(
              eq(members.ownerUserId, memberUserId),
              eq(members.memberUserId, userId),
            ),
          ),
        );
      if (
        userId === memberUserId ||
        connections.length !== 2 ||
        connections.some((row) => row.status !== "active")
      )
        throw new CircleSharingError("member_not_available", 404);
    }
    const values = {
      sourceUserId: userId,
      recipientUserId: memberUserId,
      allowScore: input.fields.includes("score"),
      allowState: input.fields.includes("state"),
      version: (current?.version ?? 0) + 1,
      acknowledgementVersion: input.fields.length
        ? SHARING_ACKNOWLEDGEMENT
        : null,
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

export type RecordedSnapshot = {
  score: number;
  level: string;
  capturedAt: Date;
};
/** Validate the latest record as a whole; never substitute an older valid record. */
export function filterRecordedActivity(
  snapshot: RecordedSnapshot,
  fields: readonly SharingField[],
  now = new Date(),
) {
  const age = now.getTime() - snapshot.capturedAt.getTime();
  const states: Record<string, string> = {
    PEAK: "Peak",
    BALANCED: "Balanced",
    RECOVERING: "Recovering",
    DEPLETED: "Depleted",
  };
  if (
    !fields.length ||
    !Number.isFinite(age) ||
    age < 0 ||
    age > 86400000 ||
    !Number.isInteger(snapshot.score) ||
    snapshot.score < 0 ||
    snapshot.score > 100 ||
    !Object.hasOwn(states, snapshot.level)
  )
    return null;
  return {
    ...(fields.includes("score") ? { score: snapshot.score } : {}),
    ...(fields.includes("state") ? { state: states[snapshot.level] } : {}),
    recordedAt: snapshot.capturedAt.toISOString(),
    source: "recorded_app_data" as const,
  };
}
export async function readCircleActivity(userId: string) {
  if (!sharingEnabled())
    throw new CircleSharingError("circle_sharing_unavailable", 503);
  // One SQL statement snapshots grants, reciprocal membership, and latest record.
  // LATERAL selects latest BEFORE validation so NOT_COMPUTED cannot expose history.
  const result = await db.execute(sql`
    select g.source_user_id as "userId", visible.name, visible.initials,
      g.allow_score as "allowScore", g.allow_state as "allowState",
      latest.score, latest.level, latest.captured_at as "capturedAt"
    from aforce_circle_sharing_grants g
    join aforce_circle_users visible on visible.owner_user_id = g.recipient_user_id
      and visible.member_user_id = g.source_user_id and visible.status = 'active'
    join aforce_circle_users reciprocal on reciprocal.owner_user_id = g.source_user_id
      and reciprocal.member_user_id = g.recipient_user_id and reciprocal.status = 'active'
    join lateral (select score, level, captured_at from aforce_score_snapshots
      where user_id = g.source_user_id order by captured_at desc, id desc limit 1) latest on true
    where g.recipient_user_id = ${userId} and g.source_user_id <> ${userId}
      and g.acknowledgement_version = ${SHARING_ACKNOWLEDGEMENT}
      and (g.allow_score or g.allow_state)
    order by latest.captured_at desc, g.source_user_id
  `);
  const now = new Date();
  return result.rows.flatMap((row) => {
    const fields: SharingField[] = [];
    if (row.allowScore === true) fields.push("score");
    if (row.allowState === true) fields.push("state");
    const data = filterRecordedActivity(
      {
        score: row.score as number,
        level: row.level as string,
        capturedAt: new Date(row.capturedAt as string),
      },
      fields,
      now,
    );
    return data
      ? [
          {
            userId: row.userId as string,
            name: row.name as string,
            initials: row.initials as string,
            ...data,
          },
        ]
      : [];
  });
}
