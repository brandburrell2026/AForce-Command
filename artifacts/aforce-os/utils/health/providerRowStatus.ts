/**
 * providerRowStatus — maps the Profile screen's live app state onto the honest
 * §26 status resolver (`resolveHealthProviderStatus`).
 *
 * WHY (PASS-3 / RC-L13): the Profile screen previously collapsed every
 * provider to a LIVE / DEMO / CONNECT pill, showed "LIVE" on token presence
 * alone (OAuth success, no freshness), and let a mock toggle fake "LIVE" for
 * providers with no real client wiring. This module derives the resolver's
 * input from real runtime facts so the rendered pill is always truthful:
 *
 *   - "Connected/Syncing" ONLY for a verified, unexpired link.
 *   - Token expired → "Needs Attention" (never LIVE).
 *   - Oura / Strava / Google Health have NO client integration yet → they can
 *     never render as live; a user demo opt-in renders the labeled DEMO pill.
 *   - Garmin without backend credentials → "Approval Pending" (its Health API
 *     requires partner approval), a real link always wins.
 *
 * Pure + framework-free so it runs under the pure test runner.
 */

import {
  resolveHealthProviderStatus,
  type HealthPlatform,
  type HealthLinkState,
  type HealthProviderStatus,
  type HealthProviderUiStatus,
} from './healthProviderStatus';
import type { HealthProviderId } from '@/data/healthProviders';
import type { FeatureFlags } from '@/types';

/** Project the app FeatureFlags onto the per-provider connectability map. */
export function healthFlagsFromFeatureFlags(
  flags: Pick<
    FeatureFlags,
    | 'health_apple_enabled' | 'health_google_connect_enabled' | 'health_whoop_enabled'
    | 'health_oura_enabled' | 'health_strava_enabled' | 'health_garmin_enabled'
    | 'health_samsung_direct_enabled'
  >,
): Partial<Record<HealthProviderId, boolean>> {
  return {
    apple_health: flags.health_apple_enabled,
    google_health: flags.health_google_connect_enabled,
    whoop: flags.health_whoop_enabled,
    oura: flags.health_oura_enabled,
    strava: flags.health_strava_enabled,
    garmin: flags.health_garmin_enabled,
    samsung_health: flags.health_samsung_direct_enabled,
  };
}

/**
 * FeatureFlags key gating each provider's user-facing connectability.
 * All default OFF (featureFlags/flags.ts) — enforced by
 * featureFlags/__tests__/healthFlagsDefaultOff.test.ts.
 */
export const HEALTH_FLAG_BY_PROVIDER: Record<HealthProviderId, string> = {
  apple_health: 'health_apple_enabled',
  google_health: 'health_google_connect_enabled',
  whoop: 'health_whoop_enabled',
  oura: 'health_oura_enabled',
  strava: 'health_strava_enabled',
  garmin: 'health_garmin_enabled',
  samsung_health: 'health_samsung_direct_enabled',
};

/** The screen-side facts the Profile screen actually holds. */
export interface ProviderRowFacts {
  provider: HealthProviderId;
  platform: HealthPlatform;
  /**
   * Per-provider connectability from the `health_*` feature flags
   * (HEALTH_FLAG_BY_PROVIDER). Pure module — the SCREEN reads the flag slice
   * and passes the values in. Omitted map / omitted provider ⇒ NOT enabled,
   * with one documented carve-out below.
   */
  healthFlags?: Partial<Record<HealthProviderId, boolean>>;
  /** WHOOP server connection state ('connected' | 'not_connected' | 'credentials_missing' | ...). */
  whoopState?: string;
  /** Epoch ms the WHOOP access token expires; null/undefined when unknown. */
  whoopExpiresAt?: number | null;
  /** Garmin UI state ('connected'-like live states, 'demo', 'credentials_missing', ...). */
  garminLive?: boolean;
  garminDemo?: boolean;
  garminCredentialsMissing?: boolean;
  /** Providers toggled on via the local (mock/demo) connect path. */
  locallyLinked?: boolean;
  /** Apple Health native module actually available in this build. */
  appleNativeReady?: boolean;
  /** Clock injection for tests. */
  nowMs?: number;
}

/** Link state for WHOOP from server state + token expiry. Expired ≠ live. */
export function whoopLinkState(
  state: string | undefined,
  expiresAt: number | null | undefined,
  nowMs: number,
): HealthLinkState {
  if (state !== 'connected') return 'none';
  if (typeof expiresAt === 'number' && expiresAt > 0 && expiresAt <= nowMs) return 'expired';
  return 'connected';
}

/** Derive the honest §26 status for one provider row. */
export function deriveProviderRowStatus(f: ProviderRowFacts): HealthProviderStatus {
  const now = f.nowMs ?? Date.now();

  let link: HealthLinkState = 'none';
  let integrationReady = false;
  let approvalGranted = true;
  let demoOptIn = false;

  switch (f.provider) {
    case 'whoop':
      link = whoopLinkState(f.whoopState, f.whoopExpiresAt, now);
      integrationReady = f.whoopState !== 'credentials_missing';
      break;
    case 'garmin':
      link = f.garminLive ? 'connected' : 'none';
      integrationReady = !f.garminCredentialsMissing;
      approvalGranted = !f.garminCredentialsMissing;
      demoOptIn = !!f.garminDemo;
      break;
    case 'oura':
    case 'strava':
      // Real server adapters exist, but there is NO client OAuth wiring yet —
      // these can never be live from this screen. A local toggle is a demo.
      integrationReady = false;
      demoOptIn = !!f.locallyLinked;
      break;
    case 'google_health':
      integrationReady = false;
      demoOptIn = !!f.locallyLinked;
      break;
    case 'apple_health':
      link = f.locallyLinked ? 'connected' : 'none';
      integrationReady = !!f.appleNativeReady;
      break;
    case 'samsung_health':
      // Resolver routes this to available_through_health_connect / unsupported.
      break;
  }

  // Flag enforcement (Foundation 1A): the `health_*` flags now govern
  // connectability. WHOOP carve-out — its gating remains the server
  // credential probe (`credentials_missing` ⇒ not integrationReady), exactly
  // as shipped, until the provider-kit cutover (PR 1B) migrates it onto
  // `health_whoop_enabled`. Every other provider is strictly flag-gated and
  // all `health_*` flags default OFF, so no provider becomes connectable
  // from this change alone. A real existing link always wins (resolver
  // ordering) — flags gate NEW connections, they never fake or hide a
  // genuine connected state.
  const enabled =
    f.provider === 'whoop' ? true : f.healthFlags?.[f.provider] === true;

  return resolveHealthProviderStatus({
    provider: f.provider,
    platform: f.platform,
    enabled,
    integrationReady,
    approvalGranted,
    link,
    demoOptIn,
  });
}

/**
 * Provider-row accessibility state (Squad-F HIGH #3): the announced
 * affordance for the Profile "HEALTH PLATFORMS" row. Previously the row's
 * `accessibilityLabel` was `Connect {name}` / `Disconnect {name}` purely off
 * `linked`, so a screen reader would announce "Connect WHOOP" on a row that
 * was actually Approval Pending, Coming Soon, or Unsupported — an action
 * that was never available. This mirrors the render branch order in
 * ProfileScreenV2, at its ONLY call site (`row.status`/`row.live` sourced
 * directly from `deriveProviderRowStatus`, above): demo → live →
 * needs_attention → approval_pending → coming_soon → via_health_connect →
 * unsupported → connect. `deriveProviderRowStatus`'s `link` is only ever
 * assigned 'none' | 'connected' | 'expired' (never 'syncing' / 'partial' /
 * 'authorizing' / 'error'), so `resolveHealthProviderStatus`'s 'syncing' and
 * 'partially_authorized' statuses can never actually reach this function —
 * a real connection at this call site is always the plain `live` kind. The
 * reachability lock in providerRowStatus.test.ts proves this by construction
 * across the full input space; if a future change (e.g. a real sync-in-
 * progress or partial-scopes signal) makes one of those statuses reachable,
 * that lock fails, which is the signal to add its a11y branch (and en.json
 * copy) THEN — not to carry the untested branch ahead of the real behavior.
 */
export type ProviderRowA11yKind =
  | 'demo'
  | 'live'
  | 'needs_attention'
  | 'approval_pending'
  | 'coming_soon'
  | 'via_health_connect'
  | 'unsupported'
  | 'connect';

/** i18n key (under `profile.v2.`) carrying `{{name}}` for each announced state. */
export const PROVIDER_ROW_A11Y_I18N_KEY: Record<ProviderRowA11yKind, string> = {
  demo: 'profile.v2.row_a11y_demo',
  live: 'profile.v2.row_a11y_connected',
  needs_attention: 'profile.v2.row_a11y_needs_attention',
  approval_pending: 'profile.v2.row_a11y_approval_pending',
  coming_soon: 'profile.v2.row_a11y_coming_soon',
  via_health_connect: 'profile.v2.row_a11y_via_health_connect',
  unsupported: 'profile.v2.row_a11y_unsupported',
  connect: 'profile.v2.connect_a11y',
};

export function providerRowA11yKind(params: {
  /** The row shows the labeled DEMO pill (display-only, never a real link). */
  demoLinked: boolean;
  /** `HealthProviderStatus.live` — a real, verified connection. */
  live: boolean;
  status: HealthProviderUiStatus;
}): ProviderRowA11yKind {
  const { demoLinked, live, status } = params;
  if (demoLinked && !live) return 'demo';
  if (live) return 'live';
  if (status === 'needs_attention') return 'needs_attention';
  if (status === 'approval_pending') return 'approval_pending';
  if (status === 'coming_soon') return 'coming_soon';
  if (status === 'available_through_health_connect') return 'via_health_connect';
  if (status === 'unsupported') return 'unsupported';
  return 'connect';
}
