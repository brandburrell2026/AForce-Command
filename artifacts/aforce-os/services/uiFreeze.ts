/**
 * UI Freeze — keystone manifest.
 *
 * Spec Rule #1:
 *   Keep exactly:
 *     Home Orb Timeline Performance Signal Heat map Glow nodes
 *     Journal HydroScan Profile Sleep Community Cards Spacing
 *     Graphs
 *   No redesign.
 *   Do not move screens.
 *   Do not rebuild navigation.
 *
 * Hidden architecture only this turn — no UI changes, no edits
 * to any screen, layout, navigation file, or component. This is
 * the keystone constraint that governs every other spec rule:
 * a machine-readable registry of the 14 frozen surfaces plus
 * the three spec prohibitions, surfaced as `assertUiFreeze` so
 * any future code path that tries to redesign / move / rebuild
 * can hard-fail at the call site.
 *
 * Gate: `spec_uiFreeze` (default true — the freeze is core
 * policy; only the formalized invariant + guardrail are new).
 */
import { useFeatureFlags } from '@/store/useAppStore';

/** The 14 frozen UI surfaces, in spec order. */
export const FROZEN_SURFACES = [
  'home',
  'orb',
  'timeline',
  'performanceSignal',
  'heatMap',
  'glowNodes',
  'journal',
  'hydroScan',
  'profile',
  'sleep',
  'community',
  'cards',
  'spacing',
  'graphs',
] as const;

export type FrozenSurface = (typeof FROZEN_SURFACES)[number];

/** Verbatim spec display strings for the 14 frozen surfaces. */
export const FROZEN_SURFACE_LABELS: Readonly<Record<FrozenSurface, string>> = {
  home: 'Home',
  orb: 'Orb',
  timeline: 'Timeline',
  performanceSignal: 'Performance Signal',
  heatMap: 'Heat map',
  glowNodes: 'Glow nodes',
  journal: 'Journal',
  hydroScan: 'HydroScan',
  profile: 'Profile',
  sleep: 'Sleep',
  community: 'Community',
  cards: 'Cards',
  spacing: 'Spacing',
  graphs: 'Graphs',
};

/** Pure: is `s` one of the 14 frozen surfaces? */
export function isFrozenSurface(s: string): s is FrozenSurface {
  return (FROZEN_SURFACES as readonly string[]).includes(s);
}

/**
 * The three spec prohibitions, verbatim. Exported as a readonly
 * tuple so future code can iterate or surface them in dev tools
 * without restating them.
 */
export const UI_FREEZE_INVARIANTS = [
  'No redesign.',
  'Do not move screens.',
  'Do not rebuild navigation.',
] as const;

export type UiFreezeInvariant = (typeof UI_FREEZE_INVARIANTS)[number];

/** Intent flags evaluated by `assertUiFreeze`. */
export interface UiFreezeIntent {
  redesign?: boolean;
  moveScreen?: boolean;
  rebuildNavigation?: boolean;
}

export class UiFreezeViolationError extends Error {
  /** The spec invariants that were violated, verbatim. */
  readonly violated: readonly UiFreezeInvariant[];
  constructor(violated: readonly UiFreezeInvariant[]) {
    super(`UI Freeze violated: ${violated.join(' ')}`);
    this.name = 'UiFreezeViolationError';
    this.violated = violated;
  }
}

/**
 * Pure: throw if the given intent would violate the UI Freeze.
 * `redesign` → 'No redesign.'
 * `moveScreen` → 'Do not move screens.'
 * `rebuildNavigation` → 'Do not rebuild navigation.'
 * Empty / all-false intent is a no-op. Multiple violations are
 * reported together. Use as a precondition at the call site of
 * any future code that touches screens, layout, or navigation.
 */
export function assertUiFreeze(intent: UiFreezeIntent = {}): void {
  const violated: UiFreezeInvariant[] = [];
  if (intent.redesign) violated.push('No redesign.');
  if (intent.moveScreen) violated.push('Do not move screens.');
  if (intent.rebuildNavigation) violated.push('Do not rebuild navigation.');
  if (violated.length > 0) throw new UiFreezeViolationError(violated);
}

export interface UiFreezeState {
  enabled: boolean;
  surfaces: typeof FROZEN_SURFACES;
  surfaceLabels: typeof FROZEN_SURFACE_LABELS;
  invariants: typeof UI_FREEZE_INVARIANTS;
}

/**
 * Hidden hook. Returns the frozen-surface registry + spec
 * invariants with `enabled` gated on `spec_uiFreeze`. Not
 * consumed by any UI this turn — the freeze is enforced by
 * not editing screens, not by runtime checks in the existing
 * codebase.
 */
export function useHiddenUiFreeze(): UiFreezeState {
  const flags = useFeatureFlags();
  return {
    enabled: !!flags.spec_uiFreeze,
    surfaces: FROZEN_SURFACES,
    surfaceLabels: FROZEN_SURFACE_LABELS,
    invariants: UI_FREEZE_INVARIANTS,
  };
}
