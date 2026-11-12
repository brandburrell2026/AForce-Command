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

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const ymd = (at: Date) =>
  `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;

/**
 * "No, Saturday" → a new draft date "YYYY-MM-DD" (spec v1.8.2 CB4), using the
 * same conventions as the One Breath parser: today, tomorrow, or a weekday
 * within the coming week. A weekday that is today, "next Saturday", or two
 * different days return null so the member is asked instead.
 */
export function changedDate(text: string, now = new Date()): string | null {
  const lower = text.toLowerCase();
  const found: string[] = [];
  for (const m of lower.matchAll(/\b(today|tonight|tomorrow)\b/g)) {
    const at = new Date(now);
    if (m[1] === 'tomorrow') at.setDate(at.getDate() + 1);
    found.push(ymd(at));
  }
  for (const m of lower.matchAll(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/g)) {
    const offset = (WEEKDAYS.indexOf(m[1]!) - now.getDay() + 7) % 7;
    if (offset === 0 || /\bnext\s+$/.test(lower.slice(0, m.index))) return null;
    const at = new Date(now);
    at.setDate(at.getDate() + offset);
    found.push(ymd(at));
  }
  return new Set(found).size === 1 ? found[0]! : null;
}
