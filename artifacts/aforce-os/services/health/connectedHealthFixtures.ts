/**
 * CONNECTED HEALTH — deterministic fixtures for every visual + honesty state.
 *
 * Pure data only (no RN). Two layers:
 *
 *  1. `PROVIDER_ROW_FIXTURES` — one `ConnectedHealthProviderInput` per
 *     `ProviderPresentationState` (all 13, per the frozen `@workspace/health-core`
 *     vocabulary). Used by the resolver's per-state unit tests. Providers are
 *     reused across states here deliberately — this is a state-coverage table,
 *     not a simultaneous screen render.
 *
 *  2. `CONNECTED_HEALTH_FIXTURES` — full-screen `ConnectedHealthInput` scenarios
 *     (one row per real provider, believable state per provider) for the
 *     render harness + loading/offline/empty screen states.
 */
import type { HealthProviderId, ProviderPresentationState, CanonicalHealthMetricType } from '@workspace/health-core';
import { HEALTH_PROVIDER_CAPABILITIES } from '@workspace/health-core';
import { HEALTH_PROVIDERS } from '@/data/healthProviders';
import {
  CONNECTED_HEALTH_GROUP_BY_STATE,
  type ConnectedHealthInput,
  type ConnectedHealthProviderInput,
} from './connectedHealthView';

const FIXED_NOW = new Date('2026-04-22T21:30:00Z').getTime();
const MIN = 60_000;
const HOUR = 60 * MIN;

/** States that carry a genuinely real, currently-fresh link (per §53 rules). */
const LIVE_ELIGIBLE: ReadonlySet<ProviderPresentationState> = new Set([
  'connected', 'connected_limited', 'syncing',
]);

/** States for which the provider has an actual link (used to seed default grants). */
const HAS_LINK: ReadonlySet<ProviderPresentationState> = new Set(
  (Object.keys(CONNECTED_HEALTH_GROUP_BY_STATE) as ProviderPresentationState[]).filter(
    (s) => CONNECTED_HEALTH_GROUP_BY_STATE[s] === 'connected',
  ),
);

function providerFixture(
  providerId: HealthProviderId,
  state: ProviderPresentationState,
  over: {
    lastSyncAtMs: number | null;
    grantedTypes?: readonly CanonicalHealthMetricType[];
    deniedTypes?: readonly CanonicalHealthMetricType[];
    errorNote?: string | null;
    ageLabel?: string | null;
  },
): ConnectedHealthProviderInput {
  const { lastSyncAtMs } = over;
  const dataAgeMs = lastSyncAtMs == null ? null : Math.max(0, FIXED_NOW - lastSyncAtMs);
  const live = LIVE_ELIGIBLE.has(state) && lastSyncAtMs != null;
  const allTypes = HEALTH_PROVIDER_CAPABILITIES[providerId].recordTypes;

  return {
    providerId,
    presentation: { state, live, dataAgeMs },
    lastSyncAtMs,
    // Honest default: only assume grants exist where a real link exists, and
    // only for types not explicitly denied by the caller.
    grantedTypes:
      over.grantedTypes ?? (HAS_LINK.has(state) ? allTypes.filter((t) => !(over.deniedTypes ?? []).includes(t)) : []),
    deniedTypes: over.deniedTypes ?? [],
    errorNote: over.errorNote ?? null,
    ageLabel: over.ageLabel ?? null,
  };
}

/** One fixture per ProviderPresentationState — full 13-state coverage. */
export const PROVIDER_ROW_FIXTURES: Record<ProviderPresentationState, ConnectedHealthProviderInput> = {
  connected: providerFixture('whoop', 'connected', { lastSyncAtMs: FIXED_NOW - 5 * MIN }),

  connected_limited: providerFixture('apple_health', 'connected_limited', {
    lastSyncAtMs: FIXED_NOW - 30 * MIN,
    deniedTypes: ['sleep_session'],
  }),

  syncing: providerFixture('oura', 'syncing', { lastSyncAtMs: FIXED_NOW - 2 * MIN }),

  // Stale: real link, last real snapshot >24h old (§53 stale window).
  stale: providerFixture('oura', 'stale', { lastSyncAtMs: FIXED_NOW - 30 * HOUR }),

  // No recent data: real link, snapshot beyond the §53 expiry window — stream is dark.
  no_recent_data: providerFixture('whoop', 'no_recent_data', { lastSyncAtMs: FIXED_NOW - 100 * HOUR }),

  action_required: providerFixture('google_health', 'action_required', {
    lastSyncAtMs: FIXED_NOW - 3 * HOUR,
    errorNote: 'Permission needs to be renewed.',
  }),

  error: providerFixture('strava', 'error', {
    lastSyncAtMs: FIXED_NOW - 5 * HOUR,
    errorNote: 'Last sync failed — token expired.',
  }),

  disconnected: providerFixture('strava', 'disconnected', { lastSyncAtMs: null }),

  connecting: providerFixture('oura', 'connecting', { lastSyncAtMs: null }),

  // Samsung: Phase-1 arrives as an upstream origin through Health Connect only.
  via_health_connect: providerFixture('samsung_health', 'via_health_connect', {
    lastSyncAtMs: FIXED_NOW - 45 * MIN,
  }),

  // Garmin: UNVERIFIED pending partner credentials (health-core contracts.ts) → dormant.
  dormant: providerFixture('garmin', 'dormant', { lastSyncAtMs: null }),

  // Garmin's Health API requires a formal partner approval not yet granted.
  requires_external_approval: providerFixture('garmin', 'requires_external_approval', { lastSyncAtMs: null }),

  // Google Health Connect: device-native but not available on this build/device.
  unavailable: providerFixture('google_health', 'unavailable', { lastSyncAtMs: null }),
};

export type ProviderRowFixtureKey = keyof typeof PROVIDER_ROW_FIXTURES;

// ─── Full-screen scenarios (render harness) ──────────────────────────────────

function screen(over: Partial<ConnectedHealthInput> = {}): ConnectedHealthInput {
  return {
    now: FIXED_NOW,
    mode: 'ready',
    platform: 'ios',
    providers: [],
    ...over,
  };
}

/** One row per real catalog provider, a believable mixed set of states. */
const MIXED_PROVIDERS: readonly ConnectedHealthProviderInput[] = [
  providerFixture('apple_health', 'connected', { lastSyncAtMs: FIXED_NOW - 12 * MIN }),
  providerFixture('whoop', 'connected', { lastSyncAtMs: FIXED_NOW - 5 * MIN }),
  providerFixture('oura', 'stale', { lastSyncAtMs: FIXED_NOW - 30 * HOUR }),
  providerFixture('samsung_health', 'via_health_connect', { lastSyncAtMs: FIXED_NOW - 45 * MIN }),
  providerFixture('google_health', 'action_required', {
    lastSyncAtMs: FIXED_NOW - 3 * HOUR,
    errorNote: 'Permission needs to be renewed.',
  }),
  providerFixture('garmin', 'dormant', { lastSyncAtMs: null }),
  providerFixture('strava', 'disconnected', { lastSyncAtMs: null }),
];

export const CONNECTED_HEALTH_FIXTURES: Record<string, ConnectedHealthInput> = {
  // 1 · Mixed — every group represented (connected / connectable / gated)
  mixed: screen({ providers: MIXED_PROVIDERS }),

  // 2 · All connected — the happiest honest state
  'all-connected': screen({
    providers: HEALTH_PROVIDERS.map((p) =>
      providerFixture(p.id, 'connected', { lastSyncAtMs: FIXED_NOW - 10 * MIN }),
    ),
  }),

  // 3 · Loading — no rows resolved yet
  loading: screen({ mode: 'loading', providers: [] }),

  // 4 · Offline — last known state still shown, loudly marked stale-context
  offline: screen({ mode: 'offline', providers: MIXED_PROVIDERS }),

  // 5 · Empty — zero providers configured (defensive/edge state)
  empty: screen({ providers: [] }),

  // 6 · Error-heavy — every connected row needs attention
  'needs-attention': screen({
    providers: [
      providerFixture('apple_health', 'action_required', {
        lastSyncAtMs: FIXED_NOW - 6 * HOUR,
        errorNote: 'Motion & Fitness permission revoked.',
      }),
      providerFixture('whoop', 'error', {
        lastSyncAtMs: FIXED_NOW - 8 * HOUR,
        errorNote: 'Last sync failed — token expired.',
      }),
    ],
  }),

  // 7 · Android platform — Samsung + Google Health Connect framing
  android: screen({
    platform: 'android',
    providers: [
      providerFixture('samsung_health', 'via_health_connect', { lastSyncAtMs: FIXED_NOW - 20 * MIN }),
      providerFixture('google_health', 'connected_limited', {
        lastSyncAtMs: FIXED_NOW - 15 * MIN,
        deniedTypes: ['sleep_session'],
      }),
      providerFixture('garmin', 'requires_external_approval', { lastSyncAtMs: null }),
    ],
  }),
};

export type ConnectedHealthFixtureKey = keyof typeof CONNECTED_HEALTH_FIXTURES;
