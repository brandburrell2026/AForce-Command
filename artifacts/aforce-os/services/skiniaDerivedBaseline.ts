import type { SkinIAInternalObservation } from './skiniaObservationPipeline';

/** Derived observation history only. Raw captures are never accepted or stored. */
export type SkinIADerivedBaseline = Readonly<{
  observation: SkinIAInternalObservation['observation'];
  recentCount: number;
  comparison: 'PERSONAL_BASELINE';
}>;

export function buildSkinIADerivedBaseline(
  history: readonly SkinIAInternalObservation[],
  observation: SkinIAInternalObservation['observation'],
): SkinIADerivedBaseline | null {
  const recentCount = history.filter(item => item.observation === observation && item.comparison === 'PERSONAL_BASELINE').length;
  return recentCount > 0 ? Object.freeze({ observation, recentCount, comparison: 'PERSONAL_BASELINE' }) : null;
}
