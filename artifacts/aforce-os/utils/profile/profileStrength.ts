/**
 * §55 / Show-10 — Profile Strength display model (pure).
 *
 * Assembles a user's profile-completeness level into a ConfidenceChip model for
 * the Profile Strength section. Pure glue over the shipped §55 resolver
 * (`assessProfileCompleteness`) and the shared chip mapping (`completenessChip`)
 * — no new logic, no §56, no score, no React Native. The section (slice-2)
 * renders this; keeping the assembly here makes it node-testable.
 */
import { assessProfileCompleteness, type ProfileCompletenessLevel } from './profileCompleteness';
import { completenessChip, type ConfidenceChipModel } from '../confidence/confidenceChip';
import type { ProfileIdentity } from '../profileIdentity';

export interface ProfileStrength {
  level: ProfileCompletenessLevel;
  /** The chip to render — label + opacity, no copy (copy is an optional view prop). */
  chip: ConfidenceChipModel;
}

export function profileStrength(profile: ProfileIdentity): ProfileStrength {
  const { level } = assessProfileCompleteness(profile);
  return { level, chip: completenessChip(level) };
}
