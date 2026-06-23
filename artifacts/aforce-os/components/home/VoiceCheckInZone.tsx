/**
 * VoiceCheckInZone — the single Home seam for the two NEW Voice Check-In™
 * read-out surfaces: Brain Energy™ and Performance Memory™.
 *
 * Responsibilities (and only these):
 *   • Feature-flag gate — renders nothing unless `voice_checkin_enabled` is on,
 *     so both cards are purely additive / hideable (Build 100% · Show 10%).
 *     The flag ships OFF in the production binary and ON in DEMO.
 *   • Data — a one-directional, READ-ONLY projection of the persisted check-in
 *     history (via `useVoiceCheckIn`) and the already-derived recovery engine.
 *     Nothing here awards or mutates a hydration point, performance band, or
 *     recovery score (Score-Protection): it only reads the morning self-report
 *     and folds it through the pure `computeBrainEnergy` /
 *     `computePerformanceMemory` helpers.
 *
 * All rendering lives in the pure presentational cards below.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Colors } from '@/theme/colors';
import { useEngineSlice, useFlagsSlice, useUserSlice } from '@/store/slices';
import {
  deriveRecoverySnapshot,
  recoveryInputsFromState,
} from '@/services/recoveryEngine';
import { useVoiceCheckIn } from '@/hooks/useVoiceCheckIn';
import {
  computeBrainEnergy,
  type BrainEnergyBand,
  type BrainEnergyResult,
} from '@/utils/brainEnergy';
import {
  computePerformanceMemory,
  type PerformanceMemoryEntry,
  type PerformanceMemoryResult,
} from '@/utils/performanceMemory';
import { useCommandLedgerStore } from '@/services/commandLedger';
import { computeExecutionMemory } from '@/utils/intelligence/executionMemory';

const BRAND = Colors.accent.brand;

/** Brain-energy band → WHOOP recovery tint. */
function bandTint(band: BrainEnergyBand | null): string {
  switch (band) {
    case 'PRIMED':
      return Colors.states.PEAK.primary;
    case 'STEADY':
      return Colors.states.BALANCED.primary;
    case 'FOGGY':
      return Colors.states.RECOVERING.primary;
    case 'LOW':
      return Colors.states.DEPLETED.primary;
    default:
      return Colors.text.primary;
  }
}

// ─── Brain Energy card (presentational) ───────────────────────────────
function BrainEnergyCard({ result }: { result: BrainEnergyResult }) {
  const { t } = useTranslation();
  const tint = bandTint(result.band);

  return (
    <View style={styles.card} testID="home-brain-energy-card">
      <Text style={styles.eyebrow}>
        {t('voiceCheckIn.brainEnergy.eyebrow', { defaultValue: 'BRAIN ENERGY' })}
      </Text>

      {result.score == null ? (
        <Text style={styles.collecting} testID="home-brain-energy-collecting">
          {t('voiceCheckIn.brainEnergy.collecting', {
            defaultValue:
              'Complete your morning check-in to read Brain Energy.',
          })}
        </Text>
      ) : (
        <View testID="home-brain-energy-value">
          <View style={styles.valueRow}>
            <Text style={[styles.value, { color: tint }]}>{result.score}</Text>
            <Text style={[styles.band, { color: tint }]}>{result.label}</Text>
          </View>
          <Text style={styles.caption}>{result.caption}</Text>
        </View>
      )}
    </View>
  );
}

// ─── Performance Memory card (presentational) ─────────────────────────
function PerformanceMemoryCard({
  result,
  executionSlot,
}: {
  result: PerformanceMemoryResult;
  executionSlot?: React.ReactNode;
}) {
  const { t } = useTranslation();

  return (
    <View style={styles.card} testID="home-performance-memory-card">
      <Text style={styles.eyebrow}>
        {t('voiceCheckIn.memory.eyebrow', {
          defaultValue: 'PERFORMANCE MEMORY',
        })}
      </Text>

      {result.status === 'empty' ? (
        <Text style={styles.collecting} testID="home-performance-memory-empty">
          {t('voiceCheckIn.memory.empty', {
            defaultValue: 'Your first check-in starts your performance memory.',
          })}
        </Text>
      ) : (
        <View testID="home-performance-memory-value">
          <View style={styles.statsRow}>
            <View style={styles.statCol}>
              <Text style={styles.statValue}>{result.streak}</Text>
              <Text style={styles.statLabel}>
                {t('voiceCheckIn.memory.streak', { defaultValue: 'DAY STREAK' })}
              </Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCol}>
              <Text style={styles.statValue}>{result.entriesLogged}</Text>
              <Text style={styles.statLabel}>
                {t('voiceCheckIn.memory.logged', { defaultValue: 'CHECK-INS' })}
              </Text>
            </View>
          </View>
          <Text style={styles.caption}>{result.recap}</Text>
        </View>
      )}
      {executionSlot}
    </View>
  );
}

// ─── Execution Memory (command-completion) sub-readout ────────────────
// Mounted only when `performance_memory_execution_enabled` is on, so the
// ledger subscription + compute path never run in the production binary. The
// recap is a pure, READ-ONLY projection of recorded command confirmations —
// it never awards/mutates score and follow-rate never feeds Command Confidence.
function ExecutionMemoryContent() {
  const { t } = useTranslation();
  const ledger = useCommandLedgerStore();
  const execution = React.useMemo(
    () => computeExecutionMemory(ledger.events),
    [ledger.events],
  );

  // Nothing followed yet → keep the card byte-identical to the voice-only read.
  if (execution.status === 'empty') return null;

  return (
    <View style={styles.executionSection} testID="home-execution-memory">
      <View style={styles.executionDivider} />
      <Text style={styles.subEyebrow}>
        {t('voiceCheckIn.memory.executionEyebrow', {
          defaultValue: 'COMMANDS FOLLOWED',
        })}
      </Text>
      <View style={styles.statsRow}>
        <View style={styles.statCol}>
          <Text style={styles.statValue}>{execution.executionStreak}</Text>
          <Text style={styles.statLabel}>
            {t('voiceCheckIn.memory.executionStreak', {
              defaultValue: 'CMD STREAK',
            })}
          </Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statCol}>
          <Text style={styles.statValue}>
            {execution.followed}/{execution.sampleSize}
          </Text>
          <Text style={styles.statLabel}>
            {t('voiceCheckIn.memory.executionFollowed', {
              defaultValue: 'FOLLOWED',
            })}
          </Text>
        </View>
      </View>
      <Text style={styles.caption}>{execution.recap}</Text>
    </View>
  );
}

// ─── Data seam ────────────────────────────────────────────────────────
function VoiceCheckInZoneInner({
  showExecutionMemory,
}: {
  showExecutionMemory: boolean;
}) {
  const user = useUserSlice();
  const engine = useEngineSlice();
  const { latestAnswers, records } = useVoiceCheckIn();

  const brainEnergy = React.useMemo(() => {
    // Brain Energy is the morning ritual's read-out: surface it only once a
    // check-in exists, otherwise the recovery signal alone would fabricate a
    // score before the user has ever calibrated.
    if (!latestAnswers) return computeBrainEnergy({});
    const recoveryCapacity = deriveRecoverySnapshot(
      recoveryInputsFromState(user, engine),
    ).recovery;
    return computeBrainEnergy({
      energy: latestAnswers.energy,
      stress: latestAnswers.stress,
      recoveryCapacity:
        typeof recoveryCapacity === 'number' ? recoveryCapacity : null,
    });
  }, [latestAnswers, user, engine]);

  const memory = React.useMemo(() => {
    const entries: PerformanceMemoryEntry[] = records.map((r) => ({
      dayIndex: r.dayIndex,
      energy: r.answers.energy,
      stress: r.answers.stress,
      goal: r.answers.goal,
    }));
    return computePerformanceMemory(entries, new Date());
  }, [records]);

  return (
    <View style={styles.wrap}>
      <BrainEnergyCard result={brainEnergy} />
      <PerformanceMemoryCard
        result={memory}
        executionSlot={showExecutionMemory ? <ExecutionMemoryContent /> : null}
      />
    </View>
  );
}

export function VoiceCheckInZone() {
  const flags = useFlagsSlice();
  if (!flags.voice_checkin_enabled) return null;
  return (
    <VoiceCheckInZoneInner
      showExecutionMemory={flags.performance_memory_execution_enabled}
    />
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 14 },
  card: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.07)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    paddingVertical: 18,
    paddingHorizontal: 18,
    marginBottom: 14,
  },
  eyebrow: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    letterSpacing: 2.5,
    color: BRAND,
    marginBottom: 14,
  },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  value: {
    fontFamily: 'Inter_700Bold',
    fontSize: 52,
    letterSpacing: -1.5,
  },
  band: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
    letterSpacing: 2,
  },
  caption: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    letterSpacing: 0.2,
    lineHeight: 17,
    color: Colors.text.secondary,
    marginTop: 6,
  },
  collecting: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 17,
    color: Colors.text.secondary,
  },
  statsRow: { flexDirection: 'row', alignItems: 'center' },
  statCol: { flex: 1 },
  statValue: {
    fontFamily: 'Inter_700Bold',
    fontSize: 34,
    letterSpacing: -1,
    color: Colors.text.primary,
  },
  statLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 10,
    letterSpacing: 1.4,
    color: Colors.text.muted,
    marginTop: 2,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(255,255,255,0.07)',
    marginHorizontal: 14,
  },
  executionSection: { marginTop: 2 },
  executionDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.07)',
    marginVertical: 14,
  },
  subEyebrow: {
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    letterSpacing: 2,
    color: Colors.text.muted,
    marginBottom: 12,
  },
});
