/**
 * Coach phrasing adapter (E4) — PRESENTATION/DELIVERY ONLY.
 *
 * Re-voices an *already-selected* command line in a coach's tone. It runs AFTER
 * the protected engine has chosen the command, the dose, the timing, the
 * urgency and the evidence (`utils/scoring/*`) — it only rephrases the display
 * string. It can NEVER change the command's substance:
 *   • it only PREPENDS a short tone lead / swaps the eyebrow label;
 *   • it proves every numeric/dose/timing token survives (`preservesCommandSubstance`);
 *   • it runs the result through the §64 observation-only guard
 *     (`isCompliantCoachLine`);
 *   • on ANY failure it fail-safes to the original string, unchanged.
 * Identical command + evidence for every coach; only tone differs. Pure + RN-free.
 */
import type { CoachArchetype } from '@/services/voiceCatalog';
import { isCompliantCoachLine } from '@/utils/intelligence/conversationalLanguage';

/** Coach-specific eyebrow that replaces the generic "Your next move". */
export function coachEyebrow(archetype: CoachArchetype): string {
  switch (archetype) {
    case 'push':
      return 'Water first';
    case 'precision':
      return 'The move';
    case 'ignite':
      return 'Go time';
    case 'recovery':
      return 'Ease in';
    default:
      return 'Your next move';
  }
}

/** Short, compliant tone lead per coach — the delivery flavor, no substance. */
export function coachLead(archetype: CoachArchetype): string {
  switch (archetype) {
    case 'push':
      return 'Lock in.';
    case 'precision':
      return 'Execute cleanly.';
    case 'ignite':
      return "Let's go.";
    case 'recovery':
      return 'Slow and steady.';
    default:
      return '';
  }
}

/** Numeric/dose/timing tokens ("12oz", "15min", "2", "50%") normalized for comparison. */
function substanceTokens(text: string): string[] {
  const m = text.match(/\d+(?:\.\d+)?\s?(?:oz|ml|min(?:utes?)?|hours?|hrs?|%)?/gi) ?? [];
  return m.map((s) => s.replace(/\s+/g, '').toLowerCase());
}

/** True when every numeric/dose token in `orig` still appears in `out`. */
export function preservesCommandSubstance(orig: string, out: string): boolean {
  const outTokens = substanceTokens(out);
  return substanceTokens(orig).every((tok) => outTokens.includes(tok));
}

/**
 * Re-voice a command/instruction line in the coach's tone. Fail-safe: returns the
 * original text unchanged if the re-voiced line would drop any dose/timing token
 * or introduce non-compliant (§64) language.
 */
export function formatCommandForCoach(text: string, archetype: CoachArchetype): string {
  if (!text || !text.trim()) return text;
  const lead = coachLead(archetype);
  if (!lead) return text;
  const candidate = `${lead} ${text.trim()}`;
  if (!preservesCommandSubstance(text, candidate)) return text;
  if (!isCompliantCoachLine(candidate)) return text;
  return candidate;
}
