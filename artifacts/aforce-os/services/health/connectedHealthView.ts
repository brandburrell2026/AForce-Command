/**
 * CONNECTED HEALTH — pure view-model resolver.
 *
 * Turns the raw per-provider connection facts (canonical presentation state
 * from `services/health/providerPresentation.ts`, last-sync timestamp,
 * granted/denied record types, a closed error-kind enum) into a fully-resolved
 * view model for the Connected Health command center. RN-free and
 * dependency-free so it stays unit-testable and deterministic (`now` is
 * injected; nothing reads the clock).
 *
 * I18N ARCHITECTURE (review #460, item 4):
 *   This resolver NEVER calls `t()` and never imports react-i18next / the app
 *   i18n singleton. Every user-facing string is emitted as an `I18nText` —
 *   `{ key, params? }` — pointing at the `connected_health.*` namespace in
 *   `locales/*.json`. Translation happens exactly one place: the
 *   presentational component (`components/health/ConnectedHealthView.tsx`),
 *   which is the only file in this surface that calls `useTranslation()`.
 *   This choice was made (over translating at the resolver edge) because the
 *   resolver's own unit tests assert on the state → copy mapping tables
 *   below; keeping the resolver's output as stable, locale-independent keys
 *   means those tests need no i18n runtime and stay exactly as fast and
 *   dependency-free as the rest of this module. It also means a locale can
 *   be edited without touching or re-testing this file at all.
 *
 * HONESTY DISCIPLINE (mirrors sleepModeView / healthProviderStatus):
 *   - `state` on the status pill is ALWAYS the true `ProviderPresentationState`
 *     — `stale` and `no_recent_data` NEVER render as `connected`, and their
 *     tone is never `green` (the "live/connected" tone). Only a genuinely
 *     fresh, real link earns `green`.
 *   - Freshness is ALWAYS surfaced for every row (not just connected ones):
 *     `lastSyncAtMs === null` ⇒ "Never synced" — never a fabricated time.
 *   - Sub-copy per state is the exact, honest sentence the state warrants
 *     (e.g. `dormant` ⇒ "Awaiting partner access", never "Connected").
 *   - Pull chips reflect the REAL permission grant, not the mere existence of
 *     a capability: a type absent from both `grantedTypes` and `deniedTypes`
 *     renders `unknown` — never silently assumed granted. Gated rows
 *     (`dormant` / `requires_external_approval` / `unavailable`) never render
 *     pull chips at all — there is no real link to have pulled anything from.
 *   - Troubleshoot affordances match what is actually actionable: `stale`
 *     has a live link with old data, so `reconnect` is offered; `no_recent_data`
 *     has a live link that has simply produced nothing yet, so there is
 *     nothing to reconnect — no affordance is offered and the sub-copy says so.
 *   - `errorKind` is a closed union, never a raw provider/HTTP string — no
 *     backend error text has a path into product copy.
 *   - Health data is scoped to Readiness ONLY. The footer card carries the
 *     exact Score-Protection sentence; nothing in this module (or its
 *     consumers) may imply health data changes the Hydration Score.
 *
 * Governance: consumes `@workspace/health-core` (frozen provider vocabulary)
 * and `services/health/providerPresentation.ts` (§53-aware freshness). Does
 * NOT modify scoringEngine.ts / statusColor.ts (off-limits) and carries no
 * store, flag, or navigation dependency — the container wires those.
 */
import type {
  HealthProviderId,
  ProviderPresentationState,
  CanonicalHealthMetricType,
  ConnectMethod,
} from '@workspace/health-core';
import { HEALTH_PROVIDER_CAPABILITIES } from '@workspace/health-core';
import { HEALTH_PROVIDERS } from '@/data/healthProviders';
import type { ProviderPresentation } from './providerPresentation';

export type ConnectedHealthPlatform = 'ios' | 'android' | 'web';

/** Screen-level data-availability mode (drives loading/offline shells). */
export type ConnectedHealthScreenMode = 'ready' | 'loading' | 'offline';

/** Which of the three honest buckets a row sorts into (spec order). */
export type ConnectedHealthRowGroup = 'connected' | 'connectable' | 'gated';

/** Color-independent status tone — always paired with text + shape, never alone. */
export type StatusTone = 'green' | 'cyan' | 'amber' | 'red' | 'neutral';

export type TroubleshootKind = 'connect' | 'reconnect' | 'manage_permissions' | 'none';

export type PullChipStatus = 'granted' | 'denied' | 'unknown';

/**
 * Closed error vocabulary (review #460, item 7). No raw provider/HTTP error
 * text is ever accepted here — the caller (container) classifies the failure
 * into one of these four buckets before handing it to the resolver.
 */
export type ConnectedHealthErrorKind =
  | 'sync_failed'
  | 'auth_expired'
  | 'permission_revoked'
  | 'provider_outage';

/** A translation reference, never a resolved string. See file header. */
export interface I18nText {
  key: string;
  params?: Record<string, string | number>;
}

// ─── Inputs ──────────────────────────────────────────────────────────────────

export interface ConnectedHealthProviderInput {
  providerId: HealthProviderId;
  /** Output of resolveProviderPresentation (already §53 freshness-aware). */
  presentation: ProviderPresentation;
  /** Epoch ms of the newest real snapshot, or null when never synced. */
  lastSyncAtMs: number | null;
  /** Record types the user has actually granted (subset of the capability's recordTypes). */
  grantedTypes: readonly CanonicalHealthMetricType[];
  /** Record types the user has actually denied (subset of the capability's recordTypes). */
  deniedTypes: readonly CanonicalHealthMetricType[];
  /** Closed error classification when presentation.state === 'error'; else null. */
  errorKind: ConnectedHealthErrorKind | null;
  /**
   * Optional PRE-FORMATTED freshness line (e.g. "Synced 2h ago"), typically
   * produced by a locale-aware formatter upstream. When omitted, the resolver
   * derives a deterministic label from `lastSyncAtMs` and the injected `now`.
   */
  ageLabel?: string | null;
}

export interface ConnectedHealthInput {
  now: number; // epoch ms — injected for testability
  mode: ConnectedHealthScreenMode;
  platform: ConnectedHealthPlatform;
  providers: readonly ConnectedHealthProviderInput[];
}

// ─── Resolved view model ─────────────────────────────────────────────────────

export interface ConnectedHealthStatusPill {
  state: ProviderPresentationState;
  label: I18nText;
  tone: StatusTone;
}

export interface ConnectedHealthPullChip {
  type: CanonicalHealthMetricType;
  label: I18nText;
  status: PullChipStatus;
}

export interface ConnectedHealthTroubleshoot {
  kind: TroubleshootKind;
  /** Accessible action label; null when kind === 'none' (no affordance to render). */
  label: I18nText | null;
}

export interface ConnectedHealthRowView {
  providerId: HealthProviderId;
  displayName: string;
  group: ConnectedHealthRowGroup;
  statusPill: ConnectedHealthStatusPill;
  /** "Synced 2h ago" | "Never synced" — always present, never fabricated. */
  freshness: I18nText;
  /** Empty for gated rows (dormant / requires_external_approval / unavailable) — no real link exists. */
  pulls: readonly ConnectedHealthPullChip[];
  subCopy: I18nText;
  /** e.g. "Samsung Health · via Health Connect" — always visible provenance. */
  provenance: I18nText;
  troubleshoot: ConnectedHealthTroubleshoot;
  canDisconnect: boolean;
}

export interface ConnectedHealthFooterView {
  title: I18nText; // "HOW YOUR DATA IS USED"
  /** EXACT Score-Protection sentence — do not paraphrase. See SCORE_PROTECTION_LINE. */
  scoreProtectionLine: I18nText;
  body: I18nText;
}

export interface ConnectedHealthView {
  mode: ConnectedHealthScreenMode;
  header: { title: I18nText; tagline: I18nText };
  /** Non-null only when mode === 'offline'. */
  offlineNotice: I18nText | null;
  rows: readonly ConnectedHealthRowView[];
  /** Non-null only when mode === 'ready' and there are zero rows. */
  emptyCopy: I18nText | null;
  footer: ConnectedHealthFooterView;
}

// ─── Exact, load-bearing copy ────────────────────────────────────────────────

/**
 * EXACT Score-Protection sentence (governance: health data → Readiness only).
 * The resolver does NOT emit this string directly — `footer.scoreProtectionLine`
 * is the locale key `connected_health.footer.score_protection`. This constant
 * is the canonical literal kept for tests and documentation; the EN value at
 * that key must always equal it exactly (enforced by
 * `services/health/__tests__/prohibitedCopy.test.ts`).
 */
export const SCORE_PROTECTION_LINE =
  'Health data informs Readiness only. It never changes your Hydration Score.';

export const CONNECTED_HEALTH_HEADER: { title: I18nText; tagline: I18nText } = {
  title: { key: 'connected_health.header.title' },
  tagline: { key: 'connected_health.header.tagline' },
};

// ─── Static maps (state → honest presentation facts) ────────────────────────

/** Sort bucket per §53-aware presentation state — connected first, then connectable, then gated. */
export const CONNECTED_HEALTH_GROUP_BY_STATE: Record<ProviderPresentationState, ConnectedHealthRowGroup> = {
  connected: 'connected',
  connected_limited: 'connected',
  syncing: 'connected',
  stale: 'connected',
  no_recent_data: 'connected',
  action_required: 'connected',
  error: 'connected',
  via_health_connect: 'connected',
  connecting: 'connected',
  disconnected: 'connectable',
  dormant: 'gated',
  requires_external_approval: 'gated',
  unavailable: 'gated',
};

const GROUP_RANK: Record<ConnectedHealthRowGroup, number> = {
  connected: 0,
  connectable: 1,
  gated: 2,
};

/**
 * Locale key suffix per state, under `connected_health.state_label.*`.
 * Kept as an exhaustive Record (rather than a template string) so adding a
 * new `ProviderPresentationState` in health-core is a compile error here
 * until a factual, non-promissory label is chosen for it.
 *
 * Review #460 item 1: `dormant` reads factually as "Awaiting Access" (never
 * "Coming Soon" — that is commitment language this product has not made).
 * `requires_external_approval` keeps its OWN distinct factual label
 * ("Approval Pending") — the two gated states are never merged into one copy.
 */
const STATE_LABEL_KEY: Record<ProviderPresentationState, string> = {
  connected: 'connected',
  connected_limited: 'connected_limited',
  syncing: 'syncing',
  stale: 'stale',
  no_recent_data: 'no_recent_data',
  action_required: 'action_required',
  error: 'error',
  via_health_connect: 'via_health_connect',
  connecting: 'connecting',
  disconnected: 'disconnected',
  dormant: 'dormant',
  requires_external_approval: 'requires_external_approval',
  unavailable: 'unavailable',
};

/** Never `green` for anything short of a genuinely fresh, real link. */
const STATE_TONE: Record<ProviderPresentationState, StatusTone> = {
  connected: 'green',
  connected_limited: 'amber',
  syncing: 'cyan',
  stale: 'amber',
  no_recent_data: 'amber',
  action_required: 'red',
  error: 'red',
  via_health_connect: 'cyan',
  connecting: 'cyan',
  disconnected: 'neutral',
  dormant: 'neutral',
  requires_external_approval: 'neutral',
  unavailable: 'neutral',
};

/** Non-error states each have exactly one honest sub-copy key. */
type NonErrorState = Exclude<ProviderPresentationState, 'error'>;

const SUB_COPY_KEY: Record<NonErrorState, string> = {
  dormant: 'dormant',
  via_health_connect: 'via_health_connect',
  stale: 'stale',
  // Review #460 item 2: the link is real and fine here — there is simply
  // nothing to sync yet. The copy explains that explicitly so the missing
  // troubleshoot affordance (see TROUBLESHOOT_KIND below) reads as intentional,
  // not broken.
  no_recent_data: 'no_recent_data',
  connected_limited: 'connected_limited',
  connected: 'connected',
  syncing: 'syncing',
  connecting: 'connecting',
  disconnected: 'disconnected',
  action_required: 'action_required',
  requires_external_approval: 'requires_external_approval',
  unavailable: 'unavailable',
};

/** `error` sub-copy is keyed by the closed error kind, never a raw string. */
const ERROR_SUB_COPY_KEY: Record<ConnectedHealthErrorKind | 'unknown', string> = {
  sync_failed: 'sync_failed',
  auth_expired: 'auth_expired',
  permission_revoked: 'permission_revoked',
  provider_outage: 'provider_outage',
  unknown: 'unknown',
};

/**
 * Troubleshoot affordance per state (review #460 item 2 — SWAPPED from the
 * shipped #460 build, which had this backwards):
 *   - `stale`: a real link exists but the last snapshot has aged out —
 *     actionable, so `reconnect` is offered.
 *   - `no_recent_data`: the link is fine; the user simply hasn't generated
 *     anything for the provider to sync yet. There is nothing to reconnect —
 *     `none`. The sub-copy (see SUB_COPY_KEY) explains why no button appears.
 */
const TROUBLESHOOT_KIND: Record<ProviderPresentationState, TroubleshootKind> = {
  connected: 'none',
  connected_limited: 'manage_permissions',
  syncing: 'none',
  stale: 'reconnect',
  no_recent_data: 'none',
  action_required: 'reconnect',
  error: 'reconnect',
  via_health_connect: 'none',
  connecting: 'none',
  disconnected: 'connect',
  dormant: 'none',
  requires_external_approval: 'none',
  unavailable: 'none',
};

/** A row can only be disconnected while a real link genuinely exists. */
const CAN_DISCONNECT_STATES: ReadonlySet<ProviderPresentationState> = new Set([
  'connected', 'connected_limited', 'syncing', 'stale', 'no_recent_data', 'action_required', 'error',
]);

const DISPLAY_NAME_BY_ID: Partial<Record<HealthProviderId, string>> = Object.fromEntries(
  HEALTH_PROVIDERS.map((p) => [p.id, p.name]),
);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function troubleshootLabel(kind: TroubleshootKind, platform: ConnectedHealthPlatform): I18nText | null {
  switch (kind) {
    case 'connect': return { key: 'connected_health.troubleshoot.connect' };
    case 'reconnect': return { key: 'connected_health.troubleshoot.reconnect' };
    case 'manage_permissions':
      return { key: `connected_health.troubleshoot.manage_permissions_${platform}` };
    case 'none': return null;
  }
}

function pullStatus(
  type: CanonicalHealthMetricType,
  granted: readonly CanonicalHealthMetricType[],
  denied: readonly CanonicalHealthMetricType[],
): PullChipStatus {
  if (denied.includes(type)) return 'denied';
  if (granted.includes(type)) return 'granted';
  return 'unknown';
}

function pullChipLabel(type: CanonicalHealthMetricType): I18nText {
  return { key: `connected_health.pull_chip_label.${type}` };
}

function provenanceFor(providerId: HealthProviderId, method: ConnectMethod): I18nText {
  const name = DISPLAY_NAME_BY_ID[providerId] ?? providerId;
  const key = method === 'via_health_connect'
    ? 'connected_health.provenance.via_health_connect'
    : 'connected_health.provenance.direct';
  return { key, params: { name } };
}

/** Deterministic freshness reference from injected `now` — never `Date.now()`. */
function freshnessFor(now: number, lastSyncAtMs: number | null, ageLabel: string | null | undefined): I18nText {
  if (lastSyncAtMs == null) return { key: 'connected_health.freshness.never_synced' };
  if (ageLabel != null) return { key: 'connected_health.freshness.literal', params: { text: ageLabel } };

  const ms = Math.max(0, now - lastSyncAtMs);
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return { key: 'connected_health.freshness.just_now' };
  if (mins < 60) return { key: 'connected_health.freshness.minutes_ago', params: { count: mins } };
  const hours = Math.floor(mins / 60);
  if (hours < 24) return { key: 'connected_health.freshness.hours_ago', params: { count: hours } };
  const days = Math.floor(hours / 24);
  return { key: 'connected_health.freshness.days_ago', params: { count: days } };
}

// ─── Resolver ────────────────────────────────────────────────────────────────

export function resolveConnectedHealthView(input: ConnectedHealthInput): ConnectedHealthView {
  const { now, mode, platform, providers } = input;

  const rows = providers
    .map((p, index) => ({ row: resolveProviderRow(p, now, platform), index }))
    .sort((a, b) => {
      const rankDiff = GROUP_RANK[a.row.group] - GROUP_RANK[b.row.group];
      return rankDiff !== 0 ? rankDiff : a.index - b.index; // stable within group
    })
    .map((x) => x.row);

  return {
    mode,
    header: CONNECTED_HEALTH_HEADER,
    offlineNotice: mode === 'offline' ? { key: 'connected_health.offline_notice' } : null,
    rows,
    emptyCopy: mode === 'ready' && rows.length === 0 ? { key: 'connected_health.empty' } : null,
    footer: {
      title: { key: 'connected_health.footer.title' },
      scoreProtectionLine: { key: 'connected_health.footer.score_protection' },
      body: { key: 'connected_health.footer.body' },
    },
  };
}

function resolveProviderRow(
  p: ConnectedHealthProviderInput,
  now: number,
  platform: ConnectedHealthPlatform,
): ConnectedHealthRowView {
  const state = p.presentation.state;
  const capability = HEALTH_PROVIDER_CAPABILITIES[p.providerId];
  const group = CONNECTED_HEALTH_GROUP_BY_STATE[state];

  const troubleshootKind = TROUBLESHOOT_KIND[state];

  const subCopy: I18nText = state === 'error'
    ? { key: `connected_health.sub_copy.error.${ERROR_SUB_COPY_KEY[p.errorKind ?? 'unknown']}` }
    : { key: `connected_health.sub_copy.${SUB_COPY_KEY[state as NonErrorState]}` };

  return {
    providerId: p.providerId,
    displayName: DISPLAY_NAME_BY_ID[p.providerId] ?? p.providerId,
    group,
    statusPill: {
      state,
      label: { key: `connected_health.state_label.${STATE_LABEL_KEY[state]}` },
      tone: STATE_TONE[state],
    },
    freshness: freshnessFor(now, p.lastSyncAtMs, p.ageLabel),
    // Review #460 item 6: gated rows have no real link — never claim a pull.
    pulls: group === 'gated'
      ? []
      : capability.recordTypes.map((type) => ({
          type,
          label: pullChipLabel(type),
          status: pullStatus(type, p.grantedTypes, p.deniedTypes),
        })),
    subCopy,
    provenance: provenanceFor(p.providerId, capability.method),
    troubleshoot: {
      kind: troubleshootKind,
      label: troubleshootLabel(troubleshootKind, platform),
    },
    canDisconnect: CAN_DISCONNECT_STATES.has(state),
  };
}
