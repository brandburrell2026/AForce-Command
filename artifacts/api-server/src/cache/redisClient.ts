/**
 * Redis client interface — production wraps `ioredis`/`@upstash/redis`,
 * dev/test uses an in-memory map so the rest of the stack can boot without
 * a Redis dependency. Swap implementations behind `getCache()` only.
 *
 * Responsibilities of the production wrapper (NOT YET WIRED):
 *   - Cluster-mode client with sentinels.
 *   - Per-call timeout (default 50ms) — never block the request thread.
 *   - Auto-reconnect with capped backoff.
 *   - Hit/miss metrics emission via `observability/metrics`.
 *   - Single-flight on `getOrSet` to prevent thundering-herd recomputes.
 */

export interface CacheClient {
  get<T = unknown>(key: string): Promise<T | null>;
  set<T = unknown>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  /** Atomic get-or-compute. Single-flight per key per pod. */
  getOrSet<T>(key: string, ttlSeconds: number, compute: () => Promise<T>): Promise<T>;
  /** Pub/sub — used for cross-pod cache invalidation and flag propagation. */
  publish(channel: string, message: string): Promise<void>;
  subscribe(channel: string, handler: (message: string) => void): Promise<void>;
}

interface Entry { value: unknown; expiresAt: number }

class InMemoryCache implements CacheClient {
  private store = new Map<string, Entry>();
  private inflight = new Map<string, Promise<unknown>>();
  private subs = new Map<string, Array<(m: string) => void>>();

  async get<T>(key: string): Promise<T | null> {
    const e = this.store.get(key);
    if (!e) return null;
    if (e.expiresAt < Date.now()) { this.store.delete(key); return null; }
    return e.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds = 60): Promise<void> {
    this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  async del(key: string): Promise<void> { this.store.delete(key); }

  async getOrSet<T>(key: string, ttlSeconds: number, compute: () => Promise<T>): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;
    const existing = this.inflight.get(key);
    if (existing) return existing as Promise<T>;
    const p = (async () => {
      try {
        const v = await compute();
        await this.set(key, v, ttlSeconds);
        return v;
      } finally {
        this.inflight.delete(key);
      }
    })();
    this.inflight.set(key, p);
    return p;
  }

  async publish(channel: string, message: string): Promise<void> {
    for (const h of this.subs.get(channel) ?? []) {
      try { h(message); } catch { /* swallow handler errors */ }
    }
  }

  async subscribe(channel: string, handler: (m: string) => void): Promise<void> {
    const list = this.subs.get(channel) ?? [];
    list.push(handler);
    this.subs.set(channel, list);
  }
}

let _cache: CacheClient | null = null;

export function getCache(): CacheClient {
  if (!_cache) _cache = new InMemoryCache();
  return _cache;
}

/** For tests / wiring a real Redis client at boot. */
export function setCacheClient(client: CacheClient): void { _cache = client; }
