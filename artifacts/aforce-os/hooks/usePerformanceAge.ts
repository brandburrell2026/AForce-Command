/**
 * usePerformanceAge — the single hook-friendly selector for the
 * Performance Age surface.
 *
 * Reads ONLY already-derived engine outputs, the biometrics path, the
 * profile identity, and the internal analytics metrics, then folds them
 * through `derivePerformanceAge`. It dispatches nothing into the hydration
 * reducer, so consuming it can never affect a hydration point, performance
 * band, or recovery score (Score Protection).
 *
 * The analytics-derived signals (compliance streak + active days) load
 * asynchronously from storage with safe defaults (streak unknown, 0 active
 * days), so a brand-new session simply reads "provisional" until they land
 * — never a wrong number.
 *
 * Daily snapshot series (powers the 7-/30-day trends): this hook reads the
 * persisted Performance Age snapshots back from the Command-Event Ledger and
 * feeds them to the trend helper, and — once a finite age exists — records ONE
 * snapshot per UTC day into that same ledger. Recording is advisory and
 * Score-Protection-safe: the ledger only stores the already-derived display
 * age; it never dispatches a reducer action or moves a hydration point,
 * performance band, or recovery score. The write is idempotent (one event per
 * UTC day, the first finite value of the day wins) and loop-safe (it is
 * skipped when today's snapshot is already present, so re-renders never
 * re-append or churn the store). Until ≥2 distinct days with a baseline
 * spanning the window exist, the trends honestly report "collecting…" rather
 * than a fabricated slope.
 */
import React from 'react';

import { useEngineSlice, useUserSlice, useProfileIdentitySlice } from '@/store/slices';
import {
  deriveRecoverySnapshot,
  recoveryInputsFromState,
} from '@/services/recoveryEngine';
import { selectFreshestSleepHours } from '@/services/profileBodyModel';
import {
  selectMaxWorkoutMinutes,
  selectMaxStrain,
} from '@/services/metabolicReadinessService';
import { ageFromBirthYear } from '@/utils/profileIdentity';
import { getAnalyticsMetrics } from '@/services/analytics';
import { dailySnapshotForRecording } from '@/utils/performanceAge';
import {
  derivePerformanceAge,
  type PerformanceAgeSnapshot,
} from '@/services/performanceAgeService';
import {
  useCommandLedgerStore,
  getCommandLedgerState,
  appendCommandEvents,
} from '@/services/commandLedger';
import {
  ledgerToPerformanceAgeSnapshots,
  collectPerformanceAgeSnapshotEvents,
} from '@/utils/intelligence/commandEventAdapters';

// UTC day indices with a snapshot append currently in flight. The hook is read
// by two surfaces at once (Home + the weekly report), so two consumers can
// observe the same "not yet recorded" state in one tick before either append
// lands; this module-level latch keeps exactly one write per day in flight. The
// ledger merge would dedupe a double write anyway, but the latch also avoids the
// bounded extra notify/persist churn from a redundant no-op append.
const snapshotInFlightDays = new Set<number>();

export function usePerformanceAge(): PerformanceAgeSnapshot {
  const user = useUserSlice();
  const engine = useEngineSlice();
  const profile = useProfileIdentitySlice();
  const ledger = useCommandLedgerStore();

  const [activeDays, setActiveDays] = React.useState(0);
  const [complianceStreak, setComplianceStreak] = React.useState<number | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    void getAnalyticsMetrics().then((m) => {
      if (cancelled) return;
      setActiveDays(m.retention.activeDays);
      setComplianceStreak(m.streak.current);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Persisted daily history, projected from the ledger for the trend helper.
  const dailySnapshots = React.useMemo(
    () => ledgerToPerformanceAgeSnapshots(ledger.events),
    [ledger.events],
  );

  const snapshot = React.useMemo(() => {
    const recovery = deriveRecoverySnapshot(
      recoveryInputsFromState(user, engine),
    ).recovery;
    const sleep = selectFreshestSleepHours(user.biometrics);

    return derivePerformanceAge({
      actualAge: ageFromBirthYear(profile.birthYear),
      recoveryCapacity: typeof recovery === 'number' ? recovery : null,
      sleepHours: sleep ? sleep.hours : null,
      workoutMinutes: selectMaxWorkoutMinutes(user.biometrics),
      strain: selectMaxStrain(user.biometrics),
      activityLevel: profile.activityLevel,
      complianceStreak,
      activeDays,
      dailySnapshots,
      nowMs: Date.now(),
    });
  }, [user, engine, profile, activeDays, complianceStreak, dailySnapshots]);

  // Record one snapshot per UTC day (advisory-only; never mutates score). Three
  // guards keep this idempotent + loop-safe so the first finite value of the day
  // is locked and the append → re-read cycle terminates instead of churning:
  //   1. the in-flight latch skips a day whose write has not yet landed;
  //   2. the existence check reads the FRESHEST ledger state (not the captured
  //      render value) so a sibling consumer's just-committed write is seen;
  //   3. the latch is released only after the write settles.
  const performanceAge = snapshot.result.performanceAge;
  React.useEffect(() => {
    const toRecord = dailySnapshotForRecording(performanceAge, Date.now());
    if (!toRecord) return;
    const { dayIndex } = toRecord;
    if (snapshotInFlightDays.has(dayIndex)) return;
    const alreadyRecorded = getCommandLedgerState().events.some(
      (e) => e.kind === 'performance_age_snapshot' && e.localDayIndex === dayIndex,
    );
    if (alreadyRecorded) return;
    snapshotInFlightDays.add(dayIndex);
    void appendCommandEvents(collectPerformanceAgeSnapshotEvents([toRecord])).finally(
      () => snapshotInFlightDays.delete(dayIndex),
    );
  }, [performanceAge, ledger.events]);

  return snapshot;
}
