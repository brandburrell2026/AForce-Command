/**
 * Circle service — circle membership + shared status retrieval.
 *
 * Backed by the api-server `/api/circle/*` endpoints; preserves the
 * synchronous read surface (and the `useSyncExternalStore` subscribe
 * pattern) by keeping an in-memory cache that mirrors the server.
 *
 * The cache starts EMPTY and stays empty when a fetch fails (Wave-4).
 * It used to boot from — and fall back to — the MOCK_* seeds, so an
 * offline or logged-out user was shown invented friends with invented
 * scores, indistinguishable from server truth. A circle we could not
 * reach is not a circle we may draw. `getCircleLoadState()` is how the
 * UI tells "we haven't got it yet" apart from "we asked and couldn't
 * get it" — neither may be rendered as a populated circle.
 *
 * Mutations: optimistic local update + version bump, fire-and-forget
 * server call. On failure we re-fetch the affected slice to recover.
 */

import type {
  CircleUser, SharedStatus, CircleFeedItem, CircleGroup, CircleChallenge,
  CircleNotification, RelationshipStatus,
} from '@/types/circle';
import {
  getJsonAforceApi, postJsonAforceApi, deleteJsonAforceApi,
} from '@/services/aforceApiClient';

let users: CircleUser[] = [];
let statuses: Record<string, SharedStatus> = {};
let challenges: CircleChallenge[] = [];
let notifications: CircleNotification[] = [];

let usersHydrated = false;
let statusesHydrated = false;
let challengesHydrated = false;
let notificationsHydrated = false;

let usersInflight: Promise<void> | null = null;
let challengesInflight: Promise<void> | null = null;
let notificationsInflight: Promise<void> | null = null;

// Latched by a failed fetch. Two jobs: it is what makes `unavailable`
// distinguishable from `loading`, and it stops `ensure*Hydrated` re-firing —
// the failure emit re-enters these reads, which without the latch is an
// unbounded retry storm against a server that is already down. Cleared by
// `retryCircleHydration()` and by the mutation-recovery refetches.
let usersFetchFailed = false;
let challengesFetchFailed = false;
let notificationsFetchFailed = false;

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

export type CircleLoadState = 'loading' | 'ready' | 'unavailable';

/**
 * What a circle surface is allowed to claim right now.
 *
 * `unavailable` exists because an empty list on its own says "you have no
 * one" — a statement about the user's life we have no standing to make when
 * all we actually know is that the request failed. Screens must render the
 * two differently.
 */
export function getCircleLoadState(): CircleLoadState {
  if (usersHydrated) return 'ready';
  if (usersFetchFailed) return 'unavailable';
  // Idle collapses into 'loading': every consumer read triggers the fetch.
  return 'loading';
}

/** Drop the failure latches so the next read re-fetches (retry action). */
export function retryCircleHydration(): void {
  usersFetchFailed = false;
  challengesFetchFailed = false;
  notificationsFetchFailed = false;
  emit();
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
  if (usersHydrated || usersInflight || usersFetchFailed) return;
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
      // Stay empty and say so. Inventing a circle to fill the screen is the
      // exact failure this branch used to ship.
      usersFetchFailed = true;
      emit();
    } finally {
      usersInflight = null;
    }
  })();
}

function ensureChallengesHydrated(): void {
  if (challengesHydrated || challengesInflight || challengesFetchFailed) return;
  challengesInflight = (async () => {
    try {
      const res = await getJsonAforceApi<{ challenges: ServerChallenge[] }>('/circle/challenges');
      applyChallengeList(res.challenges);
      challengesHydrated = true;
      emit();
    } catch {
      // No emit: the list was already empty and stays empty, so there is
      // nothing new for a subscriber to paint — only the latch to set.
      challengesFetchFailed = true;
    } finally {
      challengesInflight = null;
    }
  })();
}

function ensureNotificationsHydrated(): void {
  if (notificationsHydrated || notificationsInflight || notificationsFetchFailed) return;
  notificationsInflight = (async () => {
    try {
      const res = await getJsonAforceApi<{ notifications: ServerNotification[] }>(
        '/circle/notifications',
      );
      applyNotificationList(res.notifications);
      notificationsHydrated = true;
      emit();
    } catch {
      notificationsFetchFailed = true;
    } finally {
      notificationsInflight = null;
    }
  })();
}

/* ─── Mutation-failure recovery ──────────────────────────────────────────
   A mutation that fails needs the slice re-pulled, which means clearing the
   failure latch as well as the hydrated flag — otherwise the guard above
   swallows the recovery attempt. */
function refetchUsers(): void {
  usersHydrated = false;
  statusesHydrated = false; // statuses ride along on the same fetch
  usersFetchFailed = false;
  ensureUsersHydrated();
}

function refetchChallenges(): void {
  challengesHydrated = false;
  challengesFetchFailed = false;
  ensureChallengesHydrated();
}

function refetchNotifications(): void {
  notificationsHydrated = false;
  notificationsFetchFailed = false;
  ensureNotificationsHydrated();
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
      refetchUsers();
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
      refetchUsers();
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
      refetchUsers();
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
      refetchChallenges();
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
      refetchNotifications();
    }
  })();
}

/** Composite circle leaderboard — used by both the feed and challenge cards. */
export function getCircleRanking(): Array<{ user: CircleUser; status: SharedStatus; rank: number }> {
  const feed = getCircleFeed();
  return feed.map((item, i) => ({ user: item.user, status: item, rank: i + 1 }));
}

/**
 * Test-only reset. Returns every cache to the cold-boot empty state, clears
 * the hydration/inflight/failure flags, and bumps version so any subscribed
 * snapshots invalidate. Not exported for app code paths.
 */
export function __resetCircleStateForTests(): void {
  users = [];
  statuses = {};
  challenges = [];
  notifications = [];
  usersHydrated = false;
  statusesHydrated = false;
  challengesHydrated = false;
  notificationsHydrated = false;
  usersInflight = null;
  challengesInflight = null;
  notificationsInflight = null;
  usersFetchFailed = false;
  challengesFetchFailed = false;
  notificationsFetchFailed = false;
  emit();
}
