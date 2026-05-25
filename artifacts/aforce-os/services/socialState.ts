/**
 * Hidden Social Mode derivation — Rule #13.
 *
 * Parallel pure-function module mirroring (NOT replacing) the
 * derivation logic currently inlined inside SocialModeV2Screen. The
 * visible screen keeps its own inline derivation untouched so this
 * rule cannot accidentally change shipped behavior. Later rules can
 * migrate the screen to import from here once we're ready to absorb
 * the render-path change.
 *
 * Surfaces (the six pieces Rule #13 says to keep):
 *   1. Signal          — one of LOCKED IN / FLOW / RECOVERING / RECOVERY REQUIRED
 *   2. Command         — one-line action
 *   3. Forecast        — one-sentence outlook
 *   4. Session Memory  — prior-night snapshot {dateISO, aura, signal}
 *   5. Crew            — max 3 rows of {name, state}
 *   6. Shared Context  — one-sentence room read derived from Crew
 *
 * The hook is gated on `spec_social` (Rule #17 default false). When
 * the flag is off, the hook returns null and the rest of the app is
 * none the wiser.
 */

import { useMemo } from 'react';

import { useFeatureFlags } from '../store/useAppStore';

export type SocialSignal =
  | 'LOCKED IN'
  | 'FLOW'
  | 'RECOVERING'
  | 'RECOVERY REQUIRED';

export type SocialAura = 'RECOVERED' | 'STEADY' | 'STRAINED';

export interface SocialInputs {
  /** 0–100 hydration recovery capacity. */
  recoveryCapacity: number;
  /** Discrete water-cycle count for the day. */
  waterCycles: number;
  /** Logged alcoholic-drink count for the active session. */
  drinkCount: number;
}

export interface CrewMember {
  name: string;
  state: SocialSignal;
}

export interface SessionMemory {
  dateISO: string;
  aura: SocialAura;
  signal: SocialSignal;
}

export interface SocialSnapshot {
  signal: SocialSignal;
  command: string;
  forecast: string;
  sharedContext: string;
  crew: CrewMember[];
  sessionMemory: SessionMemory | null;
}

/** Crew cap — Rule #13 says max 3 rows. */
export const CREW_MAX = 3;

const SIGNAL_PHRASE: Record<SocialSignal, string> = {
  'LOCKED IN': 'locked in',
  'FLOW': 'in flow',
  'RECOVERING': 'recovering',
  'RECOVERY REQUIRED': 'in recovery',
};

export function deriveSocialSignal(i: SocialInputs): SocialSignal {
  if (i.recoveryCapacity < 30) return 'RECOVERY REQUIRED';
  if (i.drinkCount >= 3 || i.recoveryCapacity < 55) return 'RECOVERING';
  if (i.recoveryCapacity >= 75 && i.waterCycles >= 5) return 'LOCKED IN';
  return 'FLOW';
}

export function deriveSocialCommand(i: SocialInputs): string {
  if (i.drinkCount >= 1) return 'One water. Now.';
  if (i.waterCycles < 3) return 'Cycle water before the next round.';
  return 'Hold position.';
}

export function deriveSocialForecast(i: SocialInputs): string {
  if (i.recoveryCapacity > 70 && i.waterCycles >= 5) return 'Signal up.';
  if (i.recoveryCapacity < 40) return 'Signal down.';
  if (i.drinkCount >= 2) return 'Signal at risk.';
  return 'Signal holding.';
}

/**
 * One-sentence room read of the Crew — never name-drops, never longer
 * than a single line. Counts each distinct state and joins them with
 * a thin separator. Returns "Crew quiet." when nobody is online.
 */
export function deriveSocialSharedContext(crew: readonly CrewMember[]): string {
  if (crew.length === 0) return 'Crew quiet.';
  const counts = new Map<SocialSignal, number>();
  for (const c of crew.slice(0, CREW_MAX)) {
    counts.set(c.state, (counts.get(c.state) ?? 0) + 1);
  }
  const order: SocialSignal[] = ['LOCKED IN', 'FLOW', 'RECOVERING', 'RECOVERY REQUIRED'];
  const parts: string[] = [];
  for (const s of order) {
    const n = counts.get(s);
    if (n) parts.push(`${n} ${SIGNAL_PHRASE[s]}`);
  }
  return `${parts.join(' · ')}.`;
}

export interface DeriveSocialArgs extends SocialInputs {
  crew: readonly CrewMember[];
  sessionMemory: SessionMemory | null;
}

export function deriveSocialSnapshot(args: DeriveSocialArgs): SocialSnapshot {
  return {
    signal: deriveSocialSignal(args),
    command: deriveSocialCommand(args),
    forecast: deriveSocialForecast(args),
    sharedContext: deriveSocialSharedContext(args.crew),
    crew: args.crew.slice(0, CREW_MAX),
    sessionMemory: args.sessionMemory,
  };
}

/**
 * React hook — returns the derived snapshot, or `null` when
 * `spec_social` is off. The visible Social V2 screen does NOT
 * consume this hook yet; it exists so the next wave of work
 * (notifications, multi-device sync, crew presence) can read from a
 * single shared source.
 */
export function useHiddenSocialState(args: DeriveSocialArgs): SocialSnapshot | null {
  const flags = useFeatureFlags();
  return useMemo(() => {
    if (!flags.spec_social) return null;
    return deriveSocialSnapshot(args);
  }, [
    flags.spec_social,
    args.recoveryCapacity,
    args.waterCycles,
    args.drinkCount,
    args.crew,
    args.sessionMemory,
  ]);
}
