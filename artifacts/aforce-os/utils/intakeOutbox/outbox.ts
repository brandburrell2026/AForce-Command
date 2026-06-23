/**
 * Offline intake outbox — pure core (RN-free, dependency-free).
 *
 * All queue math lives here so the persistence service (services/intakeOutbox.ts)
 * and the live wiring stay thin and the invariants are unit-tested in isolation,
 * mirroring `utils/intelligence/commandEvents.ts:mergeCommandEvents`.
 *
 * INVARIANTS (asserted by tests):
 *  - Never fabricates or mutates a score. Each item carries the frozen
 *    scoreBefore/scoreAfter from the user's completed action; the outbox only
 *    moves those numbers across the network gap (Score-Protection).
 *  - Never reorders the user's water: replay order is the real chronological
 *    order the intakes were logged (`event.loggedAt`), so water logged first
 *    syncs first (Water-First).
 *  - A bad/corrupt persisted item is dropped, never crashes a read.
 *  - A stale (>24h) item is still sent (server records it as a historical log)
 *    but is excluded from today's optimistic counters.
 */
import type { OutboxItem, OutboxStatus, PendingOverlay, PreparedIntake } from './types';

export const MAX_OUTBOX_ITEMS = 200;
export const STALE_WINDOW_MS = 24 * 60 * 60 * 1000;
export const BACKOFF_BASE_MS = 2000;
export const BACKOFF_MAX_MS = 5 * 60 * 1000;

const VALID_STATUS: ReadonlySet<OutboxStatus> = new Set<OutboxStatus>([
  'pending',
  'syncing',
  'failed',
  'synced',
]);

// ─── Validation ───────────────────────────────────────────────────────────────

function isFiniteNumber(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

function isNonEmptyString(s: unknown): s is string {
  return typeof s === 'string' && s.length > 0;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function normalizePrepared(raw: unknown): PreparedIntake | null {
  if (!isRecord(raw)) return null;
  const { clientEventId, fluidType, ozAmount, scoreBefore, scoreAfter, event } = raw;
  if (!isNonEmptyString(clientEventId)) return null;
  if (!isNonEmptyString(fluidType)) return null;
  if (!isFiniteNumber(ozAmount) || ozAmount < 0) return null;
  if (!isFiniteNumber(scoreBefore) || !isFiniteNumber(scoreAfter)) return null;
  if (!isRecord(event)) return null;
  if (!isNonEmptyString(event['id'])) return null;
  if (!isNonEmptyString(event['loggedAt'])) return null;
  // Carry the event through verbatim so replay is byte-identical; only the
  // structural fields above are validated.
  return {
    clientEventId,
    fluidType,
    ozAmount,
    scoreBefore,
    scoreAfter,
    event: event as PreparedIntake['event'],
  };
}

/**
 * Validate + fill defaults for one persisted item. Returns null for anything
 * structurally invalid so corrupt storage can never crash a read.
 */
export function normalizeOutboxItem(raw: unknown): OutboxItem | null {
  if (!isRecord(raw)) return null;
  const prepared = normalizePrepared(raw['prepared']);
  if (!prepared) return null;

  const createdAtMs = isFiniteNumber(raw['createdAtMs']) ? raw['createdAtMs'] : Date.now();
  const statusRaw = raw['status'];
  const status: OutboxStatus =
    typeof statusRaw === 'string' && VALID_STATUS.has(statusRaw as OutboxStatus)
      ? (statusRaw as OutboxStatus)
      : 'pending';
  const attempts =
    Number.isInteger(raw['attempts']) && (raw['attempts'] as number) >= 0
      ? (raw['attempts'] as number)
      : 0;
  const nextAttemptAtMs = isFiniteNumber(raw['nextAttemptAtMs'])
    ? raw['nextAttemptAtMs']
    : createdAtMs;

  const item: OutboxItem = { prepared, status, attempts, createdAtMs, nextAttemptAtMs };
  if (isFiniteNumber(raw['lastErrorAtMs'])) item.lastErrorAtMs = raw['lastErrorAtMs'];
  return item;
}

// ─── Merge (the hydrate / append union path) ───────────────────────────────────

/**
 * Combine an existing queue with incoming items into a clean, ordered, capped
 * queue. Dedupe is by `clientEventId`; the FIRST occurrence wins so a late
 * hydrate load can never clobber a just-enqueued item, and re-enqueuing an
 * already-present key is a no-op (idempotent). Sorted by `createdAtMs` ascending;
 * if the count exceeds `cap`, the OLDEST items are dropped. An empty `incoming`
 * returns the normalized existing queue unchanged.
 */
export function mergeOutboxItems(
  existing: readonly unknown[],
  incoming: readonly unknown[] = [],
  options: { cap?: number } = {},
): OutboxItem[] {
  const cap =
    Number.isInteger(options.cap) && (options.cap as number) > 0
      ? (options.cap as number)
      : MAX_OUTBOX_ITEMS;

  const byKey = new Map<string, OutboxItem>();
  for (const raw of existing) {
    const it = normalizeOutboxItem(raw);
    if (it && !byKey.has(it.prepared.clientEventId)) byKey.set(it.prepared.clientEventId, it);
  }
  for (const raw of incoming) {
    const it = normalizeOutboxItem(raw);
    if (it && !byKey.has(it.prepared.clientEventId)) byKey.set(it.prepared.clientEventId, it);
  }

  const merged = Array.from(byKey.values()).sort((a, b) => a.createdAtMs - b.createdAtMs);
  return merged.length > cap ? merged.slice(merged.length - cap) : merged;
}

// ─── Backoff / staleness ───────────────────────────────────────────────────────

/**
 * Exponential backoff delay for the Nth failure (1-based): BASE * 2^(n-1),
 * capped at BACKOFF_MAX_MS. Deterministic (no jitter) so it is unit-testable;
 * jitter, if ever wanted, belongs in the service layer, not the pure core.
 */
export function backoffDelayMs(attempt: number): number {
  if (!Number.isFinite(attempt) || attempt < 1) return BACKOFF_BASE_MS;
  const delay = BACKOFF_BASE_MS * 2 ** (Math.floor(attempt) - 1);
  return Math.min(delay, BACKOFF_MAX_MS);
}

/** ms epoch the underlying intake was actually logged (falls back to enqueue time). */
export function eventLoggedAtMs(item: OutboxItem): number {
  const t = Date.parse(item.prepared.event.loggedAt);
  return Number.isFinite(t) ? t : item.createdAtMs;
}

/** True when the intake was logged more than `windowMs` ago (default 24h). */
export function isStale(item: OutboxItem, nowMs: number, windowMs: number = STALE_WINDOW_MS): boolean {
  return nowMs - eventLoggedAtMs(item) > windowMs;
}

// ─── Status transitions (pure — return new arrays) ──────────────────────────────

function mapItem(
  items: readonly OutboxItem[],
  clientEventId: string,
  fn: (it: OutboxItem) => OutboxItem,
): OutboxItem[] {
  return items.map((it) => (it.prepared.clientEventId === clientEventId ? fn(it) : it));
}

/** Flag an item as in-flight. Does not change `attempts` (only failures do). */
export function markSyncing(items: readonly OutboxItem[], clientEventId: string): OutboxItem[] {
  return mapItem(items, clientEventId, (it) => ({ ...it, status: 'syncing' }));
}

/** Flag an item as confirmed landed on the server. */
export function markSynced(items: readonly OutboxItem[], clientEventId: string): OutboxItem[] {
  return mapItem(items, clientEventId, (it) => ({ ...it, status: 'synced' }));
}

/** Record a failed send: bump attempts, schedule the next retry via backoff. */
export function markFailed(
  items: readonly OutboxItem[],
  clientEventId: string,
  nowMs: number,
): OutboxItem[] {
  return mapItem(items, clientEventId, (it) => {
    const attempts = it.attempts + 1;
    return {
      ...it,
      status: 'failed',
      attempts,
      nextAttemptAtMs: nowMs + backoffDelayMs(attempts),
      lastErrorAtMs: nowMs,
    };
  });
}

// ─── Queries / projections ──────────────────────────────────────────────────────

/** Everything not yet confirmed on the server. */
export function pendingItems(items: readonly OutboxItem[]): OutboxItem[] {
  return items.filter((it) => it.status !== 'synced');
}

/** Count of unsynced items (the value the UI badge shows). */
export function countPending(items: readonly OutboxItem[]): number {
  return pendingItems(items).length;
}

/**
 * Unsynced items whose retry time has arrived, in the real chronological order
 * they were logged (Water-First — first water logged is first sent). Stale items
 * ARE included: they still need to reach the server (which records them as a
 * historical log). An item mid-flight (`syncing`) that never resolved (e.g. the
 * app was killed) becomes due again once its `nextAttemptAtMs` passes; replaying
 * it is safe because the server dedupes on `clientEventId`.
 */
export function dueItems(items: readonly OutboxItem[], nowMs: number): OutboxItem[] {
  return items
    .filter((it) => it.status !== 'synced' && it.nextAttemptAtMs <= nowMs)
    .sort((a, b) => eventLoggedAtMs(a) - eventLoggedAtMs(b) || a.createdAtMs - b.createdAtMs);
}

/** Drop confirmed items (run after a successful reconcile to keep storage small). */
export function pruneSynced(items: readonly OutboxItem[]): OutboxItem[] {
  return items.filter((it) => it.status !== 'synced');
}

/**
 * Optimistic overlay to add on top of authoritative server state. The badge
 * `count` is every unsynced item; the numeric deltas exclude stale (>24h) items
 * because the server will not fold those into today's counters — keeping the
 * overlay from fabricating "today" numbers the server won't confirm.
 */
export function pendingOverlay(items: readonly OutboxItem[], nowMs: number): PendingOverlay {
  let count = 0;
  let unitsPending = 0;
  let ozPending = 0;
  let aforceUnitsPending = 0;
  for (const it of items) {
    if (it.status === 'synced') continue;
    count += 1;
    if (isStale(it, nowMs)) continue;
    unitsPending += 1;
    ozPending += it.prepared.ozAmount;
    if (it.prepared.fluidType.startsWith('aforce_')) aforceUnitsPending += 1;
  }
  return { count, unitsPending, ozPending, aforceUnitsPending };
}

// ─── Invariants (structural guard used by tests / optional runtime check) ────────

/**
 * Structural invariants that must always hold: no duplicate keys, no negative
 * volume, valid status, non-negative attempts. (Score-Protection and Water-First
 * are enforced by construction — there is no score-mutation path in this module
 * and `dueItems` orders by log time — and are asserted directly in the tests.)
 */
export function outboxInvariantsHold(items: readonly OutboxItem[]): boolean {
  const seen = new Set<string>();
  for (const it of items) {
    const key = it.prepared.clientEventId;
    if (seen.has(key)) return false;
    seen.add(key);
    if (!(it.prepared.ozAmount >= 0)) return false;
    if (!VALID_STATUS.has(it.status)) return false;
    if (!Number.isInteger(it.attempts) || it.attempts < 0) return false;
  }
  return true;
}
