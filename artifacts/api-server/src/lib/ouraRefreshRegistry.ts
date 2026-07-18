/**
 * Process-level Oura refresh singleflight registry.
 *
 * Faithful mirror of `whoopRefreshRegistry.ts` / `garminRefreshRegistry.ts`.
 * The fetch worker mints a fresh manager per run, so two concurrent runs
 * for the same user would each hold their own per-manager `inflight`
 * slot and fire two POSTs. Oura's refresh tokens are single-use; the
 * second POST wins and invalidates the first's refresh_token. This
 * registry promotes singleflight to the PROCESS level keyed by userId.
 *
 * Scope: a single Node process (current Replit topology). Cross-replica
 * coordination would need a distributed lock — out of scope.
 *
 * Architecture lock: hidden-infra. No HTTP route consumes the registry
 * directly; it is plumbed only into the fetch worker deps.
 */

import type { OuraTokens } from "@workspace/db";

export type OuraRefreshCoordinator = (
  impl: () => Promise<OuraTokens>,
) => Promise<OuraTokens>;

export interface OuraRefreshRegistry {
  /** Returns a coordinator bound to this userId. Multiple managers for
   *  the same user share an inflight slot when given coordinators from
   *  the same registry. */
  coordinatorFor(userId: string): OuraRefreshCoordinator;
  /** Observability — number of in-flight refreshes right now. */
  size(): number;
}

/**
 * Build a process-level singleflight registry. Internal Map keyed by
 * userId; entries cleared on settle (resolve OR reject) so a failed
 * refresh does not cache the failure for the next caller.
 */
export function createOuraRefreshRegistry(): OuraRefreshRegistry {
  const inflight = new Map<string, Promise<OuraTokens>>();
  return {
    coordinatorFor(userId: string): OuraRefreshCoordinator {
      if (!userId) {
        throw new Error(
          "createOuraRefreshRegistry.coordinatorFor: userId must be non-empty",
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
