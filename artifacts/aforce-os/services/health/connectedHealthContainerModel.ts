/**
 * CONNECTED HEALTH — container model (W3.6 live wiring).
 *
 * Bridges the REAL facts a container can gather (zustand store state, cloud
 * status probes, feature flags, the clock) into the input
 * `resolveConnectedHealthView` (services/health/connectedHealthView.ts)
 * expects. This is the FIRST production wiring of the whole Connected Health
 * stack: `deriveProviderRowStatus` / `resolveProviderPresentation` /
 * `fetchHealthConnectionSignals` have all shipped with zero production
 * callers until this module + `components/health/ConnectedHealthContainer.tsx`.
 *
 * STILL NO PROVIDER ACTIVATION. Every `health_*` flag defaults OFF, and this
 * module never flips one — it only reads them (via `healthFlagsFromFeatureFlags`)
 * to render the honest, non-connectable states that follow. WHOOP keeps its
 * pre-existing flag-immune carve-out (`providerRowStatus.ts`'s own documented
 * exception) — it is the ONE provider that can show a real Connect/Connected
 * row today. A real, previously-established connection (e.g. a legacy Garmin
 * link) still wins over a flag being off, because `resolveHealthProviderStatus`
 * never hides a genuine connection — flags gate NEW connections only.
 *
 * TWO SECTIONS, DELIBERATELY:
 *   1. PURE MODEL — `buildConnectedHealthInput` and its helpers. Same inputs
 *      (in any order) ⇒ same output. No I/O, no `Date.now()` (`nowMs` is
 *      always injected). This is the part the task names explicitly.
 *   2. INJECTABLE I/O LAYER — `loadConnectedHealthCloudFacts` and
 *      `performConnectedHealthDisconnect`. These DO perform real network
 *      calls (cloud status probes, disconnect endpoints), so they are not
 *      pure. They live here rather than in the `.tsx` container so they stay
 *      importable and unit-testable under the plain `services/**` node test
 *      environment — mirroring the existing precedent in this codebase where
 *      container/screen files (e.g. `screens/CruiseModeScreen.tsx`) are never
 *      imported directly by a test (they pull in `expo-router`,
 *      `react-native-safe-area-context`, `@react-native-async-storage/*`),
 *      while their pure logic siblings are. Both functions follow the same
 *      injectable-deps shape already used by `services/whoopConnect.ts` /
 *      `services/garmin.ts` / `services/healthConnections.ts`.
 *
 * KNOWN, DOCUMENTED GAPS (flagged, not silently papered over):
 *   - No per-record-type consent source exists anywhere in the app yet
 *     (HealthKit / Health Connect authorization status isn't surfaced to the
 *     client today), so `grantedTypes` / `deniedTypes` are always empty here.
 *     Per connectedHealthView.ts's own honesty rule, an absent type renders
 *     `pull_chip_status: 'unknown'` — the correct, honest default given what
 *     we actually know, not a placeholder for "none granted".
 *   - `errorKind` is always `null`: no real fact this container can produce
 *     today reaches presentation state `'error'` (see `providerPresentation.ts`
 *     — its `BASE_STATE` map never emits `'error'`, only `'action_required'`,
 *     which already carries its own honest sub-copy with no `errorKind`).
 *   - `mode` is `'ready'` or `'loading'` here for the reason that already
 *     shipped: this codebase has no network-connectivity primitive (no
 *     NetInfo / expo-network dependency) and `fetchHealthConnectionSignals`
 *     deliberately collapses a genuine network failure into the SAME signal
 *     as "not configured" (see its own file header) — so a single per-provider
 *     probe result can never honestly distinguish "you're offline" from
 *     "this is legitimately unconfigured." That epistemic limit is unchanged
 *     and still flagged as a follow-up, not silently solved.
 *
 *     `mode` DOES become `'offline'` in one narrow, honestly-distinguishable
 *     case: when the client's own probe *attempt* fails to complete at all —
 *     a rejected probe promise or one that blows past `CLOUD_PROBE_TIMEOUT_MS`
 *     without resolving. That is a categorically different, stronger fact
 *     than "the server told us something ambiguous": it means we don't have
 *     a real read on cloud connection state this cycle, full stop. Per-row
 *     facts still use the same conflated-but-honest `{integrationReady:false,
 *     link:'none'}` fallback (never a fabricated `disconnected`/`denied`/
 *     `unsupported`), and any previously-successful cloud facts already in
 *     the container are left in place rather than being overwritten by a
 *     worse guess — `mode: 'offline'`'s own copy ("showing the last known
 *     connection status") is what makes surfacing this honest instead of
 *     silent. See `CLOUD_PROBE_TIMEOUT_MS` / `probeCloudProvider` below and
 *     `ConnectedHealthContainer.tsx`'s `refreshCloudFacts`.
 */
import type { CanonicalHealthMetricType, HealthProviderId } from '@workspace/health-core';
import { HEALTH_PROVIDERS } from '../../data/healthProviders';
import {
  deriveProviderRowStatus,
  healthFlagsFromFeatureFlags,
  type ProviderRowFacts,
} from '../../utils/health/providerRowStatus';
import type { HealthPlatform } from '../../utils/health/healthProviderStatus';
import { resolveProviderPresentation } from './providerPresentation';
import {
  type ConnectedHealthInput,
  type ConnectedHealthPlatform,
  type ConnectedHealthProviderInput,
  type ConnectedHealthScreenMode,
  type I18nText,
} from './connectedHealthView';
import type { FeatureFlags } from '../../types';
import type { ProviderBiometrics } from '../../types/biometrics';
import { fetchHealthConnectionSignals, type HealthConnectionsDeps } from '../healthConnections';
import type { HealthConnectionSignals } from '../../utils/health/healthConnectionMapping';
import {
  disconnectWhoop as disconnectWhoopReal,
  type WhoopServiceDeps,
  type WhoopDisconnectResult,
} from '../whoopConnect';
import {
  disconnectGarmin as disconnectGarminReal,
  type GarminServiceDeps,
  type GarminDisconnectResult,
} from '../garmin';

// ─────────────────────────────────────────────────────────────────────────
// SECTION 1 — PURE MODEL
// ─────────────────────────────────────────────────────────────────────────

/** Cloud OAuth providers this app can probe via `GET /{provider}/status`. */
const CLOUD_PROBE_PROVIDERS = ['whoop', 'garmin', 'oura', 'strava'] as const;

/** Real cloud probe results, one per cloud OAuth provider. Undefined ⇒ the
 *  probe hasn't resolved (or errored) yet — treated identically to an
 *  explicit `{integrationReady:false, link:'none'}`, never fabricated. */
export type ConnectedHealthCloudFacts = Partial<Record<(typeof CLOUD_PROBE_PROVIDERS)[number], HealthConnectionSignals>>;

const EMPTY_METRIC_TYPES: readonly CanonicalHealthMetricType[] = [];

export interface ConnectedHealthContainerModelInput {
  /** Epoch ms, injected — this module never reads the clock. */
  nowMs: number;
  mode: ConnectedHealthScreenMode;
  platform: ConnectedHealthPlatform;
  featureFlags: FeatureFlags;
  biometrics: ProviderBiometrics | undefined;
  cloud: ConnectedHealthCloudFacts;
  /**
   * Real HealthKit permission grant signal — true only when a genuine
   * snapshot has actually been captured (`biometrics.apple_health` present).
   * Deliberately NOT the demo/mock `linkedProviders` toggle that
   * `ProfileScreenV2` uses for the other providers; that toggle is explicitly
   * documented there as "Mocked OAuth state" and has no place in a "real
   * data" wiring pass.
   */
  appleHealthLinked: boolean;
  /** `isAppleHealthSupported()` — native module + platform check, a real,
   *  synchronous device fact. Passed in rather than called here so this file
   *  stays platform-import-free. */
  appleHealthNativeReady: boolean;
}

function whoopRowFacts(
  probe: HealthConnectionSignals | undefined,
  nowMs: number,
): Pick<ProviderRowFacts, 'whoopState' | 'whoopExpiresAt'> {
  if (!probe || !probe.integrationReady) {
    return { whoopState: 'credentials_missing', whoopExpiresAt: null };
  }
  if (probe.link === 'none') {
    return { whoopState: 'not_connected', whoopExpiresAt: null };
  }
  // probe.link is 'connected' or 'expired' — both mean a real stored token.
  // The generic cloud probe reports only the already-computed link bucket,
  // not the raw expiry instant, so an honest, sufficient proxy for "expired"
  // is "expired as of right now" (nowMs): `whoopLinkState` only ever checks
  // `expiresAt <= nowMs`, and this trips that check without claiming a
  // specific (unknown to us) expiry timestamp.
  return { whoopState: 'connected', whoopExpiresAt: probe.link === 'expired' ? nowMs : null };
}

function buildProviderRowFacts(
  providerId: HealthProviderId,
  input: ConnectedHealthContainerModelInput,
): ProviderRowFacts {
  const platform: HealthPlatform = input.platform;
  const healthFlags = healthFlagsFromFeatureFlags(input.featureFlags);
  const base = { provider: providerId, platform, healthFlags, nowMs: input.nowMs };

  switch (providerId) {
    case 'whoop':
      return { ...base, ...whoopRowFacts(input.cloud.whoop, input.nowMs) };

    case 'garmin': {
      const probe = input.cloud.garmin;
      const garminCredentialsMissing = !probe || !probe.integrationReady;
      return {
        ...base,
        garminLive: probe?.link === 'connected',
        garminCredentialsMissing,
        // Connected Health never surfaces the labeled-demo overlay — that is
        // a ProfileScreenV2-only concept and has no place on this "what's
        // really connected" surface.
        garminDemo: false,
      };
    }

    case 'oura':
    case 'strava':
      // `providerRowStatus.ts` hardcodes `integrationReady = false` for both
      // of these regardless of any fact supplied here — "no client OAuth
      // wiring yet" per its own file header. The cloud probe is still
      // fetched (see `loadConnectedHealthCloudFacts` below) so
      // `fetchHealthConnectionSignals` has a real production caller for
      // every cloud provider today, and the data is ready the moment client
      // wiring lands — but it cannot move this row yet.
      return { ...base, locallyLinked: false };

    case 'apple_health':
      return { ...base, locallyLinked: input.appleHealthLinked, appleNativeReady: input.appleHealthNativeReady };

    case 'google_health':
      // Same "no client wiring yet" situation as Oura/Strava.
      return { ...base, locallyLinked: false };

    case 'samsung_health':
      // `via_health_connect` short-circuits on platform alone in
      // `resolveHealthProviderStatus` — no facts needed.
      return base;
  }
}

/**
 * THE pure transform: store state + cloud probe results + flags + nowMs →
 * `resolveConnectedHealthView`'s input. Deterministic; safe to call on every
 * render.
 */
export function buildConnectedHealthInput(input: ConnectedHealthContainerModelInput): ConnectedHealthInput {
  const providers: ConnectedHealthProviderInput[] = HEALTH_PROVIDERS.map((p) => {
    const rowFacts = buildProviderRowFacts(p.id, input);
    const status = deriveProviderRowStatus(rowFacts);
    const lastSyncAtMs = input.biometrics?.[p.id]?.fetchedAt ?? null;
    const presentation = resolveProviderPresentation({
      status,
      latestFetchedAtMs: lastSyncAtMs,
      nowMs: input.nowMs,
    });

    return {
      providerId: p.id,
      presentation,
      lastSyncAtMs,
      grantedTypes: EMPTY_METRIC_TYPES,
      deniedTypes: EMPTY_METRIC_TYPES,
      errorKind: null,
      ageLabel: null,
    };
  });

  return { now: input.nowMs, mode: input.mode, platform: input.platform, providers };
}

// ─────────────────────────────────────────────────────────────────────────
// SECTION 2 — REVOCATION VOCABULARY (pure)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Closed, honest outcome vocabulary for a disconnect attempt. Never a raw
 * HTTP status or provider error string reaches product copy.
 *   - succeeded            — the hardened DELETE endpoint confirmed removal.
 *   - failed               — the endpoint call threw (network / server error).
 *   - unsupported          — no wired disconnect capability exists for this
 *                             provider at all (see `CLOUD_DISCONNECT_PROVIDERS`).
 *   - skipped_not_connected — the endpoint reported nothing was actually
 *                             connected to revoke (e.g. WHOOP/Garmin's
 *                             `credentials_missing`, meaning the backend
 *                             integration itself isn't configured).
 */
export type ConnectedHealthRevocationOutcome =
  | 'succeeded'
  | 'failed'
  | 'unsupported'
  | 'skipped_not_connected';

/**
 * Providers with a real, hardened `DELETE /{provider}/disconnect` endpoint
 * wired client-side today. Apple / Google / Samsung revoke through OS-level
 * permission settings — no server call can do that for them. Oura / Strava
 * have server adapters (per `@workspace/health-core`'s capability table) but
 * no client OAuth/disconnect wiring yet, matching `providerRowStatus.ts`'s
 * own documented limitation. `'unsupported'` is the honest outcome for all
 * five today — never a fabricated success.
 */
export const CLOUD_DISCONNECT_PROVIDERS: ReadonlySet<HealthProviderId> = new Set(['whoop', 'garmin']);

export type CloudDisconnectResult = { status: 'ok' } | { status: 'credentials_missing' };

/** Pure mapping from a provider identity + a real disconnect-endpoint result
 *  to the closed outcome vocabulary above. `'failed'` is assigned by the
 *  caller (see `performConnectedHealthDisconnect`) when the endpoint call
 *  itself throws — `disconnectWhoop` / `disconnectGarmin` never resolve with
 *  a "failed" shape, they either resolve ok/credentials_missing or reject. */
export function resolveRevocationOutcome(
  providerId: HealthProviderId,
  result: CloudDisconnectResult,
): ConnectedHealthRevocationOutcome {
  if (!CLOUD_DISCONNECT_PROVIDERS.has(providerId)) return 'unsupported';
  return result.status === 'ok' ? 'succeeded' : 'skipped_not_connected';
}

/** `connected_health.revocation.<outcome>` — see locales/en.json (mirrored,
 *  untranslated, to the other 10 locales per the `settings.whoop` precedent). */
export function revocationCopyKey(outcome: ConnectedHealthRevocationOutcome): I18nText {
  return { key: `connected_health.revocation.${outcome}` };
}

// ─────────────────────────────────────────────────────────────────────────
// SECTION 3 — INJECTABLE I/O LAYER (NOT pure — real network calls)
// ─────────────────────────────────────────────────────────────────────────

export interface ConnectedHealthContainerDeps {
  /** Override the whole cloud-probe call (fast unit tests), or leave it
   *  default (the real, exported `fetchHealthConnectionSignals` — this is
   *  its first production call site) and override just `getJson` to
   *  exercise the real probe/mapping logic end-to-end against a fake
   *  transport. */
  fetchCloudSignals?: (provider: HealthProviderId, deps?: HealthConnectionsDeps) => Promise<HealthConnectionSignals>;
  getJson?: HealthConnectionsDeps['getJson'];
  /** Same override-the-whole-fn-or-just-the-transport pattern for disconnect. */
  disconnectWhoop?: (deps?: WhoopServiceDeps) => Promise<WhoopDisconnectResult>;
  disconnectGarmin?: (deps?: GarminServiceDeps) => Promise<GarminDisconnectResult>;
  deleteJson?: WhoopServiceDeps['deleteJson'];
  /** Override the bounded per-probe timeout (tests only — fake timers). */
  probeTimeoutMs?: number;
}

/**
 * Bounded wait for a single cloud probe before this container gives up on it
 * for the current cycle. A hung bridge/transport (a `fetch` that never
 * settles) must never wedge `probesLoaded`/`mode: 'loading'` forever — see
 * file header. Chosen well above realistic p99 API latency, short enough
 * that a genuinely stuck probe surfaces the honest `'offline'` retry state
 * within one screen visit rather than leaving the user staring at a spinner.
 */
export const CLOUD_PROBE_TIMEOUT_MS = 8_000;

/** The one honest fallback signal for a probe that did NOT complete —
 *  identical in shape to `fetchHealthConnectionSignals`'s own "can't tell"
 *  bucket (see its file header), so a failed/timed-out probe never renders
 *  any differently, per-row, than an ambiguous network error already does.
 *  Never a fabricated `disconnected`/`denied`/`unsupported`. */
const PROBE_INCOMPLETE_SIGNAL: HealthConnectionSignals = { integrationReady: false, link: 'none' };

interface CloudProbeAttempt {
  id: (typeof CLOUD_PROBE_PROVIDERS)[number];
  signals: HealthConnectionSignals;
  /** True when this probe REJECTED or exceeded `probeTimeoutMs` — i.e. the
   *  client's own attempt failed to complete, not "the server answered
   *  ambiguously." Never true for a resolved (even negative) probe result. */
  failed: boolean;
}

/**
 * Run one cloud probe with a bounded timeout, guaranteed to RESOLVE, never
 * reject and never hang past `timeoutMs` — the structural fix for "a probe
 * promise path is currently unhandled." Whichever settles first (the real
 * probe, or the timeout) wins; the loser is simply ignored (its eventual
 * settlement, if any, is swallowed here rather than left to become an
 * unhandled rejection later).
 */
function probeCloudProvider(
  id: (typeof CLOUD_PROBE_PROVIDERS)[number],
  fetchCloudSignals: NonNullable<ConnectedHealthContainerDeps['fetchCloudSignals']>,
  probeDeps: HealthConnectionsDeps,
  timeoutMs: number,
): Promise<CloudProbeAttempt> {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve({ id, signals: PROBE_INCOMPLETE_SIGNAL, failed: true });
    }, timeoutMs);

    // `Promise.resolve().then(...)` so a SYNCHRONOUS throw from a test-injected
    // `fetchCloudSignals` (not just a rejected promise) is caught the same way
    // as a genuine rejection — both are "the probe attempt failed," never an
    // unhandled rejection or an uncaught synchronous throw.
    Promise.resolve()
      .then(() => fetchCloudSignals(id, probeDeps))
      .then((signals) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({ id, signals, failed: false });
      })
      .catch(() => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({ id, signals: PROBE_INCOMPLETE_SIGNAL, failed: true });
      });
  });
}

export interface ConnectedHealthCloudProbeResult {
  facts: ConnectedHealthCloudFacts;
  /**
   * True when one or more cloud probes failed to complete honestly this
   * cycle (rejected, threw, or timed out) — NEVER true for a probe that
   * simply resolved to a negative/ambiguous-but-real result. Drives the
   * container's `mode: 'offline'` retry presentation; never changes any
   * per-provider fact on its own.
   */
  anyProbeFailed: boolean;
}

/**
 * Fetch real cloud connection signals for every cloud OAuth provider. First
 * production caller of `fetchHealthConnectionSignals` — see file header.
 *
 * Structurally cannot reject: every individual probe is wrapped by
 * `probeCloudProvider`, which always resolves (bounded by `probeTimeoutMs`),
 * so `Promise.all` over already-non-rejecting promises cannot reject either.
 * Callers may still wrap this in their own try/catch as defense in depth,
 * but no known code path here produces an unhandled rejection.
 */
export async function loadConnectedHealthCloudFacts(
  nowMs: number,
  deps: ConnectedHealthContainerDeps = {},
): Promise<ConnectedHealthCloudProbeResult> {
  const fetchCloudSignals = deps.fetchCloudSignals ?? fetchHealthConnectionSignals;
  const timeoutMs = deps.probeTimeoutMs ?? CLOUD_PROBE_TIMEOUT_MS;
  const probeDeps: HealthConnectionsDeps = { now: nowMs, getJson: deps.getJson };

  const attempts = await Promise.all(
    CLOUD_PROBE_PROVIDERS.map((id) => probeCloudProvider(id, fetchCloudSignals, probeDeps, timeoutMs)),
  );

  const facts: ConnectedHealthCloudFacts = {};
  let anyProbeFailed = false;
  for (const attempt of attempts) {
    facts[attempt.id] = attempt.signals;
    if (attempt.failed) anyProbeFailed = true;
  }
  return { facts, anyProbeFailed };
}

/**
 * Perform a real disconnect for the given provider and resolve the honest
 * outcome. Never throws — a thrown/rejected endpoint call maps to `'failed'`,
 * the one outcome `resolveRevocationOutcome` cannot produce on its own.
 */
export async function performConnectedHealthDisconnect(
  providerId: HealthProviderId,
  deps: ConnectedHealthContainerDeps = {},
): Promise<ConnectedHealthRevocationOutcome> {
  if (!CLOUD_DISCONNECT_PROVIDERS.has(providerId)) return 'unsupported';

  try {
    if (providerId === 'whoop') {
      const disconnect = deps.disconnectWhoop ?? disconnectWhoopReal;
      const result = await disconnect({ deleteJson: deps.deleteJson });
      return resolveRevocationOutcome(providerId, result);
    }
    const disconnect = deps.disconnectGarmin ?? disconnectGarminReal;
    const result = await disconnect({ deleteJson: deps.deleteJson });
    return resolveRevocationOutcome(providerId, result);
  } catch {
    return 'failed';
  }
}
