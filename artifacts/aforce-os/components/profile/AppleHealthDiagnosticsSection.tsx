/**
 * AppleHealthDiagnosticsSection — connected wrapper around the pure
 * `AppleHealthDiagnosticsPanel`.
 *
 * RC-2 P0 device-validation audit. Split into its own component (rather
 * than adding a `useEngineSlice()` call inside `ProfileScreenV2`) so its
 * store subscription can never regress the whole-screen re-render
 * optimization RC-1 W3P2 fought for — see `ProfileScreenV2.tsx`'s own
 * header comment on narrow slice subscriptions ("every 1s TICK_TIMER
 * re-rendered this entire 3000+ line screen"). `engineOutput` changes every
 * tick; a CHILD component re-rendering from its own subscription does not
 * cascade a re-render to its parent, so isolating the subscription here
 * keeps the cost contained to this one small subtree.
 *
 * In production and every non-internal build, `INTERNAL_TESTFLIGHT_OVERLAY_ENABLED`
 * is `false` and the caller (`ProfileScreenV2.tsx`) never mounts this
 * component at all — so this `useEngineSlice()` subscription doesn't merely
 * render nothing there, it never runs. Zero cost off-gate.
 */
import React, { useMemo } from 'react';
import { AppleHealthDiagnosticsPanel } from './AppleHealthDiagnosticsPanel';
import { useEngineSlice } from '@/store/slices';
import { INTERNAL_TESTFLIGHT_OVERLAY_ENABLED } from '@/featureFlags/internalTestflightOverlay';
import { explainFieldArbitration } from '@/utils/biometricsAggregator';
import type {
  AppleHealthDiagnosticsSnapshot,
  AppleHealthScoringInputSnapshot,
} from '@/services/appleHealthDiagnostics';
import type { ProviderBiometrics, ProviderSnapshot } from '@/types';

export interface AppleHealthDiagnosticsSectionProps {
  diagnostics: AppleHealthDiagnosticsSnapshot | null;
  /** `state.userState.biometrics?.apple_health` — already subscribed at the screen level via `useUserSlice()`, so passing it down costs nothing extra. */
  biometricsEntry: ProviderSnapshot | null | undefined;
  /**
   * RC-2 founder logging order (build-49 device finding, 2026-08-07): the
   * FULL cross-provider record — `state.userState.biometrics` — needed for
   * `explainFieldArbitration`'s per-field readback (WHICH provider won
   * `sleepHoursLastNight`/`hrvSdnn` arbitration and why), as distinct from
   * `biometricsEntry` above, which is Apple's slice alone. Already
   * subscribed at the screen level, so passing it down costs nothing extra.
   */
  biometrics: ProviderBiometrics | undefined;
}

export function AppleHealthDiagnosticsSection({
  diagnostics,
  biometricsEntry,
  biometrics,
}: AppleHealthDiagnosticsSectionProps) {
  const engineOutput = useEngineSlice();
  const recoveryRow = engineOutput.breakdown.find((c) => c.id === 'health_signals') ?? null;

  // N-a (RC-2 independent-verdict review, second pass): the memo below
  // originally depended on `recoveryRow` itself. `recoveryRow` is a fresh
  // object every render — `engineOutput.breakdown` is rebuilt from scratch
  // on every `TICK_TIMER` tick (per this file's own header), so `.find()`
  // above returns a new object reference each time even when its fields
  // (`id`/`label`/`delta`/`hint`) are unchanged. A `useMemo` keyed on that
  // reference recomputes every tick regardless — the exact churn the N2 fix
  // below was meant to prevent, silently inert. Depending on the row's
  // primitive fields instead (not the row object) is what actually makes
  // the memo hold across ticks whose recovery contribution hasn't changed.
  const recoveryId = recoveryRow?.id ?? null;
  const recoveryLabel = recoveryRow?.label ?? null;
  const recoveryDelta = recoveryRow?.delta ?? null;
  const recoveryHint = recoveryRow?.hint ?? null;

  // N2 (RC-2 independent-verdict review): memoized so this object identity
  // only changes when one of its actual inputs does, rather than on every
  // render of this component (which — per this file's own header — happens
  // on every `engineOutput` tick while the diagnostics panel is mounted).
  // `AppleHealthDiagnosticsPanel` doesn't currently rely on referential
  // stability, but a fresh object every second is needless churn for a
  // debug-only subtree and cheap to avoid.
  const scoringInput: AppleHealthScoringInputSnapshot = useMemo(
    () => ({
      biometricsEntry: biometricsEntry
        ? {
            restingHeartRate: biometricsEntry.restingHeartRate ?? null,
            hrvSdnn: biometricsEntry.hrvSdnn ?? null,
            sleepHoursLastNight: biometricsEntry.sleepHoursLastNight ?? null,
            stepsToday: biometricsEntry.stepsToday ?? null,
            fetchedAt: biometricsEntry.fetchedAt,
            // RC-2 founder logging order: the observation axes, read back
            // verbatim from the store mirror — undefined (never null,
            // matching `ProviderSnapshot`'s own convention) when the
            // producer never populated them.
            ...(biometricsEntry.fieldObservedAtMs?.sleepHoursLastNight != null
              ? { sleepObservedAtMs: biometricsEntry.fieldObservedAtMs.sleepHoursLastNight }
              : {}),
            ...(biometricsEntry.latestObservedAtMs != null
              ? { latestObservedAtMs: biometricsEntry.latestObservedAtMs }
              : {}),
          }
        : null,
      recoveryContribution: recoveryId !== null
        ? {
            id: recoveryId,
            label: recoveryLabel as string,
            delta: recoveryDelta as number,
            hint: recoveryHint as string,
          }
        : null,
    }),
    [biometricsEntry, recoveryId, recoveryLabel, recoveryDelta, recoveryHint],
  );

  // RC-2 founder logging order (build-49 device finding, 2026-08-07): the
  // arbitration readback — WHICH provider won each field and why. Memoized
  // on `biometrics` alone (its reference only changes when a fetch/merge
  // actually updates the record), mirroring `aggregateBiometrics`'s own
  // production call sites, which likewise resolve `now` once at computation
  // time rather than continuously re-clamping against a ticking clock.
  const arbitration = useMemo(
    () => ({
      sleep: explainFieldArbitration(biometrics, 'sleepHoursLastNight', Date.now()),
      hrv: explainFieldArbitration(biometrics, 'hrvSdnn', Date.now()),
    }),
    [biometrics],
  );

  return (
    <AppleHealthDiagnosticsPanel
      enabled={INTERNAL_TESTFLIGHT_OVERLAY_ENABLED}
      diagnostics={diagnostics}
      scoringInput={scoringInput}
      arbitration={arbitration}
    />
  );
}
