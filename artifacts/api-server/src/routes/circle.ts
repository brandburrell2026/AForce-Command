/**
 * AForce Circles — circle membership, shared statuses, challenges,
 * notifications. Mounted under `/api/circle`.
 *
 *   GET    /                              → active circle members (?group=)
 *   GET    /pending                       → pending requests
 *   GET    /feed                          → members joined to their statuses
 *   POST   /users/:memberUserId/status    → set relationship status
 *   POST   /users/:memberUserId/group     → move to a group
 *   DELETE /users/:memberUserId           → remove from circle
 *   GET    /challenges                    → open challenges
 *   POST   /challenges/:id/accept         → accept a challenge
 *   GET    /notifications                 → all notifications, newest first
 *   POST   /notifications/:id/read        → mark notification read
 *
 * All rows are scoped to `owner_user_id = req.userId`.
 *
 * Every GET here used to seed the caller's rows with a demo circle
 * (friends, statuses, challenges, notifications) so the UI had content
 * out of the box. Fabricated people and fabricated social signal written
 * into real user data become indistinguishable from real ones forever —
 * exactly what the Constitution forbids ("observation never diagnosis",
 * "trust over attention") — so the writes are gone and the SEED_*
 * constants are now READ-SIDE EXCLUSION LISTS only. Rows already written
 * by the old behavior stay in the database but are never served again:
 * nothing is deleted and no migration is required. A user with no real
 * circle now gets empty lists, and the client renders an honest empty
 * state instead of a fabricated one.
 */

import { Router, type IRouter, type Request } from "express";
import { z } from "zod";
import {
  db,
  aforceCircleUsers,
  aforceCircleStatuses,
  aforceCircleChallenges,
  aforceCircleNotifications,
} from "@workspace/db";
import { and, eq, asc, desc, notInArray } from "drizzle-orm";
import { DEFAULT_USER_ID } from "../lib/aforceState";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.use(requireAuth);

function resolveUserId(req: Request): string {
  return req.userId ?? DEFAULT_USER_ID;
}

/* ─── Enums (mirror types/circle.ts on the client) ───────────────────────── */
const CIRCLE_GROUPS = ["friends", "team", "coach", "family"] as const;
const RELATIONSHIP_STATUSES = ["pending", "active", "muted"] as const;
const CHALLENGE_KINDS = [
  "match_my_score",
  "complete_your_cycle",
  "weekly_consistency",
  "circle_ranking",
] as const;
const SHARED_STATES = ["Peak", "Balanced", "Recovering", "Depleted"] as const;
const TREND_DIRS = ["up", "flat", "down"] as const;

const groupEnum = z.enum(CIRCLE_GROUPS);
const relStatusEnum = z.enum(RELATIONSHIP_STATUSES);

/* ─── Legacy seeds — read-side exclusion lists, never written ────────────── */
interface SeedUser {
  memberUserId: string;
  name: string;
  initials: string;
  city: string;
  group: (typeof CIRCLE_GROUPS)[number];
  status: (typeof RELATIONSHIP_STATUSES)[number];
  joinedAt: string;
}

const SEED_USERS: ReadonlyArray<SeedUser> = [
  { memberUserId: "u_kai",     name: "Kai Reeves",   initials: "KR", city: "Miami",     group: "friends", status: "active",  joinedAt: "2026-03-12T10:00:00Z" },
  { memberUserId: "u_sasha",   name: "Sasha Lin",    initials: "SL", city: "Brooklyn",  group: "friends", status: "active",  joinedAt: "2026-03-14T10:00:00Z" },
  { memberUserId: "u_marcus",  name: "Marcus Webb",  initials: "MW", city: "Austin",    group: "team",    status: "active",  joinedAt: "2026-02-04T10:00:00Z" },
  { memberUserId: "u_devon",   name: "Devon Reyes",  initials: "DR", city: "San Diego", group: "team",    status: "active",  joinedAt: "2026-02-04T10:00:00Z" },
  { memberUserId: "u_riley",   name: "Riley Park",   initials: "RP", city: "Seattle",   group: "team",    status: "active",  joinedAt: "2026-02-09T10:00:00Z" },
  { memberUserId: "u_coach_j", name: "Coach Jordan", initials: "CJ", city: "Tampa",     group: "coach",   status: "active",  joinedAt: "2026-01-22T10:00:00Z" },
  { memberUserId: "u_mom",     name: "Mom",          initials: "M",  city: "Phoenix",   group: "family",  status: "active",  joinedAt: "2026-01-04T10:00:00Z" },
  { memberUserId: "u_ari",     name: "Ari Cohen",    initials: "AC", city: "Denver",    group: "friends", status: "pending", joinedAt: "2026-04-15T10:00:00Z" },
];

interface SeedStatus {
  memberUserId: string;
  score: number;
  state: (typeof SHARED_STATES)[number];
  streakDays: number;
  protocolComplete: boolean;
  trend: (typeof TREND_DIRS)[number];
  updatedAt: string;
}

const SEED_STATUSES: ReadonlyArray<SeedStatus> = [
  { memberUserId: "u_kai",     score: 92, state: "Peak",       streakDays: 18, protocolComplete: true,  trend: "up",   updatedAt: "2026-04-21T14:02:00Z" },
  { memberUserId: "u_sasha",   score: 84, state: "Balanced",   streakDays: 11, protocolComplete: true,  trend: "flat", updatedAt: "2026-04-21T14:01:00Z" },
  { memberUserId: "u_marcus",  score: 78, state: "Balanced",   streakDays:  7, protocolComplete: false, trend: "up",   updatedAt: "2026-04-21T13:55:00Z" },
  { memberUserId: "u_devon",   score: 61, state: "Recovering", streakDays:  3, protocolComplete: false, trend: "down", updatedAt: "2026-04-21T13:48:00Z" },
  { memberUserId: "u_riley",   score: 88, state: "Peak",       streakDays: 22, protocolComplete: true,  trend: "up",   updatedAt: "2026-04-21T13:59:00Z" },
  { memberUserId: "u_coach_j", score: 81, state: "Balanced",   streakDays: 31, protocolComplete: true,  trend: "flat", updatedAt: "2026-04-21T13:30:00Z" },
  { memberUserId: "u_mom",     score: 72, state: "Balanced",   streakDays: 14, protocolComplete: true,  trend: "up",   updatedAt: "2026-04-21T12:50:00Z" },
];

interface SeedChallenge {
  id: string;
  fromUserId: string;
  kind: (typeof CHALLENGE_KINDS)[number];
  targetScore?: number;
  expiresAt: string;
  createdAt: string;
}

const SEED_CHALLENGES: ReadonlyArray<SeedChallenge> = [
  { id: "ch_1", fromUserId: "u_kai",     kind: "match_my_score",     targetScore: 92, expiresAt: "2026-04-22T00:00:00Z", createdAt: "2026-04-21T13:00:00Z" },
  { id: "ch_2", fromUserId: "u_coach_j", kind: "weekly_consistency",                 expiresAt: "2026-04-27T00:00:00Z", createdAt: "2026-04-21T08:00:00Z" },
];

interface SeedNotification {
  id: string;
  kind: string;
  fromUserId: string;
  message: string;
  createdAt: string;
  read: boolean;
}

const SEED_NOTIFICATIONS: ReadonlyArray<SeedNotification> = [
  { id: "n1", kind: "protocol_complete",    fromUserId: "u_kai",     message: "Kai finished today's protocol.",            createdAt: "2026-04-21T13:45:00Z", read: false },
  { id: "n2", kind: "streak_milestone",     fromUserId: "u_riley",   message: "Riley hit a 21 day streak.",                createdAt: "2026-04-21T11:10:00Z", read: false },
  { id: "n3", kind: "reaction_received",    fromUserId: "u_coach_j", message: "Coach Jordan reacted: Hold the line.",      createdAt: "2026-04-21T10:32:00Z", read: true  },
  { id: "n4", kind: "friend_trending_down", fromUserId: "u_devon",   message: "Devon is trending down. A check-in helps.", createdAt: "2026-04-21T09:14:00Z", read: false },
];

// Members and statuses were seeded under literal mock ids (`u_kai`), the same
// for every owner — a real member id is the invitee's Clerk id (`user_2…`) and
// can never collide with these. Both lists are unioned so a seeded status is
// excluded even where its member row isn't, and vice versa. Mutable `string[]`
// rather than ReadonlyArray because notInArray only accepts a mutable array.
const SEEDED_MEMBER_IDS: string[] = Array.from(
  new Set([
    ...SEED_USERS.map((u) => u.memberUserId),
    ...SEED_STATUSES.map((s) => s.memberUserId),
  ]),
);

// Challenges and notifications were stored user-prefixed
// (`<userId>:ch_1`), so their exclusion lists are rebuilt per caller.
function seededChallengeIds(userId: string): string[] {
  return SEED_CHALLENGES.map((c) => `${userId}:${c.id}`);
}

function seededNotificationIds(userId: string): string[] {
  return SEED_NOTIFICATIONS.map((n) => `${userId}:${n.id}`);
}

/* ─── Row → wire shape (strip owner + db-id, normalize dates) ─────────────── */
function userRowToWire(row: typeof aforceCircleUsers.$inferSelect) {
  return {
    userId: row.memberUserId,
    name: row.name,
    initials: row.initials,
    city: row.city ?? undefined,
    group: row.group,
    status: row.status,
    joinedAt: row.joinedAt.toISOString(),
  };
}

function statusRowToWire(row: typeof aforceCircleStatuses.$inferSelect) {
  return {
    userId: row.memberUserId,
    score: row.score,
    state: row.state,
    streakDays: row.streakDays,
    protocolComplete: row.protocolComplete,
    trend: row.trend,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function challengeRowToWire(row: typeof aforceCircleChallenges.$inferSelect) {
  // Strip the `userId:` prefix so the client sees the original id.
  const colon = row.id.indexOf(":");
  const clientId = colon === -1 ? row.id : row.id.slice(colon + 1);
  return {
    id: clientId,
    fromUserId: row.fromUserId,
    toUserId: row.toUserId ?? undefined,
    kind: row.kind,
    targetScore: row.targetScore ?? undefined,
    expiresAt: row.expiresAt.toISOString(),
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  };
}

function notificationRowToWire(row: typeof aforceCircleNotifications.$inferSelect) {
  const colon = row.id.indexOf(":");
  const clientId = colon === -1 ? row.id : row.id.slice(colon + 1);
  return {
    id: clientId,
    kind: row.kind,
    fromUserId: row.fromUserId,
    message: row.message,
    createdAt: row.createdAt.toISOString(),
    read: row.read,
  };
}

/* ─── GET / — active members (optional ?group=) ───────────────────────────── */
router.get("/", async (req, res) => {
  try {
    const userId = resolveUserId(req);
    const groupParam = String(req.query["group"] ?? "");
    const group = (CIRCLE_GROUPS as readonly string[]).includes(groupParam)
      ? (groupParam as (typeof CIRCLE_GROUPS)[number])
      : null;

    const where = group
      ? and(
          eq(aforceCircleUsers.ownerUserId, userId),
          eq(aforceCircleUsers.status, "active"),
          eq(aforceCircleUsers.group, group),
          notInArray(aforceCircleUsers.memberUserId, SEEDED_MEMBER_IDS),
        )
      : and(
          eq(aforceCircleUsers.ownerUserId, userId),
          eq(aforceCircleUsers.status, "active"),
          notInArray(aforceCircleUsers.memberUserId, SEEDED_MEMBER_IDS),
        );

    const rows = await db
      .select()
      .from(aforceCircleUsers)
      .where(where)
      .orderBy(asc(aforceCircleUsers.name));
    res.json({ users: rows.map(userRowToWire) });
  } catch (err) {
    req.log.error({ err }, "GET /circle failed");
    res.status(500).json({ error: "circle_fetch_failed" });
  }
});

/* ─── GET /pending ────────────────────────────────────────────────────────── */
router.get("/pending", async (req, res) => {
  try {
    const userId = resolveUserId(req);
    const rows = await db
      .select()
      .from(aforceCircleUsers)
      .where(
        and(
          eq(aforceCircleUsers.ownerUserId, userId),
          eq(aforceCircleUsers.status, "pending"),
          notInArray(aforceCircleUsers.memberUserId, SEEDED_MEMBER_IDS),
        ),
      )
      .orderBy(asc(aforceCircleUsers.name));
    res.json({ users: rows.map(userRowToWire) });
  } catch (err) {
    req.log.error({ err }, "GET /circle/pending failed");
    res.status(500).json({ error: "circle_pending_fetch_failed" });
  }
});

/* ─── GET /feed — active members + their latest shared status ─────────────── */
router.get("/feed", async (req, res) => {
  try {
    const userId = resolveUserId(req);
    const groupParam = String(req.query["group"] ?? "");
    const group = (CIRCLE_GROUPS as readonly string[]).includes(groupParam)
      ? (groupParam as (typeof CIRCLE_GROUPS)[number])
      : null;

    const userWhere = group
      ? and(
          eq(aforceCircleUsers.ownerUserId, userId),
          eq(aforceCircleUsers.status, "active"),
          eq(aforceCircleUsers.group, group),
          notInArray(aforceCircleUsers.memberUserId, SEEDED_MEMBER_IDS),
        )
      : and(
          eq(aforceCircleUsers.ownerUserId, userId),
          eq(aforceCircleUsers.status, "active"),
          notInArray(aforceCircleUsers.memberUserId, SEEDED_MEMBER_IDS),
        );

    const userRows = await db.select().from(aforceCircleUsers).where(userWhere);
    // The status query is filtered too, not just joined against the filtered
    // users: a seeded status must never reach the feed even if a same-named
    // member row somehow survives.
    const statusRows = await db
      .select()
      .from(aforceCircleStatuses)
      .where(
        and(
          eq(aforceCircleStatuses.ownerUserId, userId),
          notInArray(aforceCircleStatuses.memberUserId, SEEDED_MEMBER_IDS),
        ),
      );

    const statusByMember = new Map(
      statusRows.map((r) => [r.memberUserId, statusRowToWire(r)]),
    );

    const feed = userRows
      .map((u) => {
        const s = statusByMember.get(u.memberUserId);
        if (!s) return null;
        return { ...s, user: userRowToWire(u) };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => b.score - a.score);

    res.json({ feed });
  } catch (err) {
    req.log.error({ err }, "GET /circle/feed failed");
    res.status(500).json({ error: "circle_feed_fetch_failed" });
  }
});

/* ─── POST /users/:memberUserId/status ────────────────────────────────────── */
const setStatusSchema = z.object({ status: relStatusEnum });

router.post("/users/:memberUserId/status", async (req, res) => {
  try {
    const userId = resolveUserId(req);
    const memberUserId = String(req.params["memberUserId"] ?? "");
    if (!memberUserId) {
      res.status(400).json({ error: "missing_member" });
      return;
    }
    const parsed = setStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_body", issues: parsed.error.issues });
      return;
    }
    const [row] = await db
      .update(aforceCircleUsers)
      .set({ status: parsed.data.status })
      .where(
        and(
          eq(aforceCircleUsers.ownerUserId, userId),
          eq(aforceCircleUsers.memberUserId, memberUserId),
        ),
      )
      .returning();
    if (!row) {
      res.status(404).json({ error: "member_not_found" });
      return;
    }
    res.json({ user: userRowToWire(row) });
  } catch (err) {
    req.log.error({ err }, "POST /circle/users/:id/status failed");
    res.status(500).json({ error: "circle_status_update_failed" });
  }
});

/* ─── POST /users/:memberUserId/group ─────────────────────────────────────── */
const setGroupSchema = z.object({ group: groupEnum });

router.post("/users/:memberUserId/group", async (req, res) => {
  try {
    const userId = resolveUserId(req);
    const memberUserId = String(req.params["memberUserId"] ?? "");
    if (!memberUserId) {
      res.status(400).json({ error: "missing_member" });
      return;
    }
    const parsed = setGroupSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_body", issues: parsed.error.issues });
      return;
    }
    const [row] = await db
      .update(aforceCircleUsers)
      .set({ group: parsed.data.group })
      .where(
        and(
          eq(aforceCircleUsers.ownerUserId, userId),
          eq(aforceCircleUsers.memberUserId, memberUserId),
        ),
      )
      .returning();
    if (!row) {
      res.status(404).json({ error: "member_not_found" });
      return;
    }
    res.json({ user: userRowToWire(row) });
  } catch (err) {
    req.log.error({ err }, "POST /circle/users/:id/group failed");
    res.status(500).json({ error: "circle_group_update_failed" });
  }
});

/* ─── DELETE /users/:memberUserId ─────────────────────────────────────────── */
router.delete("/users/:memberUserId", async (req, res) => {
  try {
    const userId = resolveUserId(req);
    const memberUserId = String(req.params["memberUserId"] ?? "");
    if (!memberUserId) {
      res.status(400).json({ error: "missing_member" });
      return;
    }
    // Drop the membership row + any shared status snapshot for this owner+member.
    await db
      .delete(aforceCircleUsers)
      .where(
        and(
          eq(aforceCircleUsers.ownerUserId, userId),
          eq(aforceCircleUsers.memberUserId, memberUserId),
        ),
      );
    await db
      .delete(aforceCircleStatuses)
      .where(
        and(
          eq(aforceCircleStatuses.ownerUserId, userId),
          eq(aforceCircleStatuses.memberUserId, memberUserId),
        ),
      );
    res.json({ removed: memberUserId });
  } catch (err) {
    req.log.error({ err }, "DELETE /circle/users/:id failed");
    res.status(500).json({ error: "circle_remove_failed" });
  }
});

/* ─── GET /challenges ─────────────────────────────────────────────────────── */
router.get("/challenges", async (req, res) => {
  try {
    const userId = resolveUserId(req);
    const rows = await db
      .select()
      .from(aforceCircleChallenges)
      .where(
        and(
          eq(aforceCircleChallenges.ownerUserId, userId),
          eq(aforceCircleChallenges.status, "open"),
          notInArray(aforceCircleChallenges.id, seededChallengeIds(userId)),
        ),
      )
      .orderBy(asc(aforceCircleChallenges.expiresAt));
    res.json({ challenges: rows.map(challengeRowToWire) });
  } catch (err) {
    req.log.error({ err }, "GET /circle/challenges failed");
    res.status(500).json({ error: "challenges_fetch_failed" });
  }
});

/* ─── POST /challenges/:id/accept ─────────────────────────────────────────── */
router.post("/challenges/:id/accept", async (req, res) => {
  try {
    const userId = resolveUserId(req);
    const clientId = String(req.params["id"] ?? "");
    if (!clientId) {
      res.status(400).json({ error: "missing_id" });
      return;
    }
    // Stored ids are user-prefixed; match with the prefix added back.
    const storedId = `${userId}:${clientId}`;
    const [row] = await db
      .update(aforceCircleChallenges)
      .set({ status: "accepted" })
      .where(
        and(
          eq(aforceCircleChallenges.ownerUserId, userId),
          eq(aforceCircleChallenges.id, storedId),
        ),
      )
      .returning();
    if (!row) {
      res.status(404).json({ error: "challenge_not_found" });
      return;
    }
    res.json({ challenge: challengeRowToWire(row) });
  } catch (err) {
    req.log.error({ err }, "POST /circle/challenges/:id/accept failed");
    res.status(500).json({ error: "challenge_accept_failed" });
  }
});

/* ─── GET /notifications ──────────────────────────────────────────────────── */
router.get("/notifications", async (req, res) => {
  try {
    const userId = resolveUserId(req);
    const rows = await db
      .select()
      .from(aforceCircleNotifications)
      .where(
        and(
          eq(aforceCircleNotifications.ownerUserId, userId),
          notInArray(
            aforceCircleNotifications.id,
            seededNotificationIds(userId),
          ),
        ),
      )
      .orderBy(desc(aforceCircleNotifications.createdAt));
    res.json({ notifications: rows.map(notificationRowToWire) });
  } catch (err) {
    req.log.error({ err }, "GET /circle/notifications failed");
    res.status(500).json({ error: "notifications_fetch_failed" });
  }
});

/* ─── POST /notifications/:id/read ────────────────────────────────────────── */
router.post("/notifications/:id/read", async (req, res) => {
  try {
    const userId = resolveUserId(req);
    const clientId = String(req.params["id"] ?? "");
    if (!clientId) {
      res.status(400).json({ error: "missing_id" });
      return;
    }
    const storedId = `${userId}:${clientId}`;
    const [row] = await db
      .update(aforceCircleNotifications)
      .set({ read: true })
      .where(
        and(
          eq(aforceCircleNotifications.ownerUserId, userId),
          eq(aforceCircleNotifications.id, storedId),
        ),
      )
      .returning();
    if (!row) {
      res.status(404).json({ error: "notification_not_found" });
      return;
    }
    res.json({ notification: notificationRowToWire(row) });
  } catch (err) {
    req.log.error({ err }, "POST /circle/notifications/:id/read failed");
    res.status(500).json({ error: "notification_mark_read_failed" });
  }
});

export default router;
