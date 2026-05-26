/**
 * Unified health-provider connection layer.
 *
 * Apple HealthKit and Samsung Health use native permission grants
 * (no OAuth tokens), so "auth parity" with WHOOP means giving them
 * the same hidden-infra shape WHOOP has:
 *   - injectable persistence (so the same call sites can run under
 *     SecureStore on native, in-memory in tests + web)
 *   - a typed status enum that the future Profile → Health screen
 *     can switch on
 *   - explicit connect() / disconnect() verbs
 *
 * The actual native permission request stays inside
 * `appleHealth.ts` / `samsungHealth.ts`. This module is the
 * orchestration layer on top of them.
 *
 * Architecture lock: Build only. No UI / reducer / screen wires
 * this module today. Once a sign-in surface lands it will call
 * `connection.connect()` on tap, then read `connection.getStatus()`
 * on each app launch to show the current state.
 */

export type HealthProviderId = 'apple_health' | 'samsung_health';

export type ConnectionStatus =
  | 'unavailable' // platform mismatch / native module not linked
  | 'not_determined' // never asked, or store has no record
  | 'connected' // user-consent record persisted
  | 'denied'; // permission request returned false

export interface HealthConnectionRecord {
  /** Epoch ms when the user successfully granted permission. */
  connectedAt: number;
}

/** Injectable persistence. Same shape on every platform. */
export interface HealthConnectionStore {
  read(id: HealthProviderId): Promise<HealthConnectionRecord | null>;
  write(id: HealthProviderId, rec: HealthConnectionRecord): Promise<void>;
  clear(id: HealthProviderId): Promise<void>;
}

/** In-memory store. Use for tests and as a web fallback. */
export function createInMemoryHealthConnectionStore(
  seed: Partial<Record<HealthProviderId, HealthConnectionRecord>> = {},
): HealthConnectionStore {
  const map = new Map<HealthProviderId, HealthConnectionRecord>(
    Object.entries(seed).filter(([, v]) => !!v) as Array<
      [HealthProviderId, HealthConnectionRecord]
    >,
  );
  return {
    async read(id) {
      return map.get(id) ?? null;
    },
    async write(id, rec) {
      map.set(id, rec);
    },
    async clear(id) {
      map.delete(id);
    },
  };
}

const SECURE_KEY = (id: HealthProviderId) => `aforce.health.connection.v1.${id}`;

/**
 * SecureStore-backed store. Lazy-loaded so this module remains
 * safe to import from Node / web / SSR (mirror of the WHOOP and
 * Samsung loader pattern).
 */
export async function createSecureHealthConnectionStore(): Promise<HealthConnectionStore> {
  try {
    const mod: unknown = await Function('s', 'return import(s)')('expo-secure-store');
    const SecureStore = (mod as { default?: unknown }).default ?? mod;
    const api = SecureStore as {
      getItemAsync(key: string): Promise<string | null>;
      setItemAsync(key: string, value: string): Promise<void>;
      deleteItemAsync(key: string): Promise<void>;
    };
    if (typeof api.getItemAsync !== 'function') {
      return createInMemoryHealthConnectionStore();
    }
    return {
      async read(id) {
        const raw = await api.getItemAsync(SECURE_KEY(id));
        if (!raw) return null;
        try {
          const parsed = JSON.parse(raw) as HealthConnectionRecord;
          if (typeof parsed.connectedAt === 'number') return parsed;
          return null;
        } catch {
          return null;
        }
      },
      async write(id, rec) {
        await api.setItemAsync(SECURE_KEY(id), JSON.stringify(rec));
      },
      async clear(id) {
        await api.deleteItemAsync(SECURE_KEY(id));
      },
    };
  } catch {
    return createInMemoryHealthConnectionStore();
  }
}

export interface HealthConnection {
  readonly providerId: HealthProviderId;
  /** Native module + platform check. */
  isSupported(): boolean;
  /**
   * Returns the current status without prompting the user.
   *   - 'unavailable' if isSupported() === false
   *   - 'connected'   if the store has a record
   *   - 'not_determined' otherwise
   * Note: native permission can be revoked from system settings
   * between sessions; this status reflects *our* recorded consent,
   * not the live OS permission. Callers that need the live answer
   * should follow up with a snapshot fetch and treat all-null
   * fields as "permission revoked".
   */
  getStatus(): Promise<ConnectionStatus>;
  /**
   * Prompts native permission. On success persists a record and
   * returns 'connected'. On any failure path returns 'denied' or
   * 'unavailable' and does NOT persist anything.
   */
  connect(): Promise<ConnectionStatus>;
  /** Clear the persisted consent record. */
  disconnect(): Promise<void>;
}

/** Internal factory — exposed so tests can inject deterministic seams. */
export interface CreateConnectionOptions {
  providerId: HealthProviderId;
  store: HealthConnectionStore;
  isSupported: () => boolean;
  requestPermissions: () => Promise<boolean>;
  nowMs?: () => number;
}

export function createHealthConnection(opts: CreateConnectionOptions): HealthConnection {
  const now = opts.nowMs ?? (() => Date.now());
  return {
    providerId: opts.providerId,
    isSupported: opts.isSupported,
    async getStatus() {
      if (!opts.isSupported()) return 'unavailable';
      const rec = await opts.store.read(opts.providerId);
      return rec ? 'connected' : 'not_determined';
    },
    async connect() {
      if (!opts.isSupported()) return 'unavailable';
      let ok = false;
      try {
        ok = await opts.requestPermissions();
      } catch {
        // A throwing bridge is indistinguishable from a denial
        // for our purposes — never let it propagate past connect().
        return 'denied';
      }
      if (!ok) return 'denied';
      await opts.store.write(opts.providerId, { connectedAt: now() });
      return 'connected';
    },
    async disconnect() {
      await opts.store.clear(opts.providerId);
    },
  };
}

