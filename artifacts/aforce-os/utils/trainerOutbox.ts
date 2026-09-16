/**
 * Trainer outbox — local-first writes for a field with no signal.
 *
 * Phase 7 of `docs/TRAINER-DASHBOARD-BRIEF.md`. Pure core, storage-agnostic,
 * modelled on `utils/intakeOutbox/outbox.ts`, which is the only proven
 * local-first write path in this repo.
 *
 * The rules, quoting the brief:
 *
 *   "Local-first writes, queued sync, last-writer-wins with a visible
 *    conflict surface for status changes — never silently drop a trainer's
 *    entry."
 *   "Sync state is always visible and never lies."
 *
 * Three consequences shape this file:
 *
 *   1. NOTHING IS EVER DROPPED. A failed item goes back to `pending` with a
 *      backoff. A CONFLICTED item stays in the queue in its own state until a
 *      human resolves it. There is no code path that removes an unsynced
 *      entry, which is why `prune` only removes items already `synced`.
 *
 *   2. LAST-WRITER-WINS IS A DECISION, NOT A SILENT OVERWRITE. When the
 *      server's version is newer than the base the trainer edited from, the
 *      item becomes `conflicted` and carries both values. The queue surfaces
 *      it; it does not pick a winner quietly.
 *
 *   3. THE SUMMARY CANNOT OVERSTATE. `syncSummary` derives its label from the
 *      queue alone and has no notion of connectivity — this app ships no
 *      NetInfo, so a green "synced" tick would be a claim nothing can back.
 *      "Saved locally · 3 pending" is what the data supports.
 */

export type OutboxItemKind = "availability" | "note" | "rtp_signoff" | "session";

export type OutboxItemState = "pending" | "syncing" | "conflicted" | "synced" | "failed";

export interface OutboxItem {
  /** Client-generated, stable across retries. The server dedupe key. */
  id: string;
  kind: OutboxItemKind;
  athleteUserId: string;
  programId: string;
  /** The payload as the trainer entered it. Never rewritten after enqueue. */
  payload: Record<string, unknown>;
  /**
   * The server version this edit was made against, when the kind has one.
   * Null for append-only kinds (a note, a sign-off) that cannot conflict.
   */
  baseVersion: number | null;
  state: OutboxItemState;
  attempts: number;
  createdAtMs: number;
  /** Earliest time a retry may run. */
  nextAttemptAtMs: number;
  /** Set only on `conflicted`, so a human can see both sides. */
  conflict?: {
    serverVersion: number;
    serverValue: Record<string, unknown>;
  };
  lastError?: string;
}

export const MAX_ITEMS = 500;
export const BACKOFF_BASE_MS = 2_000;
export const BACKOFF_MAX_MS = 5 * 60_000;

/** Exponential with a ceiling. Attempt 1 waits 2s, attempt 8 waits 5 minutes. */
export function backoffFor(attempts: number): number {
  const raw = BACKOFF_BASE_MS * 2 ** Math.max(0, attempts - 1);
  return Math.min(raw, BACKOFF_MAX_MS);
}

export function enqueue(
  queue: readonly OutboxItem[],
  item: Omit<OutboxItem, "state" | "attempts" | "nextAttemptAtMs">,
): OutboxItem[] {
  // Re-enqueueing the same id is a replay, not a second entry.
  if (queue.some((q) => q.id === item.id)) return [...queue];

  const next: OutboxItem = {
    ...item,
    state: "pending",
    attempts: 0,
    nextAttemptAtMs: item.createdAtMs,
  };

  const appended = [...queue, next];
  if (appended.length <= MAX_ITEMS) return appended;

  // At the cap, drop the OLDEST ALREADY-SYNCED item. An unsynced entry is a
  // trainer's work and is never sacrificed to make room.
  const oldestSyncedIndex = appended.findIndex((q) => q.state === "synced");
  if (oldestSyncedIndex === -1) return appended;
  return [...appended.slice(0, oldestSyncedIndex), ...appended.slice(oldestSyncedIndex + 1)];
}

/** Items due for a send attempt, oldest first. Chronological replay. */
export function selectDue(queue: readonly OutboxItem[], nowMs: number): OutboxItem[] {
  return queue
    .filter((q) => (q.state === "pending" || q.state === "failed") && q.nextAttemptAtMs <= nowMs)
    .sort((a, b) => a.createdAtMs - b.createdAtMs);
}

export function markSyncing(queue: readonly OutboxItem[], id: string): OutboxItem[] {
  return queue.map((q) => (q.id === id ? { ...q, state: "syncing" as const } : q));
}

export function markSynced(queue: readonly OutboxItem[], id: string): OutboxItem[] {
  return queue.map((q) => (q.id === id ? { ...q, state: "synced" as const, lastError: undefined } : q));
}

/**
 * A send failed. The item goes back to `pending` with a backoff — never
 * removed, however many times it has failed.
 */
export function markFailed(
  queue: readonly OutboxItem[],
  id: string,
  error: string,
  nowMs: number,
): OutboxItem[] {
  return queue.map((q) => {
    if (q.id !== id) return q;
    const attempts = q.attempts + 1;
    return {
      ...q,
      state: "failed" as const,
      attempts,
      nextAttemptAtMs: nowMs + backoffFor(attempts),
      lastError: error,
    };
  });
}

/**
 * The server had a newer version than the trainer edited from.
 *
 * Both values are kept on the item. Nothing is applied and nothing is
 * discarded until a person chooses, which is the "visible conflict surface"
 * the brief asks for.
 */
export function markConflicted(
  queue: readonly OutboxItem[],
  id: string,
  conflict: { serverVersion: number; serverValue: Record<string, unknown> },
): OutboxItem[] {
  return queue.map((q) => (q.id === id ? { ...q, state: "conflicted" as const, conflict } : q));
}

/** Resolve a conflict by keeping the trainer's entry: re-queued as pending. */
export function resolveKeepMine(queue: readonly OutboxItem[], id: string, nowMs: number): OutboxItem[] {
  return queue.map((q) =>
    q.id === id && q.state === "conflicted"
      ? {
          ...q,
          state: "pending" as const,
          // Rebased onto what the server actually has, so the retry is an
          // informed overwrite rather than a second blind one.
          baseVersion: q.conflict?.serverVersion ?? q.baseVersion,
          nextAttemptAtMs: nowMs,
          conflict: undefined,
        }
      : q,
  );
}

/** Resolve by taking the server's value: the local entry is marked synced. */
export function resolveKeepServer(queue: readonly OutboxItem[], id: string): OutboxItem[] {
  return queue.map((q) =>
    q.id === id && q.state === "conflicted" ? { ...q, state: "synced" as const, conflict: undefined } : q,
  );
}

/** Remove synced items. The ONLY removal path in this module. */
export function prune(queue: readonly OutboxItem[]): OutboxItem[] {
  return queue.filter((q) => q.state !== "synced");
}

export interface SyncSummary {
  pending: number;
  syncing: number;
  conflicted: number;
  failed: number;
  /** Everything not yet accepted by the server. */
  unsynced: number;
  /** What the indicator shows. Derived only from the queue. */
  label: string;
  /** True when a person has to choose something. */
  needsAttention: boolean;
}

/**
 * The sync indicator's text.
 *
 * Deliberately never says "synced" or "up to date" — this app has no
 * connectivity signal, so the honest ceiling is "nothing is waiting", which
 * is what an empty queue actually means.
 */
export function syncSummary(queue: readonly OutboxItem[]): SyncSummary {
  const pending = queue.filter((q) => q.state === "pending").length;
  const syncing = queue.filter((q) => q.state === "syncing").length;
  const conflicted = queue.filter((q) => q.state === "conflicted").length;
  const failed = queue.filter((q) => q.state === "failed").length;
  const unsynced = pending + syncing + conflicted + failed;

  let label: string;
  if (conflicted > 0) {
    label = `${conflicted} need${conflicted === 1 ? "s" : ""} your decision`;
  } else if (failed > 0) {
    label = `Saved locally · ${unsynced} pending · retrying`;
  } else if (unsynced > 0) {
    label = `Saved locally · ${unsynced} pending`;
  } else {
    label = "Nothing waiting to send";
  }

  return { pending, syncing, conflicted, failed, unsynced, label, needsAttention: conflicted > 0 };
}
