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
} from './healthProviderStatus';
import type { HealthProviderId } from '@/data/healthProviders';

/** The screen-side facts the Profile screen actually holds. */
export interface ProviderRowFacts {
  provider: HealthProviderId;
  platform: HealthPlatform;
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

  return resolveHealthProviderStatus({
    provider: f.provider,
    platform: f.platform,
    enabled: true,
    integrationReady,
    approvalGranted,
    link,
    demoOptIn,
  });
}
