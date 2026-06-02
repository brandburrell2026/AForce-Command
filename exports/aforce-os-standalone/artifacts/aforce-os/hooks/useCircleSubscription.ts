/**
 * Reactive subscription hooks for the in-memory service stores.
 *
 * Built on `useSyncExternalStore` so React subscribes once per mounted screen
 * and re-renders automatically when any service mutation runs — eliminating
 * the `useReducer` "tick" pattern previously sprinkled across screens and
 * fixing cross-screen propagation (e.g. accept a request in Manage Circle,
 * see it appear in the Circles feed without remount).
 */

import { useSyncExternalStore } from 'react';

import { subscribeCircle, getCircleVersion } from '@/services/circleService';
import { subscribeBattles, getBattlesVersion } from '@/services/battleService';

/**
 * Subscribe to circle state. Returns the version counter — use it as a
 * dep in `useMemo` over service reads, e.g.:
 *
 *   const v = useCircleSubscription();
 *   const feed = useMemo(() => getCircleFeed(group), [group, v]);
 */
export function useCircleSubscription(): number {
  return useSyncExternalStore(
    subscribeCircle,
    getCircleVersion,
    getCircleVersion, // SSR snapshot — same value, no React Native SSR concerns
  );
}

export function useBattlesSubscription(): number {
  return useSyncExternalStore(
    subscribeBattles,
    getBattlesVersion,
    getBattlesVersion,
  );
}
