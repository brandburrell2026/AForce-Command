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
import { scopedStorage } from '@/services/scopedStorage';
import { subscribeScopeState } from '@/services/userScope';
import { Platform } from "react-native";

import type {
  AnalyticsEventEnvelope,
  AnalyticsEventType,
} from "@workspace/analytics-contract";

import { postAnalyticsBatch } from "@/lib/api";

import {
  captureScopeToken,
  reconcile,
  resolveEmissionIdentity,
  scopeTokenStillValid,
} from "./consentAuthority";
import { createEnvelope } from "./event_envelope";
import { isConsentGranted } from "./privacy_manager";

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
    const raw = await scopedStorage.getItem(OUTBOX_KEY);
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
    await scopedStorage.setItem(OUTBOX_KEY, JSON.stringify(events.slice(-MAX_OUTBOX)));
    return true;
  } catch {
    return false; /* non-fatal */
  }
}

let flushing = false;

/**
 * Envelopes removed from the outbox without being stored.
 *
 * Counts only — no ids, no payloads, nothing that could reconstruct an event a
 * member is not being collected for. Kept because "how many did we drop" is a
 * question worth being able to answer, and explicitly NOT reported as delivery:
 * a settled envelope is one we have stopped owing, which is a different fact
 * from one the server stored.
 */
export interface SettlementCounters {
  /** Named a pseudonym this member does not own (legacy local mints). */
  foreign: number;
  /** The server's writer gate refused the batch (`inserted: 0`). */
  refused: number;
  /** The server said these are not ours (403 analytics_id_not_owned). */
  notOwned: number;
}

const settlement: SettlementCounters = { foreign: 0, refused: 0, notOwned: 0 };

/** Read the local settlement counters. Diagnostic; never sent anywhere. */
export function getSettlementCounters(): SettlementCounters {
  return { ...settlement };
}

/**
 * Send queued events to the server. Idempotent and safe to call often;
 * overlapping calls coalesce.
 *
 * ── WHY SETTLEMENT IS NOT THE SAME AS DELIVERY ─────────────────────────────
 *
 * An envelope leaves the outbox when we stop OWING it, which happens three
 * ways, only one of which is delivery:
 *
 *   stored      the server wrote it (or had already written it — that is what
 *               `deduped` counts, and it is still delivery).
 *   refused     the writer gate answered `{inserted: 0}`. It deliberately does
 *               not say why. Nothing was stored and nothing will be.
 *   not_owned   the envelopes name a pseudonym this caller does not own.
 *
 * The last two are TERMINAL, not retryable: re-POSTing a batch the gate has
 * already refused produces the same refusal on every foreground, forever. So
 * they are settled and counted — never reported as delivered, and never used to
 * infer what the member's privacy state is. A `{inserted: 0}` could mean
 * revoked, suppressed, or not-a-member, and the server refuses to distinguish
 * them precisely so that the client cannot.
 *
 * ── WHY FOREIGN ENVELOPES ARE FILTERED BEFORE SENDING ──────────────────────
 *
 * The server refuses a batch if ANY envelope names a pseudonym the caller does
 * not own. One leftover envelope from the old local mint therefore poisons
 * every batch behind it and the outbox never drains again. They are settled out
 * before the request instead. The legacy outbox KEY is untouched and the legacy
 * analytics-id key is neither read nor deleted here.
 */
export async function flush(): Promise<void> {
  if (flushing) return;
  flushing = true;
  try {
    // The gate: a server-issued pseudonym AND effective consent. No id means
    // there is nothing we are allowed to send, and nothing is sent.
    //
    // The token is captured BEFORE the gate, not after: capturing it after
    // would let a switch land between the two, pairing member A's pseudonym
    // with member B's token — and every later barrier check would then say
    // "still valid" while acting on the wrong member's id.
    const token = captureScopeToken();
    const analyticsId = await resolveEmissionIdentity();
    if (analyticsId === null) return;
    if (!scopeTokenStillValid(token)) return;

    // Snapshot the head of the outbox under the write-queue so emits during
    // the network call aren't lost, settling foreign envelopes as we go.
    const batch = await enqueue(async () => {
      const outbox = await readOutbox();
      const mine: AnalyticsEventEnvelope[] = [];
      let foreign = 0;
      for (const e of outbox) {
        if (e.analytics_id === analyticsId) mine.push(e);
        else foreign += 1;
      }
      if (foreign > 0 && scopeTokenStillValid(token)) {
        settlement.foreign += foreign;
        await writeOutbox(mine);
      }
      return mine.slice(0, FLUSH_BATCH);
    });
    if (batch.length === 0) return;

    // `postAnalyticsBatch` reports transport failure as an outcome rather than
    // throwing, but flush is fire-and-forget from `emit` — an unhandled
    // rejection here would be an unhandled rejection in the app, so the throw
    // path is still treated as "still owed".
    let result: Awaited<ReturnType<typeof postAnalyticsBatch>>;
    try {
      result = await postAnalyticsBatch(batch);
    } catch {
      return;
    }
    // The member may have changed while the request was in flight. The outbox
    // is not yet per-member, so settling now would delete the INCOMING
    // member's events against the outgoing member's answer.
    if (!scopeTokenStillValid(token)) return;
    if (result.outcome === "unavailable") return; // still owed; retry later
    if (result.outcome === "refused") settlement.refused += batch.length;
    if (result.outcome === "not_owned") settlement.notOwned += batch.length;

    const settledIds = new Set(batch.map((e) => e.eventId));
    await enqueue(async () => {
      const outbox = await readOutbox();
      await writeOutbox(outbox.filter((e) => !settledIds.has(e.eventId)));
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
  // ONE gate, ONE read. This was two calls — `isConsentGranted()` then
  // `getAnalyticsId()` — which left a window in which consent could be revoked
  // between them and an event still be stamped. Two places deciding one thing
  // is the shape of defect this repo keeps finding; the authority answers both
  // questions off a single state, and returns null unless BOTH hold: the
  // server has issued a pseudonym, and effective consent (server state with the
  // local ceiling applied) is granted.
  const analyticsId = await resolveEmissionIdentity();
  if (analyticsId === null) return false;

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
    if ((await scopedStorage.getItem(SESSION_DAY_KEY)) === today) return;
  } catch {
    /* fall through — better to emit than silently drop the session */
  }
  try {
    await scopedStorage.setItem(SESSION_DAY_KEY, today);
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
      if ((await scopedStorage.getItem(TERRITORY_DAY_KEY)) === today) return;
    } catch {
      /* fall through — better to emit than silently drop the open */
    }
    if (await emit("territory_opened")) {
      try {
        await scopedStorage.setItem(TERRITORY_DAY_KEY, today);
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

const PERF_AGE_DAY_KEY = "@aforce/analytics-perf-age-day";

/** Lifecycle status of a Performance Age™ estimate at the moment it is
 *  recorded. Only finite estimates are ever emitted, so the `missing-age`
 *  (no-number) state is excluded by construction. */
export type PerformanceAgeSnapshotStatus = "provisional" | "established";

/** Collapses same-tick concurrent perf-age snapshot emits (two surfaces read
 *  usePerformanceAge at once) into one in-flight attempt. Set synchronously
 *  before any await so a second caller in the same tick sees it. */
let perfAgeSnapshotInFlight = false;

/**
 * Emit `performance_age_snapshot` at most once per UTC day — the founder
 * Performance Age™ trend signal.
 *
 * PRIVACY (this is a derived HEALTH metric, treated more conservatively than a
 * click-count): the payload is deliberately minimal — only the years DELTA
 * (performanceAge − actualAge; negative = younger) and the estimate's lifecycle
 * status. The absolute Performance Age and the actual age are NEVER sent —
 * sending both the absolute age and the delta would let actual age be
 * reconstructed. The identity is the pseudonymous analytics id, never the Clerk
 * user id, and the founder route only ever returns k-anonymous aggregates.
 *
 * Score-Protection: display-only telemetry. It never touches a hydration point,
 * performance band, or recovery score — Performance Age is a one-way projection
 * of signals the engines already produced.
 *
 * Durability mirrors emitTerritoryOpened: the day key is burned ONLY after the
 * emit durably queues, so a failed write (no analyticsId yet / outbox error)
 * re-emits on the next mount instead of silently dropping the day. The founder
 * route dedupes per identity per UTC day, so an occasional re-emit can never
 * inflate the sample.
 */
export async function emitPerformanceAgeSnapshot(
  deltaYears: number,
  status: PerformanceAgeSnapshotStatus,
): Promise<void> {
  if (!Number.isFinite(deltaYears)) return;
  if (perfAgeSnapshotInFlight) return;
  perfAgeSnapshotInFlight = true;
  try {
    if (!(await isConsentGranted())) return;
    const today = new Date().toISOString().slice(0, 10);
    try {
      if ((await scopedStorage.getItem(PERF_AGE_DAY_KEY)) === today) return;
    } catch {
      /* fall through — better to emit than silently drop the snapshot */
    }
    if (await emit("performance_age_snapshot", { deltaYears, status })) {
      try {
        await scopedStorage.setItem(PERF_AGE_DAY_KEY, today);
      } catch {
        /* non-fatal — a retry next mount re-emits, deduped server-side by day */
      }
    }
  } finally {
    perfAgeSnapshotInFlight = false;
  }
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
      if ((await scopedStorage.getItem(FIRST_WIN_KEY)) === "1") return;
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
      await scopedStorage.setItem(FIRST_WIN_KEY, "1");
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

/**
 * Call once on app start.
 *
 * Reconcile FIRST, then flush. The order matters: after a cold start there is
 * no adopted consent state and possibly no pseudonym, so a flush that ran first
 * would send nothing and the run would be wasted. Reconciliation is also what
 * publishes a consent decision the member made while offline — including a
 * revoke, which must reach the server before any queued event does.
 */
export async function initAnalytics(): Promise<void> {
  await reconcile();
  await flush();
}

// Wave-3 PR12: reset the module-level in-flight latches on a scope change so
// USER B's session can never be blocked (or double-emit) off USER A's
// in-flight once-per-day/once-ever dedupe state.
//
// `subscribeScopeState`, NOT `subscribeUserScope`: with the isolation flag off
// the latter fires zero times on an account switch, so this reset never ran.
subscribeScopeState(() => {
  territoryOpenInFlight = false;
  perfAgeSnapshotInFlight = false;
  firstWinInFlight = false;
  flushing = false;
});
