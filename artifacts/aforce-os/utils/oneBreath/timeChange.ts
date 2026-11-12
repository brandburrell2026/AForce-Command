/**
 * "Make it 7" → a new draft time (Complete App Spec v1.8.2, Part 6.1.5).
 *
 * Pure and deterministic. Takes the draft's current 24-hour "HH:mm" and the
 * member's words, and returns the new "HH:mm", or null when the words don't
 * name one unambiguous time. Never guesses: a bare "12" with no AM/PM, or a
 * line with no time at all, returns null and the caller asks instead.
 *
 * Without AM/PM, the new time keeps the current half of the day: a 6:30 AM
 * lift moved with "make it 7" becomes 7:00 AM; a 6:30 PM dinner becomes 7:00 PM.
 */
const TIME_TOKEN =
  /\b(noon|midnight)\b|\b(\d{1,2})(?::(\d{2}))?\s*(a\.?\s?m\.?|p\.?\s?m\.?)?(?![\d:])/g;

const pad = (n: number) => String(n).padStart(2, '0');

export function changedTime(currentHHmm: string, text: string): string | null {
  const current = /^(\d{2}):(\d{2})$/.exec(currentHHmm);
  if (!current) return null;
  const currentHour = Number(current[1]);
  const lower = text.toLowerCase();

  // The last time named wins: "move it from 6:30 to 7" → 7.
  let last: RegExpExecArray | null = null;
  for (const m of lower.matchAll(TIME_TOKEN)) last = m;
  if (!last) return null;

  if (last[1] === 'noon') return '12:00';
  if (last[1] === 'midnight') return '00:00';

  let hour = Number(last[2]);
  const minute = last[3] === undefined ? 0 : Number(last[3]);
  const period = last[4]?.replace(/[.\s]/g, '');
  if (!Number.isInteger(hour) || minute > 59) return null;

  if (period === 'am' || period === 'pm') {
    if (hour < 1 || hour > 12) return null;
    hour = (hour % 12) + (period === 'pm' ? 12 : 0);
  } else if (hour >= 13 && hour <= 23) {
    // Already 24-hour.
  } else if (hour >= 1 && hour <= 11) {
    if (currentHour >= 12) hour += 12;
  } else {
    // 0, 12 or out of range without AM/PM: ask instead of guessing.
    return null;
  }
  return `${pad(hour)}:${pad(minute)}`;
}
