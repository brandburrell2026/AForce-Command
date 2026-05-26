/**
 * WHOOP OAuth2 token manager.
 *
 * Hidden infrastructure (Phase 1, no visible surface). Provides:
 *   - typed token-store abstraction (so reducer / SecureStore /
 *     in-memory test impls all conform to one shape)
 *   - createSecureWhoopTokenStore() — lazy-loaded expo-secure-store
 *     impl with a graceful in-memory fallback on web / SSR / when
 *     the native module isn't linked yet
 *   - createWhoopTokenManager() — pure orchestration around store
 *     + refresh endpoint. Exposes getValidAccessToken() that
 *     auto-refreshes when the cached token is expired (or within a
 *     small skew window) and persists the new tokens back to the
 *     store
 *
 * Lock alignment: no UI, no reducer wiring, no autoplay. The
 * existing fetchWhoopSnapshot() in `whoop.ts` already accepts a
 * token string; once a sign-in surface lands in a later phase it
 * will call `manager.getValidAccessToken()` and pass it in. Until
 * then, nothing in the app invokes this module.
 */

import type { ProviderSnapshot } from '../types/biometrics';
import { fetchWhoopSnapshot, toProviderSnapshot } from './whoop';

export const WHOOP_TOKEN_ENDPOINT = 'https://api.prod.whoop.com/oauth/oauth2/token';

/** Wire shape returned by the WHOOP token endpoint. */
export interface WhoopTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type?: string;
  scope?: string;
}

/** Persisted record. `expiresAt` is epoch ms for easy comparison. */
export interface WhoopTokens {
  accessToken: string;
  refreshToken: string;
  /** Epoch ms when the access token expires. */
  expiresAt: number;
}

/** Storage adapter. Implementations: SecureStore on native, memory on web/tests. */
export interface WhoopTokenStore {
  read(): Promise<WhoopTokens | null>;
  write(t: WhoopTokens): Promise<void>;
  clear(): Promise<void>;
}

/** In-memory store. Use for tests and as web fallback. */
export function createInMemoryWhoopTokenStore(seed: WhoopTokens | null = null): WhoopTokenStore {
  let current: WhoopTokens | null = seed;
  return {
    async read() {
      return current;
    },
    async write(t) {
      current = t;
    },
    async clear() {
      current = null;
    },
  };
}

const SECURE_KEY = 'aforce.whoop.tokens.v1';

/**
 * Returns an expo-secure-store backed store on native, falls back
 * to in-memory on web / SSR / when the native module isn't linked.
 * Lazy-loaded so the module is safe to import from pure tests and
 * SSR contexts (mirrors the samsungHealth.ts loader pattern).
 */
export async function createSecureWhoopTokenStore(): Promise<WhoopTokenStore> {
  try {
    const mod: unknown = await Function('s', 'return import(s)')('expo-secure-store');
    const SecureStore = (mod as { default?: unknown }).default ?? mod;
    const api = SecureStore as {
      getItemAsync(key: string): Promise<string | null>;
      setItemAsync(key: string, value: string): Promise<void>;
      deleteItemAsync(key: string): Promise<void>;
    };
    if (typeof api.getItemAsync !== 'function') return createInMemoryWhoopTokenStore();
    return {
      async read() {
        const raw = await api.getItemAsync(SECURE_KEY);
        if (!raw) return null;
        try {
          const parsed = JSON.parse(raw) as WhoopTokens;
          if (
            typeof parsed.accessToken === 'string' &&
            typeof parsed.refreshToken === 'string' &&
            typeof parsed.expiresAt === 'number'
          ) {
            return parsed;
          }
          return null;
        } catch {
          return null;
        }
      },
      async write(t) {
        await api.setItemAsync(SECURE_KEY, JSON.stringify(t));
      },
      async clear() {
        await api.deleteItemAsync(SECURE_KEY);
      },
    };
  } catch {
    return createInMemoryWhoopTokenStore();
  }
}

export interface WhoopOAuthConfig {
  clientId: string;
  clientSecret: string;
}

export interface WhoopTokenManagerOptions {
  store: WhoopTokenStore;
  config: WhoopOAuthConfig;
  /** Override for tests. */
  fetchImpl?: typeof fetch;
  /** Override for tests; defaults to Date.now. */
  nowMs?: () => number;
  /** Refresh proactively when this many ms remain on the access token. Defaults to 60s. */
  refreshSkewMs?: number;
}

export interface WhoopTokenManager {
  /** Returns the current valid access token, refreshing if needed. Null when no tokens stored. */
  getValidAccessToken(): Promise<string | null>;
  /** Force a refresh now. Throws on network / OAuth error. */
  refresh(): Promise<WhoopTokens>;
  /** Persist a fresh token bundle (e.g. after the initial OAuth code exchange). */
  setTokens(tokens: WhoopTokens): Promise<void>;
  /** Clear all stored tokens (sign-out). */
  signOut(): Promise<void>;
  /** Inspect — never used on the hot path, useful for dev/debug. */
  peek(): Promise<WhoopTokens | null>;
}

/**
 * Build a token manager. Pure orchestration — all I/O is delegated
 * to the injected store + fetchImpl.
 */
export function createWhoopTokenManager(opts: WhoopTokenManagerOptions): WhoopTokenManager {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const now = opts.nowMs ?? (() => Date.now());
  const skew = opts.refreshSkewMs ?? 60_000;

  async function refresh(): Promise<WhoopTokens> {
    const current = await opts.store.read();
    if (!current?.refreshToken) {
      throw new Error('WHOOP refresh failed: no refresh token stored');
    }
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: current.refreshToken,
      client_id: opts.config.clientId,
      client_secret: opts.config.clientSecret,
      scope: 'offline',
    });
    const res = await fetchImpl(WHOOP_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!res.ok) {
      throw new Error(`WHOOP refresh failed: HTTP ${res.status}`);
    }
    const json = (await res.json()) as WhoopTokenResponse;
    const next: WhoopTokens = {
      accessToken: json.access_token,
      refreshToken: json.refresh_token ?? current.refreshToken,
      expiresAt: now() + json.expires_in * 1000,
    };
    await opts.store.write(next);
    return next;
  }

  return {
    async getValidAccessToken() {
      const current = await opts.store.read();
      if (!current) return null;
      if (current.expiresAt - now() > skew) return current.accessToken;
      try {
        const next = await refresh();
        return next.accessToken;
      } catch {
        return null;
      }
    },
    refresh,
    async setTokens(tokens) {
      await opts.store.write(tokens);
    },
    async signOut() {
      await opts.store.clear();
    },
    peek() {
      return opts.store.read();
    },
  };
}

/**
 * Convenience: pull a snapshot using a managed token. Handles the
 * refresh-on-expiry path so callers don't have to. Returns null
 * when no tokens are stored (user hasn't connected WHOOP).
 */
export async function fetchManagedWhoopSnapshot(
  manager: WhoopTokenManager,
  fetchedAt: number,
  fetchImpl?: typeof fetch,
): Promise<ProviderSnapshot | null> {
  const token = await manager.getValidAccessToken();
  if (!token) return null;
  const snap = await fetchWhoopSnapshot({ accessToken: token, fetchImpl });
  return toProviderSnapshot(snap, fetchedAt);
}
