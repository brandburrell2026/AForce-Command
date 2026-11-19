/**
 * Home (cinematic) wording rules — App Spec v1.8.2 Part 2 · Home and
 * Appendix G §3 · Home. Real data only; no sample values.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  HOME_EMPTY_HERO,
  homeClock,
  homeDateLine,
  homeGreeting,
  homeIntakeNote,
  homeMomentHero,
  homeMomentWhen,
  homeRing,
  homeStatusLine,
  isMomentSealed,
} from '../homeCinematicLogic';
import type { Moment } from '@/types/moments';

const at = (y: number, mo: number, d: number, h = 0, mi = 0) => new Date(y, mo - 1, d, h, mi);
const iso = (d: Date) => d.toISOString();
const moment = (over: Partial<Moment>): Moment =>
  ({
    id: 'm1',
    source: 'manual',
    title: 'Investor meeting',
    type: 'work',
    importance: 'high',
    startAtIso: iso(at(2026, 11, 19, 10, 0)),
    createdAtIso: iso(at(2026, 11, 18, 9, 0)),
    ...over,
  }) as Moment;
const sealed = { version: 1, context: 'one_breath', transactionId: 't', reviewedAtIso: 'x', sealedAtIso: iso(at(2026, 11, 18, 9)) } as Moment['preparation'];

describe('greeting and date', () => {
  it('changes with the time of day', () => {
    expect(homeGreeting(at(2026, 11, 18, 7), 'Brandon')).toBe('Good morning, Brandon.');
    expect(homeGreeting(at(2026, 11, 18, 13), 'Brandon')).toBe('Good afternoon, Brandon.');
    expect(homeGreeting(at(2026, 11, 18, 19), 'Brandon')).toBe('Good evening, Brandon.');
  });
  it('never invents a name', () => {
    expect(homeGreeting(at(2026, 11, 18, 19), null)).toBe('Good evening.');
    expect(homeGreeting(at(2026, 11, 18, 19), '  ')).toBe('Good evening.');
  });
  it('writes the short date line', () => {
    expect(homeDateLine(at(2026, 11, 18))).toBe('Wed · Nov 18');
  });
  it('writes a 12-hour clock', () => {
    expect(homeClock(at(2026, 11, 18, 0, 5))).toBe('12:05 AM');
    expect(homeClock(at(2026, 11, 18, 18, 12))).toBe('6:12 PM');
  });
});

describe('next Moment hero', () => {
  const now = at(2026, 11, 18, 19);
  it('names today, tomorrow, a weekday, then a date', () => {
    expect(homeMomentWhen(iso(at(2026, 11, 18, 20, 30)), now)).toBe('Today · 8:30 PM');
    expect(homeMomentWhen(iso(at(2026, 11, 19, 10)), now)).toBe('Tomorrow · 10:00 AM');
    expect(homeMomentWhen(iso(at(2026, 11, 21, 15)), now)).toBe('Saturday · 3:00 PM');
    expect(homeMomentWhen(iso(at(2026, 12, 4, 9)), now)).toBe('Dec 4 · 9:00 AM');
  });
  it('shows an unprepared Moment as not prepared', () => {
    const h = homeMomentHero(moment({}), now, 'Private event');
    expect(h).toMatchObject({ title: 'Investor meeting', status: 'Not prepared yet · tap to plan it', target: 'moments' });
  });
  it('shows a sealed Moment as sealed, and a cancelled seal as not sealed', () => {
    expect(homeMomentHero(moment({ preparation: sealed }), now, 'x').status).toBe('Sealed');
    expect(isMomentSealed(moment({ preparation: { ...sealed!, cancelledAtIso: iso(now) } }))).toBe(false);
  });
  it('never shows the title of a private event', () => {
    expect(homeMomentHero(moment({ masked: true }), now, 'Private event').title).toBe('Private event');
  });
  it('with nothing planned, invites the first plan and points at One Breath', () => {
    expect(homeMomentHero(null, now, 'x')).toEqual(HOME_EMPTY_HERO);
    expect(HOME_EMPTY_HERO.target).toBe('one-breath');
  });
});

describe('status line', () => {
  it('is hidden when nothing is planned', () => {
    expect(homeStatusLine([], null)).toBeNull();
  });
  it('counts the Moments still to plan', () => {
    const a = moment({});
    const b = moment({ id: 'm2' });
    expect(homeStatusLine([a], a)).toEqual({ left: '1 Moment to plan', right: 'Not sealed' });
    expect(homeStatusLine([a, b], a)).toEqual({ left: '2 Moments to plan', right: 'Not sealed' });
  });
  it('says sealed and when, once the next Moment is sealed', () => {
    const a = moment({ preparation: sealed });
    expect(homeStatusLine([a], a)).toEqual({ left: 'Plan sealed', right: 'Next · 10:00 AM' });
  });
});

describe('intake note', () => {
  it('shows intake, target and the last update', () => {
    expect(homeIntakeNote(42, 96, at(2026, 11, 18, 18, 12))).toBe('42 of 96 oz · updated 6:12 PM');
  });
  it('drops the time when nothing is logged, and never goes negative', () => {
    expect(homeIntakeNote(0, 96, null)).toBe('0 of 96 oz');
    expect(homeIntakeNote(-5, 96, null)).toBe('0 of 96 oz');
  });
  it('shows a total above the target as it is', () => {
    expect(homeIntakeNote(262, 96, null)).toBe('262 of 96 oz');
  });
});

describe('HydroState ring', () => {
  it('shows Collecting and no number with limited evidence — never a 0', () => {
    for (const e of ['pending', 'building'] as const) {
      expect(homeRing(e, 0)).toEqual({ progress: 0, value: '—', label: 'Collecting' });
    }
  });
  it('shows the engine score once there is evidence, kept inside 0–100', () => {
    expect(homeRing('ready', 44)).toEqual({ progress: 0.44, value: '44', label: 'HydroState' });
    expect(homeRing('ready', 140).value).toBe('100');
    expect(homeRing('ready', Number.NaN).label).toBe('Collecting');
  });
});

describe('the Home layout is presentation only', () => {
  const view = readFileSync(join(__dirname, '..', 'HomeCinematic.tsx'), 'utf8');
  const container = readFileSync(join(__dirname, '..', 'HomeCinematicContainer.tsx'), 'utf8');
  it('reads no store and logs nothing itself', () => {
    expect(view).not.toMatch(/useAppStore|useUserSlice|logIntake|calculateScore/);
    expect(container).not.toMatch(/logIntake|calculateScore/);
  });
  it('uses no red except the mark and the ring end dot, and no sample copy', () => {
    expect(view).not.toMatch(/af\.red(Text)?\b/);
    expect(view + container).not.toMatch(/Julius|Investor meeting|Team dinner|Carbone|Sample data/);
  });
  it('the primary action is warm white with black text', () => {
    expect(view).toContain('backgroundColor: af.primaryFill');
    expect(view).toContain('color: af.onPrimaryFill');
  });
});
