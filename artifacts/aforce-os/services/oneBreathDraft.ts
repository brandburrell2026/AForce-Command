import type { MomentDraft } from './momentDraft';

/** Conservative, local suggestions. Missing/ambiguous fields stay empty for review. */
export function suggestMomentDraft(text: string, now = new Date()): MomentDraft {
  const draft: MomentDraft = { title: text.trim().slice(0, 160), date: '', time: '', type: 'personal', prepGoal: '' };
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
  }
  return draft;
}
