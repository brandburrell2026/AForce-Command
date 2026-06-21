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

async function writeOutbox(events: AnalyticsEventEnvelope[]): Promise<void> {
  try {
    await AsyncStorage.setItem(OUTBOX_KEY, JSON.stringify(events.slice(-MAX_OUTBOX)));
  } catch {
    /* non-fatal */
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
): Promise<void> {
  if (!(await isConsentGranted())) return;
  const analyticsId = await getAnalyticsId();
  if (!analyticsId) return;

  const envelope = createEnvelope(eventType, analyticsId, payload, occurredAt);
  await enqueue(async () => {
    const outbox = await readOutbox();
    await writeOutbox([...outbox, envelope]);
  });
  // Best-effort flush; errors are swallowed and retried next emit/init.
  void flush();
}

/**
 * Convenience emit that stamps the platform onto `app_opened`. Kept
 * here so the recorder doesn't need to import react-native Platform.
 */
export function emitAppOpened(): Promise<void> {
  return emit("app_opened", { platform: Platform.OS });
}

const SESSION_DAY_KEY = "@aforce/analytics-session-day";

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
