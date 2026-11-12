/**
 * What kind of workout the member named, from explicit words only
 * (Complete App Spec v1.8.2, Parts 8.2 and 8.3; Appendix A §5.2).
 *
 * A goal is never a workout type: "want my legs fresh" is a goal and does not
 * make a lift lower-body. Only explicit cues ("leg day", "lower body",
 * "squats", "deadlifts") do.
 *
 * No exercise playbook has been expert-reviewed yet (register #3, #48), so the
 * plan never suggests exercises. It shows one honest row instead.
 */
export type WorkoutFocus = 'upper_body' | 'lower_body' | 'full_body' | 'unspecified';

const WORKOUT =
  /\b(lift|lifting|workout|work out|training session|strength session|gym|leg day|squats?|deadlifts?|upper[- ]body|lower[- ]body|full[- ]body|bench press|chest day|arm day|back day)\b/;
const LOWER = /\b(leg day|lower[- ]body|squats?|deadlifts?)\b/;
const UPPER = /\b(upper[- ]body|chest day|arm day|back day|bench press)\b/;
const FULL = /\bfull[- ]body\b/;

/** The workout focus the member named, or null when this isn't a workout. */
export function workoutFocus(text: string): WorkoutFocus | null {
  const t = text.toLowerCase();
  if (!WORKOUT.test(t)) return null;
  const lower = LOWER.test(t);
  const upper = UPPER.test(t);
  if (FULL.test(t) || (lower && upper)) return 'full_body';
  if (lower) return 'lower_body';
  if (upper) return 'upper_body';
  return 'unspecified';
}

const PLAYBOOK: Record<WorkoutFocus, string> = {
  upper_body: 'upper-body',
  lower_body: 'lower-body',
  full_body: 'full-body',
  unspecified: 'workout',
};

/** "Not offered yet · the upper-body playbook isn't reviewed yet, so I won't suggest any." */
export const exerciseRow = (focus: WorkoutFocus) =>
  `Not offered yet · the ${PLAYBOOK[focus]} playbook isn’t reviewed yet, so I won’t suggest any.`;
