/**
 * Circle service — circle membership + shared status retrieval.
 *
 * Backed by the api-server `/api/circle/*` endpoints; preserves the
 * synchronous read surface (and the `useSyncExternalStore` subscribe
 * pattern) by keeping an in-memory cache that mirrors the server.
 *
 * On first call: returns the MOCK_* seeds so the UI has data right
 * away, then triggers a background fetch that replaces the cache and
 * bumps the version.
 *
 * Mutations: optimistic local update + version bump, fire-and-forget
 * server call. On failure we re-fetch the affected slice to recover.
 */

import {
  MOCK_CIRCLE_USERS, MOCK_SHARED_STATUSES, MOCK_CHALLENGES, MOCK_NOTIFICATIONS,
} from '@/data/mockCircleData';
import type {
  CircleUser, SharedStatus, CircleFeedItem, CircleGroup, CircleChallenge,
  CircleNotification, RelationshipStatus,
} from '@/types/circle';
import {
  getJsonAforceApi, postJsonAforceApi, deleteJsonAforceApi,
} from '@/services/aforceApiClient';

let users: CircleUser[] = [...MOCK_CIRCLE_USERS];
let statuses: Record<string, SharedStatus> = { ...MOCK_SHARED_STATUSES };
let challenges: CircleChallenge[] = [...MOCK_CHALLENGES];
let notifications: CircleNotification[] = [...MOCK_NOTIFICATIONS];

let usersHydrated = false;
let statusesHydrated = false;
let challengesHydrated = false;
let notificationsHydrated = false;

let usersInflight: Promise<void> | null = null;
let challengesInflight: Promise<void> | null = null;
let notificationsInflight: Promise<void> | null = null;

let version = 0;
const listeners = new Set<() => void>();

/** Subscribe to any circle state mutation. Returns an unsubscribe fn. */
export function subscribeCircle(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** Monotonic version stamp — used by `useSyncExternalStore` snapshots. */
export function getCircleVersion(): number {
  return version;
}

function emit() {
  version += 1;
  for (const fn of listeners) {
    try { fn(); } catch { /* swallow — never let one bad listener break others */ }
  }
}

/* ─── Wire shapes ─────────────────────────────────────────────────────────── */
interface ServerUser {
  userId: string;
  name: string;
  initials: string;
  city?: string;
  group: CircleGroup;
  status: RelationshipStatus;
  joinedAt: string;
}

interface ServerStatus {
  userId: string;
  score: number;
  state: SharedStatus['state'];
  streakDays: number;
  protocolComplete: boolean;
  trend: SharedStatus['trend'];
  updatedAt: string;
}

interface ServerFeedItem extends ServerStatus { user: ServerUser }

interface ServerChallenge extends Omit<CircleChallenge, 'status'> {
  status: CircleChallenge['status'];
}

interface ServerNotification extends Omit<CircleNotification, 'kind'> {
  kind: CircleNotification['kind'];
}

function applyUserList(list: ServerUser[]): void {
  // Replace only the active members (server-filtered list); keep any
  // pending entries we already have until /pending refreshes them.
  const incomingIds = new Set(list.map((u) => u.userId));
  const keptPending = users.filter((u) => u.status === 'pending' && !incomingIds.has(u.userId));
  users = [
    ...list.map((u) => ({
      userId: u.userId,
      name: u.name,
      initials: u.initials,
      ...(u.city ? { city: u.city } : {}),
      group: u.group,
      status: u.status,
      joinedAt: u.joinedAt,
    })),
    ...keptPending,
  ];
}

function applyChallengeList(list: ServerChallenge[]): void {
  challenges = list.map((c) => ({
    id: c.id,
    fromUserId: c.fromUserId,
    ...(c.toUserId ? { toUserId: c.toUserId } : {}),
    kind: c.kind,
    ...(c.targetScore != null ? { targetScore: c.targetScore } : {}),
    expiresAt: c.expiresAt,
    status: c.status,
    createdAt: c.createdAt,
  }));
}

function applyNotificationList(list: ServerNotification[]): void {
  notifications = list.map((n) => ({
    id: n.id,
    kind: n.kind,
    fromUserId: n.fromUserId,
    message: n.message,
    createdAt: n.createdAt,
    read: n.read,
  }));
}

function ensureUsersHydrated(): void {
  if (usersHydrated || usersInflight) return;
  usersInflight = (async () => {
    try {
      // Active members + feed (statuses) + pending in parallel.
      const [active, feed, pending] = await Promise.all([
        getJsonAforceApi<{ users: ServerUser[] }>('/circle'),
        getJsonAforceApi<{ feed: ServerFeedItem[] }>('/circle/feed'),
        getJsonAforceApi<{ users: ServerUser[] }>('/circle/pending'),
      ]);
      const merged = [...active.users, ...pending.users];
      applyUserList(merged);
      const next: Record<string, SharedStatus> = {};
      for (const f of feed.feed) {
        next[f.userId] = {
          userId: f.userId,
          score: f.score,
          state: f.state,
          streakDays: f.streakDays,
          protocolComplete: f.protocolComplete,
          trend: f.trend,
          updatedAt: f.updatedAt,
        };
      }
      statuses = next;
      usersHydrated = true;
      statusesHydrated = true;
      emit();
    } catch {
      // Stay on the seed lists — caller will see MOCK_CIRCLE_USERS.
    } finally {
      usersInflight = null;
    }
  })();
}

function ensureChallengesHydrated(): void {
  if (challengesHydrated || challengesInflight) return;
  challengesInflight = (async () => {
    try {
      const res = await getJsonAforceApi<{ challenges: ServerChallenge[] }>('/circle/challenges');
      applyChallengeList(res.challenges);
      challengesHydrated = true;
      emit();
    } catch {
      /* keep mock seeds */
    } finally {
      challengesInflight = null;
    }
  })();
}

function ensureNotificationsHydrated(): void {
  if (notificationsHydrated || notificationsInflight) return;
  notificationsInflight = (async () => {
    try {
      const res = await getJsonAforceApi<{ notifications: ServerNotification[] }>(
        '/circle/notifications',
      );
      applyNotificationList(res.notifications);
      notificationsHydrated = true;
      emit();
    } catch {
      /* keep mock seeds */
    } finally {
      notificationsInflight = null;
    }
  })();
}

/* ─── Reads (synchronous over the cache) ─────────────────────────────────── */
export function listCircle(group?: CircleGroup): CircleUser[] {
  ensureUsersHydrated();
  return users
    .filter(u => u.status === 'active')
    .filter(u => (group ? u.group === group : true))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function listPending(): CircleUser[] {
  ensureUsersHydrated();
  return users.filter(u => u.status === 'pending');
}

export function getUser(userId: string): CircleUser | undefined {
  ensureUsersHydrated();
  return users.find(u => u.userId === userId);
}

export function getSharedStatus(userId: string): SharedStatus | undefined {
  ensureUsersHydrated();
  return statuses[userId];
}

/** The full feed = active circle members + their latest shared status. */
export function getCircleFeed(group?: CircleGroup): CircleFeedItem[] {
  return listCircle(group)
    .map((u): CircleFeedItem | null => {
      const s = getSharedStatus(u.userId);
      return s ? { ...s, user: u } : null;
    })
    .filter((x): x is CircleFeedItem => x !== null)
    .sort((a, b) => b.score - a.score);
}

/* ─── Mutations (optimistic + background reconcile) ──────────────────────── */
export function setRelationshipStatus(userId: string, status: RelationshipStatus): void {
  users = users.map(u => (u.userId === userId ? { ...u, status } : u));
  emit();
  void (async () => {
    try {
      await postJsonAforceApi<{ user: ServerUser }>(
        `/circle/users/${encodeURIComponent(userId)}/status`,
        { status },
      );
    } catch {
      // Re-pull users to recover.
      usersHydrated = false;
      ensureUsersHydrated();
    }
  })();
}

export function removeFromCircle(userId: string): void {
  users = users.filter(u => u.userId !== userId);
  delete statuses[userId];
  emit();
  void (async () => {
    try {
      await deleteJsonAforceApi<{ removed: string }>(
        `/circle/users/${encodeURIComponent(userId)}`,
      );
    } catch {
      usersHydrated = false;
      statusesHydrated = false;
      ensureUsersHydrated();
    }
  })();
}

export function moveToGroup(userId: string, group: CircleGroup): void {
  users = users.map(u => (u.userId === userId ? { ...u, group } : u));
  emit();
  void (async () => {
    try {
      await postJsonAforceApi<{ user: ServerUser }>(
        `/circle/users/${encodeURIComponent(userId)}/group`,
        { group },
      );
    } catch {
      usersHydrated = false;
      ensureUsersHydrated();
    }
  })();
}

export function listChallenges(): CircleChallenge[] {
  ensureChallengesHydrated();
  return challenges
    .filter(c => c.status === 'open')
    .sort((a, b) => a.expiresAt.localeCompare(b.expiresAt));
}

export function acceptChallenge(id: string): void {
  challenges = challenges.map(c => (c.id === id ? { ...c, status: 'accepted' } : c));
  emit();
  void (async () => {
    try {
      await postJsonAforceApi<{ challenge: ServerChallenge }>(
        `/circle/challenges/${encodeURIComponent(id)}/accept`,
        {},
      );
    } catch {
      challengesHydrated = false;
      ensureChallengesHydrated();
    }
  })();
}

export function listNotifications(): CircleNotification[] {
  ensureNotificationsHydrated();
  return [...notifications].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function markNotificationRead(id: string): void {
  notifications = notifications.map(n => (n.id === id ? { ...n, read: true } : n));
  emit();
  void (async () => {
    try {
      await postJsonAforceApi<{ notification: ServerNotification }>(
        `/circle/notifications/${encodeURIComponent(id)}/read`,
        {},
      );
    } catch {
      notificationsHydrated = false;
      ensureNotificationsHydrated();
    }
  })();
}

/** Composite circle leaderboard — used by both the feed and challenge cards. */
export function getCircleRanking(): Array<{ user: CircleUser; status: SharedStatus; rank: number }> {
  const feed = getCircleFeed();
  return feed.map((item, i) => ({ user: item.user, status: item, rank: i + 1 }));
}

/**
 * Test-only reset. Restores all in-memory arrays and bumps version so any
 * subscribed snapshots invalidate. Not exported for app code paths.
 */
export function __resetCircleStateForTests(): void {
  users = [...MOCK_CIRCLE_USERS];
  statuses = { ...MOCK_SHARED_STATUSES };
  challenges = [...MOCK_CHALLENGES];
  notifications = [...MOCK_NOTIFICATIONS];
  usersHydrated = false;
  statusesHydrated = false;
  challengesHydrated = false;
  notificationsHydrated = false;
  usersInflight = null;
  challengesInflight = null;
  notificationsInflight = null;
  emit();
}
