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
 *     a real read on cloud connection state this cycle, full stop. A provider
 *     whose probe fails this way is OMITTED from `loadConnectedHealthCloudFacts`'s
 *     returned `facts` entirely (never written as a fabricated
 *     `{integrationReady:false, link:'none'}` — that shape is reserved for a
 *     probe that genuinely RESOLVED to "nothing configured/linked"), and
 *     `ConnectedHealthContainer`'s `refreshCloudFacts` merges each cycle's
 *     `facts` on top of the previous cycle's (`applyProbeCycle` /
 *     `mergeCloudFacts` below) rather than replacing the whole object — so
 *     any previously-successful cloud facts already in the container are
 *     genuinely left in place rather than being overwritten by a worse
 *     guess. `mode: 'offline'`'s own copy (`connected_health.offline_notice`:
 *     "Couldn't check your connections just now — this list may be out of
 *     date.") is a hedge, not a claim that a "last known status" definitely
 *     exists for every row — and this merge-not-replace behavior is exactly
 *     what makes the hedge true, in a STRICTLY LARGER set of cases than the
 *     older, stronger "showing the last known connection status" wording
 *     this comment used to argue for (#496 changed the copy; this argument
 *     is updated to match, not just re-quoted). That older phrasing was only
 *     accurate once a provider had resolved at least one prior cycle; for a
 *     provider that has NEVER resolved (still `undefined` in `cloud`), there
 *     is no "last known status" to show, so the old phrasing would have
 *     overclaimed. The current, softer "may be out of date" is honestly true
 *     either way: a provider with real prior data shows that real data
 *     (possibly stale), and a provider with no prior data shows nothing
 *     extra — never a fabricated guess in either case. See
 *     `CLOUD_PROBE_TIMEOUT_MS` / `probeCloudProvider` / `mergeCloudFacts` /
 *     `applyProbeCycle` below and `ConnectedHealthContainer.tsx`'s
 *     `refreshCloudFacts`.
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

/** Real cloud probe results, one per cloud OAuth provider. Undefined ⇒ either
 *  no probe cycle has completed yet for this provider, OR its most recent
 *  attempt failed to complete honestly (rejected/threw/timed out) —
 *  `loadConnectedHealthCloudFacts` OMITS a failed provider from its returned
 *  `facts` rather than writing a fabricated `{integrationReady:false,
 *  link:'none'}` in its place. Every downstream reader (`whoopRowFacts`'s
 *  `!probe`, `garminCredentialsMissing`'s `!probe`) already treats absence
 *  identically to that explicit "nothing configured" signal, so the two
 *  cases render the same today — but only the omission preserves whatever a
 *  PRIOR successful cycle already knew once `ConnectedHealthContainer` merges
 *  cycles together (see `mergeCloudFacts`). */
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
  /** Override the bounded per-probe timeout. Defaults to `CLOUD_PROBE_TIMEOUT_MS`
   *  (the production value). This is a real tuning knob, not a test-only
   *  seam — tests exercise it with fake timers to assert timeout behavior
   *  deterministically, but nothing here restricts it to test callers, and
   *  a future production caller adjusting probe patience for a specific
   *  provider or network condition is a legitimate use. */
  probeTimeoutMs?: number;
}

/**
 * Bounded wait for a single cloud probe before this container gives up on it
 * for the current cycle. A hung bridge/transport (a `fetch` that never
 * settles) must never wedge `probesLoaded`/`mode: 'loading'` forever — see
 * file header. Chosen well above realistic p99 API latency, short enough
 * that a genuinely stuck probe surfaces the honest `'offline'` retry state
 * within one screen visit rather than leaving the user staring at a spinner.
 *
 * NOTE (N1): this is a client-side give-up timer, not a request cancellation.
 * There is no `AbortController` wired to `fetchCloudSignals` here, so the
 * underlying request (whatever `fetchCloudSignals`/`getJson` actually does)
 * keeps running after `timeoutMs` elapses — this module simply stops
 * waiting for it and moves on. A late completion is not observed by
 * anything (see `probeCloudProvider`'s `settled` guard) and cannot corrupt
 * state, but it is also not free: it's an in-flight request this module no
 * longer tracks. Wiring real cancellation is a follow-up, not solved here.
 *
 * NOTE (N2): a probe that eventually SUCCEEDS after `timeoutMs` has already
 * elapsed has its real, correct answer silently dropped for this cycle — the
 * timeout branch has already resolved the race by the time the late success
 * arrives (see the `settled` guard in `probeCloudProvider`). That provider
 * is simply omitted from this cycle's `facts` (see `loadConnectedHealthCloudFacts`)
 * exactly as if the probe were still pending. It is never treated as a
 * failure fact, just a missed cycle — but corrected (#494 S-2 review): within
 * a single screen visit there is no "next probe cycle" waiting to pick this
 * up. `ConnectedHealthContainer.refreshCloudFacts` only runs on mount and
 * after a successful disconnect — the 60s `setInterval` in that component
 * only advances the `now` clock for freshness text ("Synced Xm ago"), it
 * never re-probes. So this provider's next real chance to report a correct
 * answer is the next MOUNT of this screen (a fresh visit), or the next
 * post-disconnect refresh — not some cycle still to come in the current
 * visit.
 */
export const CLOUD_PROBE_TIMEOUT_MS = 8_000;

/**
 * Discriminated on `failed` (#494 N-1): a probe that genuinely resolved this
 * cycle carries `failed: false` and, structurally, ALWAYS carries `signals`
 * — there is no way to construct the "resolved but signals missing" shape
 * that a plain optional `signals?: HealthConnectionSignals` on a flat
 * `{ failed: boolean }` interface used to allow. A probe that rejected,
 * threw, or timed out carries `failed: true` and no `signals` field at all —
 * see `loadConnectedHealthCloudFacts`, which OMITS such a provider from its
 * returned `facts` rather than writing any fallback value in its place.
 */
type CloudProbeAttempt =
  | { id: (typeof CLOUD_PROBE_PROVIDERS)[number]; failed: false; signals: HealthConnectionSignals }
  | { id: (typeof CLOUD_PROBE_PROVIDERS)[number]; failed: true };

/**
 * Run one cloud probe with a bounded timeout, guaranteed to RESOLVE, never
 * reject and never hang past `timeoutMs` — the structural fix for "a probe
 * promise path is currently unhandled." Whichever settles first (the real
 * probe, or the timeout) wins; the loser is simply ignored (its eventual
 * settlement, if any, is swallowed here rather than left to become an
 * unhandled rejection later — see N1/N2 on `CLOUD_PROBE_TIMEOUT_MS` above
 * for what that swallowing actually costs).
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
      resolve({ id, failed: true });
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
        resolve({ id, failed: true });
      });
  });
}

export interface ConnectedHealthCloudProbeResult {
  /** Only providers whose probe genuinely resolved THIS cycle. A provider
   *  whose probe rejected, threw, or timed out is OMITTED here entirely —
   *  never written as a fabricated `{integrationReady:false, link:'none'}` —
   *  so that `ConnectedHealthContainer`'s cycle-over-cycle merge
   *  (`mergeCloudFacts`) can genuinely preserve whatever a prior successful
   *  cycle already knew about that provider instead of downgrading it. */
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
    if (attempt.failed) {
      // OMIT — never write a fallback value. See `ConnectedHealthCloudFacts`
      // and `ConnectedHealthCloudProbeResult.facts` for why: this is what
      // lets the container's merge genuinely keep a prior cycle's real fact
      // instead of downgrading it to a fresh worse guess.
      anyProbeFailed = true;
      continue;
    }
    facts[attempt.id] = attempt.signals;
  }
  return { facts, anyProbeFailed };
}

/**
 * Merge one probe cycle's facts on top of the previous cycle's, provider by
 * provider. A provider present in `next` (its probe resolved this cycle,
 * successfully or not — see `loadConnectedHealthCloudFacts`) always wins.
 * A provider ABSENT from `next` (its probe failed to complete this cycle —
 * rejected, threw, or timed out) simply keeps whatever `prev` already had,
 * including "nothing yet" (`undefined`) if no cycle has ever succeeded for
 * it. This is the one place `mode: 'offline'`'s copy
 * (`connected_health.offline_notice`: "Couldn't check your connections just
 * now — this list may be out of date.") is actually earned rather than
 * merely asserted: a provider's real prior fact survives a failed cycle
 * untouched, so "may be out of date" never quietly means "may be
 * fabricated." See `ConnectedHealthContainer`'s file header and
 * `applyProbeCycle`, the container's actual call-site wrapper around this
 * function.
 */
export function mergeCloudFacts(
  prev: ConnectedHealthCloudFacts,
  next: ConnectedHealthCloudFacts,
): ConnectedHealthCloudFacts {
  return { ...prev, ...next };
}

/**
 * The exact state-update composition `ConnectedHealthContainer.refreshCloudFacts`
 * performs on every probe cycle: fold this cycle's newly-resolved facts on
 * top of whatever cloud facts the container already had, via `mergeCloudFacts`
 * — never a plain replacement (see `mergeCloudFacts`'s own header for why a
 * replacement would silently break the `mode: 'offline'` copy's honesty).
 *
 * Deliberately a thin, named wrapper rather than calling `mergeCloudFacts`
 * directly from the container: `components/health/__tests__/connectedHealthContainer.render.test.tsx`
 * pins the container's literal `setCloud(...)` call site to this exact
 * function BY NAME (a source-text assertion, since the container itself is
 * never mounted in that suite — see its file header for why). That gives a
 * regression back to `setCloud(facts)` (#494 S-1 — a real prior bug at this
 * exact call site, invisible to the 415 tests that existed before this
 * function/test pair) a deterministic test failure instead of silently
 * shipping.
 */
export function applyProbeCycle(
  prev: ConnectedHealthCloudFacts,
  facts: ConnectedHealthCloudFacts,
): ConnectedHealthCloudFacts {
  return mergeCloudFacts(prev, facts);
}

/**
 * Drop a single provider's cloud fact immediately on a successful disconnect
 * (#494 S-2), rather than leaving it to the follow-up probe cycle to
 * overwrite. Without this, a provider that was genuinely revoked but whose
 * follow-up `refreshCloudFacts` probe then FAILS (rejects/times out) would
 * have its stale pre-revocation fact survive `applyProbeCycle`'s merge
 * untouched — the row would keep rendering as connected for a provider whose
 * token was just revoked, until the screen remounts. Dropping the key here
 * means a failed follow-up probe leaves the provider honestly ABSENT — the
 * same "no evidence yet" state as a provider that has never once probed
 * successfully — rather than fabricating staleness into a claim of current
 * connection.
 *
 * A no-op for any `providerId` outside `CLOUD_PROBE_PROVIDERS` (apple_health
 * / google_health / samsung_health / oura / strava aren't cloud-probed at
 * all, so `facts` never has a key for them) — safe to call unconditionally
 * from the container's disconnect handler regardless of which provider was
 * revoked.
 */
export function dropCloudFact(
  facts: ConnectedHealthCloudFacts,
  providerId: HealthProviderId,
): ConnectedHealthCloudFacts {
  if (!isCloudProbeProvider(providerId) || !(providerId in facts)) return facts;
  const next = { ...facts };
  delete next[providerId];
  return next;
}

function isCloudProbeProvider(
  providerId: HealthProviderId,
): providerId is (typeof CLOUD_PROBE_PROVIDERS)[number] {
  return (CLOUD_PROBE_PROVIDERS as readonly string[]).includes(providerId);
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
