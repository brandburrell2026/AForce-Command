/**
 * Home (cinematic) — the words on the screen, as pure functions.
 *
 * Reference: App Spec v1.8.2, Part 2 · Home ("Home (cinematic, Nov 6)") and
 * Appendix G §3 · Home, with the layout taken from the "Every tab, one system."
 * prototype. Every value here comes from the member's real data. Nothing is
 * taken from the prototype's sample data.
 */
import type { Moment } from '@/types/moments';

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Wed · Nov 4" — the small date line above the greeting. */
export function homeDateLine(now: Date): string {
  return `${WEEKDAY_SHORT[now.getDay()]} · ${MONTH_SHORT[now.getMonth()]} ${now.getDate()}`;
}

/** "Good morning" before noon, "Good afternoon" until 5 PM, then "Good evening". */
export function homeGreetingWord(now: Date): 'Good morning' | 'Good afternoon' | 'Good evening' {
  const h = now.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/** "Good evening, Brandon." — or "Good evening." when the name is unknown. */
export function homeGreeting(now: Date, firstName?: string | null): string {
  const name = (firstName ?? '').trim();
  return name ? `${homeGreetingWord(now)}, ${name}.` : `${homeGreetingWord(now)}.`;
}

/** "10:00 AM" in the member's own time zone. */
export function homeClock(d: Date): string {
  const h = d.getHours();
  const m = d.getMinutes();
  return `${h % 12 === 0 ? 12 : h % 12}:${m < 10 ? `0${m}` : m} ${h < 12 ? 'AM' : 'PM'}`;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** "Today · 6:30 PM", "Tomorrow · 10:00 AM", "Thursday · 10:00 AM", "Nov 21 · 9:00 AM". */
export function homeMomentWhen(startAtIso: string, now: Date): string {
  const start = new Date(startAtIso);
  if (Number.isNaN(start.getTime())) return '';
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime() - dayStart.getTime()) / 86400000);
  const day = sameDay(start, now)
    ? 'Today'
    : sameDay(start, tomorrow)
      ? 'Tomorrow'
      : days > 1 && days < 7
        ? WEEKDAY_LONG[start.getDay()]
        : `${MONTH_SHORT[start.getMonth()]} ${start.getDate()}`;
  return `${day} · ${homeClock(start)}`;
}

/** A Moment is sealed once the member has sealed its plan and not cancelled it. */
export function isMomentSealed(moment: Pick<Moment, 'preparation'>): boolean {
  const p = moment.preparation;
  return Boolean(p && p.sealedAtIso && !p.cancelledAtIso);
}

export interface HomeMomentHeroModel {
  eyebrow: string;
  title: string;
  status: string;
  /** Where a tap goes. */
  target: 'moments' | 'one-breath';
}

/** Copy for the first-run / nothing-planned hero (spec Part 2 · Home). */
export const HOME_EMPTY_HERO: HomeMomentHeroModel = {
  eyebrow: 'Welcome to AFORCE',
  title: 'Ready when you are.',
  status: 'Your first plan takes one breath.',
  target: 'one-breath',
};

export function homeMomentHero(
  moment: Moment | null | undefined,
  now: Date,
  privateLabel: string,
): HomeMomentHeroModel {
  if (!moment) return HOME_EMPTY_HERO;
  const sealed = isMomentSealed(moment);
  return {
    eyebrow: homeMomentWhen(moment.startAtIso, now),
    title: moment.masked ? privateLabel : moment.title,
    status: sealed ? 'Sealed' : 'Not prepared yet · tap to plan it',
    target: 'moments',
  };
}

export interface HomeStatusLine {
  left: string;
  right: string;
}

/**
 * The one status line at the top of the next-move panel. Hidden when there is
 * nothing planned (the prototype hides it for a new member).
 */
export function homeStatusLine(
  upcoming: readonly Pick<Moment, 'preparation' | 'startAtIso'>[],
  next: Pick<Moment, 'preparation' | 'startAtIso'> | null | undefined,
): HomeStatusLine | null {
  if (!next) return null;
  const toPlan = upcoming.filter((m) => !isMomentSealed(m)).length;
  if (isMomentSealed(next)) {
    return { left: 'Plan sealed', right: `Next · ${homeClock(new Date(next.startAtIso))}` };
  }
  return { left: `${toPlan || 1} ${(toPlan || 1) === 1 ? 'Moment' : 'Moments'} to plan`, right: 'Not sealed' };
}

/** "42 of 96 oz · updated 6:12 PM". The time is dropped when nothing is logged. */
export function homeIntakeNote(consumedOz: number, targetOz: number, lastLoggedAt: Date | null): string {
  const consumed = Number.isFinite(consumedOz) ? Math.max(0, Math.round(consumedOz)) : 0;
  const base = `${consumed} of ${targetOz} oz`;
  return lastLoggedAt && !Number.isNaN(lastLoggedAt.getTime()) ? `${base} · updated ${homeClock(lastLoggedAt)}` : base;
}

export type HomeEvidence = 'pending' | 'building' | 'ready';

export interface HomeRingModel {
  /** 0–1 arc. */
  progress: number;
  /** Centre text: the number, or an em dash while collecting. */
  value: string;
  /** Small label under it. */
  label: 'HydroState' | 'Collecting';
}

/**
 * The ring shows the member's HydroState (0–100) from the scoring engine. With
 * limited evidence it shows "Collecting" and no number — never a red 0
 * (Appendix G §3 · Home). The score itself is not computed or changed here.
 */
export function homeRing(evidence: HomeEvidence, score: number): HomeRingModel {
  if (evidence !== 'ready' || !Number.isFinite(score)) {
    return { progress: 0, value: '—', label: 'Collecting' };
  }
  const s = Math.max(0, Math.min(100, Math.round(score)));
  return { progress: s / 100, value: String(s), label: 'HydroState' };
}
