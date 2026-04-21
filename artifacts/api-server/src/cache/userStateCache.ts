/**
 * Domain cache wrapper for current-user state. Demonstrates the pattern every
 * domain cache should follow:
 *   - typed key + value
 *   - explicit TTL
 *   - explicit invalidation hook
 *   - single-flight on miss via `getOrSet`
 */

import { getCache } from './redisClient';

export interface UserState {
  userId: string;
  score: number;
  level: 'PEAK' | 'BALANCED' | 'RECOVERING' | 'DEPLETED';
  updatedAt: string;
}

const TTL_SEC = 60 * 60; // 1h
const key = (userId: string) => `user:${userId}:state`;

export async function readUserState(
  userId: string,
  loadFromDb: () => Promise<UserState>,
): Promise<UserState> {
  return getCache().getOrSet<UserState>(key(userId), TTL_SEC, loadFromDb);
}

/** Invalidate after intake / score recompute. Called by the event consumer. */
export async function invalidateUserState(userId: string): Promise<void> {
  await getCache().del(key(userId));
  // Cross-pod fanout so every pod's local memo (if any) drops the entry too.
  await getCache().publish('cache.invalidate', JSON.stringify({ key: key(userId) }));
}
