/**
 * AForce OS — Real REST + WebSocket API client.
 *
 * Replaces the old in-memory mock service layer (deleted in Wave-2
 * PR4; protocol derivation lives on in `protocolDerivation.ts`). The api-server (see
 * `artifacts/api-server/src/routes/aforce.ts`) is the source of truth
 * for persisted user state, intake logs, confirmations, and the
 * server-side OpenWeather lookup. The scoring engine still lives on
 * the client — every response from the server gets re-fed to
 * `calculateScore` so we always render the same engineOutput shape the
 * UI was built against.
 *
 * Why keep the engine on the client:
 *   - Faster perceived response (no extra round trip for derived fields)
 *   - Lets us run the engine offline against the last known state
 *   - Avoids duplicating the engine logic on the server
 *
 * Same exported names as the old mock layer so `useAppStore` swaps in with
 * minimal churn.
 */

import type {
  UserState,
  ScoreEngineOutput,
  IntakeLog,
  IntakeEvent,
  FluidType,
  ProductFlavor,
  PulseConfig,
  JournalTimelineEntry,
  JournalRollup,
  PerformanceLevel,
  ProviderBiometrics,
} from '../types';
import type { PreparedIntake, IntakeEventWire } from '../utils/intakeOutbox';
import type { IntakeSource } from './intakeSource';
import { API_BASE } from '@/lib/apiBase';
import { normalizeProviderBiometrics } from '@workspace/health-core';
import { mergeBiometrics } from '../utils/biometricsMerge';
import { calculateScore } from '../utils/scoringEngine';
import { computeEventImpact } from './hydrationScoreService';
import { PRODUCTS } from '../data/products';
import { defaultUserState } from '../data/mockData';
import { getAuthHeaders, getAuthToken } from './authToken';

// ─── Base URL resolution ─────────────────────────────────────────────────────
// Wave-3 PR1: the canonical resolver lives in lib/apiBase (one copy for the
// whole app — this module previously carried one of five duplicates).

const AFORCE_BASE = `${API_BASE}/aforce`;

// ─── Server row → UserState normalization ────────────────────────────────────
// The Postgres row returns ISO date strings + nullable fields; the rest
// of the app expects `Date` instances. Centralize the conversion so the
// store never has to know the wire format.
/**
 * Coerce the server's `biometrics` jsonb blob into `ProviderBiometrics`.
 *
 * The backend fetch workers (WHOOP today) write one entry per provider under
 * `aforce_user_state.biometrics`, each already `ProviderSnapshot`-shaped
 * (`providerId` + numeric `fetchedAt` + metrics). We keep only well-formed
 * entries and re-stamp `providerId` from the key so a malformed blob can never
 * poison the score. Returns undefined when there's nothing usable.
 */
export function normalizeBiometrics(raw: unknown): ProviderBiometrics | undefined {
  // THE normalization boundary (health-core): preserves the original
  // semantics (well-formed entries only, providerId re-stamped from the key)
  // and additionally resolves shipped provider shape drift — Garmin `hrvMs` →
  // `hrvRmssdMs`, `stress` → `stressScore` — and populates the honest HRV
  // fields (`hrvRmssdMs`/`hrvSdnnMs`) via explicit per-provider translation.
  // Legacy `hrvSdnn` passes through byte-identical for compatibility.
  return normalizeProviderBiometrics(raw);
}

export function normalizeUserState(row: Record<string, unknown>): UserState {
  const get = <T>(k: string): T => row[k] as T;
  const dateOrNull = (k: string): Date | null => {
    const v = row[k];
    if (v == null) return null;
    return new Date(v as string);
  };
  const dateOrUndef = (k: string): Date | undefined => {
    const v = row[k];
    if (v == null) return undefined;
    return new Date(v as string);
  };
  const numOrNull = (k: string): number | null => {
    const v = row[k];
    return v == null ? null : Number(v);
  };

  return {
    unitsConsumedToday: Number(get('unitsConsumedToday') ?? 0),
    ozConsumedToday: Number(get('ozConsumedToday') ?? 0),
    aforceUnitsToday: Number(get('aforceUnitsToday') ?? 0),
    lastIntakeTime: dateOrNull('lastIntakeTime') ?? new Date() /* W3-PR10 residual: a null here
      requires nullable lastIntakeTime through the SCORING ENGINE (decay math)
      — founder decision; see the Wave-3 report */,
    lastIntakeType: (get<FluidType>('lastIntakeType') ?? 'water') as FluidType,
    symptomState: (get<UserState['symptomState']>('symptomState') ?? 'none'),
    symptoms: (get<string[]>('symptoms') ?? []),
    urineSignal: Number(get('urineSignal') ?? 3),
    energyState: (get<UserState['energyState']>('energyState') ?? 'steady'),
    heatLoad: Number(get('heatLoad') ?? 4),
    sweatRate: Number(get('sweatRate') ?? 3),
    activityLevel: Number(get('activityLevel') ?? 5),
    complianceStreak: Number(get('complianceStreak') ?? 0),
    dailyTarget: Number(get('dailyTarget') ?? 8),
    ozTarget: Number(get('ozTarget') ?? 96),
    isSnoozed: Boolean(get('isSnoozed')),
    snoozeUntil: dateOrNull('snoozeUntil'),
    bodyWeightLbs: Number(get('bodyWeightLbs') ?? 180),
    isAwake: Boolean(get('isAwake') ?? true),
    wakeTime: dateOrNull('wakeTime'),
    overnightLossOz: Number(get('overnightLossOz') ?? 0),
    hasSeenMorningCommand: Boolean(get('hasSeenMorningCommand')),
    appleHealth: get<UserState['appleHealth']>('appleHealth') ?? undefined,
    confirmationDelta: numOrNull('confirmationDelta') ?? undefined,
    confirmationDeltaSetAt: dateOrUndef('confirmationDeltaSetAt'),
    clutchDecayBoostUntil: dateOrUndef('clutchDecayBoostUntil'),
    clutchActive: Boolean(get('clutchActive')),
    weatherTempC: numOrNull('weatherTempC'),
    weatherHumidity: numOrNull('weatherHumidity'),
    weatherCity: (get<string | null>('weatherCity') ?? null),
    weatherFetchedAt: row['weatherFetchedAt'] ? new Date(row['weatherFetchedAt'] as string).getTime() : null,
    language: ((get<string>('language') ?? 'en') as UserState['language']),
    intakeEvents: normalizeIntakeEvents(row['intakeEvents']),
    socialMode: normalizeSocialMode(row['socialMode']),
    // Server-fetched provider biometrics (e.g. WHOOP). Previously dropped as
    // "client-only"; the backend now persists them, so carry them through and
    // let the freshest-wins merge reconcile with any client-owned snapshots.
    biometrics: normalizeBiometrics(row['biometrics']),
  };
}

function normalizeIntakeEvents(raw: unknown): UserState['intakeEvents'] {
  if (!Array.isArray(raw)) return [];
  return raw.map((r) => {
    const e = r as Record<string, unknown>;
    return {
      id: String(e['id'] ?? `evt-${Math.random().toString(36).slice(2)}`),
      fluidType: (e['fluidType'] as FluidType) ?? 'water',
      ...(e['flavor'] != null ? { flavor: e['flavor'] as ProductFlavor } : {}),
      oz: Number(e['oz'] ?? 12),
      loggedAt: e['loggedAt'] ? new Date(e['loggedAt'] as string) : new Date(),
      baseImpact: Number(e['baseImpact'] ?? 0),
      capAdjusted: Number(e['capAdjusted'] ?? 0),
      immediate: Number(e['immediate'] ?? 0),
      delayed: Number(e['delayed'] ?? 0),
      delayedDurationMin: Number(e['delayedDurationMin'] ?? 25),
      heatGuardActiveAtLog: Boolean(e['heatGuardActiveAtLog']),
      scoreBeforeAtLog: Number(e['scoreBeforeAtLog'] ?? 0),
    };
  });
}

function normalizeSocialMode(raw: unknown): UserState['socialMode'] {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const drinks = Array.isArray(r['drinks']) ? r['drinks'] : [];
  return {
    active: Boolean(r['active']),
    startedAt: r['startedAt'] ? new Date(r['startedAt'] as string) : new Date(),
    drinks: drinks.map((d) => {
      const x = d as Record<string, unknown>;
      const abvRaw = x['abv'];
      const ozRaw = x['oz'];
      return {
        id: String(x['id'] ?? `drink-${Math.random().toString(36).slice(2)}`),
        type: (x['type'] as 'beer' | 'wine' | 'cocktail' | 'liquor' | 'hard_seltzer' | 'custom') ?? 'custom',
        loggedAt: x['loggedAt'] ? new Date(x['loggedAt'] as string) : new Date(),
        multiplier: Number(x['multiplier'] ?? 1.25),
        hydrated: x['hydrated'] == null ? null : Boolean(x['hydrated']),
        ...(abvRaw != null ? { abv: Number(abvRaw) } : {}),
        ...(ozRaw != null ? { oz: Number(ozRaw) } : {}),
      };
    }),
    lastHydrationPromptAt: r['lastHydrationPromptAt'] ? new Date(r['lastHydrationPromptAt'] as string) : undefined,
    endedAt: r['endedAt'] ? new Date(r['endedAt'] as string) : undefined,
    ...(r['sex'] === 'male' || r['sex'] === 'female' || r['sex'] === 'unspecified'
      ? { sex: r['sex'] as 'male' | 'female' | 'unspecified' }
      : {}),
    ...(typeof r['ateRecently'] === 'boolean' ? { ateRecently: r['ateRecently'] } : {}),
    // Chunk #4: Recovery preset round-trip. Strict allow-list — any
    // unknown value coming back from the server (or a stale persisted
    // row from an older client) collapses to null so we never inject
    // garbage into the environmental-stress floor calc downstream.
    ...(r['preset'] === 'travel' || r['preset'] === 'heat' || r['preset'] === 'hard_block'
      ? { preset: r['preset'] as 'travel' | 'heat' | 'hard_block' }
      : {}),
    // Chunk #5: Cruise Mode + Voyage Shield round-trip. ISO strings on
    // the wire → Date in client state. Invalid values are dropped so a
    // bad row never leaks into `isModifierActive`.
    ...(typeof r['cruiseUntil'] === 'string' && !Number.isNaN(Date.parse(r['cruiseUntil']))
      ? { cruiseUntil: new Date(r['cruiseUntil']) }
      : {}),
    ...(typeof r['voyageShieldUntil'] === 'string' && !Number.isNaN(Date.parse(r['voyageShieldUntil']))
      ? { voyageShieldUntil: new Date(r['voyageShieldUntil']) }
      : {}),
  };
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const auth = await getAuthHeaders();
  const res = await fetch(`${AFORCE_BASE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...auth },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} → ${res.status}`);
  return (await res.json()) as T;
}

async function getJson<T>(path: string): Promise<T> {
  const auth = await getAuthHeaders();
  const res = await fetch(`${AFORCE_BASE}${path}`, { headers: auth });
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  return (await res.json()) as T;
}

// ─── GET /home (compat shim over /state) ─────────────────────────────────────
export interface HomePayload {
  engineOutput: ScoreEngineOutput;
  userState: UserState;
  serverTime: string | null;
  /** Wave-3 PR10: true when the server was unreachable and this is the
   *  caller's own last state echoed back. serverTime is null in that case. */
  stale?: boolean;
}

let lastKnownState: UserState = defaultUserState;

/**
 * Read the server-side provider biometrics blob DIRECTLY (before the
 * client-owned merge). Used to pull a server-fetched provider snapshot (WHOOP,
 * written by the backend) into the client store right after connect/sync — so
 * the card reflects it immediately instead of waiting for the next full state
 * sync (and without the client-keys merge dropping a key the client hasn't
 * seeded yet). Returns undefined on any failure — never throws.
 */
export async function fetchServerBiometrics(): Promise<ProviderBiometrics | undefined> {
  try {
    const { userState: row } = await getJson<{ userState: Record<string, unknown> }>('/state');
    return normalizeBiometrics(row['biometrics']);
  } catch (err) {
    console.warn('[AForce] fetchServerBiometrics failed', err);
    return undefined;
  }
}

export async function fetchHome(userState: UserState): Promise<HomePayload> {
  // Push any client-side mutations (clutchActive flag, appleHealth,
  // biometrics) forward by merging them onto whatever the server
  // returns. The server is the source of truth for everything else.
  try {
    const { userState: row, serverTime } = await getJson<{ userState: Record<string, unknown>; serverTime: string }>('/state');
    const normalized = normalizeUserState(row);
    const merged: UserState = {
      ...normalized,
      // appleHealth is client-only (on-device HealthKit); preserve it so a
      // server round-trip never erases it.
      appleHealth: userState.appleHealth ?? normalized.appleHealth,
      // biometrics: the backend now persists server-fetched provider snapshots
      // (WHOOP) AND the client holds on-device / demo ones. Merge freshest-wins
      // so real server data flows in and can't freeze behind a stale local copy.
      biometrics: mergeBiometrics(normalized.biometrics, userState.biometrics),
    };
    lastKnownState = merged;
    return { engineOutput: calculateScore(merged), userState: merged, serverTime };
  } catch (err) {
    // Wave-3 PR10: network down — keep the UI alive with the LAST state,
    // but say so. `stale: true` + a null serverTime replace the old
    // fabricated success envelope (which minted a fresh server clock for
    // a server that was never reached — no caller could tell truth from
    // fallback).
    console.warn('[AForce] fetchHome failed, falling back (stale)', err);
    return {
      engineOutput: calculateScore(userState),
      userState,
      serverTime: null,
      stale: true,
    };
  }
}

// ─── POST /intake ────────────────────────────────────────────────────────────
export interface IntakeLogPayload {
  fluidType: FluidType;
  ozAmount?: number;
  /** Optional flavor — required for AForce flavored bonuses. */
  flavor?: ProductFlavor;
  /**
   * Which surface created this intake. Record-only provenance: it never affects
   * scoring, dedupe or persistence, and exists so a duplicate can be attributed
   * to a surface from data instead of a code audit.
   */
  entrySource?: IntakeSource;
}
export interface IntakeLogResponse {
  log: IntakeLog;
  newUserState: UserState;
  engineOutput: ScoreEngineOutput;
}

/**
 * The frozen result of `prepareIntake` — everything needed to EITHER send the
 * intake now OR durably queue it for offline replay. Captured once so the same
 * bytes (and the same frozen `scoreBefore`/`scoreAfter`) are used on both paths.
 * `outbox` is the wire-replayable payload; `optimisticUserState` is the local
 * projection used to keep the UI coherent before the server confirms.
 */
export interface PreparedIntakeBundle {
  outbox: PreparedIntake;
  /** Client-shape event (Date `loggedAt`) for building the optimistic log/history. */
  event: IntakeEvent;
  fluidType: FluidType;
  ozAmount: number;
  scoreBefore: number;
  scoreAfter: number;
  optimisticUserState: UserState;
}

/**
 * Pure-ish, network-free preparation of one intake: computes the per-event
 * hydration impact, builds the event, the optimistic post-intake state, and the
 * frozen scoreBefore/scoreAfter — and mints an explicit `clientEventId`
 * idempotency key (distinct from `event.id`). No I/O, so it is safe to call and
 * then queue if the device is offline. Score-Protection: the frozen scores are
 * derived from the user's completed action right here; later replay carries them
 * verbatim and never recomputes.
 */
export function prepareIntake(
  userState: UserState,
  body: IntakeLogPayload,
): PreparedIntakeBundle {
  const product = PRODUCTS[body.fluidType];
  const ozAmount = body.ozAmount ?? product.ozPerServing;
  const flavor = body.flavor ?? product.flavor;
  const now = new Date();
  // Pre-compute the per-event hydration impact so the score moves
  // immediately and the event is reproducible server-side.
  const beforeOutput = calculateScore(userState);
  const scoreBefore = beforeOutput.score;
  // Heat Guard active proxy: use the same heatLoad threshold that
  // already drives the engine's heat-context penalty (>= 6). This
  // avoids a second evaluateHeatRisk pass on every intake while still
  // matching the user-visible "Heat Guard ON" surface.
  const heatGuardActive = (userState.heatLoad ?? 0) >= 6;
  const impact = computeEventImpact(
    body.fluidType,
    flavor,
    ozAmount,
    userState.intakeEvents ?? [],
    now,
    { heatGuardActive, scoreBefore },
  );
  const event: IntakeEvent = {
    id: `evt-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
    fluidType: body.fluidType,
    ...(flavor ? { flavor } : {}),
    oz: ozAmount,
    loggedAt: now,
    baseImpact: impact.baseImpact,
    capAdjusted: impact.capAdjusted,
    immediate: impact.immediate,
    delayed: impact.delayed,
    delayedDurationMin: impact.delayedDurationMin,
    heatGuardActiveAtLog: heatGuardActive,
    scoreBeforeAtLog: scoreBefore,
  };
  // Compute the optimistic post-intake state so we can report scoreAfter
  // truthfully without a second round trip.
  const optimistic: UserState = {
    ...userState,
    unitsConsumedToday: userState.unitsConsumedToday + 1,
    ozConsumedToday: userState.ozConsumedToday + ozAmount,
    aforceUnitsToday: userState.aforceUnitsToday + (body.fluidType.startsWith('aforce_') ? 1 : 0),
    lastIntakeTime: now,
    lastIntakeType: body.fluidType,
    intakeEvents: [...(userState.intakeEvents ?? []), event],
  };
  const scoreAfter = calculateScore(optimistic).score;
  // Serialize the event for the wire (Date -> ISO).
  const eventWire: IntakeEventWire = { ...event, loggedAt: event.loggedAt.toISOString() };
  // Explicit idempotency key for the server's NULLS-DISTINCT unique index,
  // distinct from event.id so the dedupe contract is independent of payload id.
  const clientEventId = `cid-${now.getTime()}-${Math.random().toString(36).slice(2, 10)}`;
  return {
    outbox: {
      clientEventId,
      fluidType: body.fluidType,
      ozAmount,
      scoreBefore,
      scoreAfter,
      event: eventWire,
      // Frozen with the payload so a replay reports the ORIGINATING surface.
      ...(body.entrySource ? { entrySource: body.entrySource } : {}),
    },
    event,
    fluidType: body.fluidType,
    ozAmount,
    scoreBefore,
    scoreAfter,
    optimisticUserState: optimistic,
  };
}

/**
 * Send a prepared intake to the server and normalize the response into the same
 * `IntakeLogResponse` shape `postIntakeLog` always returned.
 *
 * `withClientEventId` controls whether the idempotency key rides on the wire:
 * the legacy/online `postIntakeLog` path leaves it OFF so the request body is
 * byte-identical to before (the server's NULLS-DISTINCT index never dedupes a
 * keyless write); the offline-outbox replay path turns it ON so a retried send
 * is deduped server-side and can never double-apply.
 */
export async function sendPreparedIntake(
  prepared: PreparedIntakeBundle,
  preserve: Pick<UserState, 'appleHealth' | 'biometrics'>,
  opts: { withClientEventId?: boolean } = {},
): Promise<IntakeLogResponse> {
  const { outbox } = prepared;
  const resp = await postJson<{ userState: Record<string, unknown>; log: { id: number; loggedAt: string } }>(
    '/intake',
    {
      fluidType: prepared.fluidType,
      ozAmount: prepared.ozAmount,
      scoreBefore: prepared.scoreBefore,
      scoreAfter: prepared.scoreAfter,
      event: outbox.event,
      ...(outbox.entrySource ? { entrySource: outbox.entrySource } : {}),
      ...(opts.withClientEventId ? { clientEventId: outbox.clientEventId } : {}),
    },
  );
  const normalized = normalizeUserState(resp.userState);
  const newUserState: UserState = {
    ...normalized,
    appleHealth: preserve.appleHealth ?? normalized.appleHealth,
    biometrics: mergeBiometrics(normalized.biometrics, preserve.biometrics),
  };
  lastKnownState = newUserState;
  const log: IntakeLog = {
    id: `intake-${resp.log.id}`,
    fluidType: prepared.fluidType,
    ozAmount: prepared.ozAmount,
    loggedAt: new Date(resp.log.loggedAt),
    scoreBefore: prepared.scoreBefore,
    scoreAfter: prepared.scoreAfter,
  };
  return { log, newUserState, engineOutput: calculateScore(newUserState) };
}

/**
 * Replay a previously-queued (offline) intake. Fires the SAME frozen wire
 * payload — including its `clientEventId` — so the server applies it exactly
 * once: a duplicate replay (already-landed key) returns the current state
 * untouched, and a stale event (>24h) is persisted as a historical log without
 * inflating today's counters. We deliberately ignore the response body here —
 * the caller reconciles to authoritative server truth via `fetchHome` only once
 * the queue is fully drained, so there is no optimistic/server double-apply.
 */
export async function replayPreparedIntake(prepared: PreparedIntake): Promise<void> {
  await postJson<{ userState: Record<string, unknown>; log: { id: number; loggedAt: string } }>(
    '/intake',
    {
      fluidType: prepared.fluidType,
      ozAmount: prepared.ozAmount,
      scoreBefore: prepared.scoreBefore,
      scoreAfter: prepared.scoreAfter,
      event: prepared.event,
      // The originating surface, not "offline_replay": provenance must survive
      // queueing, or the timeline loses the surface exactly when it matters.
      ...(prepared.entrySource ? { entrySource: prepared.entrySource } : {}),
      clientEventId: prepared.clientEventId,
    },
  );
}

/**
 * True when a failed send means we never reached the server (offline / DNS /
 * timeout / auth-token fetch failure) and the intake is therefore safe to queue
 * for replay. A real server RESPONSE — even an error status — is NOT offline:
 * `postJson` encodes those as `POST <path> → <status>`, so anything carrying a
 * 3-digit status is treated as a genuine rejection and must surface as a
 * failure (never optimistically "succeeded").
 */
export function isOfflineError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return !/→\s*\d{3}\b/.test(msg);
}

export async function postIntakeLog(
  userState: UserState,
  body: IntakeLogPayload,
): Promise<IntakeLogResponse> {
  const prepared = prepareIntake(userState, body);
  // RC-L12 (§10): the online path now sends the idempotency key too, so a
  // double-fired tap dedupes server-side ((userId, clientEventId) unique
  // index) instead of double-counting. Server treats the key as optional, so
  // this stays wire-compatible in both directions.
  return sendPreparedIntake(
    prepared,
    {
      ...(userState.appleHealth ? { appleHealth: userState.appleHealth } : {}),
      ...(userState.biometrics ? { biometrics: userState.biometrics } : {}),
    },
    { withClientEventId: true },
  );
}

// ─── POST /signals ───────────────────────────────────────────────────────────
async function postAndRecompute(
  path: string,
  body: unknown,
  preserve: Pick<UserState, 'appleHealth' | 'biometrics'>,
): Promise<{ newUserState: UserState; engineOutput: ScoreEngineOutput }> {
  const resp = await postJson<{ userState: Record<string, unknown> }>(path, body);
  const normalized = normalizeUserState(resp.userState);
  // appleHealth + biometrics are client-only (sourced from HealthKit
  // on-device + provider OAuth, never persisted server-side yet).
  // Server-owned fields (including clutchActive after the T6 swap) flow
  // through unchanged so multi-device & WS pushes stay consistent.
  const newUserState: UserState = {
    ...normalized,
    appleHealth: preserve.appleHealth ?? normalized.appleHealth,
    biometrics: mergeBiometrics(normalized.biometrics, preserve.biometrics),
  };
  lastKnownState = newUserState;
  return { newUserState, engineOutput: calculateScore(newUserState) };
}

export function postSignalsUpdate(userState: UserState, symptoms: string[]) {
  return postAndRecompute('/signals', { symptoms }, userState);
}
export function postUrineSignalUpdate(userState: UserState, urineSignal: number) {
  return postAndRecompute('/urine', { urineSignal }, userState);
}
export function postEnergyStateUpdate(userState: UserState, energyState: UserState['energyState']) {
  return postAndRecompute('/energy', { energyState }, userState);
}
export function postCheckin(userState: UserState) {
  return postAndRecompute('/checkin', {}, userState);
}
export function postClutchFlag(userState: UserState, clutchActive: boolean) {
  return postAndRecompute('/flags', { clutchActive }, userState);
}
/**
 * Persist the user's chosen UI language. Server stores it on the
 * userState row so a fresh device reload picks up the right locale
 * before i18n auto-detects from `expo-localization`.
 */
export function postLanguage(userState: UserState, language: UserState['language']) {
  return postAndRecompute('/language', { language }, userState);
}
export function postSocialActivate(
  userState: UserState,
  preset?: 'travel' | 'heat' | 'hard_block' | null,
) {
  return postAndRecompute('/social/activate', preset ? { preset } : {}, userState);
}
export function postSocialDrink(
  userState: UserState,
  type: 'beer' | 'wine' | 'cocktail' | 'liquor' | 'hard_seltzer' | 'custom',
  opts: { abv?: number; oz?: number } = {},
) {
  return postAndRecompute('/social/drink', { type, ...opts }, userState);
}
export function postSocialHydrate(userState: UserState, confirmed: boolean) {
  return postAndRecompute('/social/hydrate', { confirmed }, userState);
}
export function postSocialDeactivate(userState: UserState) {
  return postAndRecompute('/social/deactivate', {}, userState);
}
/** Chunk #5: engage Cruise Mode — extends recovery window 8h → 24h. */
export function postSocialCruise(userState: UserState) {
  return postAndRecompute('/social/cruise', {}, userState);
}
/** Chunk #5: engage Voyage Shield — floors Recovery score at 60 for 12h. */
export function postSocialShield(userState: UserState) {
  return postAndRecompute('/social/shield', {}, userState);
}
export function postSocialContext(
  userState: UserState,
  ctx: { sex?: 'male' | 'female' | 'unspecified'; ateRecently?: boolean },
) {
  return postAndRecompute('/social/context', ctx, userState);
}
export function postConfirmCommand(userState: UserState, followed: boolean) {
  // inClutch is read from the server state by the route, but we send
  // the client's view as a hint so the server can short-circuit if the
  // flag flipped between requests.
  const inClutch = !!userState.clutchActive;
  return postAndRecompute('/confirm', { followed, inClutch }, userState);
}

export function fetchPulseConfig(userState: UserState): Promise<PulseConfig> {
  return Promise.resolve(calculateScore(userState).pulseConfig);
}

// ─── Weather refresh (server-side OpenWeather) ────────────────────────────────
export async function refreshWeather(
  userState: UserState,
  lat: number,
  lon: number,
): Promise<{ newUserState: UserState; engineOutput: ScoreEngineOutput }> {
  try {
    const resp = await getJson<{ userState: Record<string, unknown> }>(
      `/weather?lat=${lat}&lon=${lon}`,
    );
    const normalized = normalizeUserState(resp.userState);
    const newUserState: UserState = {
      ...normalized,
      appleHealth: userState.appleHealth ?? normalized.appleHealth,
      ...(userState.biometrics ? { biometrics: userState.biometrics } : {}),
    };
    lastKnownState = newUserState;
    return { newUserState, engineOutput: calculateScore(newUserState) };
  } catch (err) {
    console.warn('[AForce] refreshWeather failed', err);
    return { newUserState: userState, engineOutput: calculateScore(userState) };
  }
}

// ─── Live updates over WebSocket ─────────────────────────────────────────────
/**
 * Subscribe to live state pushes from the api-server. Returns an
 * unsubscribe function. The callback receives a freshly normalized
 * UserState; transient client-only fields (clutchActive, appleHealth)
 * are merged from `getOverlay` so flag flips and Apple Health snapshots
 * survive a server push.
 */
export function subscribeToStateUpdates(
  onState: (state: UserState) => void,
  getOverlay: () => Pick<UserState, 'appleHealth' | 'biometrics'>,
): () => void {
  const wsBase = AFORCE_BASE.replace(/^http/, 'ws');

  let ws: WebSocket | null = null;
  let closed = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let attempt = 0;

  const connect = async () => {
    if (closed) return;
    // Refresh the Clerk token on every (re)connect so a long-lived
    // session doesn't drift past the JWT expiry between reconnects.
    const token = await getAuthToken();
    const url = token
      ? `${wsBase}/ws?token=${encodeURIComponent(token)}`
      : `${wsBase}/ws?user=default`;
    try {
      ws = new WebSocket(url);
    } catch (err) {
      console.warn('[AForce] ws construct failed', err);
      schedule();
      return;
    }
    ws.onopen = () => { attempt = 0; };
    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(typeof evt.data === 'string' ? evt.data : '{}');
        if (msg.type === 'state' && msg.userState) {
          const overlay = getOverlay();
          const normalized = normalizeUserState(msg.userState);
          const next: UserState = {
            ...normalized,
            // appleHealth + biometrics are purely client-side (HealthKit
            // on-device + provider OAuth snapshots). Everything else
            // (including clutchActive) is server-owned.
            appleHealth: overlay.appleHealth ?? normalized.appleHealth,
            ...(overlay.biometrics ? { biometrics: overlay.biometrics } : {}),
          };
          lastKnownState = next;
          onState(next);
        }
      } catch (err) {
        console.warn('[AForce] ws message parse failed', err);
      }
    };
    ws.onerror = () => { /* swallow — onclose handles reconnect */ };
    ws.onclose = () => {
      ws = null;
      schedule();
    };
  };

  const schedule = () => {
    if (closed) return;
    if (reconnectTimer) return;
    // Exponential backoff capped at 15s.
    const delay = Math.min(15000, 500 * 2 ** attempt);
    attempt += 1;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, delay);
  };

  connect();

  return () => {
    closed = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (ws) {
      try { ws.close(); } catch { /* ignore */ }
    }
  };
}

export function getLastKnownState(): UserState {
  return lastKnownState;
}

// ─── Hydration Journal ───────────────────────────────────────────────────────
/**
 * Persist a single score snapshot. Called from the store's snapshot
 * writer effect — debounced to ~5 min (or on band change) so we don't
 * flood the table. Errors are swallowed by the caller.
 */
export interface JournalSnapshotPayload {
  score: number;
  /**
   * Per-factor score deltas at write time ({id: delta} plus `raw`/`clamped`).
   * Deltas only — never labels or weights. Optional so older callers and
   * pre-instrumentation replays stay wire-compatible.
   */
  factorDeltas?: Record<string, number>;
  level: PerformanceLevel;
  ozConsumedToday: number;
  aforceUnitsToday: number;
  unitsConsumedToday: number;
  sodiumDeliveredMg: number;
  sodiumLostMg: number;
  deficitPct: number;
  clutchActive: boolean;
  socialActive: boolean;
  autopilotActive: boolean;
  reason: string;
  /** Recovery Layer — only sent when `spec_recovery` is on. */
  recoveryScore?: number;
  pressureScore?: number;
  recoveryTrend?: 'rising' | 'stable' | 'declining';
  recoveryFingerprint?: string;
  recoveryStory?: string;
}

export async function postJournalSnapshot(payload: JournalSnapshotPayload): Promise<void> {
  await postJson<{ snapshot: unknown }>('/journal/snapshot', payload);
}

export async function fetchJournalTimeline(days: number): Promise<JournalTimelineEntry[]> {
  const resp = await getJson<{ entries: JournalTimelineEntry[] }>(`/journal/timeline?days=${days}`);
  return resp.entries ?? [];
}

export async function fetchJournalRollups(days: number): Promise<JournalRollup[]> {
  const resp = await getJson<{ rollups: JournalRollup[] }>(`/journal/rollups?days=${days}`);
  return resp.rollups ?? [];
}

// ─── Sweat-sensor import ─────────────────────────────────────────────────────
import type { SensorRow, SensorSource } from './sensorImportService';
import type { AchievementCode, AchievementUnlockState } from './achievementsCatalog';

export interface SensorImportPayload {
  source: SensorSource;
  rows: SensorRow[];
}
export interface SensorImportResponse {
  imported: number;
  source: SensorSource;
  reason: string;
}

export async function postSensorImport(payload: SensorImportPayload): Promise<SensorImportResponse> {
  return postJson<SensorImportResponse>('/sensors/import', payload);
}

// ─── Achievements ────────────────────────────────────────────────────────────
export interface AchievementsResponse { unlocks: AchievementUnlockState[] }

export async function fetchAchievements(): Promise<AchievementsResponse> {
  return getJson<AchievementsResponse>('/achievements');
}

export interface UnlockResponse {
  code: AchievementCode;
  unlocked: true;
  newlyUnlocked: boolean;
}

export async function unlockAchievement(code: AchievementCode): Promise<UnlockResponse> {
  return postJson<UnlockResponse>('/achievements/unlock', { code });
}
