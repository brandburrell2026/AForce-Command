/**
 * Process-level Garmin refresh singleflight registry.
 *
 * Faithful mirror of `whoopRefreshRegistry.ts`. The fetch worker mints
 * a fresh manager per run, so two concurrent runs for the same user
 * would each hold their own per-manager `inflight` slot and fire two
 * POSTs. Garmin rotates refresh tokens; the second POST wins and
 * invalidates the first's refresh_token. This registry promotes
 * singleflight to the PROCESS level keyed by userId.
 *
 * Scope: a single Node process (current Replit topology). Cross-replica
 * coordination would need a distributed lock — out of scope.
 *
 * Architecture lock: DORMANT / hidden-infra. No HTTP route consumes the
 * registry directly; it is plumbed only into the fetch worker deps.
 */

import type { GarminTokens } from "@workspace/db";

export type GarminRefreshCoordinator = (
  impl: () => Promise<GarminTokens>,
) => Promise<GarminTokens>;

export interface GarminRefreshRegistry {
  /** Returns a coordinator bound to this userId. Multiple managers for
   *  the same user share an inflight slot when given coordinators from
   *  the same registry. */
  coordinatorFor(userId: string): GarminRefreshCoordinator;
  /** Observability — number of in-flight refreshes right now. */
  size(): number;
}

/**
 * Build a process-level singleflight registry. Internal Map keyed by
 * userId; entries cleared on settle (resolve OR reject) so a failed
 * refresh does not cache the failure for the next caller.
 */
export function createGarminRefreshRegistry(): GarminRefreshRegistry {
  const inflight = new Map<string, Promise<GarminTokens>>();
  return {
    coordinatorFor(userId: string): GarminRefreshCoordinator {
      if (!userId) {
        throw new Error(
          "createGarminRefreshRegistry.coordinatorFor: userId must be non-empty",
        );
      }
      return (impl) => {
        const existing = inflight.get(userId);
        if (existing) return existing;
        const p = impl().finally(() => {
          if (inflight.get(userId) === p) inflight.delete(userId);
        });
        inflight.set(userId, p);
        return p;
      };
    },
    size() {
      return inflight.size;
    },
  };
}
