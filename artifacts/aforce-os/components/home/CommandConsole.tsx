/**
 * CommandConsole — fuses AICommandCard (the "AI Coach" hero) with the
 * VoiceStatusModule (Voice Engine status footer) into a single
 * cinematic card. The AI Coach is the star at the top with its full
 * urgency band + projected impact, then a hairline divider, then the
 * compact Voice Engine status (lifecycle pill, 3-up grid, last
 * command, replay) sits as a footer strip inside the same frame.
 *
 * Both children render in `embedded` mode so they drop their own
 * outer chrome (margin, border, shadow, background) — this wrapper
 * provides the unifying container.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';

import type { Command, PerformanceState } from '../../types';
import { Colors } from '../../theme/colors';
import { useFeatureFlags } from '../../store/useAppStore';
import { useEngineSlice } from '../../store/slices';
import { AICommandCard } from '../AICommandCard';
import { CommandEvidence } from './CommandEvidence';
import { VoiceStatusModule } from '../VoiceStatusModule';
import { useRecoverySnapshotFromStore } from '../../services/useRecoverySnapshot';
import { MODE_RECOVERY_SCORE } from '../../utils/modes/smartModes';

interface Props {
  command: Command;
  performanceState: PerformanceState;
  accentOverride?: string;
}

function CommandConsoleImpl({ command, performanceState, accentOverride }: Props) {
  const color = accentOverride ?? performanceState.color;
  const flags = useFeatureFlags();
  // Ruling #5 (Recovery Mode tone): while Recovery Mode is active (score
  // below MODE_RECOVERY_SCORE), the AI Command's 'critical' badge drops
  // alarm framing. Gated so normal mode (score >= threshold) renders
  // identically to before.
  const engine = useEngineSlice();
  const recoveryActive = typeof engine.score === 'number' && engine.score < MODE_RECOVERY_SCORE;
  // Phase 3 (Recovery Layer): when `spec_recovery` is on, swap the
  // headline `action` for the Recovery engine's short imperative.
  // Hook returns null in production (flag default OFF) — no change.
  const recovery = useRecoverySnapshotFromStore();
  const displayCommand: Command =
    recovery != null && recovery.command
      ? { ...command, action: recovery.command }
      : command;
  return (
    <View style={[styles.frame, { borderColor: `${color}30` }]} testID="command-console">
      <AICommandCard
        command={displayCommand}
        performanceState={performanceState}
        accentOverride={accentOverride}
        embedded
        recoveryActive={recoveryActive}
      />
      {flags.evidence_engine_enabled && <CommandEvidence />}
      {flags.voice_status_module_visible && <VoiceStatusModule embedded />}
    </View>
  );
}

export const CommandConsole = React.memo(CommandConsoleImpl);

const styles = StyleSheet.create({
  frame: {
    marginHorizontal: 20,
    paddingHorizontal: 20,
    paddingVertical: 18,
    backgroundColor: Colors.background.card,
    borderRadius: 20,
    borderWidth: 1,
    gap: 14,
  },
});
