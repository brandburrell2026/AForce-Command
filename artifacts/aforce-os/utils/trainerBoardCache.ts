/**
 * Board cache — the roster half of "works in airplane mode after first load".
 *
 * Phase 3 cached one athlete record. This caches the board itself, so a cold
 * open with no signal shows the roster rather than an empty screen.
 *
 * Same contract as `trainerRecordCache`: storage-agnostic, corrupt entries are
 * a miss that cleans up after itself, staleness is reported rather than
 * enforced. The two share the `CacheStorage` interface deliberately — one
 * storage seam for the whole surface, so the offline behaviour is proven in
 * one place and bound to AsyncStorage in another.
 */

import type { BoardAthlete } from "./trainerBoard";
import type { CacheStorage } from "./trainerRecordCache";

export const BOARD_CACHE_VERSION = 1;

const KEY_PREFIX = "@aforce/trainer-board";

export function boardCacheKey(viewerUserId: string, programId: string): string {
  return `${KEY_PREFIX}:${viewerUserId}:${programId}`;
}

interface BoardEnvelope {
  v: number;
  savedAtMs: number;
  athletes: BoardAthlete[];
}

export interface CachedBoard {
  athletes: BoardAthlete[];
  savedAtMs: number;
  ageMs: number;
}

function isAthleteLike(value: unknown): value is BoardAthlete {
  if (typeof value !== "object" || value === null) return false;
  const a = value as Partial<BoardAthlete>;
  return (
    typeof a.athleteUserId === "string" &&
    typeof a.displayName === "string" &&
    typeof a.consentGranted === "boolean"
  );
}

export async function writeBoard(
  storage: CacheStorage,
  viewerUserId: string,
  programId: string,
  athletes: readonly BoardAthlete[],
  nowMs: number = Date.now(),
): Promise<void> {
  const envelope: BoardEnvelope = {
    v: BOARD_CACHE_VERSION,
    savedAtMs: nowMs,
    athletes: [...athletes],
  };
  await storage.setItem(boardCacheKey(viewerUserId, programId), JSON.stringify(envelope));
}

export async function readBoard(
  storage: CacheStorage,
  viewerUserId: string,
  programId: string,
  nowMs: number = Date.now(),
): Promise<CachedBoard | null> {
  const key = boardCacheKey(viewerUserId, programId);
  let raw: string | null;
  try {
    raw = await storage.getItem(key);
  } catch {
    return null;
  }
  if (raw === null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    await storage.removeItem(key).catch(() => undefined);
    return null;
  }

  const env = parsed as Partial<BoardEnvelope>;
  if (
    typeof env !== "object" ||
    env === null ||
    env.v !== BOARD_CACHE_VERSION ||
    typeof env.savedAtMs !== "number" ||
    !Array.isArray(env.athletes) ||
    // One bad row poisons the entry: a half-parsed roster is worse than none,
    // because a trainer cannot tell which athletes are missing.
    !env.athletes.every(isAthleteLike)
  ) {
    await storage.removeItem(key).catch(() => undefined);
    return null;
  }

  return {
    athletes: env.athletes,
    savedAtMs: env.savedAtMs,
    ageMs: Math.max(0, nowMs - env.savedAtMs),
  };
}

/**
 * Apply an unsent availability change to a cached roster.
 *
 * This is what makes a local-first write visible immediately: the queue holds
 * the intent, and the board shows it while it waits. Without it a trainer taps
 * "out", sees nothing change, and taps again.
 */
export function applyPendingAvailability(
  athletes: readonly BoardAthlete[],
  pending: readonly { athleteUserId: string; status: string }[],
): BoardAthlete[] {
  if (pending.length === 0) return [...athletes];
  const latest = new Map<string, string>();
  for (const p of pending) latest.set(p.athleteUserId, p.status);

  return athletes.map((a) => {
    const status = latest.get(a.athleteUserId);
    if (!status) return a;
    if (status !== "available" && status !== "limited" && status !== "out" && status !== "unset") {
      return a;
    }
    return { ...a, availability: status };
  });
}
