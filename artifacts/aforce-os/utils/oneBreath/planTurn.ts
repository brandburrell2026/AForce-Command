/**
 * Plan turns — pure helpers that turn words into a plan to read back, one
 * missing piece at a time (One Breath Final Build Spec, "The Moment
 * lifecycle", steps 1–3).
 *
 * These reuse the app's existing parsers (`suggestMomentDraft`,
 * `suggestTimeQuestion`, `changedDate`, `changedTime`); nothing here is a
 * second parser. They never guess: a day or time that was not said stays
 * missing and becomes the one question. Plan steps are left empty on purpose:
 * they come from the preparation service when this is wired to a screen, not
 * from here.
 */
import { suggestMomentDraft, suggestTimeQuestion } from '@/services/oneBreathDraft';
import type { PlanDraft } from './session';
import { changedDate, changedTime } from './timeChange';

export interface PlanQuestion {
  need: 'time' | 'day';
  /** The specific question, when there is one ("6:30 in the morning or evening?"). */
  question?: string;
  options?: { label: string; time: string }[];
  /** The words that named the plan, without the goal, kept so a later answer can finish the name. */
  base?: string;
}

export interface PlanStep {
  plan: PlanDraft;
  asking?: PlanQuestion;
}

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-11-21" → "Sat, Nov 21". Built from the parts, so it never shifts with a time zone. */
export function dayLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const at = new Date(y!, m! - 1, d!);
  return `${WEEKDAY[at.getDay()]}, ${MONTH[at.getMonth()]} ${at.getDate()}`;
}

/** "07:00" → "7:00 AM". */
export function timeLabel(time24: string): string {
  const [h, min] = time24.split(':').map(Number);
  return `${h! % 12 === 0 ? 12 : h! % 12}:${String(min).padStart(2, '0')} ${h! < 12 ? 'AM' : 'PM'}`;
}

const withWhen = (plan: PlanDraft, date?: string, time24?: string): PlanDraft => ({
  ...plan,
  date,
  time24,
  day: date ? dayLabel(date) : undefined,
  time: time24 ? timeLabel(time24) : undefined,
});

export const planComplete = (plan: PlanDraft): boolean => !!plan.date && !!plan.time24 && plan.title.trim().length > 0;

/** Stable for one plan, so a repeated "seal it", a double tap or a retry can only save once. */
export const planSealId = (plan: PlanDraft): string => `seal:${plan.date}T${plan.time24}:${plan.title.toLowerCase()}`;

const LEAD_IN = /^(i want to|i wanna|i need to|i'd like to|i would like to|plan (a|an|my)|set up (a|an))\s+/i;
/** Alcohol is handled only inside Social and never becomes part of a plan's name. */
const DRINKS_ASIDE = /[,;]?\s*(and\s+)?(probably\s+|maybe\s+)?(a\s+)?(couple\s+(of\s+)?|few\s+)?drinks?\b.*$/i;
const BARE_ACTIVITY = /^(lift|lifting|workout|training|run|swim|ride|practice|session)$/i;
const WHEN_WORDS =
  /\b(today|tonight|tomorrow|(mon|tues|wednes|thurs|fri|satur|sun)day)\b|\b(at\s+)?\d{1,2}(:\d{2})?\s*(a\.?m\.?|p\.?m\.?)?(?![\d:a-z])|\b(in the )?(morning|afternoon|evening)\b|\b(at|on)\b/gi;

/** A name for a plan whose day or time arrived in a later answer. */
function titleFor(base: string, time24: string | undefined): string {
  const bare = base.replace(WHEN_WORDS, ' ').replace(/\s+/g, ' ').replace(/^[\s,.;:]+|[\s,.;:]+$/g, '');
  if (bare && BARE_ACTIVITY.test(bare) && time24) {
    const hour = Number(time24.slice(0, 2));
    return `${hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening'} ${bare.toLowerCase()}`;
  }
  const name = bare || base.trim();
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function nextQuestion(plan: PlanDraft, base: string): PlanQuestion | undefined {
  if (!plan.time24) {
    const q = suggestTimeQuestion(base);
    return q ? { need: 'time', question: q.question, options: [...q.options] } : { need: 'time' };
  }
  return plan.date ? undefined : { need: 'day' };
}

export function planFromWords(words: string, now: Date, opts: { social: boolean; timingOnly?: boolean }): PlanStep {
  // Timing only: the sentence that names the plan, never the health detail after it.
  const said = opts.timingOnly ? (words.split(/(?<=[.!?])\s+/)[0] ?? words) : words;
  const cleaned = said.replace(/[.!?]+$/, '').replace(DRINKS_ASIDE, '').replace(LEAD_IN, '').trim();
  const draft = suggestMomentDraft(cleaned, now);
  const whole = !!draft.date && !!draft.time;
  // Until the schedule is whole the draft's title is the words without the goal.
  const base = whole ? cleaned : draft.title;
  const plan = withWhen(
    {
      title: whole ? draft.title : titleFor(base, draft.time || undefined),
      type: opts.social ? 'social' : draft.type,
      goal: draft.prepGoal || undefined,
      steps: [],
      heard: [said],
    },
    draft.date || undefined,
    draft.time || undefined,
  );
  const asking = nextQuestion(plan, base);
  return asking ? { plan, asking: { ...asking, base } } : { plan };
}


function answeredTime(words: string, asking: PlanQuestion): string | null {
  const t = words.toLowerCase().trim();
  const picked = asking.options?.find((o) => o.label.toLowerCase() === t);
  if (picked) return picked.time;
  if (asking.options?.length === 2) {
    if (/^(a\.?m\.?|morning|in the morning)$/.test(t)) return asking.options[0]!.time;
    if (/^(p\.?m\.?|evening|in the evening|night|at night)$/.test(t)) return asking.options[1]!.time;
  }
  const m = /\b(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*(a\.?m\.?|p\.?m\.?|in the (morning|afternoon|evening)|at night)/.exec(t);
  if (!m) return null;
  const pm = /^p|afternoon|evening|night/.test(m[3]!);
  const hour = (Number(m[1]) % 12) + (pm ? 12 : 0);
  return `${String(hour).padStart(2, '0')}:${m[2] ?? '00'}`;
}

/** Fills the one missing piece from an answer, or returns null when the words were not an answer. */
export function answerPlanQuestion(plan: PlanDraft, asking: PlanQuestion, words: string, now: Date): PlanStep | null {
  const base = asking.base ?? '';
  let date = plan.date;
  let time24 = plan.time24;
  if (asking.need === 'time') {
    const time = answeredTime(words, asking);
    if (!time) return null;
    time24 = time;
    date = date ?? changedDate(words, now) ?? undefined;
  } else {
    const day = changedDate(words, now);
    if (!day) return null;
    date = day;
  }
  const next = withWhen({ ...plan, title: titleFor(base, time24), heard: [...plan.heard, words] }, date, time24);
  const more = nextQuestion(next, base);
  return more ? { plan: next, asking: { ...more, base } } : { plan: next };
}

/** "No, Saturday" or "Can I go at 7 instead?" on a complete plan. Null when no new day or time was named. */
export function changePlan(plan: PlanDraft, words: string, now: Date): PlanDraft | null {
  if (!plan.date || !plan.time24) return null;
  const date = changedDate(words, now);
  const time = changedTime(plan.time24, words.replace(/\b(mon|tues|wednes|thurs|fri|satur|sun)day\b/gi, ' '));
  if (!date && !time) return null;
  return withWhen({ ...plan, heard: [...plan.heard, words] }, date ?? plan.date, time ?? plan.time24);
}
