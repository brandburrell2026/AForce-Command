import type { MomentDraft } from './momentDraft';

/** Stated goals the member can name (spec v1.8.2 Part 8.2). A goal is never a
 * workout type: "want my legs fresh" does not make a lift lower-body. */
const GOALS: ReadonlyArray<{ pattern: RegExp; goal: string }> = [
  { pattern: /[,;]?\s*(?:and\s+)?(?:i\s+)?(?:want|need|wanna)\s+(?:my\s+)?legs\s+(?:to\s+(?:be|feel)\s+)?fresh\b/i, goal: 'Legs fresh' },
  { pattern: /[,;]?\s*(?:and\s+)?(?:i\s+)?(?:want|need|wanna)\s+fresh\s+legs\b/i, goal: 'Legs fresh' },
  { pattern: /[,;]?\s*(?:and\s+|to\s+)?(?:i\s+)?(?:want\s+to\s+|wanna\s+)?build\s+strength\b/i, goal: 'Build strength' },
];

/** A bare activity name gets its part of day: "Lift" at 6:30 AM → "Morning lift". */
const BARE_ACTIVITY = /^(lift|lifting|workout|training|run|swim|ride|practice|session)$/i;

/** Conservative, local suggestions. Missing/ambiguous fields stay empty for review. */
export function suggestMomentDraft(input: string, now = new Date()): MomentDraft {
  let prepGoal = '';
  let text = input;
  for (const { pattern, goal } of GOALS) {
    if (prepGoal) break;
    const match = pattern.exec(text);
    if (match) {
      prepGoal = goal;
      text = (text.slice(0, match.index) + text.slice(match.index + match[0].length)).replace(/\s+/g, ' ').trim();
    }
  }
  const draft: MomentDraft = { title: text.trim().slice(0, 160), date: '', time: '', type: 'personal', prepGoal };
  const normalized = text.toLowerCase();
  const dates: string[] = [];
  const dateSpans: Array<{ start: number; length: number }> = [];
  const format = (at: Date) => `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`;
  const relative = [...normalized.matchAll(/\b(today|tomorrow|day after tomorrow)\b/g)];
  for (const match of relative) {
    dateSpans.push({ start: match.index!, length: match[0].length });
    const at = new Date(now); at.setDate(at.getDate() + (match[1] === 'today' ? 0 : match[1] === 'tomorrow' ? 1 : 2)); dates.push(format(at));
  }
  for (const match of normalized.matchAll(/\b(20\d{2}-\d{2}-\d{2})\b/g)) { dates.push(match[1]!); dateSpans.push({ start: match.index!, length: match[0].length }); }
  const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  for (const match of normalized.matchAll(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/g)) {
    dateSpans.push({ start: match.index!, length: match[0].length });
    const offset = (weekdays.indexOf(match[1]!) - now.getDay() + 7) % 7;
    // Same-day and "next Friday" conventions vary: ask for an explicit date.
    if (offset === 0 || /\bnext\s+$/.test(normalized.slice(0, match.index))) dates.push('');
    else { const at = new Date(now); at.setDate(at.getDate() + offset); dates.push(format(at)); }
  }
  if (dates.length === 1) draft.date = dates[0]!;
  const times = [...normalized.matchAll(/\b(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*(a\.?m\.?|p\.?m\.?)(?![a-z])/g)];
  if (times.length === 1) {
    const t = times[0]!; const hour = Number(t[1]) % 12 + (t[3]!.startsWith('p') ? 12 : 0);
    draft.time = `${String(hour).padStart(2, '0')}:${t[2] ?? '00'}`;
  }
  // Foreign zones and travel need explicit timezone-aware entry; never reinterpret them as device time.
  if (/\b(utc|gmt|est|edt|cst|cdt|mst|mdt|pst|pdt|time zone|timezone|eastern|central|mountain|pacific|flight|airport|not|maybe|instead|or)\b/i.test(text)) { draft.date = ''; draft.time = ''; }
  // Only remove schedule words when the schedule is unambiguous and visible
  // in separate review fields. Preserve the utterance for every uncertain case.
  if (draft.date && draft.time && dateSpans.length === 1 && times.length === 1) {
    const date = dateSpans[0]!; const time = times[0]!;
    const spans = [date, { start: time.index!, length: time[0].length }];
    const hour = Number(draft.time.slice(0, 2));
    const period = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : '(?:evening|night)';
    let title = text;
    for (const span of spans.sort((a, b) => b.start - a.start)) {
      // Remove a scheduling preposition only when it directly precedes this span.
      const before = title.slice(0, span.start).replace(/\b(?:at|on)\s*$/i, '');
      let after = title.slice(span.start + span.length);
      after = after.replace(new RegExp(`^\\s+(?:in the |in |this )?${period}\\b`, 'i'), '');
      title = `${before} ${after}`;
    }
    title = title.replace(/\s+/g, ' ').replace(/\s+([,.;!?])/g, '$1').replace(/^[\s,.;:]+|[\s,.;:]+$/g, '');
    // Schedule-only input still needs a meaningful name; never produce a blank.
    if (title) draft.title = title.slice(0, 160);
    if (BARE_ACTIVITY.test(draft.title)) {
      const part = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';
      draft.title = `${part} ${draft.title.toLowerCase()}`;
    }
  }
  return draft;
}

export interface TimeQuestion {
  /** "6:30 in the morning or evening?" */
  question: string;
  options: ReadonlyArray<{ label: string; time: string }>;
}

/**
 * One clarification for a bare clock time ("Lift at 6:30"), spec v1.8.2
 * Part 7.2 / CB3. Returns null when AM/PM was said, when there is no single
 * bare time, or when the wording is otherwise uncertain (the draft keeps those
 * fields empty for explicit review).
 */
export function suggestTimeQuestion(input: string): TimeQuestion | null {
  const normalized = input.toLowerCase();
  if (/\b(a\.?m\.?|p\.?m\.?)(?![a-z])/.test(normalized)) return null;
  if (/\b(utc|gmt|est|edt|cst|cdt|mst|mdt|pst|pdt|time zone|timezone|flight|airport|not|maybe|instead|or)\b/.test(normalized)) return null;
  const bare = [...normalized.matchAll(/\b(1[0-2]|0?[1-9]):([0-5]\d)\b|\bat\s+(1[0-2]|0?[1-9])\b(?![:\d])/g)];
  if (bare.length !== 1) return null;
  const m = bare[0]!;
  const hour = Number(m[1] ?? m[3]);
  const minute = m[2] ?? '00';
  const pad = (n: number) => String(n).padStart(2, '0');
  const shown = `${hour}:${minute}`;
  return {
    question: `${shown} in the morning or evening?`,
    options: [
      { label: `${shown} AM`, time: `${pad(hour % 12)}:${minute}` },
      { label: `${shown} PM`, time: `${pad((hour % 12) + 12)}:${minute}` },
    ],
  };
}
