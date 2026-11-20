/**
 * Screen answers — what the opening One Breath screen does with words that
 * are not a plan (first integration step of the One Breath pipeline).
 *
 * One Breath stays one experience: a plan request returns null here and goes
 * to the existing Mirror → Plan → Seal → Lock In → Replay flow untouched.
 * Only requests the pipeline can answer without changing anything are
 * answered in place: HydroState, what is coming up, opening a screen, and
 * Lock In (which is never started here, only routed to the Moment that owns
 * it). Anything the rules are not sure about also returns null, so nothing
 * that reaches Mirror today stops reaching it.
 */
import { preparationClosed } from '@/services/momentPreparationLifecycle';
import { interpretByRules } from '@/services/oneBreath/rulesInterpreter';
import type { Moment } from '@/types/moments';
import { lockInWindow } from './lockInWindow';
import { dayLabel, timeLabel } from './planTurn';
import { emptyOneBreathState, ONE_BREATH_LINES, oneBreathTurn, screenNamed, type OneBreathContext } from './session';

export type ScreenAnswer =
  /** A line to show in place. */
  | { kind: 'text'; request: 'upcoming' | 'lock_in'; text: string }
  /** HydroState, drawn by the component that owns reading it. */
  | { kind: 'status' }
  /** Go to a screen. */
  | { kind: 'open'; route: string }
  /** Go to the sealed Moment that is in its Lock In window; its own screen starts Lock In. */
  | { kind: 'moment'; momentId: string };

/** Screen keys from the pipeline to the routes the app already uses. A key with no route is not opened. */
export const ONE_BREATH_ROUTES: Readonly<Record<string, string>> = {
  home: '/',
  hydration: '/journal',
  moments: '/moments-tab',
  circle: '/(tabs)/competition',
  profile: '/(tabs)/profile',
  settings: '/(tabs)/profile',
  scan: '/scan',
  store: '/store',
  sleep: '/(tabs)/sleep',
  remembers: '/remembers',
  weekly_report: '/weekly-report',
  // The current Travel screen. The older one is no longer where a trip is added (founder decision, 2026-11-20).
  travel: '/travel-intelligence',
  performance_signal: '/performance-signal',
  recovery: '/recovery-coach',
};

const pad = (n: number) => String(n).padStart(2, '0');

/** Sealed or planned Moments still ahead, soonest first, as the pipeline lists them. */
export function upcomingForOneBreath(moments: readonly Moment[], nowMs: number, limit = 5): NonNullable<OneBreathContext['upcoming']> {
  return moments
    .filter((m) => Date.parse(m.startAtIso) >= nowMs && !preparationClosed(m.preparation))
    .sort((a, b) => Date.parse(a.startAtIso) - Date.parse(b.startAtIso))
    .slice(0, limit)
    .map((m) => {
      const at = new Date(m.startAtIso);
      return {
        title: m.title,
        day: dayLabel(`${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`),
        time: timeLabel(`${pad(at.getHours())}:${pad(at.getMinutes())}`),
      };
    });
}

/** The sealed Moment that can be locked in right now, if there is one. */
export function momentInLockInWindow(moments: readonly Moment[], nowMs: number): Moment | undefined {
  const DAY_MS = 24 * 60 * 60 * 1000;
  return moments
    .filter((m) => {
      const p = m.preparation;
      if (!p?.sealedAtIso || p.lockedInAtIso || preparationClosed(p)) return false;
      if (lockInWindow(m.startAtIso, nowMs) !== 'open') return false;
      const end = Date.parse(m.endAtIso ?? '');
      // A known end closes it. With no known end, a Moment that began over a day ago is not "starting".
      return Number.isFinite(end) ? nowMs < end : nowMs - Date.parse(m.startAtIso) < DAY_MS;
    })
    .sort((a, b) => Date.parse(a.startAtIso) - Date.parse(b.startAtIso))[0];
}

export function screenAnswer(
  words: string,
  args: { social: boolean; moments: readonly Moment[]; nowMs: number },
): ScreenAnswer | null {
  const starting = args.social ? undefined : momentInLockInWindow(args.moments, args.nowMs);
  const heard = interpretByRules(words, { social: args.social, momentInWindow: !!starting });

  if (heard.request === 'status' && heard.outcome === 'act') return { kind: 'status' };

  if (heard.request === 'upcoming' && heard.outcome === 'act') {
    const turn = oneBreathTurn(emptyOneBreathState(), { kind: 'say', words, via: 'typed' }, {
      nowIso: new Date(args.nowMs).toISOString(),
      social: args.social,
      momentInWindow: false,
      learningOn: false,
      interpreterReachable: true,
      networkUp: true,
      upcoming: upcomingForOneBreath(args.moments, args.nowMs),
    });
    return { kind: 'text', request: 'upcoming', text: turn.reply.text };
  }

  if (heard.request === 'open_screen' && heard.outcome === 'act') {
    const route = ONE_BREATH_ROUTES[screenNamed(words) ?? ''];
    return route ? { kind: 'open', route } : null;
  }

  // Social's Lock In also opens Return; it is left to its own flow.
  if (heard.request === 'lock_in' && !args.social) {
    return starting
      ? { kind: 'moment', momentId: starting.id }
      : { kind: 'text', request: 'lock_in', text: ONE_BREATH_LINES.lockInNotActive };
  }

  return null;
}
