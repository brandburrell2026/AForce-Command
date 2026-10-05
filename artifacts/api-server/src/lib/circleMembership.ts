import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, eq, isNull, gt, ne, or, desc, sql } from "drizzle-orm";
import {
  db,
  aforceCircleInvitations as invites,
  aforceCircleUsers as members,
  aforceCircleStatuses as statuses,
} from "@workspace/db";

export const membershipEnabled = () =>
  process.env["CIRCLE_MEMBERSHIP_ENABLED"] === "true";
export const hashInvitation = (code: string) =>
  createHash("sha256").update(code).digest("hex");
export class CircleMembershipError extends Error {
  constructor(
    public code: string,
    public status: number,
  ) {
    super(code);
  }
}
type Identity = { displayName: string; group: string };
export function invitationToWire(
  row: typeof invites.$inferSelect,
  now = new Date(),
) {
  return {
    id: row.id,
    group: row.group,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    status: row.revokedAt
      ? "revoked"
      : row.acceptedAt
        ? "accepted"
        : row.expiresAt <= now
          ? "expired"
          : "pending",
  };
}
const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((part) => Array.from(part)[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
export async function createInvitation(
  ownerUserId: string,
  identity: Identity,
) {
  return db.transaction(async (tx) => {
    // Serialize per-owner creation so concurrent requests cannot bypass the cap.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${"circle-invites:" + ownerUserId}, 0))`,
    );
    const now = new Date();
    const outstanding = await tx
      .select({ id: invites.id })
      .from(invites)
      .where(liveInvitations(ownerUserId, now))
      .limit(10);
    if (outstanding.length >= 10)
      throw new CircleMembershipError("invitation_limit_reached", 409);
    const code = randomBytes(32).toString("base64url");
    const [row] = await tx
      .insert(invites)
      .values({
        id: randomUUID(),
        ownerUserId,
        ...identity,
        codeHash: hashInvitation(code),
        createdAt: now,
        expiresAt: new Date(now.getTime() + 7 * 86400000),
      })
      .returning();
    return { invitation: invitationToWire(row), code };
  });
}
function liveInvitations(ownerUserId: string, now: Date) {
  return and(
    eq(invites.ownerUserId, ownerUserId),
    gt(invites.expiresAt, now),
    isNull(invites.acceptedAt),
    isNull(invites.revokedAt),
  );
}
/** Outstanding invitations only. The per-owner cap keeps this list bounded. */
export async function listInvitations(ownerUserId: string) {
  const rows = await db
    .select()
    .from(invites)
    .where(liveInvitations(ownerUserId, new Date()))
    .orderBy(desc(invites.createdAt));
  return rows.map((row) => invitationToWire(row));
}
export async function revokeInvitation(ownerUserId: string, id: string) {
  const [row] = await db
    .update(invites)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(invites.id, id),
        eq(invites.ownerUserId, ownerUserId),
        isNull(invites.acceptedAt),
        isNull(invites.revokedAt),
      ),
    )
    .returning();
  if (!row) throw new CircleMembershipError("invitation_unavailable", 404);
}
export async function acceptInvitation(
  userId: string,
  code: string,
  identity: Identity,
) {
  return db.transaction(async (tx) => {
    const now = new Date();
    // Conditional UPDATE locks and consumes the invitation in this same transaction.
    // Concurrent requests cannot both win; rollback restores the token if any write fails.
    const [invite] = await tx
      .update(invites)
      .set({ acceptedAt: now, acceptedByUserId: userId })
      .where(
        and(
          eq(invites.codeHash, hashInvitation(code)),
          isNull(invites.acceptedAt),
          isNull(invites.revokedAt),
          gt(invites.expiresAt, now),
          ne(invites.ownerUserId, userId),
        ),
      )
      .returning();
    if (!invite) {
      const [own] = await tx
        .select()
        .from(invites)
        .where(
          and(
            eq(invites.codeHash, hashInvitation(code)),
            eq(invites.ownerUserId, userId),
          ),
        )
        .limit(1);
      throw new CircleMembershipError(
        own ? "cannot_accept_own_invitation" : "invitation_unavailable",
        own ? 400 : 404,
      );
    }
    // A new consent to connect never revives historical health sharing.
    await tx
      .delete(statuses)
      .where(
        or(
          and(
            eq(statuses.ownerUserId, userId),
            eq(statuses.memberUserId, invite.ownerUserId),
          ),
          and(
            eq(statuses.ownerUserId, invite.ownerUserId),
            eq(statuses.memberUserId, userId),
          ),
        ),
      );
    // Consistent insertion order reduces deadlocks for simultaneous reciprocal invites.
    const values = [
      {
        ownerUserId: invite.ownerUserId,
        memberUserId: userId,
        name: identity.displayName,
        initials: initials(identity.displayName),
        group: invite.group,
      },
      {
        ownerUserId: userId,
        memberUserId: invite.ownerUserId,
        name: invite.displayName,
        initials: initials(invite.displayName),
        group: identity.group,
      },
    ].sort((a, b) => a.ownerUserId.localeCompare(b.ownerUserId));
    await tx
      .insert(members)
      .values(values)
      .onConflictDoUpdate({
        target: [members.ownerUserId, members.memberUserId],
        set: {
          status: sql`case when ${members.status} = 'pending' then 'active' else ${members.status} end`,
        },
      });
    const [member] = await tx
      .select()
      .from(members)
      .where(
        and(
          eq(members.ownerUserId, userId),
          eq(members.memberUserId, invite.ownerUserId),
        ),
      );
    return member;
  });
}
export async function removeMembership(userId: string, memberUserId: string) {
  await db.transaction(async (tx) => {
    const pair = (table: typeof members | typeof statuses) =>
      or(
        and(
          eq(table.ownerUserId, userId),
          eq(table.memberUserId, memberUserId),
        ),
        and(
          eq(table.ownerUserId, memberUserId),
          eq(table.memberUserId, userId),
        ),
      );
    await tx.delete(members).where(pair(members));
    await tx.delete(statuses).where(pair(statuses));
  });
}
