/**
 * Athlete record cache — the "renders with no network" half of Phase 3.
 *
 * Storage-agnostic on purpose. The codec and the policy live here as pure
 * functions over a tiny `CacheStorage` interface, so the unit lane can prove
 * the offline behaviour with a fake map and the app can bind AsyncStorage
 * without this file importing it. Same separation the intake outbox uses
 * (`utils/intakeOutbox/outbox.ts` pure, `services/intakeOutbox.ts` bound).
 *
 * Three rules, each learned from the outbox:
 *
 *   1. A CORRUPT ENTRY IS A MISS, NEVER A CRASH. Parse failures, wrong
 *      versions and wrong shapes all return null and delete the key. A record
 *      screen that throws on bad cache is worse offline than one that shows
 *      nothing.
 *   2. STALENESS IS REPORTED, NOT ENFORCED. `readRecord` hands back the age
 *      and lets the caller decide. On a field with no signal, a four-hour-old
 *      record is the most useful thing in the world; silently discarding it
 *      because it crossed a TTL would be the opposite of the requirement.
 *   3. KEYS ARE USER-SCOPED. Two staff members sharing a device must never
 *      read each other's cached athletes.
 */

import type { AthleteRecord } from "./trainerRecord";

/** The subset of AsyncStorage this cache needs. */
export interface CacheStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/** Bump when the stored shape changes. Old entries are dropped, not migrated. */
export const CACHE_VERSION = 1;

const KEY_PREFIX = "@aforce/trainer-record";

export function cacheKey(viewerUserId: string, athleteUserId: string): string {
  return `${KEY_PREFIX}:${viewerUserId}:${athleteUserId}`;
}

interface Envelope {
  v: number;
  savedAtMs: number;
  record: AthleteRecord;
}

export interface CachedRecord {
  record: AthleteRecord;
  savedAtMs: number;
  /** Milliseconds since the entry was written, at the time of the read. */
  ageMs: number;
}

function isRecordLike(value: unknown): value is AthleteRecord {
  if (typeof value !== "object" || value === null) return false;
  const r = value as Partial<AthleteRecord>;
  return (
    typeof r.athleteUserId === "string" &&
    typeof r.displayName === "string" &&
    Array.isArray(r.signals) &&
    Array.isArray(r.trend)
  );
}

export async function writeRecord(
  storage: CacheStorage,
  viewerUserId: string,
  record: AthleteRecord,
  nowMs: number = Date.now(),
): Promise<void> {
  const envelope: Envelope = { v: CACHE_VERSION, savedAtMs: nowMs, record };
  await storage.setItem(cacheKey(viewerUserId, record.athleteUserId), JSON.stringify(envelope));
}

/**
 * Read a record. Returns null for a miss, a corrupt entry or a stale version —
 * and deletes the key in the latter two cases so the fault does not persist.
 */
export async function readRecord(
  storage: CacheStorage,
  viewerUserId: string,
  athleteUserId: string,
  nowMs: number = Date.now(),
): Promise<CachedRecord | null> {
  const key = cacheKey(viewerUserId, athleteUserId);
  let raw: string | null;
  try {
    raw = await storage.getItem(key);
  } catch {
    // Storage itself failed. Nothing to clean up, and no reason to throw at a
    // screen that simply wants to render what it has.
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

  const env = parsed as Partial<Envelope>;
  if (
    typeof env !== "object" ||
    env === null ||
    env.v !== CACHE_VERSION ||
    typeof env.savedAtMs !== "number" ||
    !isRecordLike(env.record)
  ) {
    await storage.removeItem(key).catch(() => undefined);
    return null;
  }

  return {
    record: env.record,
    savedAtMs: env.savedAtMs,
    ageMs: Math.max(0, nowMs - env.savedAtMs),
  };
}

export async function clearRecord(
  storage: CacheStorage,
  viewerUserId: string,
  athleteUserId: string,
): Promise<void> {
  await storage.removeItem(cacheKey(viewerUserId, athleteUserId)).catch(() => undefined);
}

/**
 * How to describe the age of what is on screen.
 *
 * The brief's Phase 7 rule — "sync state is always visible and never lies" —
 * starts here: a record served from cache says so, with its age, rather than
 * presenting yesterday's numbers as today's.
 */
export function freshnessLabel(ageMs: number | null): string {
  if (ageMs === null) return "Live";
  const minutes = Math.floor(ageMs / 60000);
  if (minutes < 1) return "Cached just now";
  if (minutes < 60) return `Cached ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Cached ${hours}h ago`;
  return `Cached ${Math.floor(hours / 24)}d ago`;
}
