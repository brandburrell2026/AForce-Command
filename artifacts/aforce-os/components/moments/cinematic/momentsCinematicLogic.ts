/**
 * Moments tab (cinematic) — the words on the screen, as pure functions.
 *
 * Reference: the approved prototype's Moments tab — a hero for the next (or
 * live) Moment, the status line, "Plan a Moment · say it", then Upcoming and
 * Done as hairline rows. Real Moments only; nothing from the sample data.
 */
import type { Moment } from '@/types/moments';
import { homeClock, isMomentSealed } from '@/components/home/cinematic/homeCinematicLogic';

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** "Today · 7:30 PM", "Tomorrow · 10:00 AM", "Sat · 3:00 PM", "Dec 4 · 9:00 AM". */
export function momentWhenShort(startAtIso: string, now: Date): string {
  const start = new Date(startAtIso);
  if (Number.isNaN(start.getTime())) return '';
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round(
    (new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime() - dayStart.getTime()) / 86400000,
  );
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const day = sameDay(start, now)
    ? 'Today'
    : sameDay(start, tomorrow)
      ? 'Tomorrow'
      : days > -7 && days < 7
        ? WEEKDAY_SHORT[start.getDay()]
        : `${MONTH_SHORT[start.getMonth()]} ${start.getDate()}`;
  return `${day} · ${homeClock(start)}`;
}

/** A Moment is done once the member has returned from it or cancelled it. */
export function isMomentDone(moment: Pick<Moment, 'preparation'>): boolean {
  const p = moment.preparation;
  return Boolean(p && (p.returnedAtIso || p.cancelledAtIso));
}

/** A sealed Moment whose start has passed and that is not yet done is live. */
export function isMomentLive(moment: Pick<Moment, 'preparation' | 'startAtIso'>, now: Date): boolean {
  return isMomentSealed(moment) && !isMomentDone(moment) && Date.parse(moment.startAtIso) <= now.getTime();
}

export interface MomentRowModel {
  id: string;
  title: string;
  sub: string;
  pill: 'Sealed' | 'Plan' | 'Done' | null;
}

export interface MomentsModel {
  hero: { eyebrow: string; title: string; sub: string } | null;
  upcoming: MomentRowModel[];
  done: MomentRowModel[];
}

export const MOMENTS_EMPTY_HERO = {
  eyebrow: 'Life happens in Moments',
  title: 'Your first Moment',
  sub: 'One breath to plan it.',
};

function title(m: Moment, privateLabel: string): string {
  return m.masked ? privateLabel : m.title;
}

export function momentsModel(moments: readonly Moment[], now: Date, privateLabel: string): MomentsModel {
  const sorted = [...moments].sort((a, b) => Date.parse(a.startAtIso) - Date.parse(b.startAtIso));
  const nowMs = now.getTime();
  const done = sorted.filter((m) => isMomentDone(m));
  const live = sorted.filter((m) => isMomentLive(m, now));
  const upcoming = sorted.filter((m) => !isMomentDone(m) && Date.parse(m.startAtIso) > nowMs);
  const lead = live[0] ?? upcoming[0] ?? null;

  const hero = lead
    ? {
        eyebrow: `${live[0] ? 'Now' : 'Next'} · ${momentWhenShort(lead.startAtIso, now)}`,
        title: title(lead, privateLabel),
        sub: isMomentSealed(lead) ? 'Sealed' : 'Not prepared yet',
      }
    : null;

  return {
    hero,
    upcoming: upcoming.map((m) => {
      const sealed = isMomentSealed(m);
      return {
        id: m.id,
        title: title(m, privateLabel),
        sub: sealed
          ? `${momentWhenShort(m.startAtIso, now)} · sealed`
          : `${momentWhenShort(m.startAtIso, now)} · not prepared · plan it in one breath`,
        pill: sealed ? 'Sealed' : 'Plan',
      };
    }),
    done: done
      .slice()
      .reverse()
      .map((m) => {
        const p = m.preparation!;
        const skipped = p.replay === 'skipped';
        const replayed = p.replay != null && !skipped;
        const state = p.cancelledAtIso
          ? 'Cancelled'
          : skipped
            ? 'Replay skipped'
            : replayed
              ? 'Replay done'
              : 'Replay ready';
        return {
          id: m.id,
          title: title(m, privateLabel),
          sub: `${momentWhenShort(m.startAtIso, now)} · ${state}`,
          pill: replayed ? 'Done' : null,
        };
      }),
  };
}
