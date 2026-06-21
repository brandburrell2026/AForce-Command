/**
 * useCommandLedgerSync — live wiring for the Command-Event Ledger (Step 4).
 *
 * Observes the already-existing runtime sources (hydration intake history,
 * voice check-in records, and the live context provenance) and feeds them into
 * the persistence service's idempotent ingest. It is deliberately a ONE-WAY,
 * READ-ONLY bridge:
 *
 *   runtime state ──(pure collectors)──▶ command ledger
 *
 * HARD LOCKS honored:
 *   - Score-Protection: this hook NEVER dispatches a reducer action and never
 *     touches a hydration point / performance band / recovery score. It only
 *     records advisory provenance via `ingestCommandLedgerSources`.
 *   - No fabrication: events are built by the pure adapter collectors, which
 *     drop anything invalid. The context snapshot reuses the EXACT live
 *     confidence derivation (`commandConfidenceInputsFromState`) so the ledger
 *     can never look more confident than the live engine — weather is recorded
 *     only when it is live-fresh, otherwise `null` (no reading).
 *   - Idempotent: intake and voice events carry stable ids, so re-ingesting the
 *     same history is a no-op (the merge dedupes by id). A compact dependency
 *     key gates the effect so it only re-runs when the observed content
 *     actually changes — no per-render ingest, no effect loop.
 *
 * NOT wired this phase: command confirmations. The answer to "did you follow
 * the command?" flows through the transient `confirmCommand` action and is NOT
 * persisted as an observable history in state, so there is no stable, idempotent
 * source to mirror without fabricating. The collector plumbing
 * (`commandConfirmations`) is in place for when such a log exists; until then
 * we record nothing rather than invent confirmations.
 *
 * Mount ONCE, inside `<AppProvider>` (see `app/_layout.tsx`).
 */
import { useEffect, useMemo } from 'react';

import { useUserSlice } from '@/store/slices';
import { useVoiceCheckIn } from '@/hooks/useVoiceCheckIn';
import { deriveContextSnapshotFields } from '@/utils/scoring/commandConfidence';
import {
  ingestCommandLedgerSources,
  type CommandLedgerSources,
} from '@/services/commandLedger';

export function useCommandLedgerSync(): void {
  const userState = useUserSlice();
  const { records: voiceRecords } = useVoiceCheckIn();

  const intakeEvents = userState.intakeEvents ?? null;

  // Faithful, live-derived context built from a SINGLE evaluation clock, so a
  // freshness flag can never disagree with its own source anchor (see
  // `deriveContextSnapshotFields`). Each flag is bound to its `*FetchedAtMs`, so
  // a reader anchors freshness to the original fetch and never falls back to the
  // observation instant — the ledger can never overstate freshness vs live.
  const {
    hasContext,
    weatherTempC,
    weatherFetchedAtMs,
    hasFreshBiometrics,
    biometricsFetchedAtMs,
  } = deriveContextSnapshotFields(userState, Date.now());

  // Compact content key. Deliberately excludes wall-clock time: the effect must
  // fire on CONTENT change (a new log, a new check-in, a changed context
  // signal), not on every tick — otherwise a time-keyed context snapshot would
  // append on every render. Source fetch times ARE part of the key so a fresh
  // fetch (new provenance) re-syncs, even when the boolean is unchanged.
  const syncKey = useMemo(() => {
    const lastIntake = intakeEvents && intakeEvents.length > 0
      ? intakeEvents[intakeEvents.length - 1]?.id ?? '∅'
      : '∅';
    const lastVoice = voiceRecords.length > 0
      ? voiceRecords[voiceRecords.length - 1]?.completedAtMs ?? 0
      : 0;
    const ctx = hasContext
      ? `${weatherFetchedAtMs != null ? `${weatherTempC}@${weatherFetchedAtMs}` : 'x'}:${
          biometricsFetchedAtMs ?? 'x'
        }`
      : 'none';
    return [
      intakeEvents?.length ?? 0,
      lastIntake,
      voiceRecords.length,
      lastVoice,
      ctx,
    ].join('|');
  }, [
    intakeEvents,
    voiceRecords,
    hasContext,
    weatherTempC,
    weatherFetchedAtMs,
    biometricsFetchedAtMs,
  ]);

  useEffect(() => {
    const now = Date.now();
    const sources: CommandLedgerSources = {
      intakeEvents,
      voiceCheckIns: voiceRecords,
      // Record a context snapshot only when there is real context to capture,
      // so the ledger does not accumulate empty "no context" rows. Each signal
      // carries its own source fetch time so a reader anchors freshness to the
      // original fetch, never to this observation instant. `hasFreshBiometrics`
      // is true iff `biometricsFetchedAtMs` is non-null, so the flag and its
      // anchor are always emitted together (fail-closed).
      contextSnapshots: hasContext
        ? [
            {
              atMs: now,
              weatherTempC,
              hasFreshBiometrics,
              ...(weatherFetchedAtMs != null ? { weatherFetchedAtMs } : {}),
              ...(biometricsFetchedAtMs != null ? { biometricsFetchedAtMs } : {}),
            },
          ]
        : null,
    };
    // Fire-and-forget: ingest is best-effort + serialized internally, and never
    // throws into render. Idempotent merge means a redundant call is harmless.
    void ingestCommandLedgerSources(sources);
    // The effect is intentionally keyed on the compact content key only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncKey]);
}
