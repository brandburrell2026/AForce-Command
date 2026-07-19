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
import { buildRecoveryCommand, parseEngineActionCopy } from '../utils/recovery/recoveryCommandFromStore';

export default function RecoveryCoachRoute() {
  const router = useRouter();
  const { state } = useAppStore();

  // Dormant unless explicitly enabled — never surfaces in the production binary.
  if (!state.featureFlags.spec_recoveryCoach) return <Redirect href="/" />;

  const engineCommand = state.engineOutput.command;
  // Reconstruct the recheck window from the risk timer. `timerSeconds` is the
  // *remaining* time (it ticks down every second); the full window it was seeded
  // from is `riskTimer.minutes * 60`. Passing only the remaining value would make
  // the Coach treat a mid-cycle command as a fresh short window ("4 MIN" on a
  // 15-minute recheck). Deriving elapsed = full − remaining anchors createdAt to
  // the true issue time, so countdown, duration, and progress stay coherent
  // (spec §11). Clamp so the window never drops below the remaining time.
  const remainingSeconds = Math.max(0, state.timerSeconds);
  const fullWindowSeconds = Math.max(remainingSeconds, (state.engineOutput.riskTimer?.minutes ?? 0) * 60);
  const elapsedSeconds = fullWindowSeconds - remainingSeconds;
  // The engine command string is parsed into title + instruction with any
  // "Recheck in …" clause STRIPPED — the recheck is shown only by the countdown
  // (spec §2/§7). When the recovery/rules engine emits structured commands, feed
  // those straight to buildRecoveryCommand instead.
  const { title, instruction } = parseEngineActionCopy(engineCommand.action);
  const command = buildRecoveryCommand(
    {
      commandId: engineCommand.id,
      title: title || 'Start with water',
      instruction,
      primaryActionLabel: "I've had the water",
      rationale: engineCommand.explanation,
      recheckInSeconds: remainingSeconds,
      elapsedSeconds,
      sourceVersion: 'engine@live',
    },
    Date.now(),
  );

  return <RecoveryCoachScreen command={command} onClose={() => router.back()} />;
}
