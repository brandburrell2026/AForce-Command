/**
 * The opening One Breath screen answers a few requests in place and sends
 * everything else to the existing Mirror flow, untouched.
 */
import { describe, it, expect } from 'vitest';
import type { Moment } from '@/types/moments';
import { ONE_BREATH_LINES, screenNamed } from '@/utils/oneBreath/session';
import { momentInLockInWindow, ONE_BREATH_ROUTES, screenAnswer, upcomingForOneBreath } from '@/utils/oneBreath/screenAnswer';
import { PHRASING_SET } from './phrasingSet';

const NOW = new Date(2026, 10, 20, 6, 20).getTime();
const moment = (id: string, at: Date, prep?: Partial<NonNullable<Moment['preparation']>>, extra: Partial<Moment> = {}): Moment =>
  ({
    id, source: 'manual', title: id, type: 'training', importance: 'high', startAtIso: at.toISOString(), createdAtIso: at.toISOString(),
    ...(prep ? { preparation: { version: 1, context: 'one_breath', transactionId: 't', reviewedAtIso: at.toISOString(), steps: [], ...prep } } : {}),
    ...extra,
  }) as Moment;
const sealed = { sealedAtIso: '2026-11-19T12:00:00.000Z' };
const ask = (words: string, moments: Moment[] = [], social = false) => screenAnswer(words, { social, moments, nowMs: NOW });

describe('One Breath screen answers · a plan still goes to Mirror', () => {
  it('every plan phrase, and every drink phrase, is left to the existing flow', () => {
    for (const p of PHRASING_SET.filter((x) => x.request === 'plan_moment' || x.request === 'log_drink' || x.request === 'prepare')) {
      expect(screenAnswer(p.text, { social: p.social, moments: [], nowMs: NOW }), `${p.id} ${p.text}`).toBeNull();
    }
  });

  it('words the rules do not recognize are left to the existing flow, never blocked', () => {
    for (const words of ['Acupuncture 3pm', 'Brunch with mom', 'Should I take creatine before I lift?', 'Dinner with Lilia Friday at 8', 'never mind']) {
      expect(ask(words), words).toBeNull();
    }
  });

  it('an unclear "open it" is left alone too', () => {
    expect(ask('open it')).toBeNull();
  });
});

describe('One Breath screen answers · answered in place', () => {
  it('"How am I doing?" is handed to the component that reads HydroState', () => {
    expect(ask('How am I doing?')).toEqual({ kind: 'status' });
  });

  it('"What\'s coming up?" lists Moments still ahead, soonest first, and skips finished ones', () => {
    const moments = [
      moment('Later', new Date(2026, 10, 22, 9, 0)),
      moment('Morning lift', new Date(2026, 10, 20, 6, 30), sealed),
      moment('Yesterday', new Date(2026, 10, 19, 6, 30), sealed),
      moment('Done', new Date(2026, 10, 21, 6, 30), { ...sealed, returnedAtIso: '2026-11-20T01:00:00.000Z' }),
    ];
    expect(upcomingForOneBreath(moments, NOW).map((m) => m.title)).toEqual(['Morning lift', 'Later']);
    expect(ask("What's coming up this week?", moments)).toEqual({
      kind: 'text', request: 'upcoming', text: 'Morning lift · Fri, Nov 20 6:30 AM. Later · Sun, Nov 22 9:00 AM.',
    });
    expect(ask("What's next", [])).toEqual({ kind: 'text', request: 'upcoming', text: ONE_BREATH_LINES.upcomingNone });
  });

  it('opens a named screen on a route the app already has', () => {
    expect(ask('Pull up hydration')).toEqual({ kind: 'open', route: '/journal' });
    expect(ask('open moments')).toEqual({ kind: 'open', route: '/moments-tab' });
    expect(ask('show me what aforce remembers')).toEqual({ kind: 'open', route: '/remembers' });
    // The current Travel screen, not the older one.
    expect(ask('open travel')).toEqual({ kind: 'open', route: '/travel-intelligence' });
  });

  it('every "open a screen" phrase either has a route or is left to the existing flow', () => {
    for (const p of PHRASING_SET.filter((x) => x.request === 'open_screen' && x.outcome === 'act')) {
      const a = ask(p.text);
      const key = screenNamed(p.text);
      if (key && ONE_BREATH_ROUTES[key]) expect(a, p.text).toEqual({ kind: 'open', route: ONE_BREATH_ROUTES[key] });
      else expect(a, p.text).toBeNull();
    }
  });
});

describe('One Breath screen answers · Lock In is routed, never started here', () => {
  const lift = moment('lift', new Date(2026, 10, 20, 6, 30), sealed);

  it('with no Moment in its window, says so', () => {
    expect(ask('Lock me in')).toEqual({ kind: 'text', request: 'lock_in', text: ONE_BREATH_LINES.lockInNotActive });
    expect(ask('Lock me in', [moment('tomorrow', new Date(2026, 10, 21, 6, 30), sealed)])).toMatchObject({ kind: 'text' });
  });

  it('with a sealed Moment in its window, goes to that Moment, whose own screen has Lock In', () => {
    expect(ask('Lock me in', [lift])).toEqual({ kind: 'moment', momentId: 'lift' });
  });

  it('does not offer a Moment that is unsealed, already locked in, finished, or long past', () => {
    const at = new Date(2026, 10, 20, 6, 30);
    expect(momentInLockInWindow([moment('unsealed', at)], NOW)).toBeUndefined();
    expect(momentInLockInWindow([moment('locked', at, { ...sealed, lockedInAtIso: '2026-11-20T11:00:00.000Z' })], NOW)).toBeUndefined();
    expect(momentInLockInWindow([moment('returned', at, { ...sealed, returnedAtIso: '2026-11-20T11:00:00.000Z' })], NOW)).toBeUndefined();
    expect(momentInLockInWindow([moment('old', new Date(2026, 10, 18, 6, 30), sealed)], NOW)).toBeUndefined();
    expect(momentInLockInWindow([moment('ended', new Date(2026, 10, 20, 5, 0), sealed, { endAtIso: new Date(2026, 10, 20, 6, 0).toISOString() })], NOW)).toBeUndefined();
  });

  it('Social keeps its own Lock In flow', () => {
    expect(ask('Lock me in', [lift], true)).toBeNull();
  });
});
