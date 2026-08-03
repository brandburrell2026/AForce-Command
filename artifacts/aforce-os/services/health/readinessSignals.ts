/**
 * READINESS SIGNALS — pure adapter from canonical resolved health signals to
 * the exact input shape the EXISTING readiness/evidence layers already consume.
 *
 * PR W3.5 (Wave 3). `resolveHealthSignals` (W3.1) is the canonical selector,
 * but the shipping score path still reads the legacy per-provider snapshot
 * record (`ProviderBiometrics`) through:
 *
 *   - utils/scoring/breakdown.ts      → aggregateBiometrics(state.biometrics)
 *     (recovery delta ±10 + inferred-activity floor)
 *   - utils/scoring/commandConfidence.ts → freshBiometricAnchorMs(state)
 *   - utils/scoring/commandEvidence.ts   → the neutral 'biometrics' context item
 *
 * ALL of those files are governance-locked (Score-Protection) and are NOT
 * edited. Instead, this module converts a `HealthSignals` result back into a
 * `ProviderBiometrics`-compatible view, so the EXISTING breakdown/aggregator
 * path could consume canonical (deduped, priority+freshness-selected,
 * provenance-honest) data with ZERO scoring-file changes.
 *
 * ── Wiring status: NOT WIRED (deliberate) ─────────────────────────────────
 * `toReadinessBiometrics` (THIS file's adapter) is not wired anywhere. Do not
 * confuse it with `canonicalReadinessSignals` in `healthSignalsFromStore.ts`,
 * which IS wired — `useMetabolicReadiness` / `usePerformanceAge` already call
 * it behind `health_canonical_consumers` (default OFF). The two share the
 * same `EMITTING_FRESHNESS` policy (exported below) but are separate
 * projections onto separate consumer shapes.
 * Nothing calls `toReadinessBiometrics` yet (the module IS imported for its
 * shared `emits()` policy — see `healthSignalsFromStore.ts`). The flag-gated
 * swap point is the STORE / CONTAINER layer (where `state.biometrics` is populated today),
 * NOT the scoring layer — scoring keeps reading `state.biometrics` verbatim
 * either way. The store-shaped input builder already exists
 * (`healthSignalsFromStore.ts`, W3.2): the future wiring composes
 * store → `healthSignalsFromStore` → `resolveHealthSignals` →
 * `toReadinessBiometrics` → the biometrics slot scoring already reads.
 * That swap is gated on:
 *
 *   1. `health_canonical_consumers` (featureFlags/flags.ts — OFF), and
 *   2. explicit Governance-Architect sign-off for the store-path PR.
 *
 * This PR is adapter + invariant proof only — zero behavior change. The
 * companion suite `__tests__/scoreProtectionInvariants.test.ts` proves the
 * score-protection invariants hold BEFORE any wiring lands.
 *
 * ── Honesty rules carried through from signalResolution ──────────────────
 *   - PER-WINNER OUTPUT: each metric family carries at most ONE winning
 *     origin's value (already selected upstream). The adapter never blends,
 *     never re-selects, never fabricates a snapshot field the winner did not
 *     supply. A field a family did not resolve is simply absent.
 *   - ATTRIBUTION PRESERVED: the emitted snapshot is keyed by the reading's
 *     TRUE origin (`reading.source`), not the delivering aggregator, so a
 *     WHOOP HRV delivered via Apple Health still shows up as `whoop`.
 *   - PROVIDER SCORES STAY PROVIDER-ATTRIBUTED: `whoop_recovery` can only
 *     ever land on the `whoop` snapshot's own `recoveryPct` field (and so on
 *     per kind). A mis-attributed entry is DROPPED, never re-homed — see
 *     `SCORE_KIND_OWNER`. No provider score is ever mapped to an AForce
 *     concept or another provider's field.
 *   - STALE/EXPIRED EMIT NOTHING: only `fresh` / `aging` readings (§53
 *     ratings) are emitted. This is deliberately STRICTER than today's raw
 *     snapshot passthrough (which lets `aggregateBiometrics` read a snapshot
 *     of any age): a canonical signal past its §53 stale boundary produces NO
 *     readiness influence at all. Fail-safe: less influence, never more.
 *   - EMPTY IN → EMPTY OUT: if nothing resolved, the adapter returns `{}` —
 *     which the existing breakdown path already treats exactly like "no
 *     platforms connected" (its guard is `Object.keys(biometrics).length > 0`).
 *
 * ── The one legacy-field nuance: `hrvSdnn` mirror ─────────────────────────
 * `aggregateBiometrics` reads HRV exclusively through the legacy
 * `ProviderSnapshot.hrvSdnn` field, which health-core documents as a
 * MIXED-SEMANTICS wire-compat field (providers already populate it with
 * RMSSD-based values; it is kept verbatim for consumer compatibility). The
 * adapter therefore:
 *   1. writes the honest, method-true field (`hrvRmssdMs` or `hrvSdnnMs`)
 *      from the winning reading's PRESERVED method, and
 *   2. mirrors the same value into legacy `hrvSdnn` — exactly the value the
 *      winning provider itself would have placed there on the raw wire — so
 *      the untouched aggregator sees the signal at unchanged magnitude.
 * This mirrors existing wire semantics; it never converts between methods.
 *
 * ── Score-Protection (governance hard lock) ───────────────────────────────
 * This module computes NO score, NO delta, NO clamp — it only reshapes
 * already-selected signals. The ±10 recovery clamp, all weights, and all band
 * math remain solely inside the untouched scoring files. See
 * `READINESS_SIGNALS_SCORE_PROTECTION` below (asserted by the invariant suite).
 *
 * Pure module — no React Native, no store, no feature-flag import, no I/O,
 * no clock reads (freshness was already rated upstream against injected time).
 */

import type {
  HealthProviderId,
  ProviderBiometrics,
  ProviderScoreKind,
  ProviderSnapshot,
} from '@workspace/health-core';
import type {
  HealthSignalFreshness,
  HealthSignals,
} from './signalResolution';

// ─── Score-Protection ─────────────────────────────────────────────────────────

/**
 * Governance hard lock, asserted by `__tests__/scoreProtectionInvariants.test.ts`:
 * this adapter reshapes canonical signals into the legacy snapshot view ONLY.
 * It never computes a score or a delta, never applies or alters the ±10
 * recovery clamp (that stays inside the untouched scoring files), and never
 * re-attributes a provider score to another provider or to an AForce concept.
 */
export const READINESS_SIGNALS_SCORE_PROTECTION =
  'toReadinessBiometrics reshapes canonical health signals into the legacy ProviderBiometrics view only. It computes no score and no delta, leaves the ±10 recovery clamp solely to the untouched scoring files, and never re-attributes a provider score.';

// ─── Emission policy ──────────────────────────────────────────────────────────

/**
 * Only these §53 ratings may influence readiness surfaces through this
 * adapter. `stale` and `expired` readings emit NOTHING (stricter than the raw
 * snapshot passthrough — see file header, "STALE/EXPIRED EMIT NOTHING").
 *
 * ONE constant, ONE policy: exported so `healthSignalsFromStore.ts`'s
 * `canonicalReadinessSignals` projection gates on the exact same freshness
 * rule this adapter uses, rather than maintaining a second copy that could
 * drift. Any surface projecting `HealthSignals` into a readiness-influencing
 * value must reuse `EMITTING_FRESHNESS` / `emits()` — never fork it.
 */
export const EMITTING_FRESHNESS: ReadonlySet<HealthSignalFreshness> = new Set(['fresh', 'aging']);

export function emits(freshness: HealthSignalFreshness): boolean {
  return EMITTING_FRESHNESS.has(freshness);
}

/**
 * The ONLY provider each score kind may be attributed to. An entry whose
 * `provider` disagrees with its `kind` is dropped, never re-homed — provider
 * scores are attributed facts, not transferable values.
 */
const SCORE_KIND_OWNER: Record<ProviderScoreKind, HealthProviderId> = {
  whoop_recovery: 'whoop',
  whoop_strain: 'whoop',
  oura_readiness: 'oura',
  garmin_stress: 'garmin',
  strava_training_load: 'strava',
};

// ─── Internal helpers ────────────────────────────────────────────────────────

/**
 * Get-or-create the per-origin snapshot. `fetchedAt` is the max observedAt
 * across the origin's emitted readings — an honest "as of" anchor for the
 * downstream freshness gates (`freshBiometricAnchorMs`), never inflated.
 */
function snapFor(
  out: Map<HealthProviderId, ProviderSnapshot>,
  provider: HealthProviderId,
  observedAtMs: number,
): ProviderSnapshot {
  let snap = out.get(provider);
  if (!snap) {
    snap = { providerId: provider, fetchedAt: observedAtMs };
    out.set(provider, snap);
  }
  if (observedAtMs > snap.fetchedAt) snap.fetchedAt = observedAtMs;
  return snap;
}

// ─── Entry point ──────────────────────────────────────────────────────────────

/**
 * Reshape a resolved `HealthSignals` into the `ProviderBiometrics` view the
 * existing readiness/evidence layers consume. Pure: same input ⇒ same output.
 * Returns `{}` (treated by every consumer as "nothing connected") whenever no
 * signal qualifies — never a placeholder snapshot.
 */
export function toReadinessBiometrics(signals: HealthSignals): ProviderBiometrics {
  const out = new Map<HealthProviderId, ProviderSnapshot>();

  const sleep = signals.sleepDuration;
  if (sleep.available && emits(sleep.freshness)) {
    snapFor(out, sleep.source, sleep.observedAtMs).sleepHoursLastNight = sleep.value.totalSleepHours;
  }

  const rhr = signals.restingHeartRate;
  if (rhr.available && emits(rhr.freshness)) {
    snapFor(out, rhr.source, rhr.observedAtMs).restingHeartRate = rhr.value;
  }

  const hrv = signals.hrv;
  if (hrv.available && emits(hrv.freshness)) {
    const snap = snapFor(out, hrv.source, hrv.observedAtMs);
    // Honest, method-true field first — the method is PRESERVED upstream.
    if (hrv.value.method === 'rmssd') snap.hrvRmssdMs = hrv.value.valueMs;
    else snap.hrvSdnnMs = hrv.value.valueMs;
    // Legacy wire-compat mirror (see file header) — same value, no conversion.
    snap.hrvSdnn = hrv.value.valueMs;
  }

  const workouts = signals.workouts;
  if (workouts.available && emits(workouts.freshness)) {
    // Entries all belong to the ONE winning origin; summing minutes within
    // that single provider's own sessions is the codified within-provider
    // rule (never cross-provider blending). Attribution follows each entry's
    // own `source` regardless, so an origin split can never merge providers.
    for (const entry of workouts.value) {
      if (!Number.isFinite(entry.durationMin)) continue;
      const snap = snapFor(out, entry.source, entry.observedAtMs);
      snap.workoutMinutesToday = (snap.workoutMinutesToday ?? 0) + entry.durationMin;
    }
  }

  const steps = signals.steps;
  if (steps.available && emits(steps.freshness)) {
    snapFor(out, steps.source, steps.observedAtMs).stepsToday = steps.value;
  }

  for (const score of signals.providerScores) {
    if (!emits(score.freshness)) continue;
    if (SCORE_KIND_OWNER[score.kind] !== score.provider) continue; // never re-attribute
    const snap = snapFor(out, score.provider, score.observedAtMs);
    switch (score.kind) {
      case 'whoop_recovery':
        snap.recoveryPct = score.value;
        break;
      case 'whoop_strain':
        snap.strain = score.value;
        break;
      case 'oura_readiness':
        snap.readinessScore = score.value;
        break;
      case 'garmin_stress':
        snap.stressScore = score.value;
        break;
      case 'strava_training_load':
        snap.trainingLoad = score.value;
        break;
    }
  }

  return Object.fromEntries(out) as ProviderBiometrics;
}
