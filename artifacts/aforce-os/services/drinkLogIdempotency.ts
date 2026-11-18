/**
 * Stable event ids for the drink log (stop-ship RA-N5).
 *
 * The server already refuses a repeat: `aforce_recorded_drinks` has a unique
 * index on (member, client event id) and the route answers a repeat with the
 * row it stored the first time. The defect was on this side. The app made a
 * new id for every attempt, so when a request reached the server but its reply
 * was lost, the member saw "Not logged. Try again", tried again, and the same
 * drink was saved twice.
 *
 * The rule here: one member action, one id. While the outcome of an attempt is
 * unknown, the same drink keeps the same id, so trying again can only ever
 * save it once. The id is released when the server answers, either way.
 *
 * Kept in memory only. It does not survive the app being closed between the
 * failed attempt and the retry; a durable queue for drinks belongs with the
 * edit / delete work (RA-N7).
 */

/** How long an unanswered attempt keeps its id. */
export const DRINK_EVENT_ID_REUSE_WINDOW_MS = 10 * 60_000;

export interface DrinkLogIdentity {
  categoryId: string;
  displayName: string;
  ozAmount: number;
  entrySource: string;
}

/** Two attempts are the same action when every field the member chose matches. */
export function drinkFingerprint(input: DrinkLogIdentity): string {
  return JSON.stringify([input.categoryId, input.displayName, input.ozAmount, input.entrySource]);
}

export interface DrinkEventIdRegistry {
  /** The id for this action: the pending one if its outcome is unknown, else a new one. */
  idFor(fingerprint: string): string;
  /** The server answered (saved, replayed or refused). The next action is a new one. */
  settle(fingerprint: string): void;
  /** Ids currently held for an unanswered attempt. For tests. */
  pendingCount(): number;
}

export function createDrinkEventIdRegistry(
  deps: {
    now?: () => number;
    random?: () => number;
    reuseWindowMs?: number;
  } = {},
): DrinkEventIdRegistry {
  const now = deps.now ?? Date.now;
  const random = deps.random ?? Math.random;
  const windowMs = deps.reuseWindowMs ?? DRINK_EVENT_ID_REUSE_WINDOW_MS;
  const pending = new Map<string, { id: string; at: number }>();

  const prune = (): void => {
    const cutoff = now() - windowMs;
    for (const [key, entry] of pending) if (entry.at < cutoff) pending.delete(key);
  };

  return {
    idFor(fingerprint) {
      prune();
      const held = pending.get(fingerprint);
      if (held) return held.id;
      const id = `drink-${now()}-${random().toString(36).slice(2, 10)}`;
      pending.set(fingerprint, { id, at: now() });
      return id;
    },
    settle(fingerprint) {
      pending.delete(fingerprint);
    },
    pendingCount() {
      prune();
      return pending.size;
    },
  };
}

/**
 * True when the server definitely answered and refused, so retrying the same
 * bytes cannot succeed and the id can be released. `postJson` encodes a server
 * reply as `POST <path> → <status>`. A timeout (408), a rate limit (429), any
 * 5xx and any error with no status all leave the outcome unknown.
 */
export function isDefinitiveRejection(err: unknown): boolean {
  const match = /→ (\d{3})\b/.exec(err instanceof Error ? err.message : '');
  if (!match) return false;
  const status = Number(match[1]);
  return status >= 400 && status < 500 && status !== 408 && status !== 429;
}
