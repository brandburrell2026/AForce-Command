/**
 * Night Out — Water-First command presentation resolver (NO-c). PURE.
 *
 * Turns already-derived engine facts (score, command, confidence, freshness,
 * timer view) into the AForce protocol view model:  HYDROSTATE → NOW → NEXT →
 * LATER, one dominant action.  It DECIDES NOTHING about the body — the deterministic
 * engine chose the command/dose/window/confidence upstream; this only arranges the
 * presentation.  It never mutates score, logs intake, or invents confidence.
 *
 * "Do not create a command to fill the layout": when the caller reports no action
 * is needed, the resolver returns the calm no-command state, not a fabricated one.
 */

import type { NightOutTimerView } from './commandTimer';
import { formatRemaining } from './commandTimer';

export type CommandConfidenceLevel = 'high' | 'medium' | 'low';

export interface NightOutCommandInput {
  score: number;
  stateLabel: string;
  interpretation: string;
  /** Whether the engine currently has an actionable Water-First command. */
  hasActionableCommand: boolean;
  commandTitle: string;
  commandInstruction: string;
  doseOz?: number;
  reason: string;
  confidenceLevel: CommandConfidenceLevel;
  /** Age of the freshest confirmed signal (ms), or null when none/undated. */
  freshnessAgeMs: number | null;
  reassessMinutes: number;
  /** Completion window (minutes) shown before acceptance — NOT a countdown. */
  windowMinutes: number;
  /** Live timer view once accepted; null before acceptance. */
  timerView: NightOutTimerView | null;
  /** Transient: the user just confirmed water and we're awaiting reassessment. */
  justCompleted?: boolean;
}

export type NightOutCommandMode = 'no-command' | 'pre-session' | 'active' | 'processing';

export interface NightOutCommandView {
  mode: NightOutCommandMode;
  hero: { score: number; stateLabel: string; interpretation: string };
  now: {
    hasCommand: boolean;
    calmMessage?: string;
    title: string;
    instruction: string;
    doseOz?: number;
    windowLabel: string;
    reason: string;
    confidenceLabel: 'High' | 'Moderate' | 'Limited';
    freshnessLabel: string;
    limitedConfidence: boolean;
    cta: 'START WATER' | 'COMPLETE WATER' | null;
    remainingLabel?: string;
    showAdjust: boolean;
    showNotNow: boolean;
    processingLabel?: string;
  };
  next: { reassessLabel: string };
  later: { previewLabel: string; subjectToChange: true };
}

const CALM_NO_ACTION = "You're exactly where you should be. No action needed.";

export function confidenceLabel(level: CommandConfidenceLevel): 'High' | 'Moderate' | 'Limited' {
  return level === 'high' ? 'High' : level === 'medium' ? 'Moderate' : 'Limited';
}

/** Freshness copy from the freshest confirmed-signal age. Never fabricates. */
export function freshnessLabel(ageMs: number | null, level: CommandConfidenceLevel): string {
  if (level === 'low' || ageMs == null || !Number.isFinite(ageMs) || ageMs < 0) {
    return 'Waiting for fresher confirmed signals';
  }
  const min = Math.floor(ageMs / 60000);
  return min < 1 ? 'Updated just now' : `Updated ${min} min ago`;
}

export function resolveNightOutCommandView(input: NightOutCommandInput): NightOutCommandView {
  const hero = { score: input.score, stateLabel: input.stateLabel, interpretation: input.interpretation };
  const cLabel = confidenceLabel(input.confidenceLevel);
  const fLabel = freshnessLabel(input.freshnessAgeMs, input.confidenceLevel);
  const limited = input.confidenceLevel === 'low';
  const next = { reassessLabel: `Reassessment in ${Math.max(0, Math.round(input.reassessMinutes))} min` };
  const later = { previewLabel: 'Next water cycle after reassessment', subjectToChange: true as const };

  const base = {
    title: input.commandTitle,
    instruction: input.commandInstruction,
    doseOz: input.doseOz,
    reason: input.reason,
    confidenceLabel: cLabel,
    freshnessLabel: fLabel,
    limitedConfidence: limited,
  };

  // Processing (just completed) takes precedence — awaiting authoritative reassessment.
  if (input.justCompleted) {
    return {
      mode: 'processing',
      hero,
      now: {
        ...base,
        hasCommand: true,
        windowLabel: '',
        cta: null,
        showAdjust: false,
        showNotNow: false,
        processingLabel: 'Water confirmed. Reassessing…',
      },
      next,
      later,
    };
  }

  // Active — an accepted command with a live (non-invalid) timer.
  if (input.timerView && input.timerView.status !== 'invalid') {
    const remainingLabel = formatRemaining(input.timerView.remainingSec);
    return {
      mode: 'active',
      hero,
      now: {
        ...base,
        hasCommand: true,
        windowLabel: input.timerView.expired ? 'Window elapsed — confirm when done' : `${remainingLabel} remaining`,
        cta: 'COMPLETE WATER',
        remainingLabel,
        showAdjust: true,
        showNotNow: true,
      },
      next,
      later,
    };
  }

  // No actionable command — calm state, never fabricated.
  if (!input.hasActionableCommand) {
    return {
      mode: 'no-command',
      hero,
      now: {
        ...base,
        hasCommand: false,
        calmMessage: CALM_NO_ACTION,
        title: '',
        instruction: '',
        windowLabel: '',
        cta: null,
        showAdjust: false,
        showNotNow: false,
      },
      next,
      later,
    };
  }

  // Pre-session — the Water-First command, NOT yet accepted → no countdown.
  return {
    mode: 'pre-session',
    hero,
    now: {
      ...base,
      hasCommand: true,
      windowLabel: `Complete within ${Math.max(1, Math.round(input.windowMinutes))} minutes`,
      cta: 'START WATER',
      showAdjust: true,
      showNotNow: true,
    },
    next,
    later,
  };
}

/** Approved adjustment amounts (oz). Never arbitrary/unbounded (Adjust contract). */
export const NIGHT_OUT_ADJUST_OZ = [8, 12, 16, 20, 24] as const;

/** Validate an adjustment amount against the approved set. */
export function isApprovedAdjustOz(oz: number): boolean {
  return (NIGHT_OUT_ADJUST_OZ as readonly number[]).includes(oz);
}
