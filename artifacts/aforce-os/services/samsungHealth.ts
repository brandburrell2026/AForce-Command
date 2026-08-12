/**
 * Samsung Health bridge for AForce OS.
 *
 * Mirrors the contract of `appleHealth.ts`: every function resolves
 * to a safe "unavailable" snapshot on non-Android platforms (iOS,
 * web). Real integration goes through the Samsung Health Data SDK
 * (`@samsung/health-data-sdk` — Android-only, requires Samsung
 * partner enrollment + native build). We never fabricate data: if
 * a permission is denied or the SDK isn't linked, every field stays
 * null and the aggregator simply doesn't get a Samsung contribution.
 */

import type { ProviderSnapshot } from '../types/biometrics';

// Lazy Platform access so importing this module in a Node/Vitest
// environment doesn't pull react-native's Flow-typed source through
// the test-runner transformer. The native build evaluates this at
// runtime and gets the real Platform module.
function getPlatformOS(): string {
  try {
    // String-indirected require so neither Vite's SSR transformer nor
    // tsc tries to statically resolve react-native's Flow-typed
    // source when this module is imported from a Node test runner.
    const dynReq =
      typeof require !== 'undefined'
        ? (require as unknown as (id: string) => unknown)
        : null;
    if (!dynReq) return 'unknown';
    const specifier = 'react-native';
    const rn = dynReq(specifier) as { Platform?: { OS?: string } } | null;
    return rn?.Platform?.OS ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

export interface SamsungHealthSnapshot {
  /** Most recent resting HR (bpm). */
  restingHeartRate: number | null;
  /** Total step count for the current local day. */
  stepsToday: number | null;
  /** Total exercise minutes for the current local day. */
  workoutMinutesToday: number | null;
  /** Total sleep duration for the prior night (hours). */
  sleepHoursLastNight: number | null;
}

const EMPTY_SNAPSHOT: SamsungHealthSnapshot = {
  restingHeartRate: null,
  stepsToday: null,
  workoutMinutesToday: null,
  sleepHoursLastNight: null,
};

export function isSamsungHealthSupported(): boolean {
  return getPlatformOS() === 'android';
}

/**
 * Lazily import the native module so Metro doesn't try to resolve
 * the Samsung SDK on iOS / web.
 */
async function loadSamsungHealth(): Promise<unknown | null> {
  if (!isSamsungHealthSupported()) return null;
  try {
    // Indirected through a variable so neither tsc nor Metro tries
    // to statically resolve the optional SDK package — it isn't
    // bundled in web/dev builds and is only present in a real
    // Samsung-enrolled Android native build.
    const specifier = '@samsung/health-data-sdk';
    const mod = await (Function('s', 'return import(s)') as (s: string) => Promise<unknown>)(
      specifier,
    ).catch(() => null);
    return mod;
  } catch (err) {
    console.warn('[SamsungHealth] failed to load native module', err);
    return null;
  }
}

/**
 * Request read access to the metrics AForce consumes. Returns true
 * only if the request was actually shown AND the SDK is available —
 * false everywhere else (iOS, web, native build without the SDK).
 */
export async function requestSamsungHealthPermissions(): Promise<boolean> {
  const SH = (await loadSamsungHealth()) as
    | {
        requestPermissions?: (perms: {
          read: string[];
        }) => Promise<unknown>;
      }
    | null;
  if (!SH || typeof SH.requestPermissions !== 'function') return false;
  try {
    await SH.requestPermissions({
      read: [
        'com.samsung.health.heart_rate',
        'com.samsung.health.step_count',
        'com.samsung.health.exercise',
        'com.samsung.shealth.sleep',
      ],
    });
    return true;
  } catch (err) {
    console.warn('[SamsungHealth] requestPermissions failed', err);
    return false;
  }
}

/**
 * Pure reduction: Samsung sleep segments -> hours asleep, or null when
 * no asleep segment actually contributed. Zero SDK / React Native
 * dependency so the reduction is provable in node — the same convention
 * `appleHealth.ts` uses for `reduceSleepByIntervalUnion`, and the only
 * way to test this at all (`loadSamsungHealth` returns null off Android,
 * so the fetch path below is unreachable from a test runner).
 *
 * Wave-4 Part 12: `!Array.isArray(segs)` used to be the ONLY null exit,
 * so three distinct non-measurements each reduced to ms=0 and were
 * reported as a confident 0h — an empty array (the window held no sleep
 * samples at all), an all-awake segment list (the SDK classified nothing
 * as asleep), and malformed segments whose spans `Math.max(0, ...)`
 * clamps away. Downstream a literal 0 is not read as "no reading": it
 * scores as the MAXIMAL sleep deficit, and being fresher it outranks an
 * older genuine reading in the aggregator. That is a diagnosis drawn
 * from an absence, which the Constitution's "observation never
 * diagnosis" principle forbids — nothing asleep contributed, so the
 * honest output is unknown.
 *
 * Accepted consequence, matching the position the Apple lane already
 * took under the RC-2 sleep-window ruling (2026-08-08, design point 4):
 * a TRUE measured 0h night is unrepresentable from this producer. No
 * Samsung 0 was ever a verified measurement, so nothing real is lost.
 */
export function reduceSleepSegmentsToHours(segs: unknown): number | null {
  if (!Array.isArray(segs)) return null;
  const list = segs as ReadonlyArray<{ start: number; end: number; stage: number }>;
  // Samsung sleep stages: 40001 awake, 40002 light, 40003 deep,
  // 40004 REM. Sum everything except AWAKE.
  const ms = list.reduce((sum, s) => {
    const isAsleep = s.stage !== 40001;
    return isAsleep ? sum + Math.max(0, s.end - s.start) : sum;
  }, 0);
  return ms > 0 ? ms / (1000 * 60 * 60) : null;
}

/**
 * Pull a snapshot of the metrics that influence the AForce score.
 * Any field that can't be read stays null — never substituted with
 * a placeholder. Returns the empty snapshot on iOS / web.
 */
export async function fetchSamsungHealthSnapshot(): Promise<SamsungHealthSnapshot> {
  const SH = (await loadSamsungHealth()) as
    | {
        readQuantity?: (type: string, range: { start: number; end: number }) => Promise<number | null>;
        readSleepSegments?: (range: { start: number; end: number }) => Promise<
          Array<{ start: number; end: number; stage: number }>
        >;
      }
    | null;
  if (!SH) return EMPTY_SNAPSHOT;

  const now = Date.now();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const lastNightStart = now - 18 * 60 * 60 * 1000;

  const safe = async <T>(fn: () => Promise<T>): Promise<T | null> => {
    try {
      return await fn();
    } catch (err) {
      console.warn('[SamsungHealth] sample fetch failed', err);
      return null;
    }
  };

  const restingHeartRate =
    typeof SH.readQuantity === 'function'
      ? await safe(() =>
          SH.readQuantity!('com.samsung.health.heart_rate.resting', {
            start: startOfDay.getTime(),
            end: now,
          }),
        )
      : null;

  const stepsToday =
    typeof SH.readQuantity === 'function'
      ? await safe(() =>
          SH.readQuantity!('com.samsung.health.step_count', {
            start: startOfDay.getTime(),
            end: now,
          }),
        )
      : null;

  const workoutMinutesToday =
    typeof SH.readQuantity === 'function'
      ? await safe(() =>
          SH.readQuantity!('com.samsung.health.exercise.duration_min', {
            start: startOfDay.getTime(),
            end: now,
          }),
        )
      : null;

  const sleepHoursLastNight =
    typeof SH.readSleepSegments === 'function'
      ? await safe(async () =>
          reduceSleepSegmentsToHours(
            await SH.readSleepSegments!({ start: lastNightStart, end: now }),
          ),
        )
      : null;

  return {
    restingHeartRate: restingHeartRate ?? null,
    stepsToday: stepsToday ?? null,
    workoutMinutesToday: workoutMinutesToday ?? null,
    sleepHoursLastNight: sleepHoursLastNight ?? null,
  };
}

/**
 * Pure: lift a SamsungHealthSnapshot into the cross-provider
 * `ProviderSnapshot` shape consumed by the aggregator.
 */
export function toProviderSnapshot(
  s: SamsungHealthSnapshot,
  fetchedAt: number,
): ProviderSnapshot {
  return {
    providerId: 'samsung_health',
    restingHeartRate: s.restingHeartRate,
    stepsToday: s.stepsToday,
    workoutMinutesToday: s.workoutMinutesToday,
    sleepHoursLastNight: s.sleepHoursLastNight,
    fetchedAt,
  };
}
