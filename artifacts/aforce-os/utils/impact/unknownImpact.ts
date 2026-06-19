/**
 * HydroScan 2.0™ — unknown-product impact mapping (pure, dependency-free).
 *
 * The never-dead-end flow lets a user who scanned an unrecognized product
 * pick a coarse manual category. We can't compute the full profile-aware
 * impact without product sub-scores, so we map the manual category to a
 * conservative, advisory headline + timing. Water is always Water-First
 * positive (HIGH_SUPPORT / GOOD_TIMING). This is display + history only;
 * it never mutates score (Score-Protection).
 */

import type {
  HydrationImpactLevel,
  TimingGuidanceLevel,
  UnknownProductType,
} from '../../types/scan';

export interface UnknownImpact {
  impactLevel: HydrationImpactLevel;
  timingLevel: TimingGuidanceLevel;
}

const MAP: Record<UnknownProductType, UnknownImpact> = {
  // Water leads — always the most supportive, always good timing.
  water: { impactLevel: 'HIGH_SUPPORT', timingLevel: 'GOOD_TIMING' },
  // Protein/supplement are roughly neutral for hydration on their own.
  protein: { impactLevel: 'NEUTRAL', timingLevel: 'GOOD_TIMING' },
  supplement: { impactLevel: 'NEUTRAL', timingLevel: 'GOOD_TIMING' },
  // Energy products carry caffeine/sugar load — hydrate first.
  energy: { impactLevel: 'MODERATE_IMPACT', timingLevel: 'HYDRATE_FIRST' },
  // Unknown "other" — stay conservative and neutral.
  other: { impactLevel: 'NEUTRAL', timingLevel: 'GOOD_TIMING' },
};

export function unknownProductImpact(type: UnknownProductType): UnknownImpact {
  return MAP[type] ?? MAP.other;
}
