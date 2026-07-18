/**
 * HEALTH PROVIDER STATUS — provider-neutral connection-state resolution.
 *
 * Generalizes the Garmin honesty model (utils/garminProviderState.ts) to every
 * provider on the HEALTH PLATFORMS screen. One pure function turns the real
 * facts about a provider — is it enabled, is the integration actually available,
 * does external approval exist, what is the verified live link, is labeled demo
 * on — into the honest UI status the screen renders.
 *
 * The load-bearing rules (never violated):
 *   1. A real, VERIFIED connection always wins. `connected`/`syncing`/`partial`
 *      are only ever returned from a real `link` signal (backend token store or
 *      native permission grant) — never inferred, never from demo.
 *   2. Demo is a LABELED overlay only. `showDemo` can be true, but the honest
 *      `status` is never `connected`, and `live` is never true for demo. Demo
 *      data must be rendered in a clearly-labeled card and must NEVER reach the
 *      score (Score-Protection — enforced at the setProviderBiometrics seam).
 *   3. A provider only offers an actionable Connect when it is genuinely
 *      available (enabled + integrationReady + approval where required + on a
 *      supported platform). Otherwise it shows an honest non-interactive status
 *      (Coming Soon / Approval Pending / Unsupported / Available Through Health
 *      Connect) — never a Connect button that fails after the tap.
 *
 * Pure · no React Native · no I/O · no Date.now(). Unit-testable under vitest.
 */
import type { HealthProviderId } from '../../data/healthProviders';

/** The honest UI status vocabulary shown on the HEALTH PLATFORMS screen. */
export type HealthProviderUiStatus =
  | 'connect' //                    available, not connected → actionable Connect
  | 'connecting' //                 OAuth / permission flow in flight
  | 'connected' //                  real, verified connection
  | 'partially_authorized' //       connected, but some scopes/permissions denied
  | 'syncing' //                    connected + a data pull in progress
  | 'needs_attention' //            token expired / permission revoked / error → reconnect
  | 'available_through_health_connect' // Samsung on Android — route via Health Connect
  | 'approval_pending' //           requires external partner approval not yet granted
  | 'coming_soon' //                code path complete but not enabled/credentialed yet
  | 'unsupported'; //               device-native provider off its platform (or web)

/** How a provider connects. */
export type HealthConnectMethod = 'device_native' | 'oauth_cloud' | 'via_health_connect';

/** The real, verified live-connection signal (from backend token store or native grant). */
export type HealthLinkState =
  | 'none' //         no verified connection
  | 'authorizing' //  OAuth / permission flow in progress
  | 'connected' //    verified, tokens/permissions valid
  | 'partial' //      verified but partial permissions (native providers)
  | 'syncing' //      verified + a sync running
  | 'expired' //      token expired / permission revoked → needs attention
  | 'error'; //       last sync/refresh errored → needs attention

export type HealthPlatform = 'ios' | 'android' | 'web';

export interface HealthProviderCapability {
  /** Connection mechanism. */
  method: HealthConnectMethod;
  /** Platforms on which a real Connect path is possible (device-native = one OS). */
  platforms: readonly ('ios' | 'android')[];
  /** Whether a formal external partner approval is required before real use. */
  requiresExternalApproval: boolean;
}

/**
 * Static per-provider capability. Cloud OAuth providers work on both platforms;
 * device-native ones only on their OS; Samsung is reached through Health Connect
 * on Android and requires partner approval for any direct path (so we never
 * offer one). Garmin's Health API requires a formal developer/partner approval.
 */
export const HEALTH_PROVIDER_CAPABILITY: Record<HealthProviderId, HealthProviderCapability> = {
  apple_health: { method: 'device_native', platforms: ['ios'], requiresExternalApproval: false },
  google_health: { method: 'device_native', platforms: ['android'], requiresExternalApproval: false },
  samsung_health: { method: 'via_health_connect', platforms: ['android'], requiresExternalApproval: true },
  whoop: { method: 'oauth_cloud', platforms: ['ios', 'android'], requiresExternalApproval: false },
  oura: { method: 'oauth_cloud', platforms: ['ios', 'android'], requiresExternalApproval: false },
  strava: { method: 'oauth_cloud', platforms: ['ios', 'android'], requiresExternalApproval: false },
  garmin: { method: 'oauth_cloud', platforms: ['ios', 'android'], requiresExternalApproval: true },
};

export interface HealthProviderStatusInput {
  provider: HealthProviderId;
  /** The device platform the app is running on. */
  platform: HealthPlatform;
  /** The provider's ENABLE_* feature flag. */
  enabled: boolean;
  /**
   * Whether the integration is actually usable RIGHT NOW: for OAuth providers,
   * the backend is configured + a health check passes; for device-native
   * providers, the native module is present and the API is available. Computed
   * by the caller from real runtime facts — never assumed.
   */
  integrationReady: boolean;
  /** External partner approval obtained. Ignored when requiresExternalApproval is false. */
  approvalGranted: boolean;
  /** The verified live-connection signal for this user + provider. */
  link: HealthLinkState;
  /** Whether the labeled demo-data flag is on (investor/DEMO_ALL_ON build). */
  demoOptIn: boolean;
}

export interface HealthProviderStatus {
  /** The honest status to render. */
  status: HealthProviderUiStatus;
  /** Whether to offer an actionable Connect/Reconnect tap. */
  connectable: boolean;
  /** A real, verified connection exists. NEVER true for demo. */
  live: boolean;
  /** Render the labeled, display-only demo snapshot card. NEVER implies `live`. */
  showDemo: boolean;
}

/**
 * Resolve a provider's honest UI status from its real facts. Pure + total.
 */
export function resolveHealthProviderStatus(input: HealthProviderStatusInput): HealthProviderStatus {
  const cap = HEALTH_PROVIDER_CAPABILITY[input.provider];

  // 1. Samsung (via Health Connect): no direct connection is ever offered. On
  //    Android it's reachable through Health Connect; anywhere else, unsupported.
  if (cap.method === 'via_health_connect') {
    if (input.platform === 'android') {
      return { status: 'available_through_health_connect', connectable: false, live: false, showDemo: input.demoOptIn };
    }
    return { status: 'unsupported', connectable: false, live: false, showDemo: false };
  }

  // 2. Device-native providers off their platform (Apple on Android, Google on
  //    iOS), and any provider on web → unsupported on this device. No demo.
  const onPlatform = input.platform !== 'web' && cap.platforms.includes(input.platform);
  if (!onPlatform) {
    return { status: 'unsupported', connectable: false, live: false, showDemo: false };
  }

  // 3. A real, verified link ALWAYS wins. A live connection is never downgraded,
  //    and while any real link exists the labeled demo card is suppressed
  //    (rule 1 + 2 — demo can never sit next to / masquerade as a real link).
  switch (input.link) {
    case 'connected':
      return { status: 'connected', connectable: true, live: true, showDemo: false };
    case 'syncing':
      return { status: 'syncing', connectable: true, live: true, showDemo: false };
    case 'partial':
      return { status: 'partially_authorized', connectable: true, live: true, showDemo: false };
    case 'expired':
    case 'error':
      return { status: 'needs_attention', connectable: true, live: false, showDemo: false };
    case 'authorizing':
      return { status: 'connecting', connectable: false, live: false, showDemo: false };
    case 'none':
      break; // fall through to availability
  }

  // 4. Not linked → is the real integration actually available to connect?
  const approvalOk = !cap.requiresExternalApproval || input.approvalGranted;
  if (input.enabled && input.integrationReady && approvalOk) {
    return { status: 'connect', connectable: true, live: false, showDemo: input.demoOptIn };
  }

  // 5. Not available → honest non-interactive status. A labeled demo card may
  //    still render (investor build), but the status stays truthful.
  if (cap.requiresExternalApproval && !input.approvalGranted) {
    return { status: 'approval_pending', connectable: false, live: false, showDemo: input.demoOptIn };
  }
  return { status: 'coming_soon', connectable: false, live: false, showDemo: input.demoOptIn };
}

/** True only for a real, verified connection. Demo is NEVER live. */
export function isLiveHealthStatus(status: HealthProviderUiStatus): boolean {
  return status === 'connected' || status === 'syncing' || status === 'partially_authorized';
}

/** Canonical human-facing labels (structural, not claims). */
export const HEALTH_STATUS_LABEL: Record<HealthProviderUiStatus, string> = {
  connect: 'Connect',
  connecting: 'Connecting…',
  connected: 'Connected',
  partially_authorized: 'Partially Authorized',
  syncing: 'Syncing…',
  needs_attention: 'Needs Attention',
  available_through_health_connect: 'Available Through Health Connect',
  approval_pending: 'Approval Pending',
  coming_soon: 'Coming Soon',
  unsupported: 'Unsupported on This Device',
};
