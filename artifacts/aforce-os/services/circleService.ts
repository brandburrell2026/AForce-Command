/**
 * Circle service — circle membership + shared status retrieval.
 * Backed by mock data today; same shape will fit a real `/api/circle/*` later.
 *
 * Reactive: any mutation (`setRelationshipStatus`, `removeFromCircle`,
 * `moveToGroup`, `acceptChallenge`, `markNotificationRead`) bumps a version
 * counter and notifies subscribers. Screens consume this via the
 * `useCircleSubscription` hook (`useSyncExternalStore`) so all mounted views
 * refresh consistently — no manual `force()` reducers, no stale lists across
 * screens.
 */

import {
  MOCK_CIRCLE_USERS, MOCK_SHARED_STATUSES, MOCK_CHALLENGES, MOCK_NOTIFICATIONS,
} from '@/data/mockCircleData';
import type {
  CircleUser, SharedStatus, CircleFeedItem, CircleGroup, CircleChallenge,
  CircleNotification, RelationshipStatus,
} from '@/types/circle';

let users: CircleUser[] = [...MOCK_CIRCLE_USERS];
let challenges: CircleChallenge[] = [...MOCK_CHALLENGES];
let notifications: CircleNotification[] = [...MOCK_NOTIFICATIONS];

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

export function listCircle(group?: CircleGroup): CircleUser[] {
  return users
    .filter(u => u.status === 'active')
    .filter(u => (group ? u.group === group : true))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function listPending(): CircleUser[] {
  return users.filter(u => u.status === 'pending');
}

export function getUser(userId: string): CircleUser | undefined {
  return users.find(u => u.userId === userId);
}

export function getSharedStatus(userId: string): SharedStatus | undefined {
  return MOCK_SHARED_STATUSES[userId];
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

export function setRelationshipStatus(userId: string, status: RelationshipStatus): void {
  users = users.map(u => (u.userId === userId ? { ...u, status } : u));
  emit();
}

export function removeFromCircle(userId: string): void {
  users = users.filter(u => u.userId !== userId);
  emit();
}

export function moveToGroup(userId: string, group: CircleGroup): void {
  users = users.map(u => (u.userId === userId ? { ...u, group } : u));
  emit();
}

export function listChallenges(): CircleChallenge[] {
  return challenges
    .filter(c => c.status === 'open')
    .sort((a, b) => a.expiresAt.localeCompare(b.expiresAt));
}

export function acceptChallenge(id: string): void {
  challenges = challenges.map(c => (c.id === id ? { ...c, status: 'accepted' } : c));
  emit();
}

export function listNotifications(): CircleNotification[] {
  return [...notifications].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function markNotificationRead(id: string): void {
  notifications = notifications.map(n => (n.id === id ? { ...n, read: true } : n));
  emit();
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
  challenges = [...MOCK_CHALLENGES];
  notifications = [...MOCK_NOTIFICATIONS];
  emit();
}
