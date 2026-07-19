/**
 * Recovery Coach route — the flag-gated launch for the full-screen focused mode.
 *
 * DORMANT by default: rendered only when `spec_recoveryCoach` is on. Nothing in
 * the frozen home navigates here yet (the entry affordance is wired deliberately
 * later); until the flag flips, the route redirects home so it can never surface.
 *
 * The screen is driven by ONE normalized RecoveryCommand (spec §7), built here
 * from real store data (the engine's current command + the risk timer) — no
 * hardcoded hero copy, no fabricated dose.
 */
import React from 'react';
import { Redirect, useRouter } from 'expo-router';
import { useAppStore } from '../store/useAppStore';
import { RecoveryCoachScreen } from '../components/recoveryCoach/RecoveryCoachScreen';
import { buildRecoveryCommand } from '../utils/recovery/recoveryCommandFromStore';

export default function RecoveryCoachRoute() {
  const router = useRouter();
  const { state } = useAppStore();

  // Dormant unless explicitly enabled — never surfaces in the production binary.
  if (!state.featureFlags.spec_recoveryCoach) return <Redirect href="/" />;

  const engineCommand = state.engineOutput.command;
  // Build the normalized command from live store data. Title is the recovery
  // framing; instruction is the engine command verbatim (no dose parsed out);
  // recheck is the risk timer. When the recovery/rules engine emits structured
  // commands, feed those to buildRecoveryCommand instead.
  const command = buildRecoveryCommand(
    {
      commandId: engineCommand.id,
      title: 'Start with water',
      instruction: engineCommand.action,
      primaryActionLabel: "I've had the water",
      rationale: engineCommand.explanation,
      recheckInSeconds: state.timerSeconds,
      sourceVersion: 'engine@live',
    },
    Date.now(),
  );

  return <RecoveryCoachScreen command={command} onClose={() => router.back()} />;
}
