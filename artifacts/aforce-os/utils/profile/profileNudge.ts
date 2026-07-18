/**
 * SECTION 55 · STEP 3 — PROFILE COMPLETENESS NUDGE (guardrail — do not weaken)
 * Ruling: Performance Scientist, 2026-07-17. Basis: docs/science/section-55-profile-nudge.md
 *
 * This surface EXPLAINS a software capability ("more profile → more specific
 * recommendations"). It is not a behavioral lever, a health message, or a
 * completion checklist. It exists under honest-mechanics rules; the following
 * are LOCKED and may not be relaxed without a new Performance Science ruling
 * (escalate via Brandon):
 *
 *  1. CLAIM: capability only. Never imply a health, hydration, recovery, or
 *     performance OUTCOME. Approved copy is a fixed constant; it is gated by
 *     isCompliantCoachLine() (§64 observation-only guard) in the test suite.
 *  2. NO PRESSURE: never a percentage, progress ring, "X of N", or 100% target.
 *     RICH is 80% by design; "never require every field" (§55). This is a
 *     sentence, not a meter. (Surface-level rule for the consuming component.)
 *  3. FIELD NAMING: may name ONLY behavioral/preference fields from
 *     NAMEABLE_FIELD_KEYS. NEVER name or pressure body measurements
 *     (weight, goal weight, height), biological sex, age/birth year, or sweat
 *     classification. Body/bio fields are structurally unreachable here.
 *  4. CADENCE = "occasionally": sparse/partial only (never rich); >=14d apart;
 *     30d cooldown after a dismiss; stop forever after 2 dismissals, 4 lifetime
 *     shows, or reaching rich; 7-day / 3-session grace before the first show.
 *  5. NEVER couple to a low reading, a score, a reward, a streak, or urgency.
 *     If a change here works by exploiting anxiety or gamification, it is a
 *     dark pattern and must be rejected in review.
 *
 * Pure selector: no Date.now(), no I/O — all timing state is passed in as
 * caller-derived scalars. Score-Protection: touches no score, band, or color.
 */

import type {
  ProfileCompletenessLevel,
  ProfileCompletenessResult,
} from './profileCompleteness';

// ─── Locked cadence constants ─────────────────────────────────────────
/** "Occasionally" = at most once per two weeks. */
export const NUDGE_MIN_INTERVAL_DAYS = 14;
/** A dismiss earns a longer silence than the normal interval. */
export const NUDGE_DISMISS_COOLDOWN_DAYS = 30;
/** Two dismissals is a clear "no" — honor it forever. */
export const NUDGE_MAX_DISMISSALS = 2;
/** Lifetime ceiling so it can never become wallpaper even if never dismissed. */
export const NUDGE_MAX_LIFETIME_SHOWS = 4;
/** Grace period — a brand-new profile is supposed to be sparse ("over time"). */
export const NUDGE_MIN_ACCOUNT_AGE_DAYS = 7;
export const NUDGE_MIN_SESSIONS = 3;

// ─── Approved copy (capability claim only — see guardrail #1) ──────────
/** Primary line — spec §55, approved verbatim. */
export const PROFILE_NUDGE_GENERIC =
  'Completing your profile helps AForce OS generate more personalized recommendations.';
/** Equivalent rotation variant (same claim-grade) to avoid becoming wallpaper. */
export const PROFILE_NUDGE_GENERIC_ALT =
  'The more of your profile AForce OS has, the more specific its recommendations can be.';

/**
 * Fields the nudge MAY name — behavioral / preference / performance settings
 * only. A body measurement, protected characteristic, or age/identity field is
 * NEVER here, so it is structurally unreachable by the named-line builder
 * (guardrail #3). Order is the naming priority.
 */
const NAMEABLE_FIELDS: readonly { key: string; label: string }[] = [
  { key: 'trainingLevel', label: 'training level' },
  { key: 'primaryGoal', label: 'primary goal' },
  { key: 'activityLevel', label: 'activity level' },
] as const;

/** The allowlist, as a set — the one source of truth for "may this be named?". */
export const NAMEABLE_FIELD_KEYS: ReadonlySet<string> = new Set(
  NAMEABLE_FIELDS.map((f) => f.key),
);

/** Named-field copy — only ever built from an allowlisted field. */
function namedFieldLine(label: string): string {
  return `Adding your ${label} helps AForce OS tailor its recommendations.`;
}

// ─── Cadence selector (pure predicate over caller-derived scalars) ─────

export interface ProfileNudgeSignals {
  completenessLevel: ProfileCompletenessLevel;
  /** Days since the account/profile first existed. */
  accountAgeDays: number;
  /** Number of app sessions so far. */
  sessionCount: number;
  /** Lifetime times this nudge has been shown. */
  shownCount: number;
  /** Lifetime times the user has dismissed it. */
  dismissCount: number;
  /** Days since last shown; null = never shown. */
  daysSinceLastShown: number | null;
  /** Days since last dismissed; null = never dismissed. */
  daysSinceLastDismissed: number | null;
}

function nonFinite(n: number): boolean {
  return typeof n !== 'number' || !Number.isFinite(n);
}

/**
 * Whether the profile nudge may show now. Rules evaluated top-to-bottom, first
 * match wins (see guardrail #4). Fails CLOSED (never shows) on non-finite input
 * — a bad-data read must never produce a nag.
 */
export function shouldShowProfileNudge(s: ProfileNudgeSignals): boolean {
  // fail closed on malformed counters
  if (nonFinite(s.accountAgeDays) || nonFinite(s.sessionCount) ||
      nonFinite(s.shownCount) || nonFinite(s.dismissCount)) {
    return false;
  }
  // 1. rich → personalization already strong; nudging is pure nagging.
  if (s.completenessLevel === 'rich') return false;
  // 2. two dismissals is a clear "no", forever.
  if (s.dismissCount >= NUDGE_MAX_DISMISSALS) return false;
  // 3. lifetime show ceiling.
  if (s.shownCount >= NUDGE_MAX_LIFETIME_SHOWS) return false;
  // 4. grace period for a new profile ("over time").
  if (s.accountAgeDays < NUDGE_MIN_ACCOUNT_AGE_DAYS || s.sessionCount < NUDGE_MIN_SESSIONS) {
    return false;
  }
  // 5. post-dismiss cooldown (longer than the normal interval).
  if (s.daysSinceLastDismissed !== null &&
      (nonFinite(s.daysSinceLastDismissed) || s.daysSinceLastDismissed < NUDGE_DISMISS_COOLDOWN_DAYS)) {
    return false;
  }
  // 6. frequency ceiling since last shown.
  if (s.daysSinceLastShown !== null &&
      (nonFinite(s.daysSinceLastShown) || s.daysSinceLastShown < NUDGE_MIN_INTERVAL_DAYS)) {
    return false;
  }
  // 7. otherwise, occasionally.
  return true;
}

/**
 * The line to show. If a completeness result is provided and a NAMEABLE field
 * is missing, name it (helpful, never a checklist); otherwise the generic line.
 * Only allowlisted fields can ever be named — a body/bio/age field cannot reach
 * this string.
 */
export function profileNudgeLine(completeness?: ProfileCompletenessResult): string {
  if (completeness) {
    for (const { key, label } of NAMEABLE_FIELDS) {
      const field = completeness.fields.find((f) => f.key === key);
      if (field && field.present === false) return namedFieldLine(label);
    }
  }
  return PROFILE_NUDGE_GENERIC;
}

export interface ProfileNudge {
  show: boolean;
  /** The message when showing; null when not. */
  message: string | null;
}

/** Cadence + copy in one call: whether to show, and what to say. */
export function selectProfileNudge(
  signals: ProfileNudgeSignals,
  completeness?: ProfileCompletenessResult,
): ProfileNudge {
  const show = shouldShowProfileNudge(signals);
  return { show, message: show ? profileNudgeLine(completeness) : null };
}
