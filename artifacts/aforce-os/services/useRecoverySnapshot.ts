/**
 * Recovery Layer — React hooks that bridge the pure `recoveryEngine`
 * derivations into the live store. Kept separate from
 * `recoveryEngine.ts` so the pure module stays importable from
 * Node-only test environments (vitest can't parse the react-native
 * module graph that the slice hooks pull in).
 *
 *   - useHiddenRecoveryState(inputs) — gated hook that derives a
 *     snapshot from caller-supplied inputs. Returns `null` when
 *     `spec_recovery` is off.
 *   - useRecoverySnapshotFromStore() — Phase 2 convenience: pulls
 *     inputs directly from the store slices so any future surface
 *     (Orb line, Coach command, Timeline story, Journal entry) can
 *     opt in with one call. No surface consumes this yet.
 */
import { useMemo } from 'react';

import { useFeatureFlags } from '../store/useAppStore';
import { useEngineSlice, useUserSlice } from '../store/slices';
import {
  deriveRecoverySnapshot,
  recoveryInputsFromState,
  type RecoveryInputs,
  type RecoverySnapshot,
} from './recoveryEngine';

export function useHiddenRecoveryState(
  inputs: RecoveryInputs,
): RecoverySnapshot | null {
  const flags = useFeatureFlags();
  return useMemo(() => {
    if (!flags.spec_recovery) return null;
    return deriveRecoverySnapshot(inputs);
  }, [
    flags.spec_recovery,
    inputs.score,
    inputs.decayPerMinute,
    inputs.waterCycles,
    inputs.urineSignal,
    inputs.heatLoad,
    inputs.activityLevel,
    inputs.overnightLossOz,
    inputs.drinkCount,
    inputs.complianceStreak,
    inputs.energyState,
  ]);
}

export function useRecoverySnapshotFromStore(): RecoverySnapshot | null {
  const user = useUserSlice();
  const engine = useEngineSlice();
  const inputs = useMemo(
    () => recoveryInputsFromState(user, engine),
    [user, engine],
  );
  return useHiddenRecoveryState(inputs);
}
