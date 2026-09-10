/**
 * The client side of the analytics consent authority.
 *
 * The SERVER owns the operative consent state and the pseudonym. This module
 * owns exactly one thing the server cannot: a member's decision made while the
 * server was unreachable — and it owns it as a CEILING, never as a second
 * source of truth.
 *
 * ── THE INVARIANT ──────────────────────────────────────────────────────────
 *
 *   A member who revokes analytics while offline must never appear opted-in
 *   again merely because another device — or the server — still holds an
 *   older grant.
 *
 * ── THE CEILING IS ASYMMETRIC, AND THAT IS THE SAFETY PROPERTY ─────────────
 *
 *   a pending REVOKE is operative IMMEDIATELY and locally, and no adopted
 *   server state may lift it until reconciliation clears it;
 *
 *   a pending GRANT is operative NEVER until the server confirms it.
 *
 * A symmetric ceiling would let an offline grant start collection the server
 * never authorised. The ceiling only ever RESTRICTS. Getting this backwards is
 * the whole defect class: a client made into a pure renderer of server state
 * fixes stale grants and silently reverses legitimate offline revokes — the
 * same bug with the sign flipped.
 *
 * ── WHAT IS AND IS NOT CACHED ON DISK ──────────────────────────────────────
 *
 * The server-issued PSEUDONYM is cached: it is stable, the server reissues the
 * same value, and a cache of it is not an opinion about consent.
 *
 * The adopted CONSENT STATE is deliberately NOT cached. A persisted server
 * grant would be a third authority that drifts — precisely the "second
 * identity/storage authority" this design is forbidden from growing — and it
 * would let a launch with no connectivity collect on the strength of a local
 * file. So after a cold start, collection waits for the server to answer.
 * The cost is bounded and one-directional: events in an offline-at-launch
 * window are never created. That is telemetry lost, not privacy spent, and
 * the founder's ruling is that privacy and correctness outrank telemetry
 * continuity.
 *
 * ── THE PENDING KEY IS A TRANSITIONAL EXCEPTION (founder-approved) ─────────
 *
 * `@aforce/analytics-pending.<userId>` and `@aforce/analytics-id.v2.<userId>`
 * are composed with the member's id DIRECTLY rather than routed through
 * `scopedStorage`, because while `per_user_storage_isolation_enabled` is false
 * the scoped facade still resolves to BARE, device-global keys — and a
 * device-global pending decision is exactly the "member A's revoke replayed
 * for member B" failure this record exists to prevent.
 *
 * Constraints that keep it from becoming a second storage authority:
 *   - the userId comes ONLY from `getScopeState()`, the canonical authority.
 *     No exported function here accepts a userId argument.
 *   - nothing is read or written unless the scope is AUTHENTICATED.
 *   - both keys are listed as TRANSITIONAL exceptions in the raw-storage
 *     allowlist, with this reason.
 *   - PR D must migrate them back under `scopedStorage` and delete the
 *     exceptions. This is a bridge, not an architecture.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  postAnalyticsConsent,
  resolveAnalyticsIdentity as resolveIdentityOverWire,
  type AnalyticsConsentWire,
} from '@/lib/api';
import { getScopeState, getUserScopeGeneration, subscribeScopeState } from '@/services/userScope';

/** TRANSITIONAL: composed with the member id. See the docblock. */
const PENDING_KEY_PREFIX = '@aforce/analytics-pending';
/** The server-issued pseudonym cache. Deliberately NOT the legacy key. */
const SERVER_ID_KEY_PREFIX = '@aforce/analytics-id.v2';

/**
 * The disclosure the member is consenting to. Bump when the disclosure text
 * materially changes; the server stores it as evidence of WHAT was agreed, so
 * it must be a real version and never a sentinel.
 */
export const DISCLOSURE_VERSION = 1;

export type ConsentAction = 'grant' | 'revoke';

/**
 * `queued`           never sent, or a retryable failure — send on next trigger
 * `inflight`         sent, outcome unknown (a restart finds this and re-sends;
 *                    the server's compare-and-set makes a duplicate safe)
 * `needs_resolution` terminal for automation. The ceiling HOLDS and the member
 *                    is asked to retry explicitly. Never auto-retried.
 */
export type PendingState = 'queued' | 'inflight' | 'needs_resolution';

export interface PendingConsentDecision {
  readonly action: ConsentAction;
  readonly disclosureVersion: number;
  /** The server decisionSeq this decision was based on. null = "none existed". */
  readonly basedOnSeq: number | null;
  readonly state: PendingState;
  /** 409 conflict re-issues only. Network failures never consume this. */
  readonly reissues: number;
  readonly createdAtMs: number;
}

export type AdoptedConsent = AnalyticsConsentWire;

// ─── Pure decision functions (the laws drive these directly) ──────────

/**
 * THE EFFECTIVE GATE. The only definition of "may we collect".
 *
 * Restrictive-only: a pending revoke forces `false`; a pending grant is simply
 * not consulted, so collection cannot begin on an unconfirmed intent.
 * `needs_resolution` keeps the ceiling — a decision we could not deliver must
 * not quietly revert to the server's older answer.
 */
export function effectiveGranted(
  adopted: AdoptedConsent | null,
  pending: PendingConsentDecision | null,
  /**
   * A pending record exists that could not be read. It might have said
   * "revoke", so it is treated as though it did. Defaults false so every
   * existing caller keeps its meaning.
   */
  unreadable = false,
): boolean {
  if (unreadable) return false;
  if (pending?.action === 'revoke') return false;
  return adopted?.granted === true;
}

/** The gate as the module sees it, with the module's own unreadable flag. */
function effectiveGrantedNow(): boolean {
  return effectiveGranted(adopted, pending, pendingUnreadable);
}

/**
 * Classify a refused consent POST.
 *
 * NOT all 4xx are alike, and treating them alike is how a client ends up
 * POSTing a permanently impossible decision on every foreground forever.
 * Classification is by the server's explicit `code` (the S1-3 error contract),
 * never by the numeric status alone.
 *
 *   transient  session/identity not ready — stay queued, retry later
 *   terminal   a deterministic refusal — the server will never accept this
 *              decision as it stands. Stop automating; keep the ceiling; ask
 *              the member.
 */
export type FailureClass = 'transient' | 'terminal';

/** Deterministic refusals from the S1-3 contract. */
const TERMINAL_CODES: ReadonlySet<string> = new Set([
  'identity_requires_member', // 403 — this caller can never act as a member
  'invalid_body', // 400 — protocol error; retrying cannot fix it
  'analytics_identity_suppressed', // 409 — the member is terminally suppressed
]);

export function classifyConsentFailure(status: number, code: string | null): FailureClass {
  if (code !== null && TERMINAL_CODES.has(code)) return 'terminal';
  // Status 0 is our own "could not reach the server" marker.
  if (status === 0 || status >= 500) return 'transient';
  // A bare 401 is ordinary session loss: the Clerk token expired, or the scope
  // machine has not answered yet. That resolves itself, so it stays queued.
  if (status === 401) return 'transient';
  // Any other 4xx — including an unrecognised 403 — is deterministic. An
  // authorization refusal we cannot name is one we must not hammer: fail
  // closed in the direction that STOPS the loop, not the one that keeps it.
  if (status >= 400 && status < 500) return 'terminal';
  return 'transient';
}

/**
 * Whether a 409 means the member's intent is ALREADY satisfied.
 *
 * The server returns the current state with its conflict. If that state already
 * matches what the member asked for, another device got there first and there is
 * nothing left to do — clearing is correct, and re-issuing would be a pointless
 * write. Only a genuine disagreement is re-issued.
 */
export function conflictSatisfiesIntent(
  action: ConsentAction,
  current: AdoptedConsent | null,
  /**
   * The disclosure the member acted under. A decision is only "already
   * satisfied" if the server's record was made under the SAME disclosure.
   */
  disclosureVersion: number,
): boolean {
  if (current === null) return false;
  // A row with no decision on it satisfies nothing. `granted: false,
  // decisionSeq: null` means NEVER ASKED, which looks identical to "revoked" if
  // you only read the boolean — so a member's explicit "no" would be dropped as
  // redundant, the server would hold no evidence of it, and the app would ask
  // again on the next launch as though they had never answered.
  if (current.decisionSeq === null) return false;
  if (current.granted !== (action === 'grant')) return false;
  // AND the same disclosure. Comparing only the boolean means that the day
  // DISCLOSURE_VERSION is bumped — which this file instructs maintainers to do
  // "when the disclosure text materially changes" — a member re-granting under
  // the NEW disclosure is short-circuited as already-satisfied, never POSTed,
  // and the server's evidence permanently records them as having agreed to the
  // OLD text. The version constant would be decoration.
  return current.disclosureVersion === disclosureVersion;
}

/** How many 409 re-issues before the decision goes to `needs_resolution`. */
export const MAX_CONFLICT_REISSUES = 1;

// ─── The account-switch barrier ───────────────────────────────────────

/**
 * A scope-generation token, so a reconciliation begun under member A can never
 * publish its result under member B. Mirrors the PR B barrier architecture:
 * capture synchronously, compare before publishing.
 */
export interface ScopeToken {
  readonly generation: number;
  readonly userId: string | null;
}

/**
 * The member id to scope by, or null when the scope is not a definite member.
 *
 * The ONLY source of the id. Callers cannot pass one in — that is what stops
 * this module becoming a second identity authority, and what makes "A's
 * decision is never written under B" true by construction rather than by
 * discipline.
 */
function currentMemberId(): string | null {
  const s = getScopeState();
  return s.status === 'AUTHENTICATED' ? s.userId : null;
}

export function captureScopeToken(): ScopeToken {
  return { generation: getUserScopeGeneration(), userId: currentMemberId() };
}

export function scopeTokenStillValid(t: ScopeToken): boolean {
  return t.generation === getUserScopeGeneration() && t.userId === currentMemberId();
}

// ─── Persistence (pending decision + server pseudonym) ────────────────

const pendingKey = (userId: string): string => `${PENDING_KEY_PREFIX}.${userId}`;
const serverIdKey = (userId: string): string => `${SERVER_ID_KEY_PREFIX}.${userId}`;

/**
 * What a read of the pending record produced.
 *
 * `unreadable` is NOT the same as `absent`, and collapsing them is how an
 * unreadable privacy state silently becomes permission. A record we cannot
 * read might have said "revoke"; answering `null` would drop that ceiling and
 * let the next reconcile re-adopt the server's older grant.
 */
type PendingLoad =
  | { kind: 'absent' }
  | { kind: 'record'; value: PendingConsentDecision }
  | { kind: 'unreadable'; why: 'storage' | 'corrupt' };

function parsePending(raw: string | null): PendingLoad {
  if (raw === null) return { kind: 'absent' };
  // An empty string is a written-but-truncated record, not an absent one.
  if (raw === '') return { kind: 'unreadable', why: 'corrupt' };
  let p: Partial<PendingConsentDecision>;
  try {
    p = JSON.parse(raw) as Partial<PendingConsentDecision>;
  } catch {
    return { kind: 'unreadable', why: 'corrupt' };
  }
  // A record whose ACTION is unreadable is the dangerous case: we cannot tell
  // a grant from a revoke, so we must not guess, and we must not discard it.
  if (p.action !== 'grant' && p.action !== 'revoke') {
    return { kind: 'unreadable', why: 'corrupt' };
  }
  const seq = p.basedOnSeq;
  if (seq !== null && seq !== undefined && typeof seq !== 'number') {
    return { kind: 'unreadable', why: 'corrupt' };
  }
  // A disclosure version we cannot read must NOT be restamped with the current
  // constant: the server stores it as evidence of what the member agreed to,
  // and inventing one is exactly the sentinel the server contract forbids.
  if (p.disclosureVersion !== undefined && typeof p.disclosureVersion !== 'number') {
    return { kind: 'unreadable', why: 'corrupt' };
  }
  if (p.disclosureVersion === undefined) {
    return { kind: 'unreadable', why: 'corrupt' };
  }
  return {
    kind: 'record',
    value: {
      action: p.action,
      disclosureVersion: p.disclosureVersion,
      basedOnSeq: typeof seq === 'number' ? seq : null,
      // An unrecognised state is read as `queued`, never as resolved: a
      // corrupt record must not be able to CLEAR a revoke ceiling.
      state: p.state === 'inflight' || p.state === 'needs_resolution' ? p.state : 'queued',
      reissues: typeof p.reissues === 'number' ? p.reissues : 0,
      createdAtMs: typeof p.createdAtMs === 'number' ? p.createdAtMs : 0,
    },
  };
}

async function loadPending(userId: string): Promise<PendingLoad> {
  try {
    return parsePending(await AsyncStorage.getItem(pendingKey(userId)));
  } catch {
    // The storage layer itself failed. We do not know whether a decision is
    // waiting there, so we must not report that none is.
    return { kind: 'unreadable', why: 'storage' };
  }
}

async function savePending(userId: string, p: PendingConsentDecision | null): Promise<void> {
  try {
    if (p === null) await AsyncStorage.removeItem(pendingKey(userId));
    else await AsyncStorage.setItem(pendingKey(userId), JSON.stringify(p));
  } catch {
    /* best-effort: the in-memory ceiling still holds for this session */
  }
}

async function loadServerId(userId: string): Promise<string | null> {
  try {
    const v = await AsyncStorage.getItem(serverIdKey(userId));
    return v && v.length >= 8 ? v : null;
  } catch {
    return null;
  }
}

async function saveServerId(userId: string, id: string | null): Promise<void> {
  try {
    if (id === null) await AsyncStorage.removeItem(serverIdKey(userId));
    else await AsyncStorage.setItem(serverIdKey(userId), id);
  } catch {
    /* non-fatal — the in-memory id still serves this session */
  }
}

// ─── In-memory state, reset on every scope change ─────────────────────

let adopted: AdoptedConsent | null = null;
let pending: PendingConsentDecision | null = null;
let serverId: string | null = null;
let hydratedFor: string | null = null;
let hydrating: Promise<void> | null = null;
let reconciling: Promise<void> | null = null;
/** A reconcile was requested while one was already running. See `reconcile`. */
let rerunRequested = false;
/** Monotonic latch ids, so a call only ever clears the latch it installed. */
let hydrateSeq = 0;
let reconcileSeq = 0;
/** Bumped whenever a decision is written to memory. Guards hydrate's write. */
let pendingWriteSeq = 0;
/** The same guard for the pseudonym. See `setServerId`. */
let serverIdWriteSeq = 0;
/**
 * A pending record exists on disk that we could not read.
 *
 * Fails CLOSED: we cannot tell whether it said grant or revoke, so we assume
 * it may have said revoke and hold the ceiling until the member resolves it.
 * Never cleared by a read — only by a real decision replacing the record.
 */
let pendingUnreadable = false;
/**
 * The server has told us this member is terminally suppressed.
 *
 * Distinct from `needs_resolution`: retrying cannot succeed, ever, so the UI
 * must not offer one.
 */
let identitySuppressed = false;

/**
 * The ONLY way the pending record changes outside hydrate and the scope reset.
 *
 * Every write bumps `pendingWriteSeq`, which is what tells an in-flight hydrate
 * that the disk value it is holding is already stale. One setter rather than
 * fifteen assignments, so the counter cannot be forgotten at the one site where
 * it mattered.
 */
function setPending(p: PendingConsentDecision | null): void {
  pending = p;
  pendingWriteSeq += 1;
  // A real decision supersedes an unreadable one: whatever the old bytes said,
  // the member has just told us something newer.
  pendingUnreadable = false;
}

/**
 * The same discipline for the pseudonym.
 *
 * `serverId` had no staleness guard while `pending` did, one line apart — and
 * that asymmetry was a live defect, not a hypothetical: a hydrate whose disk
 * read began before a reconcile could land its stale `null` on top of a live
 * pseudonym and then latch `hydratedFor`, so the correct value on disk was
 * never re-read. Collection stopped for the rest of the process while the
 * settings row still said it was on.
 */
function setServerId(id: string | null): void {
  serverId = id;
  serverIdWriteSeq += 1;
}

type Listener = () => void;
const listeners = new Set<Listener>();

function notify(): void {
  for (const l of [...listeners]) {
    try {
      l();
    } catch {
      /* a bad listener must not take the authority down */
    }
  }
}

/** Subscribe to consent-state changes (the settings row re-renders on these). */
export function subscribeConsentState(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

/**
 * Drop every byte of the previous member's consent, pseudonym and pending
 * decision. Synchronous by design: an emit racing an account switch must not be
 * able to read member A's pseudonym while signed in as B.
 */
function resetForScopeChange(): void {
  adopted = null;
  pendingUnreadable = false;
  identitySuppressed = false;
  pending = null;
  serverId = null;
  hydratedFor = null;
  hydrating = null;
  reconciling = null;
  rerunRequested = false;
}

/**
 * A scope change is a security boundary.
 *
 * ── WHY `subscribeScopeState` AND NOT `subscribeUserScope` ─────────────────
 *
 * `subscribeUserScope` fires only when the effective STORAGE NAMESPACE changes,
 * and while `per_user_storage_isolation_enabled` is false that namespace is
 * `null` for every state — so on today's production configuration an A→B
 * account switch fires those listeners ZERO times. For a module whose cache is
 * device-global storage that is harmless (the stale RAM matches the stale disk).
 * It is not harmless here: `adopted` and `serverId` come from the SERVER, keyed
 * to one member, and inheriting them would hand B member A's pseudonym and
 * grant.
 *
 * `subscribeScopeState` fires on every resolved state regardless of the flag,
 * which is the signal this boundary actually needs.
 *
 * In-flight work is cancelled by the same switch: a captured `ScopeToken`
 * carries the member id as well as the generation, so `scopeTokenStillValid`
 * fails even when the flag-off path leaves the generation unchanged.
 */
subscribeScopeState(() => {
  resetForScopeChange();
  notify();
});

async function hydrate(): Promise<void> {
  const userId = currentMemberId();
  if (userId === null) return;
  if (hydratedFor === userId) return;
  // Backstop for the case the state listener could not cover — this module
  // first imported AFTER a switch, or a listener that threw. The adopted state
  // belongs to whoever `hydratedFor` names; if that is someone else, it is not
  // ours to keep. Cheap, and on a privacy boundary worth not relying on a
  // single mechanism.
  if (hydratedFor !== null && hydratedFor !== userId) resetForScopeChange();
  if (hydrating !== null) return hydrating;
  const token = captureScopeToken();
  const mine = ++hydrateSeq;
  const pendingSeqAtStart = pendingWriteSeq;
  const serverIdSeqAtStart = serverIdWriteSeq;
  hydrating = (async () => {
    try {
      const [p, id] = await Promise.all([loadPending(userId), loadServerId(userId)]);
      // W4: the read completed — may it be published? If the member changed
      // while the disk was answering, this data belongs to someone else.
      if (!scopeTokenStillValid(token)) return;
      // A decision recorded WHILE the disk was answering is newer than what the
      // disk holds. Overwriting it would silently undo a revoke the member has
      // already been told is in force.
      if (pendingWriteSeq === pendingSeqAtStart) {
        if (p.kind === 'record') {
          pending = p.value;
          pendingUnreadable = false;
        } else if (p.kind === 'unreadable') {
          // FAIL CLOSED. Do not translate an unreadable privacy state into
          // `pending = null` — that is permission we were never given.
          pendingUnreadable = true;
        } else {
          pending = null;
          pendingUnreadable = false;
        }
      }
      // The SAME guard the pending record has always had. Without it a stale
      // read lands `null` on a live pseudonym and `hydratedFor` then latches,
      // so the correct value on disk is never read again.
      if (serverIdWriteSeq === serverIdSeqAtStart) serverId = id;
      // An unreadable record must not latch: a transient storage fault should
      // be retried by the next read, not frozen in for the session.
      if (p.kind !== 'unreadable') hydratedFor = userId;
      notify();
    } finally {
      // Only clear the latch if no NEWER hydrate has installed one. Clearing
      // matters even on the abandoned path: a resolved latch left behind would
      // make every later hydrate a no-op and freeze the authority unhydrated.
      if (hydrateSeq === mine) hydrating = null;
    }
  })();
  return hydrating;
}

// ─── The emission gate ────────────────────────────────────────────────

/**
 * The single gate every emit passes. Returns the pseudonym to stamp, or null.
 *
 * Both conditions in ONE read of ONE state: a server-issued id AND effective
 * consent. Two separate calls (`isConsentGranted()` then `getAnalyticsId()`)
 * leave a window where consent flips between them — the shape of defect this
 * repo keeps finding, where two places decide one thing.
 */
export async function resolveEmissionIdentity(): Promise<string | null> {
  if (currentMemberId() === null) return null;
  await hydrate();
  if (!effectiveGrantedNow()) return null;
  return serverId;
}

/** The effective consent state, ceiling applied. For UI and pre-checks. */
export async function isEffectivelyGranted(): Promise<boolean> {
  if (currentMemberId() === null) return false;
  await hydrate();
  return effectiveGrantedNow();
}

/** The cached server pseudonym, if one has been issued. Never mints. */
export async function getServerAnalyticsId(): Promise<string | null> {
  if (currentMemberId() === null) return null;
  await hydrate();
  return serverId;
}

// ─── What the consent UI renders ──────────────────────────────────────

export type ConsentUiState =
  /** Scope not yet resolved — render neither on nor off as settled. */
  | { status: 'unknown' }
  /** Signed out or unverifiable: consent is not manageable here. */
  | { status: 'not_a_member' }
  /**
   * A member, but the server has not answered yet.
   *
   * DELIBERATELY NOT `unknown`. `unknown` disabled the switch, and the switch
   * is the only control that calls `recordDecision`, which is the only thing
   * that reaches the server — so a first-time member could never leave the
   * state that was disabling their only way out of it. This state is
   * ACTIONABLE: nothing is auto-granted or auto-revoked, the member simply
   * decides, and `recordDecision` works without any adopted state because it
   * bases its CAS on `null` and reconciles from whatever the server answers.
   */
  | { status: 'unsynced'; granted: boolean }
  /** The server's answer, adopted. `answered` drives whether to prompt. */
  | { status: 'settled'; granted: boolean; answered: boolean }
  /** A local decision is on its way to the server. */
  | { status: 'pending'; action: ConsentAction; granted: boolean }
  /**
   * A local decision the server deterministically refused. Automation has
   * stopped; the ceiling still holds; only the member can move this.
   */
  | { status: 'needs_resolution'; action: ConsentAction; granted: boolean }
  /**
   * A pending record exists on disk that could not be read.
   *
   * The gate is CLOSED — an unreadable record might have said "revoke" — and
   * the member is offered a way to resolve it by deciding again, which
   * replaces the unreadable bytes. Recoverable, not terminal.
   */
  | { status: 'unreadable'; granted: false }
  /**
   * The member has been forgotten. TERMINAL, and terminal differently from
   * `needs_resolution`: suppression is permanent, so there is no retry that
   * could ever succeed and none is offered.
   */
  | { status: 'suppressed'; granted: false };

export async function consentUiState(): Promise<ConsentUiState> {
  const s = getScopeState();
  if (s.status === 'UNRESOLVED') return { status: 'unknown' };
  if (s.status !== 'AUTHENTICATED') return { status: 'not_a_member' };
  await hydrate();
  // Suppression outranks everything below: it is permanent and there is
  // nothing the member can decide about it here.
  if (identitySuppressed) return { status: 'suppressed', granted: false };
  if (pendingUnreadable) return { status: 'unreadable', granted: false };
  const granted = effectiveGrantedNow();
  if (pending !== null) {
    if (pending.state === 'needs_resolution') {
      return { status: 'needs_resolution', action: pending.action, granted };
    }
    return { status: 'pending', action: pending.action, granted };
  }
  if (adopted === null) return { status: 'unsynced', granted };
  return { status: 'settled', granted, answered: adopted.decisionSeq !== null };
}

// ─── Recording a decision ─────────────────────────────────────────────

export type DecisionOutcome =
  /** The server accepted it. */
  | { outcome: 'confirmed'; granted: boolean }
  /** Recorded locally and still owed to the server. */
  | { outcome: 'queued'; granted: boolean }
  /** The server refused deterministically. The member must resolve it. */
  | { outcome: 'needs_resolution'; granted: boolean }
  /** There is no member to record a decision for. */
  | { outcome: 'not_a_member' };

/**
 * Record the member's decision.
 *
 * PHASE 1 IS SYNCHRONOUS. The pending record is in memory before the first
 * await, so a revoke is operative against any concurrent emit immediately —
 * not after a disk write, and not after a round trip. An async function body
 * runs synchronously to its first await, and this program has already paid for
 * forgetting that once (the phase-2 cleanup that ran inside phase 1).
 */
export function recordDecision(action: ConsentAction): Promise<DecisionOutcome> {
  const userId = currentMemberId();
  if (userId === null) return Promise.resolve({ outcome: 'not_a_member' });

  // ── PHASE 1 · synchronous ──
  // Deliberately NOT behind `await hydrate()`. A disk read before the ceiling
  // goes up is a window in which a concurrent emit still passes the gate, and a
  // revoke that is "immediate" except for one disk read is not immediate. The
  // only thing hydrate would contribute here is the OLD pending record, which
  // this decision replaces anyway.
  const record: PendingConsentDecision = {
    action,
    disclosureVersion: DISCLOSURE_VERSION,
    basedOnSeq: adopted?.decisionSeq ?? null,
    state: 'queued',
    reissues: 0,
    createdAtMs: Date.now(),
  };
  setPending(record); // ← the ceiling is operative from this line onward
  notify();
  return completeDecision(userId, record);
}

/** Phase 2: persist, then try to publish. Never relaxes what phase 1 set. */
async function completeDecision(
  userId: string,
  record: PendingConsentDecision,
): Promise<DecisionOutcome> {
  await savePending(userId, record);
  await reconcile();
  const p = pending;
  const granted = effectiveGrantedNow();
  if (p === null) return { outcome: 'confirmed', granted };
  if (p.state === 'needs_resolution') return { outcome: 'needs_resolution', granted };
  return { outcome: 'queued', granted };
}

/**
 * The member's explicit retry out of `needs_resolution` — the ONLY route out.
 *
 * No timer, no foreground hook and no flush may call this. That is the whole
 * point of a terminal state: the device stops asking the server a question it
 * has already answered with a deterministic no.
 */
export async function retryPendingDecision(): Promise<DecisionOutcome> {
  const userId = currentMemberId();
  if (userId === null) return { outcome: 'not_a_member' };
  await hydrate();
  if (currentMemberId() !== userId) return { outcome: 'not_a_member' };
  // A suppressed member cannot be re-enrolled by any retry. The UI does not
  // offer one; refuse here too so a stale view cannot drive an impossible
  // request.
  if (identitySuppressed) return { outcome: 'needs_resolution', granted: false };
  const p = pending;
  if (p === null || p.state !== 'needs_resolution') {
    return { outcome: 'confirmed', granted: effectiveGrantedNow() };
  }
  const revived: PendingConsentDecision = {
    ...p,
    state: 'queued',
    reissues: 0,
    basedOnSeq: adopted?.decisionSeq ?? null,
  };
  setPending(revived);
  notify();
  await savePending(userId, revived);
  await reconcile();
  const now = pending;
  const granted = effectiveGrantedNow();
  if (now === null) return { outcome: 'confirmed', granted };
  if (now.state === 'needs_resolution') return { outcome: 'needs_resolution', granted };
  return { outcome: 'queued', granted };
}

// ─── Reconciliation ───────────────────────────────────────────────────

/**
 * Bring the client into agreement with the server: resolve the pseudonym,
 * adopt the server's consent state, and publish any pending local decision.
 *
 * Safe to call on app start and on foreground. Overlapping calls coalesce —
 * two reconciles racing would POST the same decision twice and burn the
 * conflict budget against themselves.
 *
 * Coalescing alone is not enough, though: a caller that records a decision
 * while a reconcile is already past its publish step would have its decision
 * silently deferred to some later trigger. So a request arriving mid-flight
 * sets a single re-run flag — one additional pass, however many callers piled
 * up, so the newest decision is always attempted and the work stays bounded.
 */
export async function reconcile(): Promise<void> {
  if (reconciling !== null) {
    rerunRequested = true;
    return reconciling;
  }
  // Captured SYNCHRONOUSLY, at the moment the reconcile is requested. A
  // reconcile belongs to the member who asked for it; if the account changes
  // before it finishes, the right answer is to abandon it, not to finish it as
  // whoever happens to be signed in when the server replies.
  const requested = captureScopeToken();
  const mine = ++reconcileSeq;
  reconciling = (async () => {
    try {
      await reconcileOnce(requested);
      // Exactly ONE extra pass. A `while` here would let a caller that keeps
      // requesting during the re-run spin the network indefinitely. The re-run
      // takes a FRESH token: it is a new request, possibly by a new member.
      if (rerunRequested) {
        rerunRequested = false;
        await reconcileOnce(captureScopeToken());
      }
    } finally {
      rerunRequested = false;
      if (reconcileSeq === mine) reconciling = null;
    }
  })();
  return reconciling;
}

async function reconcileOnce(token: ScopeToken): Promise<void> {
  // The member id comes FROM the token, never from a second read of the scope.
  //
  // Reading them at two points was a real defect: `userId` was read before
  // `hydrate()` and the token after it, so an account switch in between
  // produced a reconcile that authenticated as B and then wrote B's pseudonym
  // under A's key — with the barrier reporting "still valid", because it was
  // comparing against B. Two reads of one fact, which is the shape of defect
  // this program keeps finding.
  const userId = token.userId;
  if (userId === null) return;
  if (!scopeTokenStillValid(token)) return;
  await hydrate();

  // ── Phase A · identity and the server's own consent state ──
  const res = await resolveIdentityOverWire();
  if (!scopeTokenStillValid(token)) return; // account switched mid-flight
  if (res.ok) {
    identitySuppressed = false;
    setServerId(res.identity.analyticsId);
    adopted = res.identity.consent;
    await saveServerId(userId, res.identity.analyticsId);
    if (!scopeTokenStillValid(token)) return;
    notify();
  } else {
    const klass = classifyConsentFailure(res.status, res.code);
    if (klass === 'transient') {
      // We do not know. Keep the ceiling, change nothing, try again later.
      return;
    }
    // Deterministic: this caller will not be issued a pseudonym as things
    // stand. Emission becomes impossible (no id), which is the fail-closed
    // direction, and the cached id is dropped so it cannot be used again.
    setServerId(null);
    adopted = { granted: false, decisionSeq: null, disclosureVersion: null };
    await saveServerId(userId, null);
    if (!scopeTokenStillValid(token)) return;

    if (res.code === 'analytics_identity_suppressed') {
      // TERMINAL, and terminal in a way `needs_resolution` is not: suppression
      // is permanent, so there is no retry that could ever succeed. Offering
      // one would be a button that is guaranteed to fail. The member is not
      // being collected and cannot be re-enrolled here, so any pending
      // decision — grant or revoke — is moot and is cleared rather than left
      // sitting in a state whose only exit is an impossible retry.
      identitySuppressed = true;
      if (pending !== null) {
        setPending(null);
        await savePending(userId, null);
      }
      pendingUnreadable = false;
      notify();
      return;
    }

    if (pending !== null) await markNeedsResolution(userId, token);
    notify();
    return;
  }

  // ── Phase B · publish the pending decision, if any ──
  await publishPending(userId, token);
}

async function markNeedsResolution(userId: string, token: ScopeToken): Promise<void> {
  const p = pending;
  if (p === null || p.state === 'needs_resolution') return;
  const next: PendingConsentDecision = { ...p, state: 'needs_resolution' };
  if (!scopeTokenStillValid(token)) return;
  setPending(next);
  await savePending(userId, next);
  notify();
}

async function publishPending(userId: string, token: ScopeToken): Promise<void> {
  // Bounded by construction: one initial attempt plus at most
  // MAX_CONFLICT_REISSUES re-issues. There is no path that loops forever.
  for (let attempt = 0; attempt <= MAX_CONFLICT_REISSUES; attempt += 1) {
    const p = pending;
    if (p === null) return;
    // `needs_resolution` is terminal for automation. Nothing here may revive
    // it; only `retryPendingDecision()`, which the member triggers.
    if (p.state === 'needs_resolution') return;
    if (conflictSatisfiesIntent(p.action, adopted, p.disclosureVersion)) {
      // The server already agrees — another device, or an earlier attempt we
      // never saw the answer to. Nothing to send.
      if (!scopeTokenStillValid(token)) return;
      setPending(null);
      await savePending(userId, null);
      notify();
      return;
    }

    const inflight: PendingConsentDecision = {
      ...p,
      state: 'inflight',
      basedOnSeq: adopted?.decisionSeq ?? null,
    };
    setPending(inflight);
    // Captured AFTER installing `inflight`, so it identifies THIS publication.
    // Every write-back below is conditional on it: a decision the member makes
    // while the request is in flight is newer than the snapshot this loop is
    // carrying, and must not be erased by it. `hydrate` has had this guard
    // since the beginning; `publishPending` did not, one function apart.
    const publishSeq = pendingWriteSeq;
    // Persisted BEFORE the request, so a crash mid-flight is recoverable: the
    // next launch finds an `inflight` record and re-sends it. The server's
    // compare-and-set makes that duplicate harmless.
    await savePending(userId, inflight);
    if (!scopeTokenStillValid(token)) return;
    if (pendingWriteSeq !== publishSeq) return; // superseded before we even sent

    const res = await postAnalyticsConsent({
      action: inflight.action,
      disclosureVersion: inflight.disclosureVersion,
      expectedSeq: inflight.basedOnSeq,
    });
    if (!scopeTokenStillValid(token)) return; // account switched mid-flight
    if (pendingWriteSeq !== publishSeq) {
      // A newer decision was recorded while we were waiting. Adopt whatever
      // the server told us — that is still true — but do NOT touch the pending
      // record, which now belongs to the newer decision.
      if (res.ok) adopted = res.consent;
      else if (res.stale === true && res.current !== null) adopted = res.current;
      notify();
      return;
    }

    if (res.ok) {
      adopted = res.consent;
      setPending(null);
      await savePending(userId, null);
      notify();
      return;
    }

    if (res.stale === true) {
      // The CAS refused and handed back the truth. Adopt it first — that is
      // what makes the next attempt's expectedSeq correct rather than a
      // re-send of the same losing value.
      if (res.current !== null) adopted = res.current;
      if (conflictSatisfiesIntent(inflight.action, adopted, inflight.disclosureVersion)) {
        setPending(null);
        await savePending(userId, null);
        notify();
        return;
      }
      if (inflight.reissues >= MAX_CONFLICT_REISSUES) {
        await markNeedsResolution(userId, token);
        notify();
        return;
      }
      const retry: PendingConsentDecision = {
        ...inflight,
        state: 'queued',
        reissues: inflight.reissues + 1,
      };
      setPending(retry);
      await savePending(userId, retry);
      notify();
      continue; // bounded by the loop, not by hope
    }

    if (classifyConsentFailure(res.status, res.code) === 'transient') {
      // Session loss or an unreachable server. Still owed; ceiling intact.
      const requeued: PendingConsentDecision = { ...inflight, state: 'queued' };
      setPending(requeued);
      await savePending(userId, requeued);
      notify();
      return;
    }

    // Deterministic refusal. Stop automating this decision for good.
    await markNeedsResolution(userId, token);
    notify();
    return;
  }
}

// ─── delete-my-data support ───────────────────────────────────────────

/**
 * Raise a DURABLE restrictive ceiling before asking the server to erase.
 *
 * The ceiling goes up FIRST and is on disk before the request leaves, so the
 * sequence that made a failed erasure silently re-enrol a member —
 *
 *   delete requested -> server failure -> local state cleared -> server grant
 *   re-adopted on the next reconcile -> analytics resumes
 *
 * — cannot happen: there is nothing to re-adopt over. If the erase is never
 * confirmed the record survives the restart, the gate stays closed, and the
 * revoke is published to the server on the next reconcile, which is what the
 * member asked for anyway.
 *
 * Phase 1 is synchronous, like `recordDecision`: the ceiling is operative
 * against any concurrent emit before the first await.
 */
export function requestErasureCeiling(): Promise<void> {
  const userId = currentMemberId();
  if (userId === null) return Promise.resolve();
  const record: PendingConsentDecision = {
    action: 'revoke',
    disclosureVersion: adopted?.disclosureVersion ?? DISCLOSURE_VERSION,
    basedOnSeq: adopted?.decisionSeq ?? null,
    state: 'queued',
    reissues: 0,
    createdAtMs: Date.now(),
  };
  setPending(record); // ← closed from this line onward
  notify();
  return savePending(userId, record);
}

/**
 * Drop every local trace this module owns for the CURRENT member, after the
 * server has CONFIRMED it erased its side.
 *
 * Only ever called on a confirmed erasure. On failure the ceiling raised by
 * `requestErasureCeiling` must survive instead — clearing it there is what
 * produced the silent re-enrolment.
 */
export async function clearLocalAuthorityState(): Promise<void> {
  const userId = currentMemberId();
  identitySuppressed = true;
  pendingUnreadable = false;
  adopted = { granted: false, decisionSeq: null, disclosureVersion: null };
  setPending(null);
  serverId = null;
  notify();
  if (userId === null) return;
  await savePending(userId, null);
  await saveServerId(userId, null);
}

/** TEST-ONLY. Key helpers, so laws can assert on the exact namespace used. */
export const __keysForTests = {
  pendingKey,
  serverIdKey,
  PENDING_KEY_PREFIX,
  SERVER_ID_KEY_PREFIX,
};

/** TEST-ONLY. Inspect and reset the in-memory authority. */
export const __authorityForTests = {
  snapshot: () => ({ adopted, pending, serverId, hydratedFor, pendingUnreadable, identitySuppressed }),
  reset: () => {
    adopted = null;
    pending = null;
    pendingUnreadable = false;
    identitySuppressed = false;
    serverId = null;
    hydratedFor = null;
    hydrating = null;
    reconciling = null;
    rerunRequested = false;
  },
};
