/**
 * CONNECTED HEALTH — pure view-model resolver.
 *
 * Turns the raw per-provider connection facts (canonical presentation state
 * from `services/health/providerPresentation.ts`, last-sync timestamp,
 * granted/denied record types, error notes) into a fully-resolved,
 * presentation-ready view model for the Connected Health command center.
 * RN-free and dependency-free so it stays unit-testable and deterministic
 * (`now` is injected; nothing reads the clock).
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
 *     renders `unknown` — never silently assumed granted.
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
  /** Human-readable error detail when presentation.state === 'error'; else null. */
  errorNote: string | null;
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
  label: string;
  tone: StatusTone;
}

export interface ConnectedHealthPullChip {
  type: CanonicalHealthMetricType;
  label: string;
  status: PullChipStatus;
}

export interface ConnectedHealthTroubleshoot {
  kind: TroubleshootKind;
  /** Accessible action label; null when kind === 'none' (no affordance to render). */
  label: string | null;
}

export interface ConnectedHealthRowView {
  providerId: HealthProviderId;
  displayName: string;
  group: ConnectedHealthRowGroup;
  statusPill: ConnectedHealthStatusPill;
  /** "Synced 2h ago" | "Never synced" — always present, never fabricated. */
  freshnessLine: string;
  pulls: readonly ConnectedHealthPullChip[];
  subCopy: string;
  /** e.g. "Samsung Health · via Health Connect" — always visible provenance. */
  provenanceLine: string;
  troubleshoot: ConnectedHealthTroubleshoot;
  canDisconnect: boolean;
}

export interface ConnectedHealthFooterView {
  title: string; // "HOW YOUR DATA IS USED"
  /** EXACT Score-Protection sentence — do not paraphrase. */
  scoreProtectionLine: string;
  body: string;
}

export interface ConnectedHealthView {
  mode: ConnectedHealthScreenMode;
  header: { title: string; tagline: string };
  /** Non-null only when mode === 'offline'. */
  offlineNotice: string | null;
  rows: readonly ConnectedHealthRowView[];
  /** Non-null only when mode === 'ready' and there are zero rows. */
  emptyCopy: string | null;
  footer: ConnectedHealthFooterView;
}

// ─── Exact, load-bearing copy ────────────────────────────────────────────────

/** EXACT Score-Protection sentence (governance: health data → Readiness only). */
export const SCORE_PROTECTION_LINE =
  'Health data informs Readiness only. It never changes your Hydration Score.';

export const CONNECTED_HEALTH_HEADER = {
  title: 'CONNECTED HEALTH',
  tagline: "What's connected, what's synced, and what isn't — stated plainly.",
} as const;

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

const STATE_LABEL: Record<ProviderPresentationState, string> = {
  connected: 'Connected',
  connected_limited: 'Limited Access',
  syncing: 'Syncing',
  stale: 'Stale',
  no_recent_data: 'No Recent Data',
  action_required: 'Action Required',
  error: 'Error',
  via_health_connect: 'Via Health Connect',
  connecting: 'Connecting',
  disconnected: 'Not Connected',
  dormant: 'Coming Soon',
  requires_external_approval: 'Approval Pending',
  unavailable: 'Unavailable',
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

/** Honest per-state sub-copy. The five values below are the EXACT required strings. */
function subCopyFor(state: ProviderPresentationState, errorNote: string | null): string {
  switch (state) {
    case 'dormant': return 'Awaiting partner access';
    case 'via_health_connect': return 'Arrives through Health Connect';
    case 'stale': return 'Connected — data is stale';
    case 'no_recent_data': return 'Connected — no recent data';
    case 'connected_limited': return 'Limited permissions granted';
    case 'connected': return 'Connected and syncing normally';
    case 'syncing': return 'Sync in progress';
    case 'connecting': return 'Connecting…';
    case 'disconnected': return 'Not connected';
    case 'action_required': return 'Reconnect to resume syncing';
    case 'error': return errorNote ? `Sync error — ${errorNote}` : 'Sync error — reconnect to resolve';
    case 'requires_external_approval': return 'Awaiting partner approval';
    case 'unavailable': return 'Not available on this device';
  }
}

const TROUBLESHOOT_KIND: Record<ProviderPresentationState, TroubleshootKind> = {
  connected: 'none',
  connected_limited: 'manage_permissions',
  syncing: 'none',
  stale: 'none',
  no_recent_data: 'reconnect',
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

const METHOD_PROVENANCE: Record<ConnectMethod, string> = {
  device_native: 'Direct',
  oauth_cloud: 'Direct',
  via_health_connect: 'via Health Connect',
};

const METRIC_LABEL: Record<CanonicalHealthMetricType, string> = {
  sleep_session: 'Sleep',
  resting_heart_rate: 'Resting HR',
  hrv: 'HRV',
  heart_rate_summary: 'Heart Rate',
  workout: 'Workouts',
  steps: 'Steps',
  active_energy: 'Active Energy',
  respiratory_rate: 'Respiratory Rate',
  provider_score: 'Provider Score',
};

const DISPLAY_NAME_BY_ID: Partial<Record<HealthProviderId, string>> = Object.fromEntries(
  HEALTH_PROVIDERS.map((p) => [p.id, p.name]),
);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function troubleshootLabel(kind: TroubleshootKind, platform: ConnectedHealthPlatform): string | null {
  switch (kind) {
    case 'connect': return 'Connect';
    case 'reconnect': return 'Reconnect';
    case 'manage_permissions':
      return platform === 'ios'
        ? 'Manage in Health app'
        : platform === 'android'
          ? 'Manage in Health Connect'
          : 'Manage Permissions';
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

/** Deterministic freshness label from injected `now` — never `Date.now()`. */
function formatSyncedAgo(now: number, lastSyncAtMs: number): string {
  const ms = Math.max(0, now - lastSyncAtMs);
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'Synced just now';
  if (mins < 60) return `Synced ${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Synced ${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `Synced ${days}d ago`;
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
    offlineNotice: mode === 'offline' ? 'Offline — showing the last known connection status.' : null,
    rows,
    emptyCopy: mode === 'ready' && rows.length === 0 ? 'No health sources configured yet.' : null,
    footer: {
      title: 'HOW YOUR DATA IS USED',
      scoreProtectionLine: SCORE_PROTECTION_LINE,
      body: 'Disconnecting a source stops new data immediately. Historical entries stay attributed to the provider that recorded them.',
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

  const freshnessLine =
    p.lastSyncAtMs == null ? 'Never synced' : (p.ageLabel ?? formatSyncedAgo(now, p.lastSyncAtMs));

  const troubleshootKind = TROUBLESHOOT_KIND[state];

  return {
    providerId: p.providerId,
    displayName: DISPLAY_NAME_BY_ID[p.providerId] ?? p.providerId,
    group,
    statusPill: {
      state,
      label: STATE_LABEL[state],
      tone: STATE_TONE[state],
    },
    freshnessLine,
    pulls: capability.recordTypes.map((type) => ({
      type,
      label: METRIC_LABEL[type],
      status: pullStatus(type, p.grantedTypes, p.deniedTypes),
    })),
    subCopy: subCopyFor(state, p.errorNote),
    provenanceLine: `${DISPLAY_NAME_BY_ID[p.providerId] ?? p.providerId} · ${METHOD_PROVENANCE[capability.method]}`,
    troubleshoot: {
      kind: troubleshootKind,
      label: troubleshootLabel(troubleshootKind, platform),
    },
    canDisconnect: CAN_DISCONNECT_STATES.has(state),
  };
}
