/**
 * WHOOP foreground refresh — "app open + stale data → refresh" with ZERO
 * client changes (WHOOP sweep redesign, 2026-08-19).
 *
 * The app already calls authenticated `GET /aforce/state` on open and on its
 * periodic refresh. This module lets that existing call trigger a
 * fire-and-forget WHOOP fetch when — and only when — the member's data is
 * stale AND the connection is eligible (not backing off, not needs_reauth).
 * Fresh data costs one control-row read and nothing else; members with no
 * WHOOP row cost one read that returns null.
 *
 * Design rules:
 *   - NEVER blocks or fails the state response. Everything here is void,
 *     catch-all, and after-the-fact.
 *   - Per-user in-process debounce so a burst of state reads (cold open fires
 *     several) triggers at most one eligibility check per minute.
 *   - Shares the process-singleton WhoopRefreshRegistry with the sweep and
 *     the admin trigger, so a foreground fetch and a sweep fetch for the same
 *     user still collapse to one WHOOP POST.
 *   - Initialized at boot iff WHOOP OAuth env is configured; without init,
 *     `triggerWhoopRefreshIfStale` is a no-op. Independent of the sweep's
 *     interval env — foreground refresh works even with the sweep disabled.
 */

import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Logger } from "pino";
import {
  buildDefaultWhoopFetchDeps,
  runWhoopFetchOnce,
} from "./whoopFetchWorker";
import type { WhoopRefreshRegistry } from "./whoopRefreshRegistry";
import { readWhoopEligibilityInput } from "./whoopRefreshControlStore";
import {
  resolveWhoopEligibility,
  WHOOP_DATA_FRESH_MS,
} from "./whoopRefreshPolicy";

type Db = NodePgDatabase<Record<string, unknown>>;

export interface WhoopForegroundRefreshDeps {
  db: Db;
  refreshRegistry: WhoopRefreshRegistry;
  log: Pick<Logger, "info" | "warn">;
  /** Defaults to WHOOP_DATA_FRESH_MS (30 min, founder-ratified). */
  freshMs?: number;
  /** TEST SEAMS. Production code should not pass these. */
  readEligibility?: typeof readWhoopEligibilityInput;
  runOnce?: (userId: string) => Promise<{ status: string }>;
  nowMs?: () => number;
}

let deps: WhoopForegroundRefreshDeps | null = null;

/** Per-user "last considered" clock so state-read bursts stay cheap. */
const lastConsideredAtMs = new Map<string, number>();
/** Per-user in-flight latch — one foreground fetch at a time per user. */
const inFlight = new Set<string>();

/** Minimum gap between eligibility CHECKS per user (not fetches). */
export const FOREGROUND_CHECK_DEBOUNCE_MS = 60 * 1000;

export function initWhoopForegroundRefresh(d: WhoopForegroundRefreshDeps): void {
  deps = d;
}

/** Test hook: reset module state between cases. */
export function resetWhoopForegroundRefreshForTests(): void {
  deps = null;
  lastConsideredAtMs.clear();
  inFlight.clear();
}

/**
 * Fire-and-forget: refresh this member's WHOOP data if it is stale and the
 * connection is eligible. Void by design — callers must not await it on a
 * response path. Never throws.
 */
export function triggerWhoopRefreshIfStale(userId: string): void {
  const d = deps;
  if (!d || !userId) return;
  const now = (d.nowMs ?? Date.now)();
  const last = lastConsideredAtMs.get(userId) ?? 0;
  if (now - last < FOREGROUND_CHECK_DEBOUNCE_MS) return;
  lastConsideredAtMs.set(userId, now);
  if (inFlight.has(userId)) return;
  inFlight.add(userId);

  void (async () => {
    try {
      const read = d.readEligibility ?? readWhoopEligibilityInput;
      const input = await read(d.db, userId);
      if (input === null) return; // no WHOOP connection — nothing to do
      const gate = resolveWhoopEligibility(
        input,
        now,
        d.freshMs ?? WHOOP_DATA_FRESH_MS,
      );
      if (gate !== "fetch") return;
      const run =
        d.runOnce ??
        ((uid: string) =>
          runWhoopFetchOnce(
            uid,
            buildDefaultWhoopFetchDeps(d.db, uid, {
              log: d.log as Pick<Logger, "info" | "warn" | "error">,
              refreshRegistry: d.refreshRegistry,
            }),
          ));
      const outcome = await run(userId);
      d.log.info(
        { userId, status: outcome.status },
        "whoopForegroundRefresh:done",
      );
    } catch (err) {
      d.log.warn(
        { userId, err: err instanceof Error ? err.message : String(err) },
        "whoopForegroundRefresh:failed",
      );
    } finally {
      inFlight.delete(userId);
    }
  })();
}
