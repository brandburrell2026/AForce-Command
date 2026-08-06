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
import type {
  AppleHealthDiagnosticsSnapshot,
  AppleHealthScoringInputSnapshot,
} from '@/services/appleHealthDiagnostics';
import type { ProviderSnapshot } from '@/types';

export interface AppleHealthDiagnosticsSectionProps {
  diagnostics: AppleHealthDiagnosticsSnapshot | null;
  /** `state.userState.biometrics?.apple_health` — already subscribed at the screen level via `useUserSlice()`, so passing it down costs nothing extra. */
  biometricsEntry: ProviderSnapshot | null | undefined;
}

export function AppleHealthDiagnosticsSection({
  diagnostics,
  biometricsEntry,
}: AppleHealthDiagnosticsSectionProps) {
  const engineOutput = useEngineSlice();
  const recoveryRow = engineOutput.breakdown.find((c) => c.id === 'health_signals') ?? null;

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
          }
        : null,
      recoveryContribution: recoveryRow
        ? {
            id: recoveryRow.id,
            label: recoveryRow.label,
            delta: recoveryRow.delta,
            hint: recoveryRow.hint,
          }
        : null,
    }),
    [biometricsEntry, recoveryRow],
  );

  return (
    <AppleHealthDiagnosticsPanel
      enabled={INTERNAL_TESTFLIGHT_OVERLAY_ENABLED}
      diagnostics={diagnostics}
      scoringInput={scoringInput}
    />
  );
}
