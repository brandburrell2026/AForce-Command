/**
 * CommandStack — middle-of-screen "what to do next" stack:
 *   <WhyThisScore/> → optional <CommandConfirmPrompt/> → <AICommandCard/>
 *   → <AIVideoPlayer/>.
 *
 * Subscribes to engine + user + confirmation slices independently, so
 * the heavy AICommandCard / AIVideoPlayer don't re-render when (e.g.)
 * the heat band flips or the orb pulse animates.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';

import { WhyThisScore } from '../WhyThisScore';
import { CommandConsole } from './CommandConsole';
import { CommandConfirmPrompt } from '../CommandConfirmPrompt';
import { AIVideoPlayer } from '../AIVideoPlayer';
import { matchVideo } from '../../services/videoEngine';
import {
  useEngineSlice,
  useUserSlice,
  useCycleSlice,
  useConfirmationSlice,
  useActionsSlice,
} from '../../store/slices';
import { useDisplayedAccent } from '../../hooks/useDisplayedAccent';
import type { FluidType } from '../../types';

interface ConfirmActions {
  confirmCommand: (followed: boolean) => Promise<void>;
  logIntake: (
    fluidType: FluidType,
    opts?: { silent?: boolean; ozOverride?: number; flavorLabel?: string },
  ) => Promise<void>;
}

interface Props {
  onOpenBreakdown: () => void;
}

function CommandStackImpl({ onOpenBreakdown }: Props) {
  const engine = useEngineSlice();
  const userState = useUserSlice();
  const { timerSeconds } = useCycleSlice();
  const { pendingConfirmation } = useConfirmationSlice();
  const { confirmCommand, logIntake } = useActionsSlice<ConfirmActions>();
  // Pass the displayed-score accent so the AI Coach recolours in lockstep
  // with the orb digit. `undefined` when not under the provider.
  const displayed = useDisplayedAccent();

  return (
    <>
      <WhyThisScore reasons={engine.reasons} onOpenBreakdown={onOpenBreakdown} />
      <View style={styles.spacer} />
      {pendingConfirmation && (
        <>
          <CommandConfirmPrompt
            onAnswer={(answer) => {
              // WATER / AFORCE RTD → run the real intake calculation
              // (immediate + delayed score impact, hydration math).
              // MISSED IT → -3 confirmation penalty, no intake event.
              if (answer.kind === 'intake') {
                logIntake(answer.fluidType);
              } else {
                confirmCommand(false);
              }
            }}
            inClutch={!!userState.clutchActive}
          />
          <View style={styles.spacer} />
        </>
      )}
      <CommandConsole
        command={engine.command}
        performanceState={engine.performanceState}
        accentOverride={displayed?.primary}
      />
      <View style={styles.spacer} />
      <AIVideoPlayer
        video={matchVideo({ engineOutput: engine, userState })}
        command={engine.command}
        timerSeconds={timerSeconds}
      />
    </>
  );
}

export const CommandStack = React.memo(CommandStackImpl);

const styles = StyleSheet.create({
  spacer: { height: 12 },
});
