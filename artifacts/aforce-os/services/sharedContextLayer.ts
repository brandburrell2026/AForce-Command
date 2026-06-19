/**
 * One Engine — Shared Context Layer manifest.
 *
 * Spec Rule #2:
 *   Shared Context Layer.
 *   Inputs: Profile Weather Temperature Humidity Water Cycles
 *           Timeline HydroScan Journal Sleep Activity Social
 *           Cruise
 *   Outputs: Signal Recovery Protocol Memory Recommendations
 *   Keep engines separate.
 *   Do NOT merge.
 *   One Orb.
 *
 * Hidden architecture only this turn — no UI changes, no edits
 * to any existing engine (hydration, recovery, scoring, Orb,
 * journal, etc.) and no aggregation that calls multiple engines.
 *
 * This is a POINTER / REGISTRY layer, not a merge layer. The
 * spec explicitly says "Keep engines separate. Do NOT merge." —
 * so this module only names the 13 input streams + 5 output
 * streams the Shared Context Layer composes from, plus the
 * "One Orb" invariant. A follow-up rule pass can build the
 * actual composition surface against these constants without
 * inventing stream names or violating the "do not merge" rule.
 *
 * Gate: `spec_sharedContextLayer` (default true — Shared Context
 * is core; only the formalized registry is new).
 */
import { useFeatureFlags } from '@/store/useAppStore';

/** The 13 Shared Context Layer input streams, in spec order. */
export const CONTEXT_INPUTS = [
  'profile',
  'weather',
  'temperature',
  'humidity',
  'water',
  'cycles',
  'timeline',
  'hydroScan',
  'journal',
  'sleep',
  'activity',
  'social',
  'cruise',
] as const;

export type ContextInput = (typeof CONTEXT_INPUTS)[number];

/** Verbatim spec display strings for the 13 input streams. */
export const CONTEXT_INPUT_LABELS: Readonly<Record<ContextInput, string>> = {
  profile: 'Profile',
  weather: 'Weather',
  temperature: 'Temperature',
  humidity: 'Humidity',
  water: 'Water',
  cycles: 'Cycles',
  timeline: 'Timeline',
  hydroScan: 'HydroScan',
  journal: 'Journal',
  sleep: 'Sleep',
  activity: 'Activity',
  social: 'Social',
  cruise: 'Cruise',
};

/** The 5 Shared Context Layer output streams, in spec order. */
export const CONTEXT_OUTPUTS = [
  'signal',
  'recovery',
  'protocol',
  'memory',
  'recommendations',
] as const;

export type ContextOutput = (typeof CONTEXT_OUTPUTS)[number];

/** Verbatim spec display strings for the 5 output streams. */
export const CONTEXT_OUTPUT_LABELS: Readonly<Record<ContextOutput, string>> = {
  signal: 'Signal',
  recovery: 'Recovery',
  protocol: 'Protocol',
  memory: 'Memory',
  recommendations: 'Recommendations',
};

/** Pure: is `s` one of the 13 context inputs? */
export function isContextInput(s: string): s is ContextInput {
  return (CONTEXT_INPUTS as readonly string[]).includes(s);
}

/** Pure: is `s` one of the 5 context outputs? */
export function isContextOutput(s: string): s is ContextOutput {
  return (CONTEXT_OUTPUTS as readonly string[]).includes(s);
}

/**
 * Pointer to an existing engine that feeds a context input. We
 * reference engines by string key — never import or invoke them
 * here — to preserve the spec's "Keep engines separate. Do NOT
 * merge." constraint.
 */
export interface ContextEngineRef {
  input: ContextInput;
  /** Opaque key. The composition surface (future) resolves it. */
  engineKey: string;
}

/**
 * Location Intelligence™ engine key — an opaque pointer only. The engine is
 * never imported or invoked from this layer; the spec mandates "Keep engines
 * separate. Do NOT merge."
 */
export const LOCATION_INTELLIGENCE_ENGINE_KEY = 'locationIntelligence';

/**
 * Registry pointers declaring that Location Intelligence feeds the existing
 * environmental context inputs. Pointer-only — additive to the registry, it
 * does NOT alter the 13 spec inputs and does NOT merge any engines. Exposure
 * stays gated by `location_intelligence_enabled` at the consumer; this
 * constant is just the manifest entry so a future composition surface can
 * resolve the pointer without inventing names.
 */
export const LOCATION_INTELLIGENCE_REFS: readonly ContextEngineRef[] = [
  { input: 'weather', engineKey: LOCATION_INTELLIGENCE_ENGINE_KEY },
  { input: 'temperature', engineKey: LOCATION_INTELLIGENCE_ENGINE_KEY },
  { input: 'humidity', engineKey: LOCATION_INTELLIGENCE_ENGINE_KEY },
] as const;

/**
 * "One Orb" invariant — the Shared Context Layer is allowed
 * exactly one Orb surface. Codified as a constant + assertion
 * so any future composition code can hard-fail rather than
 * silently rendering two.
 */
export const ONE_ORB_INVARIANT = true as const;

export class OneOrbViolationError extends Error {
  constructor(count: number) {
    super(
      `One Orb invariant violated: expected exactly 1 Orb, got ${count}`,
    );
    this.name = 'OneOrbViolationError';
  }
}

/**
 * Pure: assert there is exactly one Orb. Throws on any other
 * count (including 0). Use as a precondition in any future Orb
 * composition surface.
 */
export function assertOneOrb(count: number): void {
  if (count !== 1) throw new OneOrbViolationError(count);
}

export interface SharedContextLayerState {
  enabled: boolean;
  inputs: typeof CONTEXT_INPUTS;
  inputLabels: typeof CONTEXT_INPUT_LABELS;
  outputs: typeof CONTEXT_OUTPUTS;
  outputLabels: typeof CONTEXT_OUTPUT_LABELS;
  oneOrb: typeof ONE_ORB_INVARIANT;
}

/**
 * Hidden hook. Returns the input + output registries plus the
 * One Orb invariant, with `enabled` gated on
 * `spec_sharedContextLayer`. Not consumed by any UI this turn —
 * existing engines continue to operate independently.
 */
export function useHiddenSharedContextLayer(): SharedContextLayerState {
  const flags = useFeatureFlags();
  return {
    enabled: !!flags.spec_sharedContextLayer,
    inputs: CONTEXT_INPUTS,
    inputLabels: CONTEXT_INPUT_LABELS,
    outputs: CONTEXT_OUTPUTS,
    outputLabels: CONTEXT_OUTPUT_LABELS,
    oneOrb: ONE_ORB_INVARIANT,
  };
}
