/**
 * Section 63 — Streak copy, single testable source of truth.
 *
 * Compliance rule (spec §63, and the never-threaten-loss scope Brandon set):
 * a streak display NEVER threatens loss of a streak if a day is missed, and
 * NEVER uses do-not-break-the-chain framing. A missed day starts a NEW CYCLE,
 * framed neutrally — never "you lost N days," never "keep it or lose it."
 * Progress carries forward; the language is additive.
 *
 * Every user-facing streak string that lives in a React Native component
 * (AthleteModeCard, StreakHero) is built here instead of inline, so the
 * `utils/__tests__/streakCopy.test.ts` language guard can assert the rule
 * over the real rendered strings without importing the RN tree. i18n-owned
 * streak strings (locales/en.json) are guarded by the same test directly.
 *
 * Note: the milestone "days remaining" line is aspiration, not a threat, and
 * is kept verbatim by decision. The decay mechanic that would stop the bar
 * from emptying on a single miss is a backend/streak-owner change (the app
 * receives `complianceStreak` already zeroed on a miss and cannot reconstruct
 * carried-forward days from it) — tracked as a §63 follow-up, not built here.
 */

/** Athlete Mode milestone sub-line. Zero (post-miss) reads as a fresh cycle. */
export function athleteModeSub(streakDays: number, milestoneDays: number): string {
  const n = Math.max(0, Math.floor(streakDays) || 0);
  return n > 0
    ? `${n}-day streak · target ${milestoneDays}`
    : `New cycle · target ${milestoneDays}`;
}

/** Milestone progress line — aspiration ("days remaining"), never loss. */
export function athleteModeRemaining(view: { achievedTop: boolean; daysRemaining: number }): string {
  if (view.achievedTop) return 'Top milestone reached';
  const d = Math.max(0, Math.floor(view.daysRemaining) || 0);
  return `${d} ${d === 1 ? 'day' : 'days'} remaining`;
}

/** Journal StreakHero headline. */
export function streakHeroHeadline(streakDays: number): string {
  const n = Math.max(0, Math.floor(streakDays) || 0);
  return n > 0 ? `${n}-day momentum` : 'Begin your first cycle';
}

/** Journal StreakHero sub. Active state carries forward; empty state is a plain start. */
export function streakHeroSub(streakDays: number): string {
  const n = Math.max(0, Math.floor(streakDays) || 0);
  return n > 0
    ? 'Recovery rhythm holding. Carried forward from yesterday.'
    : 'Log an intake to begin.';
}
