/**
 * LANE G4 — the real Health Connect binding.
 *
 * Implements the `HealthConnectClient` interface (types.ts) over
 * `react-native-health-connect`, which is why this file is almost entirely
 * translation: the H1/H2 shell was written against Health Connect's actual
 * semantics, so nothing here adds behavior — it adapts shapes.
 *
 * Rules this file enforces:
 *   - ANDROID ONLY. On any other platform every call resolves to the
 *     "unavailable" shape; nothing imports the native module.
 *   - LAZY + SINGLE INIT. The native module is imported on first use and
 *     `initialize()` runs once per process; a failed init is retried on the
 *     next call rather than latched, because HC can be installed mid-session.
 *   - PERMISSION TRANSLATION IS CLOSED. Our permission strings
 *     ('android.permission.health.READ_*', built by permissions.ts from the
 *     approved metric set) map through PERMISSION_RECORD_TYPES below. A string
 *     outside that table is dropped, never guessed — the approved-permissions
 *     lock in app.json and this table must agree, and a test pins both.
 *   - NO SCHEDULING. This is a client, not a syncer — foreground callers own
 *     when anything runs (Phase-1 beta is foreground-only by founder ruling).
 */
import { Platform } from 'react-native';
import type {
  HealthConnectClient,
  HealthConnectPermissionString,
  HealthConnectSdkStatus,
} from './types';

/** Our permission string ↔ Health Connect record type, for the approved set. */
export const PERMISSION_RECORD_TYPES: Readonly<
  Record<string, string>
> = {
  'android.permission.health.READ_SLEEP': 'SleepSession',
  'android.permission.health.READ_RESTING_HEART_RATE': 'RestingHeartRate',
  'android.permission.health.READ_HEART_RATE_VARIABILITY': 'HeartRateVariabilityRmssd',
  'android.permission.health.READ_HEART_RATE': 'HeartRate',
  'android.permission.health.READ_EXERCISE': 'ExerciseSession',
  'android.permission.health.READ_STEPS': 'Steps',
  'android.permission.health.READ_ACTIVE_CALORIES_BURNED': 'ActiveCaloriesBurned',
  'android.permission.health.READ_RESPIRATORY_RATE': 'RespiratoryRate',
};

/** Minimal surface of react-native-health-connect this adapter consumes. */
interface NativeHealthConnectModule {
  initialize(): Promise<boolean>;
  getSdkStatus(): Promise<number>;
  requestPermission(
    permissions: Array<{ accessType: 'read'; recordType: string }>,
  ): Promise<Array<{ accessType: string; recordType: string }>>;
  getGrantedPermissions(): Promise<Array<{ accessType: string; recordType: string }>>;
  readRecords(
    recordType: string,
    options: unknown,
  ): Promise<{ records: unknown[] } | unknown[]>;
  getChanges(options: {
    changesToken: string;
  }): Promise<{ changes: unknown[]; nextChangesToken: string; changesTokenExpired?: boolean }>;
  getChangesToken?(options: { recordTypes: string[] }): Promise<string>;
}

/** react-native-health-connect SdkAvailabilityStatus values (stable ints). */
const SDK_UNAVAILABLE = 1;
const SDK_UPDATE_REQUIRED = 2;
const SDK_AVAILABLE = 3;

let modulePromise: Promise<NativeHealthConnectModule> | null = null;
let initialized = false;

async function nativeModule(): Promise<NativeHealthConnectModule> {
  if (!modulePromise) {
    // Specifier via variable: the dependency is declared in package.json, but
    // TS type resolution is deliberately decoupled — the adapter's own
    // NativeHealthConnectModule interface is the contract, and unit tests mock
    // this import path.
    const specifier = 'react-native-health-connect';
    modulePromise = import(specifier).then(
      (m) => m as unknown as NativeHealthConnectModule,
    );
  }
  return modulePromise;
}

async function ensureInitialized(): Promise<NativeHealthConnectModule> {
  const mod = await nativeModule();
  if (!initialized) {
    // A false/threw init is NOT latched — HC can be installed mid-session.
    initialized = await mod.initialize();
    if (!initialized) throw new Error('health_connect_init_failed');
  }
  return mod;
}

function toRecordType(permission: string): string | null {
  return PERMISSION_RECORD_TYPES[permission] ?? null;
}

function toPermissionString(recordType: string): HealthConnectPermissionString | null {
  for (const [perm, rt] of Object.entries(PERMISSION_RECORD_TYPES)) {
    if (rt === recordType) return perm as HealthConnectPermissionString;
  }
  return null;
}

/** Test seam: reset module-level state between cases. */
export function resetNativeHealthConnectForTests(): void {
  modulePromise = null;
  initialized = false;
}

export function createNativeHealthConnectClient(): HealthConnectClient {
  const android = Platform.OS === 'android';
  return {
    async getSdkStatus(): Promise<HealthConnectSdkStatus> {
      if (!android) return 'SDK_UNAVAILABLE';
      try {
        const mod = await nativeModule();
        const status = await mod.getSdkStatus();
        if (status === SDK_AVAILABLE) return 'SDK_AVAILABLE';
        if (status === SDK_UPDATE_REQUIRED) return 'SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED';
        return 'SDK_UNAVAILABLE';
      } catch {
        return 'SDK_UNAVAILABLE';
      }
    },

    async requestPermission(permissions) {
      if (!android) return [];
      const mod = await ensureInitialized();
      const wanted = permissions
        .map(toRecordType)
        .filter((rt): rt is string => rt !== null)
        .map((recordType) => ({ accessType: 'read' as const, recordType }));
      if (wanted.length === 0) return [];
      const granted = await mod.requestPermission(wanted);
      return granted
        .filter((g) => g.accessType === 'read')
        .map((g) => toPermissionString(g.recordType))
        .filter((p): p is HealthConnectPermissionString => p !== null);
    },

    async getGrantedPermissions() {
      if (!android) return [];
      const mod = await ensureInitialized();
      const granted = await mod.getGrantedPermissions();
      return granted
        .filter((g) => g.accessType === 'read')
        .map((g) => toPermissionString(g.recordType))
        .filter((p): p is HealthConnectPermissionString => p !== null);
    },

    async readRecords<T>(recordType: string, options: unknown): Promise<T[]> {
      if (!android) return [];
      const mod = await ensureInitialized();
      const out = await mod.readRecords(recordType, options);
      return (Array.isArray(out) ? out : out.records) as T[];
    },

    async getChangesToken(recordTypes) {
      if (!android) throw new Error('health_connect_unavailable');
      const mod = await ensureInitialized();
      if (mod.getChangesToken) {
        return mod.getChangesToken({ recordTypes: [...recordTypes] });
      }
      // Older lib versions mint the first token via getChanges with none —
      // sync.ts treats a thrown token call as "start a fresh window", so
      // failing loudly here is honest rather than fabricating a token.
      throw new Error('health_connect_changes_token_unsupported');
    },

    async getChanges(changesToken) {
      if (!android) throw new Error('health_connect_unavailable');
      const mod = await ensureInitialized();
      const out = await mod.getChanges({ changesToken });
      return { changes: out.changes, nextChangesToken: out.nextChangesToken };
    },
  };
}
