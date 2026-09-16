/**
 * The outbox, on disk.
 *
 * The queue lived in `useState`. A trainer entered availability for a squad
 * on a field with no signal, the app reloaded, and every entry was gone —
 * while the indicator said "Saved locally · 12 pending", which was a lie the
 * whole time. `MAX_ITEMS` was not a cap either, because nothing ever synced:
 * enqueuing 550 items against a cap of 500 left 550, since the cap only drops
 * an already-SYNCED item and there were none.
 *
 * Framework-free and backend-injected, like `trainerRecordCache`, so the
 * load/save contract is testable without mocking storage.
 *
 * THREE RULES, and they are the same three the queue itself follows:
 *
 *   1. AN UNSENT ENTRY IS A TRAINER'S WORK. Nothing here discards one. A
 *      corrupt envelope drops the whole file because its contents cannot be
 *      trusted; a single unreadable ITEM inside a readable envelope is
 *      dropped alone, so one bad row never costs the other forty-nine.
 *
 *   2. A MISS CLEANS UP AFTER ITSELF. An unreadable or wrong-version entry is
 *      removed on read rather than left to fail again on every launch —
 *      `trainerRecordCache` already does this and the reasoning is the same.
 *
 *   3. THE CAP IS ENFORCED ON LOAD, not only on enqueue. A queue that grew
 *      past the cap in a version that could not sync must not be carried
 *      forward unbounded into one that can.
 */
import {
  MAX_ITEMS,
  type OutboxItem,
  type OutboxItemKind,
  type OutboxItemState,
} from "./trainerOutbox";
import type { CacheStorage } from "./trainerRecordCache";

/** Bump when the stored shape changes. Old entries are dropped, not migrated. */
export const OUTBOX_VERSION = 1;

const KEY_PREFIX = "@aforce/trainer-outbox";

/**
 * Scoped to the viewer, for the same reason the record cache is: two staff
 * sharing a device must not flush each other's entries under their own
 * credential. The server would attribute the write to whoever is signed in.
 */
export function outboxKey(viewerUserId: string): string {
  return `${KEY_PREFIX}:${viewerUserId}`;
}

interface Envelope {
  v: number;
  items: unknown[];
}

const KINDS: readonly OutboxItemKind[] = ["availability", "note", "rtp_signoff", "session"];
const STATES: readonly OutboxItemState[] = [
  "pending",
  "syncing",
  "conflicted",
  "synced",
  "failed",
];

/**
 * Validate one stored item.
 *
 * Deliberately strict about the fields the sync loop depends on and tolerant
 * about the payload, which is opaque here and belongs to whichever route
 * eventually receives it.
 */
function parseItem(raw: unknown): OutboxItem | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;

  const str = (k: string): string | null => (typeof o[k] === "string" && o[k] ? (o[k] as string) : null);
  const num = (k: string): number | null =>
    typeof o[k] === "number" && Number.isFinite(o[k]) ? (o[k] as number) : null;

  const id = str("id");
  const athleteUserId = str("athleteUserId");
  const programId = str("programId");
  const createdAtMs = num("createdAtMs");
  const nextAttemptAtMs = num("nextAttemptAtMs");
  const attempts = num("attempts");

  if (!id || !athleteUserId || !programId) return null;
  if (createdAtMs === null || nextAttemptAtMs === null || attempts === null) return null;
  if (!KINDS.includes(o["kind"] as OutboxItemKind)) return null;
  if (!STATES.includes(o["state"] as OutboxItemState)) return null;
  if (typeof o["payload"] !== "object" || o["payload"] === null) return null;

  const baseVersion = o["baseVersion"];
  if (baseVersion !== null && typeof baseVersion !== "number") return null;

  const item: OutboxItem = {
    id,
    kind: o["kind"] as OutboxItemKind,
    athleteUserId,
    programId,
    payload: o["payload"] as Record<string, unknown>,
    baseVersion: baseVersion as number | null,
    // An item caught mid-flight by a crash is NOT left as `syncing`: nothing
    // will ever complete it, and `selectDue` would skip it forever. It
    // becomes pending, and the server's idempotency key is what makes the
    // replay safe. (That key is not read server-side yet — recorded as a
    // known gap in docs/runbooks/trainer-dashboard.md.)
    state: o["state"] === "syncing" ? "pending" : (o["state"] as OutboxItemState),
    attempts: Math.max(0, Math.floor(attempts)),
    createdAtMs,
    nextAttemptAtMs,
  };

  const conflict = o["conflict"];
  if (
    typeof conflict === "object" &&
    conflict !== null &&
    typeof (conflict as { serverVersion?: unknown }).serverVersion === "number" &&
    typeof (conflict as { serverValue?: unknown }).serverValue === "object" &&
    (conflict as { serverValue?: unknown }).serverValue !== null
  ) {
    item.conflict = conflict as OutboxItem["conflict"];
  }
  if (typeof o["lastError"] === "string") item.lastError = o["lastError"];

  return item;
}

export interface LoadResult {
  items: OutboxItem[];
  /** Items present in storage that could not be read. For the indicator. */
  dropped: number;
}

export async function loadOutbox(
  storage: CacheStorage,
  viewerUserId: string,
): Promise<LoadResult> {
  const key = outboxKey(viewerUserId);

  let raw: string | null = null;
  try {
    raw = await storage.getItem(key);
  } catch {
    // Storage itself is unavailable. An empty queue is the honest answer;
    // it is NOT a reason to delete anything.
    return { items: [], dropped: 0 };
  }
  if (raw === null) return { items: [], dropped: 0 };

  let env: Envelope;
  try {
    env = JSON.parse(raw) as Envelope;
  } catch {
    await storage.removeItem(key).catch(() => undefined);
    return { items: [], dropped: 0 };
  }

  if (env?.v !== OUTBOX_VERSION || !Array.isArray(env.items)) {
    await storage.removeItem(key).catch(() => undefined);
    return { items: [], dropped: 0 };
  }

  const parsed: OutboxItem[] = [];
  let dropped = 0;
  for (const raw of env.items) {
    const item = parseItem(raw);
    if (item) parsed.push(item);
    else dropped += 1;
  }

  // Oldest first — the sync loop replays chronologically and a stored order
  // that drifted must not decide it.
  parsed.sort((a, b) => a.createdAtMs - b.createdAtMs);

  if (parsed.length <= MAX_ITEMS) return { items: parsed, dropped };

  // Over the cap. Drop synced items first, oldest first; only if that is not
  // enough does anything unsent go, and then the OLDEST unsent, which is the
  // entry most likely to have been superseded.
  const synced = parsed.filter((i) => i.state === "synced");
  const unsent = parsed.filter((i) => i.state !== "synced");
  const keepSynced = Math.max(0, MAX_ITEMS - unsent.length);
  const kept = [...unsent, ...synced.slice(synced.length - keepSynced)].sort(
    (a, b) => a.createdAtMs - b.createdAtMs,
  );
  const overflow = kept.slice(Math.max(0, kept.length - MAX_ITEMS));

  return { items: overflow, dropped: dropped + (parsed.length - overflow.length) };
}

/**
 * Persist the queue.
 *
 * Returns whether it was written. A failure is reported rather than thrown:
 * losing the ability to persist must not take down the screen a trainer is
 * working on, and the in-memory queue is still correct.
 */
export async function saveOutbox(
  storage: CacheStorage,
  viewerUserId: string,
  items: readonly OutboxItem[],
): Promise<boolean> {
  const env: Envelope = { v: OUTBOX_VERSION, items: [...items] };
  try {
    await storage.setItem(outboxKey(viewerUserId), JSON.stringify(env));
    return true;
  } catch {
    return false;
  }
}

export async function clearOutbox(
  storage: CacheStorage,
  viewerUserId: string,
): Promise<void> {
  await storage.removeItem(outboxKey(viewerUserId)).catch(() => undefined);
}
