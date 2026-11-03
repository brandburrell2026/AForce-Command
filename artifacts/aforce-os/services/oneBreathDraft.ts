import type { MomentDraft } from './momentDraft';

/** Conservative, local suggestions. Missing/ambiguous fields stay empty for review. */
export function suggestMomentDraft(text: string, now = new Date()): MomentDraft {
  const draft: MomentDraft = { title: text.trim().slice(0, 160), date: '', time: '', type: 'personal', prepGoal: '' };
  const normalized = text.toLowerCase();
  const dates: string[] = [];
  const format = (at: Date) => `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`;
  const relative = [...normalized.matchAll(/\b(today|tomorrow|day after tomorrow)\b/g)];
  for (const match of relative) {
    const at = new Date(now); at.setDate(at.getDate() + (match[1] === 'today' ? 0 : match[1] === 'tomorrow' ? 1 : 2)); dates.push(format(at));
  }
  for (const match of normalized.matchAll(/\b(20\d{2}-\d{2}-\d{2})\b/g)) dates.push(match[1]!);
  const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  for (const match of normalized.matchAll(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/g)) {
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
  if (/\b(utc|gmt|est|edt|cst|cdt|mst|mdt|pst|pdt|time zone|timezone|eastern|central|mountain|pacific|flight|airport)\b/i.test(text)) { draft.date = ''; draft.time = ''; }
  return draft;
}
