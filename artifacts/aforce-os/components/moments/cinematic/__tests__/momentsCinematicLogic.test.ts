/** Moments tab wording — real Moments only. */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isMomentDone, isMomentLive, momentsModel, momentWhenShort, MOMENTS_EMPTY_HERO } from '../momentsCinematicLogic';
import type { Moment } from '@/types/moments';

const at = (d: number, h = 0, mi = 0) => new Date(2026, 10, d, h, mi);
const iso = (d: Date) => d.toISOString();
const now = at(18, 19);
const sealed = { version: 1, context: 'one_breath', transactionId: 't', reviewedAtIso: 'x', sealedAtIso: iso(at(18, 9)) } as NonNullable<Moment['preparation']>;
const m = (id: string, start: Date, over: Partial<Moment> = {}): Moment =>
  ({ id, source: 'manual', title: `Moment ${id}`, type: 'work', importance: 'high', startAtIso: iso(start), createdAtIso: iso(at(17)), ...over }) as Moment;

describe('when line', () => {
  it('uses Today, Tomorrow, a short weekday, then a date', () => {
    expect(momentWhenShort(iso(at(18, 20, 30)), now)).toBe('Today · 8:30 PM');
    expect(momentWhenShort(iso(at(19, 10)), now)).toBe('Tomorrow · 10:00 AM');
    expect(momentWhenShort(iso(at(21, 15)), now)).toBe('Sat · 3:00 PM');
    expect(momentWhenShort(iso(at(16, 7)), now)).toBe('Mon · 7:00 AM');
    expect(momentWhenShort(iso(new Date(2026, 11, 4, 9)), now)).toBe('Dec 4 · 9:00 AM');
  });
});

describe('moments model', () => {
  const upcomingPlan = m('a', at(19, 10));
  const upcomingSealed = m('b', at(21, 15), { preparation: sealed });
  const live = m('c', at(18, 18), { preparation: sealed });
  const replayReady = m('d', at(17, 19), { preparation: { ...sealed, returnedAtIso: iso(at(17, 23)) } });
  const replayDone = m('e', at(16, 7), { preparation: { ...sealed, returnedAtIso: iso(at(16, 9)), replay: 'yes' } });
  const cancelled = m('f', at(15, 7), { preparation: { ...sealed, cancelledAtIso: iso(at(15, 6)) } });

  it('with nothing planned there is no hero and both lists are empty', () => {
    expect(momentsModel([], now, 'Private')).toEqual({ hero: null, upcoming: [], done: [] });
    expect(MOMENTS_EMPTY_HERO.title).toBe('Your first Moment');
  });

  it('the hero is the next Moment, or the live one when there is one', () => {
    expect(momentsModel([upcomingSealed, upcomingPlan], now, 'P').hero).toEqual({
      eyebrow: 'Next · Tomorrow · 10:00 AM', title: 'Moment a', sub: 'Not prepared yet',
    });
    expect(momentsModel([upcomingPlan, live], now, 'P').hero).toMatchObject({ eyebrow: 'Now · Today · 6:00 PM', sub: 'Sealed' });
    expect(isMomentLive(live, now)).toBe(true);
  });

  it('upcoming rows say sealed or not prepared, with the matching pill', () => {
    const { upcoming } = momentsModel([upcomingSealed, upcomingPlan], now, 'P');
    expect(upcoming).toEqual([
      { id: 'a', title: 'Moment a', sub: 'Tomorrow · 10:00 AM · not prepared · plan it in one breath', pill: 'Plan' },
      { id: 'b', title: 'Moment b', sub: 'Sat · 3:00 PM · sealed', pill: 'Sealed' },
    ]);
  });

  it('done rows are newest first and say where the Replay stands', () => {
    const { done } = momentsModel([replayDone, cancelled, replayReady], now, 'P');
    expect(done.map((r) => [r.id, r.sub.split(' · ').pop(), r.pill])).toEqual([
      ['d', 'Replay ready', null],
      ['e', 'Replay done', 'Done'],
      ['f', 'Cancelled', null],
    ]);
    expect(isMomentDone(replayReady)).toBe(true);
  });

  it('a live Moment is not listed as upcoming or done', () => {
    const model = momentsModel([live], now, 'P');
    expect(model.upcoming).toEqual([]);
    expect(model.done).toEqual([]);
  });

  it('never shows the title of a private event', () => {
    const model = momentsModel([m('z', at(19, 10), { masked: true })], now, 'Private event');
    expect(model.hero!.title).toBe('Private event');
    expect(model.upcoming[0]!.title).toBe('Private event');
  });
});

describe('the Moments layout is presentation only', () => {
  const view = readFileSync(join(__dirname, '..', 'MomentsCinematic.tsx'), 'utf8');
  it('reads no store, uses no red and no sample copy', () => {
    expect(view).not.toMatch(/useMomentsStore|useMomentsData|commitReviewedMoment/);
    expect(view).not.toMatch(/af\.red(Text)?\b/);
    expect(view).not.toMatch(/Pickleball|Investor meeting|CityPickle|Sample data/);
  });
  it('the primary action is warm white with black text', () => {
    expect(view).toContain('backgroundColor: af.primaryFill');
    expect(view).toContain('color: af.onPrimaryFill');
  });
});
