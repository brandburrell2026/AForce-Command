/**
 * PKCE / OAuth-state store for the WHOOP authorize -> callback hop.
 *
 * Records the (codeVerifier, userId) pair the server minted at
 * `/whoop/oauth/start` time, keyed by the random `state` param the
 * server hands back to the client. The callback consumes the
 * record by `state` to:
 *   - prove the inbound callback corresponds to a flow this server
 *     started (CSRF defense), and
 *   - recover the verifier needed for the PKCE code exchange.
 *
 * Contract:
 *   - put: insert a fresh record. Empty state rejected — never
 *     collapse multiple flows into one row.
 *   - consume: SINGLE-USE — deletes the record on read even if it
 *     has expired. Replaying a stale state must not resurrect it.
 *   - expiry: lazy on consume. Records older than `ttlMs` return
 *     null. Background sweep is unnecessary at this volume; the
 *     map is bounded by inflight authorize attempts per user.
 *
 * In-memory is fine for now (the flow lives a few seconds and the
 * server is single-process). A Drizzle-backed variant would land
 * if/when the server goes horizontally scaled.
 */

export interface WhoopAuthStateRecord {
  /** PKCE verifier minted alongside this state. */
  codeVerifier: string;
  /** Authenticated user who started this flow. */
  userId: string;
  /** Epoch ms at start; used for TTL on consume. */
  createdAtMs: number;
}

export interface WhoopAuthStateStore {
  put(state: string, record: WhoopAuthStateRecord): Promise<void>;
  /** Returns the record once, then deletes it. Returns null when
   *  missing or expired. */
  consume(state: string, nowMs: number): Promise<WhoopAuthStateRecord | null>;
}

export interface InMemoryWhoopAuthStateStoreOptions {
  /** Default 10 minutes — generous for a flow that should take < 30s. */
  ttlMs?: number;
}

export function createInMemoryWhoopAuthStateStore(
  opts: InMemoryWhoopAuthStateStoreOptions = {},
): WhoopAuthStateStore {
  const ttlMs = opts.ttlMs ?? 10 * 60 * 1000;
  const map = new Map<string, WhoopAuthStateRecord>();
  return {
    async put(state, record) {
      if (!state) throw new Error("state must be non-empty");
      map.set(state, record);
    },
    async consume(state, nowMs) {
      const rec = map.get(state);
      if (!rec) return null;
      // Single-use: delete even when expired so a stale state can
      // never be replayed.
      map.delete(state);
      if (nowMs - rec.createdAtMs > ttlMs) return null;
      return rec;
    },
  };
}
