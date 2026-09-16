/**
 * Analytics authority lifecycle.
 *
 * Reconciles the server-owned analytics consent state at authenticated launch
 * and whenever the app returns to the foreground. This module deliberately
 * does not emit a product event: reconciliation is privacy infrastructure,
 * not consent to collect.
 *
 * Concurrent lifecycle signals are coalesced. A failure clears the latch so a
 * later foreground event can retry; it must never leave a permanent "syncing"
 * state that suppresses future reconciliation.
 */

export interface AnalyticsAuthorityLifecycle {
  reconcile(): Promise<void>;
}

export function createAnalyticsAuthorityLifecycle(
  syncAuthority: () => Promise<void>,
): AnalyticsAuthorityLifecycle {
  let inFlight: Promise<void> | null = null;

  return {
    reconcile(): Promise<void> {
      if (inFlight !== null) return inFlight;
      const run = Promise.resolve().then(syncAuthority);
      inFlight = run;
      void run.then(
        () => {
          if (inFlight === run) inFlight = null;
        },
        () => {
          if (inFlight === run) inFlight = null;
        },
      );
      return run;
    },
  };
}
