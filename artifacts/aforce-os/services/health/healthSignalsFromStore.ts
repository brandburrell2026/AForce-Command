/**
 * healthSignalsFromStore — the store-shaped adapter in front of the frozen
 * canonical selector contract (`services/health/signalResolution.ts`, READ
 * ONLY — never modified here; see that file's header for the full contract).
 *
 * W3.2 (Wave 3, Home consumes canonical selectors): the first consumers
 * migrating onto `resolveHealthSignals` read from the app store, not from
 * hand-built fixtures. This module is the ONE place that turns store shape
 * into `ResolveHealthSignalsInput` so every canonical consumer builds that
 * input the same honest way.
 *
 * STORE MAPPING — what feeds `ResolveHealthSignalsInput` today and why
 *   - `biometrics` — `UserState.biometrics` verbatim. This ALREADY carries the
 *     Apple Health overlay: `store/appStoreReducer.ts`'s `SET_APPLE_HEALTH`
 *     case mirrors every apple-health snapshot into BOTH the legacy
 *     `userState.appleHealth` field AND `biometrics.apple_health` in the same
 *     write, and every other reducer branch that touches `appleHealth` moves
 *     `biometrics` alongside it from the same source (see `SET_USER_STATE`,
 *     `store/app/actions.ts`'s post-intake merge). The two ever fall out of
 *     step. Consequently this module never reads `UserState.appleHealth`
 *     separately — that would be a second, redundant raw read of the exact
 *     same data the mirror already guarantees is in `biometrics`. This
 *     mirrors the existing legacy selectors (`selectFreshestSleepHours`,
 *     `selectFreshestHrvMs`, …), which have only ever read `biometrics` too.
 *   - `records` — always `undefined`. The record plane (`CanonicalHealthRecord[]`)
 *     is not populated anywhere in the store yet (nothing in this repo
 *     constructs one for a live user); resolveHealthSignals falls through to
 *     the snapshot plane for every family whenever records are absent, which
 *     is exactly the behavior this adapter wants for W3.2.
 *   - `activeDirectProviders` — always an empty `Set`. This is the SAME choice
 *     `signalResolutionFixtures.ts` makes for every snapshot-plane-only
 *     fixture (`APPLE_ONLY`, `HC_ONLY`, …): with `records` undefined, dedupe
 *     never runs, so this set only affects `reasonForNoData`'s honest-reason
 *     classification, not which value wins. There is no live per-provider
 *     "is this a REAL direct link" signal wired into any store slice today
 *     (see `utils/health/healthProviderStatus.ts`'s `HealthLinkState` — that
 *     requires a verified backend token / native permission grant this
 *     adapter has no synchronous access to), so an empty set is the honest
 *     default rather than a guess.
 *   - `connections` (grantedTypes / deniedTypes / presentationState) — always
 *     `undefined`. Building this per §26/§53 "providerRowStatus" facts
 *     (`services/health/providerPresentation.ts` + `connectedHealthView.ts`)
 *     requires a container that resolves real permission state; as of W3.2 no
 *     such container exists anywhere in the app (`connectedHealthView.ts` is
 *     only exercised by its own fixtures/tests — grep confirms no screen
 *     wires `grantedTypes`/`deniedTypes` from a live source yet). Per the W3.2
 *     brief ("connections via providerRowStatus facts if cheap — else
 *     biometrics-only, document"), this is NOT cheap today: it would mean
 *     building new async permission-read plumbing, which is out of scope
 *     here. Leaving `connections` undefined keeps `reasonForNoData` honest
 *     (falls back to `no_provider` / `no_data`, never a fabricated
 *     `permission_denied`) and adds NO raw provider reads.
 *
 * SCORE-PROTECTION: this module only shapes inputs for, and reads outputs
 * from, `resolveHealthSignals` — it computes nothing itself and never touches
 * `scoringEngine.ts` / `statusColor.ts` (both off-limits, both unimported
 * here).
 */
import type { HealthProviderId } from '@workspace/health-core';
import type { ProviderBiometrics } from '@/types/biometrics';
import {
  resolveHealthSignals,
  type HealthSignals,
  type ResolveHealthSignalsInput,
} from './signalResolution';
import { emits } from './readinessSignals';

export interface HealthSignalsFromStoreInput {
  /** `UserState.biometrics` — already includes the Apple Health overlay; see file header. */
  biometrics: ProviderBiometrics | undefined;
  /** Epoch ms, injected by the caller (hook passes `Date.now()`) — this module never reads the clock. */
  nowMs: number;
}

/**
 * Pure mapping: store shape → the frozen `ResolveHealthSignalsInput` contract.
 * Exported separately from `healthSignalsFromStore` so tests can assert the
 * mapping itself without re-asserting `resolveHealthSignals`'s own behavior
 * (already covered by `__tests__/signalResolution.test.ts`).
 */
export function buildResolveHealthSignalsInput(
  input: HealthSignalsFromStoreInput,
): ResolveHealthSignalsInput {
  return {
    biometrics: input.biometrics,
    records: undefined,
    activeDirectProviders: new Set<HealthProviderId>(),
    connections: undefined,
    nowMs: input.nowMs,
  };
}

/** The one-call entry point store-backed consumers use: store shape → resolved signals. */
export function healthSignalsFromStore(input: HealthSignalsFromStoreInput): HealthSignals {
  return resolveHealthSignals(buildResolveHealthSignalsInput(input));
}

// ─── Legacy-shaped projection ──────────────────────────────────────────────

/**
 * The subset of `HealthSignals` that `useMetabolicReadiness` /
 * `usePerformanceAge` actually consume, projected into the same scalar shape
 * their pre-existing legacy selectors returned — so swapping the flag only
 * changes WHERE the number comes from, never the shape the derivation math
 * expects.
 *
 * `strain` is deliberately NOT included here: `resolveHealthSignals` has no
 * general "strain" family (WHOOP strain only ever appears as a
 * provider-attributed `providerScores` entry, `kind: 'whoop_strain'`, by
 * design — see signalResolution.ts's SOURCE_PRIORITY / honesty-rules doc,
 * which deliberately excludes provider scores from cross-selection to avoid
 * relabeling one provider's concept as a generic AForce one). Synthesizing a
 * cross-provider "max strain" from that array would be exactly the kind of
 * cross-provider blending the canonical contract forbids. Both readiness
 * hooks keep reading `selectMaxStrain(biometrics)` (the legacy selector)
 * regardless of `health_canonical_consumers` — documented at each call site.
 */
/**
 * FRESHNESS GATE (governance fix, W3.5 follow-up): every field below emits
 * only when the winning reading's §53 rating is `fresh` or `aging` — the
 * SAME `EMITTING_FRESHNESS` policy `readinessSignals.ts`'s `toReadinessBiometrics`
 * uses, imported from there rather than redefined here (one constant, one
 * policy; see that file's export). This matters because the `sleep` family
 * has no `expireAfterMs` (config/hydroStateModel.ts §53 — "never expired"):
 * `signals.sleepDuration.available` alone stays `true` forever, even for a
 * reading that is months stale, so gating on `available` alone (the prior
 * behavior here) let arbitrarily old sleep data score as if it were current.
 * Gating on freshness here closes that gap without touching `available`'s
 * own semantics or anything in `resolveHealthSignals`.
 */
export interface CanonicalReadinessSignals {
  /** Winning source's total sleep hours, or null when unavailable OR stale/expired. */
  sleepHours: number | null;
  /**
   * Winning source's HRV in ms — SDNN ONLY. BLOCKER fix (batch review):
   * metabolicReadinessService's normalization curve is SDNN-anchored; an
   * RMSSD value scored on it fabricates readiness. Non-SDNN methods project
   * null — which is also exact legacy parity (legacy read hrvSdnn only).
   * Also null when unavailable or stale/expired.
   */
  hrvMs: number | null;
  /**
   * The winning reading's actual statistic, for callers that can handle both.
   * Surfaced even when `hrvMs` is null for the SDNN-only reason above, but
   * null (like every other field) when the reading is stale/expired — a
   * method annotation on a signal we've otherwise excluded would be a leak,
   * not a courtesy.
   */
  hrvMethod: 'rmssd' | 'sdnn' | null;
  /**
   * Total workout minutes from the ONE winning source's entries for today, or
   * null when unavailable or stale/expired. Summing multiple entries from a
   * single already-selected origin is the same "sum within one winning
   * provider's own samples" rule `resolveSteps` uses — never a sum/average
   * ACROSS competing providers. Non-finite durations (NaN) are skipped rather
   * than propagating a NaN total — same guard as `toReadinessBiometrics`.
   */
  workoutMinutes: number | null;
}

export function canonicalReadinessSignals(signals: HealthSignals): CanonicalReadinessSignals {
  const sleep = signals.sleepDuration;
  const sleepHours = sleep.available && emits(sleep.freshness) ? sleep.value.totalSleepHours : null;

  const hrv = signals.hrv;
  const hrvMethod = hrv.available && emits(hrv.freshness) ? hrv.value.method : null;
  const hrvMs =
    hrv.available && emits(hrv.freshness) && hrv.value.method === 'sdnn' ? hrv.value.valueMs : null;

  const workouts = signals.workouts;
  const workoutMinutes =
    workouts.available && emits(workouts.freshness)
      ? workouts.value.reduce(
          (sum, entry) => (Number.isFinite(entry.durationMin) ? sum + entry.durationMin : sum),
          0,
        )
      : null;

  return { sleepHours, hrvMs, hrvMethod, workoutMinutes };
}
