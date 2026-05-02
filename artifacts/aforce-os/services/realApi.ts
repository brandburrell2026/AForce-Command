/**
 * AForce OS — Real REST + WebSocket API client.
 *
 * Replaces the in-memory `mockApi.ts`. The api-server (see
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
 * Same exported names as `mockApi.ts` so `useAppStore` swaps in with
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
} from '../types';
import { calculateScore } from '../utils/scoringEngine';
import { computeEventImpact } from './hydrationScoreService';
import { PRODUCTS } from '../data/products';
import { defaultUserState } from '../data/mockData';
import { getAuthHeaders, getAuthToken } from './authToken';

// ─── Base URL resolution ─────────────────────────────────────────────────────
// In dev, EXPO_PUBLIC_DOMAIN is set to REPLIT_DEV_DOMAIN by package.json's
// dev script. The api-server is mounted at `/api`. In production builds
// you can override with EXPO_PUBLIC_API_BASE.
function resolveApiBase(): string {
  const explicit = process.env['EXPO_PUBLIC_API_BASE'];
  if (explicit) return explicit.replace(/\/$/, '');
  const domain = process.env['EXPO_PUBLIC_DOMAIN'];
  if (domain) return `https://${domain}/api`;
  // Last-resort fallback: same origin (web preview).
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/api`;
  }
  return '/api';
}

const API_BASE = resolveApiBase();
const AFORCE_BASE = `${API_BASE}/aforce`;

// ─── Server row → UserState normalization ────────────────────────────────────
// The Postgres row returns ISO date strings + nullable fields; the rest
// of the app expects `Date` instances. Centralize the conversion so the
// store never has to know the wire format.
function normalizeUserState(row: Record<string, unknown>): UserState {
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
    lastIntakeTime: dateOrNull('lastIntakeTime') ?? new Date(),
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
  serverTime: string;
}

let lastKnownState: UserState = defaultUserState;

export async function fetchHome(userState: UserState): Promise<HomePayload> {
  // Push any client-side mutations (clutchActive flag, appleHealth,
  // biometrics) forward by merging them onto whatever the server
  // returns. The server is the source of truth for everything else.
  try {
    const { userState: row, serverTime } = await getJson<{ userState: Record<string, unknown>; serverTime: string }>('/state');
    const normalized = normalizeUserState(row);
    const merged: UserState = {
      ...normalized,
      // appleHealth + biometrics are client-only (sourced from on-device
      // HealthKit + provider OAuth). The server doesn't persist them
      // (yet), so without preserving here, every server round-trip
      // would erase the score contribution from connected platforms.
      appleHealth: userState.appleHealth ?? normalized.appleHealth,
      ...(userState.biometrics ? { biometrics: userState.biometrics } : {}),
    };
    lastKnownState = merged;
    return { engineOutput: calculateScore(merged), userState: merged, serverTime };
  } catch (err) {
    // Network down — keep the UI alive with the last state we had,
    // recomputed against `now` so decay continues to tick locally.
    console.warn('[AForce] fetchHome failed, falling back', err);
    return {
      engineOutput: calculateScore(userState),
      userState,
      serverTime: new Date().toISOString(),
    };
  }
}

// ─── POST /intake ────────────────────────────────────────────────────────────
export interface IntakeLogPayload {
  fluidType: FluidType;
  ozAmount?: number;
  /** Optional flavor — required for AForce flavored bonuses. */
  flavor?: ProductFlavor;
}
export interface IntakeLogResponse {
  log: IntakeLog;
  newUserState: UserState;
  engineOutput: ScoreEngineOutput;
}

export async function postIntakeLog(
  userState: UserState,
  body: IntakeLogPayload,
): Promise<IntakeLogResponse> {
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
  const eventWire = { ...event, loggedAt: event.loggedAt.toISOString() };
  const resp = await postJson<{ userState: Record<string, unknown>; log: { id: number; loggedAt: string } }>(
    '/intake',
    { fluidType: body.fluidType, ozAmount, scoreBefore, scoreAfter, event: eventWire },
  );
  const normalized = normalizeUserState(resp.userState);
  const newUserState: UserState = {
    ...normalized,
    appleHealth: userState.appleHealth ?? normalized.appleHealth,
    ...(userState.biometrics ? { biometrics: userState.biometrics } : {}),
  };
  lastKnownState = newUserState;
  const log: IntakeLog = {
    id: `intake-${resp.log.id}`,
    fluidType: body.fluidType,
    ozAmount,
    loggedAt: new Date(resp.log.loggedAt),
    scoreBefore,
    scoreAfter,
  };
  return { log, newUserState, engineOutput: calculateScore(newUserState) };
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
    ...(preserve.biometrics ? { biometrics: preserve.biometrics } : {}),
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
export function postSocialActivate(userState: UserState) {
  return postAndRecompute('/social/activate', {}, userState);
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
