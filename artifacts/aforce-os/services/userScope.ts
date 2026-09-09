/**
 * userScope — the ONE authority for "who is this device acting as right now",
 * and the namespace that answer implies for durable personal data.
 *
 * ── WHY THIS WAS REWRITTEN ─────────────────────────────────────────────────
 *
 * The previous shape exported `getUserScopeSuffix(): string | null`, and
 * `scopedStorage` turned that `null` into the BARE GLOBAL key. Three unrelated
 * conditions collapsed into that one `null`:
 *
 *   1. the isolation flag is off,
 *   2. Clerk affirmed the member is signed out,
 *   3. Clerk has not answered yet.
 *
 * (3) is the dangerous one: it is the state in which the app does not know who
 * is asking, and it resolved to the namespace SHARED BY EVERY MEMBER on the
 * device. A nullable string cannot express the difference, so no amount of
 * caller discipline could fix it — hence a state machine, not a nullable.
 *
 * ── THE FOUR STATES ────────────────────────────────────────────────────────
 *
 *   UNRESOLVED              Clerk has not answered. No namespace can be
 *                           computed. Durable work WAITS.
 *   AUTHENTICATED(userId)   Clerk affirmed this member. Namespace = userId.
 *   ANONYMOUS               Clerk AFFIRMATIVELY answered "signed out"
 *                           (isLoaded === true && isSignedIn === false).
 *                           No account-scoped namespace exists.
 *   UNVERIFIABLE(reason)    We cannot establish identity. No namespace.
 *                           Durable work FAILS, definitely and immediately.
 *
 * ANONYMOUS is reachable ONLY from an affirmative signed-out answer by the
 * authentication authority. A timeout, a transport error, a `getToken()`
 * rejection, or a 401 from our own API is NOT evidence that a person is
 * anonymous — those produce UNVERIFIABLE. This is the founder's binding
 * ruling: "UNRESOLVED is not ANONYMOUS."
 *
 * ── WHY THE WATCHDOG DOES NOT INVENT AN IDENTITY ───────────────────────────
 *
 * A design where durable reads await an unresolved promise forever does not
 * terminate. A design where a timeout resolves to ANONYMOUS terminates by
 * MANUFACTURING an identity. Neither is acceptable, so the watchdog exits
 * UNRESOLVED to UNVERIFIABLE:
 *
 *   The watchdog never decides WHO the member is. It decides THAT WE DO NOT
 *   KNOW. A timeout produces a failure state, never an identity state.
 *
 * Termination then follows by exhaustion, because namespace resolution is a
 * TOTAL function from state to outcome and only UNRESOLVED defers:
 *
 *   AUTHENTICATED → proceeds        ANONYMOUS    → definite empty / dropped
 *   UNVERIFIABLE  → definite reject UNRESOLVED   → waits, bounded by the
 *                                                  watchdog, then UNVERIFIABLE
 *
 * so every durable operation settles within `watchdog + one storage round
 * trip`, in every state, with no identity invented. UNVERIFIABLE is NOT
 * terminal: if Clerk later answers, the machine leaves it. The machine never
 * returns to UNRESOLVED on its own — once the authority has spoken, its last
 * answer stands until the authority itself changes it. The single exception is
 * an explicit member-initiated retry (`retryScopeResolution`), which re-arms
 * the watchdog; termination still holds, because each retry is bounded and
 * each one requires a fresh deliberate tap.
 *
 * ── PHASE 1 IS SYNCHRONOUS. THIS IS LOAD-BEARING. ──────────────────────────
 *
 * On a transition the generation bump, the state assignment and the listener
 * notification all happen in ONE synchronous block, before any `await`. Every
 * store's RAM is therefore invalidated in the same tick the scope changes, so
 * no code can ever observe "scope is B" while a store still holds A's data.
 *
 * An earlier draft of this repair proposed awaiting the cleanup side effects
 * between the state change and the notification. That would have converted a
 * zero-width window into a hundreds-of-milliseconds one (the notification
 * cleanup performs an OS round trip), during which any mutator would have read
 * A's RAM and written it under B's key WITH THE GENERATION GUARD APPROVING,
 * because both the capture and the check would sit on B's side of the
 * boundary. Phase 2 exists, but it must never gate the read/write path.
 *
 * ── SCOPE OF THIS CHANGE (PR A) ────────────────────────────────────────────
 *
 * Flag OFF is byte-identical to before: `isolationEnabled` false means every
 * key resolves to `legacy-global`, exactly as today, and NO generation bump or
 * listener notification ever fires. The legacy migration is untouched here —
 * it is deleted in the cutover, not in this PR. No data moves in PR A.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

/** One-shot marker: which userId claimed the legacy global keys. */
export const MIGRATION_CLAIMED_BY_KEY = 'aforce.namespaceMigration.claimedBy';

/**
 * Legacy GLOBAL AsyncStorage keys migrated into the claiming user's
 * namespace. (secureKV keys are migrated by scopedSecureKV itself, and
 * the WHOOP token is deliberately WIPED — never migrated — see below.)
 */
export const MIGRATED_GLOBAL_KEYS: readonly string[] = [
  // Tier 1 — intelligence (device-only)
  '@aforce/command-ledger',
  '@aforce/performance-memory-capture',
  '@aforce/performance-statements',
  '@aforce/hydroscan-history',
  '@aforce/voice-checkin',
  '@aforce/intent-capture',
  'aforce.location.anchor.v2',
  // Tier 2 — Moments family + third-party contact data
  '@aforce/moments',
  '@aforce/momentFeedback',
  '@aforce/momentPrepared',
  '@aforce/momentNotifyPrefs',
  '@aforce/calendarPrefs',
  '@aforce/recoveryCircle',
  // Tier 3 — server-authoritative caches (safe to re-fetch)
  'aforce.subscription',
  // Wave-3 PR12 — analytics identity + per-person telemetry state
  '@aforce/analytics-id',
  '@aforce/analytics-outbox',
  '@aforce/analytics',
  '@aforce/analytics-first-win',
  '@aforce/analytics-session-day',
  '@aforce/analytics-territory-day',
  '@aforce/analytics-perf-age-day',
  '@aforce/first-command-at',
  '@aforce/day7-offer-emitted',
  '@aforce/subscription-emitted',
  'aforce.notificationSettings',
  // Consent is ALSO scoped — but via COPY-AND-RETAIN (see
  // RETAIN_GLOBAL_COPY): the {granted, version, updatedAt} triple is
  // legal evidence and must survive migration.
  '@aforce/analytics-consent',
  // Tier 4 — personal mode/session state
  '@aforce/sleepMode/targetTimeHHMM',
  '@aforce/sleepMode/sevenNightAvg',
  '@aforce/sleepMode/lastFoldedDay',
  '@aforce/cruiseMode/selfLog',
  '@aforce/socialV2/lastSession',
  'aforce_night_out_command_timer_v1',
];

/**
 * Wave-3 PR12: legacy globals whose ORIGINAL record must survive the
 * per-user migration (copied, never deleted). Analytics consent is a
 * legal artifact — "who consented, to version N, when" must stay
 * answerable even after the claiming user's copy is scoped.
 *
 * NOTE: the founder has ruled this must be removed as an OPERATIONAL
 * fallback (operative consent vs consent evidence). That removal lands in
 * the cutover PR together with the consent split; it is deliberately NOT
 * changed here, because PR A moves no data.
 */
export const RETAIN_GLOBAL_COPY: ReadonlySet<string> = new Set([
  '@aforce/analytics-consent',
]);

// ─── The state machine ────────────────────────────────────────────────

export type UnverifiableReason =
  /** The bounded watchdog elapsed while identity was still UNRESOLVED. */
  | 'watchdog'
  /**
   * Clerk reported a signed-in session with no usable user id. Previously
   * `setUserScope(userId ?? null)` turned this into `null`, i.e. the shared
   * global namespace, for a member Clerk considered SIGNED IN. It is a
   * failure, not an anonymous session.
   */
  | 'signed_in_without_user_id';

export type ScopeState =
  | { readonly status: 'UNRESOLVED' }
  | { readonly status: 'AUTHENTICATED'; readonly userId: string }
  | { readonly status: 'ANONYMOUS' }
  | { readonly status: 'UNVERIFIABLE'; readonly reason: UnverifiableReason };

/**
 * What a durable-storage facade should do, derived from the state. A TOTAL
 * function — there is no input for which the answer is "use the bare
 * account-scoped key", except the explicit legacy path while the isolation
 * flag is still off.
 */
export type Namespace =
  /** Key under this member. */
  | { readonly kind: 'member'; readonly suffix: string }
  /** Isolation flag OFF — the pre-isolation global key. Deleted at cutover. */
  | { readonly kind: 'legacy-global' }
  /** Affirmatively signed out: reads are empty, writes are dropped. */
  | { readonly kind: 'none' }
  /** Not yet known: wait for `scopeResolved()`, then ask again. */
  | { readonly kind: 'pending' }
  /** Cannot be known: fail, definitely. */
  | { readonly kind: 'unavailable'; readonly reason: UnverifiableReason };

/**
 * Thrown when a durable operation COMPLETED under a different scope than the
 * one that issued it (barrier W3). The value it carries belongs to a member
 * who is no longer active, so it is refused rather than returned.
 *
 * Distinct from `ScopeUnavailableError`, which means identity could not be
 * established at all. A caller may reasonably treat "unavailable" as "try
 * later"; "changed" means this work is void and must be abandoned, never
 * retried with the result in hand.
 */
export class ScopeChangedError extends Error {
  constructor() {
    super('user scope changed while the operation was in flight');
    this.name = 'ScopeChangedError';
  }
}

/** Thrown by durable facades when the scope is UNVERIFIABLE. */
export class ScopeUnavailableError extends Error {
  readonly reason: UnverifiableReason;
  constructor(reason: UnverifiableReason) {
    super(`user scope unavailable (${reason})`);
    this.name = 'ScopeUnavailableError';
    this.reason = reason;
  }
}

/**
 * How long identity may remain UNRESOLVED before durable work is failed
 * rather than deferred. Chosen to be longer than a cold Keychain read plus a
 * slow Clerk round trip, and short enough that a member never waits on a
 * screen that cannot progress.
 */
export const SCOPE_WATCHDOG_MS = 8_000;

type ScopeListener = () => void;
type StateListener = (state: ScopeState) => void;
/** Phase-2 cleanup. Receives the OUTGOING and INCOMING states explicitly. */
export type ScopeCleanup = (prev: ScopeState, next: ScopeState) => Promise<unknown>;

const UNRESOLVED: ScopeState = { status: 'UNRESOLVED' };

let state: ScopeState = UNRESOLVED;
let isolationEnabled = false;
let generation = 0;
let migration: Promise<void> = Promise.resolve();
let cleanupSettled: Promise<void> = Promise.resolve();

const listeners = new Set<ScopeListener>();
const stateListeners = new Set<StateListener>();
const cleanups = new Set<ScopeCleanup>();

let watchdogTimer: ReturnType<typeof setTimeout> | null = null;
let watchdogMs = SCOPE_WATCHDOG_MS;
let resolvedWaiters: Array<() => void> = [];

// ─── Reads ────────────────────────────────────────────────────────────

/** The authoritative identity state. Always accurate, flag or no flag. */
export function getScopeState(): ScopeState {
  return state;
}

/**
 * The namespace a durable facade must use. This is the ONLY place the state
 * is turned into a storage decision, so there is exactly one definition of
 * what each state means for data.
 */
export function resolveNamespace(): Namespace {
  // The isolation flag still gates the whole mechanism in PR A: with it off
  // every key is the pre-isolation global key, byte-identical to before.
  // The flag and this branch are both deleted at cutover.
  if (!isolationEnabled) return { kind: 'legacy-global' };
  switch (state.status) {
    case 'AUTHENTICATED':
      return { kind: 'member', suffix: state.userId };
    case 'ANONYMOUS':
      return { kind: 'none' };
    case 'UNRESOLVED':
      return { kind: 'pending' };
    case 'UNVERIFIABLE':
      return { kind: 'unavailable', reason: state.reason };
  }
}

/**
 * Current scope suffix, or null when there is no member namespace.
 *
 * RETAINED for the callers that only need "which member", but it is NOT the
 * storage decision — `resolveNamespace()` is. A `null` here means "no member
 * suffix" and must never be read as "use the bare key".
 */
export function getUserScopeSuffix(): string | null {
  const ns = resolveNamespace();
  return ns.kind === 'member' ? ns.suffix : null;
}

/** Monotonic generation — bumps whenever the effective namespace changes. */
export function getUserScopeGeneration(): number {
  return generation;
}

/**
 * Resolves when any in-flight legacy migration for the current scope has
 * settled. scopedStorage awaits this before every read so a store can never
 * hydrate a scoped key that migration is still populating.
 *
 * This is bounded AsyncStorage work ONLY. The phase-2 cleanup pipeline is
 * deliberately NOT part of it — see `scopeCleanupSettled`.
 */
export function migrationSettled(): Promise<void> {
  return migration;
}

/**
 * TEST/OBSERVABILITY ONLY: resolves when the phase-2 cleanup pipeline for the
 * most recent transition has settled. Nothing on the durable read/write path
 * may await this — it performs OS round trips and is therefore unbounded.
 */
export function scopeCleanupSettled(): Promise<void> {
  return cleanupSettled;
}

/**
 * Resolves as soon as identity is no longer UNRESOLVED — by a real answer or
 * by the watchdog. Never rejects. This is what makes a `pending` namespace
 * terminate: the waiter is released in bounded time, and the caller then
 * re-asks `resolveNamespace()` and gets a definite answer.
 */
export function scopeResolved(): Promise<void> {
  if (state.status !== 'UNRESOLVED') return Promise.resolve();
  return new Promise<void>((resolve) => {
    resolvedWaiters.push(resolve);
  });
}

// ─── Subscriptions ────────────────────────────────────────────────────

/**
 * Subscribe to EFFECTIVE NAMESPACE changes. Stores reset their in-memory
 * caches here. Fired SYNCHRONOUSLY inside the transition, before any await.
 */
export function subscribeUserScope(listener: ScopeListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Subscribe to raw state changes (for UI that presents UNVERIFIABLE). */
export function subscribeScopeState(listener: StateListener): () => void {
  stateListeners.add(listener);
  return () => stateListeners.delete(listener);
}

/**
 * Register a phase-2 cleanup. Cleanups receive `prev` and `next` as ARGUMENTS
 * — no cleanup may keep its own copy of the scope, which was previously a
 * second source of truth in `userScopeCleanup`.
 */
export function registerScopeCleanup(cleanup: ScopeCleanup): () => void {
  cleanups.add(cleanup);
  return () => cleanups.delete(cleanup);
}

// ─── Transitions ──────────────────────────────────────────────────────

/**
 * The effective namespace identity — what actually determines whether stored
 * data changes hands. `null` covers every state that has no member namespace
 * (and the whole flag-off path), so a UNRESOLVED → ANONYMOUS transition does
 * not churn stores that could not have hydrated anything anyway.
 */
function effectiveNamespaceId(s: ScopeState): string | null {
  if (!isolationEnabled) return null;
  return s.status === 'AUTHENTICATED' ? s.userId : null;
}

function releaseResolvedWaiters(): void {
  if (resolvedWaiters.length === 0) return;
  const waiters = resolvedWaiters;
  resolvedWaiters = [];
  for (const w of waiters) w();
}

function clearWatchdog(): void {
  if (watchdogTimer !== null) {
    clearTimeout(watchdogTimer);
    watchdogTimer = null;
  }
}

/**
 * Arm the bounded watchdog. Idempotent. Called once at app start, so that a
 * Clerk that never answers still produces a DEFINITE outcome.
 */
export function beginScopeResolution(): void {
  if (state.status !== 'UNRESOLVED' || watchdogTimer !== null) return;
  watchdogTimer = setTimeout(() => {
    watchdogTimer = null;
    // Still unresolved after the bound: we do not know who this is. That is
    // NOT the same as knowing they are signed out.
    if (state.status === 'UNRESOLVED') {
      resolveScope({ status: 'UNVERIFIABLE', reason: 'watchdog' });
    }
  }, watchdogMs);
  // Node/RN both support unref only on Node timers; guard for RN.
  const t = watchdogTimer as unknown as { unref?: () => void };
  if (typeof t?.unref === 'function') t.unref();
}

/**
 * Translate the authentication authority's report into an identity state.
 *
 * PURE, and separated from the React bridge on purpose: this is the single
 * rule that decides when ANONYMOUS is allowed, so it must be exhaustively
 * testable without mounting a component or scanning a source file.
 *
 * Returns `null` for "no transition" — `isLoaded === false` is SILENCE, not an
 * answer. Reading it as signed-out is exactly the defect this repair exists to
 * remove: a slow or failed identity lookup is not evidence that a person is
 * anonymous.
 */
export function mapClerkToScope(report: {
  isLoaded: boolean;
  isSignedIn: boolean | undefined;
  userId: string | null | undefined;
}): ScopeState | null {
  if (!report.isLoaded) return null;
  if (!report.isSignedIn) return { status: 'ANONYMOUS' };
  if (typeof report.userId === 'string' && report.userId.length > 0) {
    return { status: 'AUTHENTICATED', userId: report.userId };
  }
  return { status: 'UNVERIFIABLE', reason: 'signed_in_without_user_id' };
}

/**
 * Member-initiated retry from the identity-failure screen. The ONLY path back
 * to UNRESOLVED: a person deliberately asking us to try again is not the app
 * inventing an answer. Bounded like any other resolution attempt.
 */
export function retryScopeResolution(): void {
  if (state.status !== 'UNVERIFIABLE') return;
  resolveScope(UNRESOLVED);
  beginScopeResolution();
}

/**
 * THE single mutation point for identity. Called only by the Clerk bridge
 * (and by the watchdog above).
 *
 * PHASE 1 is synchronous and complete before any await: generation, state,
 * listeners. PHASE 2 is asynchronous and gates nothing on the durable path.
 */
export function resolveScope(next: ScopeState): void {
  const prev = state;
  if (sameState(prev, next)) return;

  const prevNs = effectiveNamespaceId(prev);
  const nextNs = effectiveNamespaceId(next);
  const namespaceChanged = prevNs !== nextNs;

  // ── PHASE 1 — SYNCHRONOUS. No await may appear in this block. ──────
  if (namespaceChanged) generation += 1;
  state = next;
  if (next.status !== 'UNRESOLVED') clearWatchdog();
  if (namespaceChanged) {
    // Every store drops its cache in the SAME TICK the scope changes.
    for (const l of [...listeners]) l();
  }
  // ── end phase 1 ────────────────────────────────────────────────────

  for (const l of [...stateListeners]) l(next);
  releaseResolvedWaiters();

  // Legacy migration is unchanged in PR A (no data moves here). It is only
  // ever armed for a real member, and only while isolation is enabled.
  if (namespaceChanged) {
    migration =
      nextNs === null ? Promise.resolve() : migrateLegacyGlobals(nextNs);
  }

  // ── PHASE 2 — asynchronous. Nothing on the read/write path awaits it. ──
  // Deferred to a microtask deliberately: calling an async function runs its
  // body synchronously up to the first await, so invoking the pipeline here
  // directly would let a cleanup execute INSIDE phase 1's synchronous window.
  // Phase 2 must not be able to observe or act on a half-applied transition.
  if (namespaceChanged) {
    cleanupSettled = Promise.resolve().then(() => runCleanups(prev, next));
  }
}

function sameState(a: ScopeState, b: ScopeState): boolean {
  if (a.status !== b.status) return false;
  if (a.status === 'AUTHENTICATED' && b.status === 'AUTHENTICATED') {
    return a.userId === b.userId;
  }
  if (a.status === 'UNVERIFIABLE' && b.status === 'UNVERIFIABLE') {
    return a.reason === b.reason;
  }
  return true;
}

async function runCleanups(prev: ScopeState, next: ScopeState): Promise<void> {
  for (const cleanup of [...cleanups]) {
    try {
      await cleanup(prev, next);
    } catch {
      // A cleanup failure must not stop the others, and must never surface
      // as an unhandled rejection on a security path.
    }
  }
}

/**
 * Tell the scope authority whether per-user isolation is enabled. Driven by
 * the feature flag from the Clerk bridge. Deleted at cutover along with the
 * flag itself.
 */
export function setScopeIsolationEnabled(enabled: boolean): void {
  if (enabled === isolationEnabled) return;
  const prevNs = effectiveNamespaceId(state);
  isolationEnabled = enabled;
  const nextNs = effectiveNamespaceId(state);
  if (prevNs !== nextNs) {
    generation += 1;
    for (const l of [...listeners]) l();
    migration = nextNs === null ? Promise.resolve() : migrateLegacyGlobals(nextNs);
  }
}

/** Whether per-user isolation is currently enabled (flag mirror). */
export function isScopeIsolationEnabled(): boolean {
  return isolationEnabled;
}

async function migrateLegacyGlobals(userId: string): Promise<void> {
  try {
    const claimedBy = await AsyncStorage.getItem(MIGRATION_CLAIMED_BY_KEY);
    if (claimedBy !== null && claimedBy !== userId) return; // later user: never claims
    for (const base of MIGRATED_GLOBAL_KEYS) {
      const scoped = `${base}:${userId}`;
      const [existingScoped, legacy] = await Promise.all([
        AsyncStorage.getItem(scoped),
        AsyncStorage.getItem(base),
      ]);
      if (legacy === null) continue;
      // Copy-then-delete; delete only after the scoped write succeeds
      // (the secureKV migration contract). Keys in RETAIN_GLOBAL_COPY are
      // copied WITHOUT deletion — the global record is preserved evidence.
      if (existingScoped === null) await AsyncStorage.setItem(scoped, legacy);
      if (!RETAIN_GLOBAL_COPY.has(base)) await AsyncStorage.removeItem(base);
    }
    // The FIRST user ever scoped on this device claims the legacy
    // namespace outright — even when no legacy keys existed — so a later
    // account can never claim leftovers (incl. the secureKV read-through
    // in scopedStorage, which consults this marker).
    if (claimedBy === null) {
      await AsyncStorage.setItem(MIGRATION_CLAIMED_BY_KEY, userId);
    }
  } catch {
    // Migration is best-effort: a failure leaves legacy keys in place for
    // the next attempt; scoped reads simply see empty until then.
  }
}

/** TEST-ONLY: reset module state between cases. */
export function __resetUserScopeForTests(): void {
  clearWatchdog();
  state = UNRESOLVED;
  isolationEnabled = false;
  generation = 0;
  migration = Promise.resolve();
  cleanupSettled = Promise.resolve();
  watchdogMs = SCOPE_WATCHDOG_MS;
  resolvedWaiters = [];
  listeners.clear();
  stateListeners.clear();
  cleanups.clear();
}

/** TEST-ONLY: shorten the watchdog so the bound is observable in a test. */
export function __setScopeWatchdogMsForTests(ms: number): void {
  watchdogMs = ms;
}

/**
 * TEST-ONLY adapter for the pre-existing isolation suites, which were written
 * against `setUserScope(userId | null)`.
 *
 * It exists so PRODUCTION has exactly one identity producer (the Clerk
 * bridge). `null` here means the affirmative sign-out those suites intend —
 * never "unknown", which is precisely the conflation this rewrite removes.
 * New tests should drive `resolveScope` directly.
 */
export function __setUserScopeForTests(userId: string | null): void {
  setScopeIsolationEnabled(true);
  resolveScope(
    userId === null
      ? { status: 'ANONYMOUS' }
      : { status: 'AUTHENTICATED', userId },
  );
}
