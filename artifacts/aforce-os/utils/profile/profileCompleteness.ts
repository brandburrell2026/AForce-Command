/**
 * PROFILE COMPLETENESS™ (Section 55) — how much of the athlete's profile is
 * actually filled in?
 *
 * The Adaptive Profile Engine reasons over the body + performance fields a user
 * has provided. The more of them are set, the more specific — and the more
 * confident — every downstream recommendation can be. This module answers ONE
 * question, purely: *which important profile fields are present, and what share
 * of them is filled?* It deliberately does NOT decide how completeness maps onto
 * a confidence band (that is the Step-2 adapter into the Data Confidence Layer),
 * and it never touches a score, band, or status color (Score-Protection).
 *
 * Design rules from the spec (§55):
 *   - "Never require every field." A profile is RICH well before 100% — there is
 *     no state in which the user is told they MUST complete anything.
 *   - Quietly monitored. This layer carries no user-facing copy and needs no
 *     i18n; the occasional nudge is a separate Step-3 surface built on top.
 *
 * Build 100% · Show 10%: the resolver and the field descriptors are built here;
 * nothing is wired into a runtime consumer and no flag gates it — a consumer
 * opts in by CALLING `assessProfileCompleteness`, exactly like the Data
 * Confidence Layer's adapters.
 *
 * Scope (this step): the fields owned by `ProfileIdentity` — the body model and
 * the §19 performance profile, i.e. the version-minting inputs that most shape
 * recommendation quality. Cross-slice fields named by the spec but owned
 * elsewhere (Climate Profile, Sleep Schedule, Hydration Goal, Connected
 * Wearables, Product Preferences) are added as further descriptor groups when
 * their sources are wired — the API takes a descriptor list precisely so that
 * extension needs no change here.
 *
 * Pure module — no React Native, no AsyncStorage, no Date.now(), no I/O.
 */

import type { ProfileIdentity } from '../profileIdentity';

// ─── Vocabulary ───────────────────────────────────────────────────────

/** How filled-in the profile is. A qualifier — never a score or a grade. */
export type ProfileCompletenessLevel = 'sparse' | 'partial' | 'rich';

/** One field's presence in the profile (for the debug trace; not a UI string). */
export interface ProfileFieldStatus {
  /** Stable id of the field. */
  key: string;
  /** True when the user has provided a real value (not the unset sentinel). */
  present: boolean;
}

export interface ProfileCompletenessResult {
  /** The resolved band. */
  level: ProfileCompletenessLevel;
  /** How many considered fields are filled. */
  filledCount: number;
  /** How many fields were considered. */
  totalFields: number;
  /** 0..1 = filledCount / totalFields (0 when no fields are considered). */
  ratio: number;
  /** Echo of each field's presence, in descriptor order (debug trace). */
  fields: ProfileFieldStatus[];
}

/** A single field the completeness measure looks at. */
export interface ProfileFieldDescriptor {
  key: string;
  /** True when this field holds a real, user-provided value. */
  present: (p: ProfileIdentity) => boolean;
}

// ─── Locked thresholds ────────────────────────────────────────────────

/**
 * RICH the moment ≥ 80% of considered fields are filled — deliberately below
 * 1.0 so a complete-enough profile is never told to fill "just one more."
 */
export const RICH_MIN_RATIO = 0.8;
/** PARTIAL once at least ~a third of fields are in; below that is SPARSE. */
export const PARTIAL_MIN_RATIO = 0.34;

function isFiniteNumber(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

/** A nullable numeric field is present when it is a finite, positive value. */
function positiveNumber(v: number | null): boolean {
  return isFiniteNumber(v) && v > 0;
}

// ─── Field descriptors (ProfileIdentity group) ────────────────────────

/**
 * The ProfileIdentity-owned fields, in editor order. Each `present` predicate
 * honors that field's own unset sentinel: `null` for the nullable inputs,
 * `'unspecified'` for biological sex (the engine's explicit "no sex signal"
 * default). `activityLevel` uses a finite check, not `> 0`, because 0
 * (mostly sedentary) is a real, provided answer — not "unset".
 */
export const PROFILE_IDENTITY_FIELDS: readonly ProfileFieldDescriptor[] = [
  { key: 'bodyWeightLbs', present: (p) => positiveNumber(p.bodyWeightLbs) },
  { key: 'heightCm', present: (p) => positiveNumber(p.heightCm) },
  { key: 'birthYear', present: (p) => positiveNumber(p.birthYear) },
  { key: 'biologicalSex', present: (p) => p.biologicalSex !== 'unspecified' },
  { key: 'activityLevel', present: (p) => isFiniteNumber(p.activityLevel) },
  { key: 'trainingLevel', present: (p) => p.trainingLevel !== null },
  { key: 'primaryGoal', present: (p) => p.primaryGoal !== null },
  { key: 'sweatClassification', present: (p) => p.sweatClassification !== null },
  { key: 'goalWeightLbs', present: (p) => positiveNumber(p.goalWeightLbs) },
] as const;

// ─── Resolver ─────────────────────────────────────────────────────────

/**
 * Resolve a profile into a completeness band over the given descriptors
 * (defaults to the ProfileIdentity group). Pure + deterministic. Locked rules:
 *
 *   - no descriptors                 → 'sparse' (ratio 0; nothing to go on)
 *   - ratio ≥ RICH_MIN_RATIO         → 'rich'
 *   - ratio ≥ PARTIAL_MIN_RATIO      → 'partial'
 *   - otherwise                      → 'sparse'
 */
export function assessProfileCompleteness(
  profile: ProfileIdentity,
  descriptors: readonly ProfileFieldDescriptor[] = PROFILE_IDENTITY_FIELDS,
): ProfileCompletenessResult {
  const fields: ProfileFieldStatus[] = descriptors.map((d) => ({
    key: d.key,
    present: d.present(profile) === true,
  }));
  const totalFields = fields.length;
  const filledCount = fields.reduce((n, f) => n + (f.present ? 1 : 0), 0);
  const ratio = totalFields === 0 ? 0 : filledCount / totalFields;

  let level: ProfileCompletenessLevel;
  if (ratio >= RICH_MIN_RATIO) level = 'rich';
  else if (ratio >= PARTIAL_MIN_RATIO) level = 'partial';
  else level = 'sparse';

  return { level, filledCount, totalFields, ratio, fields };
}
