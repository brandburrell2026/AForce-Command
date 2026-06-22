/**
 * Event dispatcher — the consent-gated, idempotent client edge of the
 * INTERNAL analytics pipeline.
 *
 * Responsibilities:
 *   - Gate every emit behind consent (privacy before collection).
 *   - Stamp a well-formed, uniquely-id'd envelope per event.
 *   - Buffer envelopes in a durable local outbox so events survive
 *     app restarts and offline windows.
 *   - Flush the outbox to the server in bounded batches, dropping only
 *     events the server has acknowledged. Because ingestion is
 *     idempotent on `eventId`, a retried flush never double-counts.
 *
 * No new UI, no new navigation — this is internal plumbing. Reuses the
 * serialized write-queue pattern from `services/analytics.ts` so
 * concurrent emits cannot clobber the outbox.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

import type {
  AnalyticsEventEnvelope,
  AnalyticsEventType,
} from "@workspace/analytics-contract";

import { postAnalyticsBatch } from "@/lib/api";

import { createEnvelope } from "./event_envelope";
import { getAnalyticsId, isConsentGranted } from "./privacy_manager";

const OUTBOX_KEY = "@aforce/analytics-outbox";
/** Bound the outbox so a long offline window can't grow it unbounded. */
const MAX_OUTBOX = 500;
/** Server accepts up to 100 envelopes per batch (analyticsBatchSchema). */
const FLUSH_BATCH = 100;

let writeQueue: Promise<unknown> = Promise.resolve();
function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = writeQueue.then(task, task);
  writeQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function readOutbox(): Promise<AnalyticsEventEnvelope[]> {
  try {
    const raw = await AsyncStorage.getItem(OUTBOX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as AnalyticsEventEnvelope[]) : [];
  } catch {
    return [];
  }
}

/**
 * Persist the outbox. Returns true only when the write durably committed,
 * so a caller gating a once-ever flag (emitFirstWinConfirmed) can tell a
 * real enqueue from a swallowed storage failure.
 */
async function writeOutbox(events: AnalyticsEventEnvelope[]): Promise<boolean> {
  try {
    await AsyncStorage.setItem(OUTBOX_KEY, JSON.stringify(events.slice(-MAX_OUTBOX)));
    return true;
  } catch {
    return false; /* non-fatal */
  }
}

let flushing = false;

/**
 * Send queued events to the server. Idempotent and safe to call often;
 * overlapping calls coalesce. Only acknowledged events are removed, so
 * a failed flush leaves the outbox intact for the next attempt.
 */
export async function flush(): Promise<void> {
  if (flushing) return;
  flushing = true;
  try {
    // Snapshot the head of the outbox under the write-queue so emits
    // during the network call aren't lost.
    const batch = await enqueue(async () => {
      const outbox = await readOutbox();
      return outbox.slice(0, FLUSH_BATCH);
    });
    if (batch.length === 0) return;

    try {
      await postAnalyticsBatch(batch);
    } catch {
      // Network/server error — keep everything for a later retry.
      return;
    }

    const sentIds = new Set(batch.map((e) => e.eventId));
    await enqueue(async () => {
      const outbox = await readOutbox();
      await writeOutbox(outbox.filter((e) => !sentIds.has(e.eventId)));
    });
  } finally {
    flushing = false;
  }
}

/**
 * Emit one analytics event. No-op (and sends nothing) until consent is
 * granted. Fire-and-forget: callers should not await the network.
 *
 * `occurredAt` lets a caller stamp the event with the real time the
 * behavior happened rather than now — used when a scan is buffered
 * on-device and only flushed once consent exists, so funnel chronology
 * (e.g. qr_scanned before app_opened) stays honest. Defaults to now.
 */
export async function emit(
  eventType: AnalyticsEventType,
  payload?: Record<string, unknown>,
  occurredAt?: string,
): Promise<boolean> {
  if (!(await isConsentGranted())) return false;
  const analyticsId = await getAnalyticsId();
  if (!analyticsId) return false;

  const envelope = createEnvelope(eventType, analyticsId, payload, occurredAt);
  const queued = await enqueue(async () => {
    const outbox = await readOutbox();
    return writeOutbox([...outbox, envelope]);
  });
  // Best-effort flush; errors are swallowed and retried next emit/init.
  void flush();
  return queued;
}

/**
 * Convenience emit that stamps the platform onto `app_opened`. Kept
 * here so the recorder doesn't need to import react-native Platform.
 */
export function emitAppOpened(): Promise<boolean> {
  return emit("app_opened", { platform: Platform.OS });
}

const SESSION_DAY_KEY = "@aforce/analytics-session-day";
const FIRST_WIN_KEY = "@aforce/analytics-first-win";

/**
 * Emit `session_started` at most once per calendar day. The outbox
 * dedupes by eventId, not by meaning, so first-of-day is gated here.
 * Consent-gated like every emit.
 */
export async function emitSessionStarted(): Promise<void> {
  if (!(await isConsentGranted())) return;
  const today = new Date().toISOString().slice(0, 10);
  try {
    if ((await AsyncStorage.getItem(SESSION_DAY_KEY)) === today) return;
  } catch {
    /* fall through — better to emit than silently drop the session */
  }
  try {
    await AsyncStorage.setItem(SESSION_DAY_KEY, today);
  } catch {
    /* non-fatal */
  }
  await emit("session_started");
}

const TERRITORY_DAY_KEY = "@aforce/analytics-territory-day";

/** Engagement actions inside Territory we actually instrument. The stub
 *  Join / Challenge buttons are intentionally excluded — they have no real
 *  effect yet, so emitting them would fabricate engagement. */
export type TerritoryEngagementAction = "region_selected" | "battle_supported";

/** Collapses same-tick concurrent territory-open emits (the screen mounts
 *  can double-invoke under React StrictMode) into one in-flight attempt. Set
 *  synchronously before any await so a second caller in the same tick sees it. */
let territoryOpenInFlight = false;

/**
 * Emit `territory_opened` at most once per calendar day — the Territory
 * engagement "reach" signal. The outbox dedupes by eventId, not by meaning,
 * so first-open-of-day is gated here. Display-only telemetry: Territory is
 * gamified social, never a scoring surface, so this never touches a hydration
 * point. Consent-gated like every emit.
 *
 * Durability: the day key is burned ONLY after the emit durably queues, so a
 * failed write (no analyticsId yet / outbox error) re-emits on the next mount
 * instead of silently dropping the day's reach. The founder dashboard dedupes
 * duplicate opens per identity per day (`bool_or`), so an occasional re-emit
 * can never inflate reached users.
 */
export async function emitTerritoryOpened(): Promise<void> {
  if (territoryOpenInFlight) return;
  territoryOpenInFlight = true;
  try {
    if (!(await isConsentGranted())) return;
    const today = new Date().toISOString().slice(0, 10);
    try {
      if ((await AsyncStorage.getItem(TERRITORY_DAY_KEY)) === today) return;
    } catch {
      /* fall through — better to emit than silently drop the open */
    }
    if (await emit("territory_opened")) {
      try {
        await AsyncStorage.setItem(TERRITORY_DAY_KEY, today);
      } catch {
        /* non-fatal — a retry next mount re-emits, deduped server-side by day */
      }
    }
  } finally {
    territoryOpenInFlight = false;
  }
}

/**
 * Emit `territory_engaged` for one real, effectful Territory action
 * (inspecting a region, supporting a battle side). Emitted per action —
 * depth telemetry for the founder Command Center. Display-only: never
 * touches score. Consent-gated like every emit.
 */
export function emitTerritoryEngaged(
  action: TerritoryEngagementAction,
): Promise<boolean> {
  return emit("territory_engaged", { action });
}

/** Collapses same-tick concurrent first-win emits (the recorder fires on
 *  every win) into a single in-flight attempt. Set synchronously before any
 *  await so a second caller in the same tick sees it. */
let firstWinInFlight = false;

/**
 * Emit `first_win_confirmed` at most once, EVER — the activation funnel's
 * "First Win" milestone fires the first time the user earns any Daily Win.
 *
 * Idempotency is two-layered so the milestone is never lost OR duplicated:
 *   - the synchronous `firstWinInFlight` latch collapses same-tick
 *     concurrent calls into one emit;
 *   - the persistent flag is burned ONLY after the event is durably
 *     enqueued, so a missing analyticsId / not-yet-granted consent / failed
 *     storage write retries on a later win instead of silently dropping the
 *     user's only First Win forever.
 * Consent-gated like every emit.
 */
export async function emitFirstWinConfirmed(winId?: string): Promise<void> {
  if (firstWinInFlight) return;
  firstWinInFlight = true;
  try {
    if (!(await isConsentGranted())) return;
    try {
      if ((await AsyncStorage.getItem(FIRST_WIN_KEY)) === "1") return;
    } catch {
      /* fall through — better to emit than silently drop the milestone */
    }
    const queued = await emit(
      "first_win_confirmed",
      winId ? { winId } : undefined,
    );
    // No consent / no analyticsId / failed write — leave the flag unset so a
    // later win retries the milestone.
    if (!queued) return;
    try {
      await AsyncStorage.setItem(FIRST_WIN_KEY, "1");
    } catch {
      /* non-fatal — a future win will retry the milestone */
    }
  } finally {
    firstWinInFlight = false;
  }
}

/** Clear all queued events (used by delete-my-data). */
export async function clearOutbox(): Promise<void> {
  await enqueue(async () => {
    await writeOutbox([]);
  });
}

/** Flush any events left from a previous run. Call once on app start. */
export async function initAnalytics(): Promise<void> {
  await flush();
}
