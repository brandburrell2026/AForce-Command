import { randomUUID } from "node:crypto";
import { and, eq, isNull, or, desc, sql } from "drizzle-orm";
import {
  db,
  aforceCircleMomentShares as shares,
  aforceCircleUsers as members,
} from "@workspace/db";
import { lockCirclePair } from "./circleSharing";

export class CircleMomentError extends Error {
  constructor(
    public code: string,
    public status: number,
  ) {
    super(code);
  }
}

export type CircleMomentInput = {
  memberUserId: string;
  momentId: string;
  title: string;
  startsAt: Date;
};

function toWire(row: typeof shares.$inferSelect) {
  return {
    id: row.id,
    sourceUserId: row.sourceUserId,
    recipientUserId: row.recipientUserId,
    momentId: row.momentId,
    title: row.title,
    startsAt: row.startsAt.toISOString(),
    sharedAt: row.createdAt.toISOString(),
  };
}

async function tableExists(tx: Pick<typeof db, "execute">) {
  const result = await tx.execute(
    sql`select to_regclass('public.aforce_circle_moment_shares') is not null as present`,
  );
  return result.rows[0]?.present === true;
}

async function requireActivePair(
  tx: Pick<typeof db, "select">,
  userId: string,
  memberUserId: string,
) {
  if (userId === memberUserId)
    throw new CircleMomentError("member_not_available", 404);
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
    connections.length !== 2 ||
    connections.some((connection) => connection.status !== "active")
  )
    throw new CircleMomentError("member_not_available", 404);
}

export async function shareMoment(userId: string, input: CircleMomentInput) {
  return db.transaction(async (tx) => {
    await lockCirclePair(tx, userId, input.memberUserId);
    if (!(await tableExists(tx)))
      throw new CircleMomentError("circle_moment_sharing_unavailable", 503);
    await requireActivePair(tx, userId, input.memberUserId);
    const now = new Date();
    const [row] = await tx
      .insert(shares)
      .values({
        id: randomUUID(),
        sourceUserId: userId,
        recipientUserId: input.memberUserId,
        momentId: input.momentId,
        title: input.title,
        startsAt: input.startsAt,
        createdAt: now,
        revokedAt: null,
      })
      .onConflictDoUpdate({
        target: [shares.sourceUserId, shares.recipientUserId, shares.momentId],
        set: {
          title: input.title,
          startsAt: input.startsAt,
          createdAt: now,
          revokedAt: null,
        },
      })
      .returning();
    return toWire(row);
  });
}

export async function listIncomingMomentShares(userId: string) {
  if (!(await tableExists(db)))
    throw new CircleMomentError("circle_moment_sharing_unavailable", 503);
  const rows = await db
    .select()
    .from(shares)
    .where(and(eq(shares.recipientUserId, userId), isNull(shares.revokedAt)))
    .orderBy(desc(shares.startsAt));
  return rows.map(toWire);
}

export async function revokeMomentShare(userId: string, shareId: string) {
  if (!(await tableExists(db))) return;
  const [row] = await db
    .update(shares)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(shares.id, shareId),
        eq(shares.sourceUserId, userId),
        isNull(shares.revokedAt),
      ),
    )
    .returning();
  if (!row) throw new CircleMomentError("moment_share_not_found", 404);
}

/** Called inside connection removal so a removed member cannot retain a share. */
export async function revokePairMomentShares(
  tx: Pick<typeof db, "execute" | "update">,
  first: string,
  second: string,
) {
  if (!(await tableExists(tx))) return;
  await tx
    .update(shares)
    .set({ revokedAt: new Date() })
    .where(
      or(
        and(eq(shares.sourceUserId, first), eq(shares.recipientUserId, second)),
        and(eq(shares.sourceUserId, second), eq(shares.recipientUserId, first)),
      ),
    );
}

/** Account deletion must withdraw both sent and received Moment records. */
export async function clearMomentSharesForUser(
  tx: Pick<typeof db, "execute" | "update">,
  userId: string,
) {
  if (!(await tableExists(tx))) return;
  await tx
    .update(shares)
    .set({ revokedAt: new Date() })
    .where(
      or(eq(shares.sourceUserId, userId), eq(shares.recipientUserId, userId)),
    );
}
