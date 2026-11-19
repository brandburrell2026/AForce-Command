/**
 * Home's "Before the Moment" and "Return" cards (prototype). They appear only
 * when they apply, say only what the app knows, and change nothing.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Moment } from '@/types/moments';
import {
  HOME_BEFORE_WINDOW_MS,
  HOME_RETURN_WINDOW_MS,
  homeBeforeCard,
  homeReturnCard,
} from '../cinematic/homeMomentCardsLogic';

const NOW = new Date(2026, 10, 19, 6, 0);
const at = (h: number, m = 0, day = 19) => new Date(2026, 10, day, h, m).toISOString();
const prep = (extra: Record<string, unknown> = {}) => ({
  version: 1,
  context: 'one_breath',
  transactionId: 't',
  reviewedAtIso: at(21, 40, 18),
  sealedAtIso: at(21, 42, 18),
  returnMethod: 'none',
  destination: '',
  emergencyNumber: '911',
  steps: [
    { atIso: at(6, 30), action: 'Water' },
    { atIso: at(5, 30), action: 'Earlier step' },
  ],
  policyVersion: 'social-v0.4-phase-a',
  ...extra,
});
const moment = (id: string, title: string, startAtIso: string, preparation?: unknown, extra: Partial<Moment> = {}) =>
  ({ id, title, startAtIso, preparation, ...extra }) as Moment;

describe('Before the Moment', () => {
  it('shows for a sealed Moment starting within the window, with the next reviewed step', () => {
    const card = homeBeforeCard([moment('a', 'Morning lift', at(7, 0), prep())], NOW, 'Private event');
    expect(card).toMatchObject({ kind: 'before', momentId: 'a', title: 'Your preparation is set.' });
    expect(card!.eyebrow).toBe('Before Morning lift · 7:00 AM');
    expect(card!.note).toBe('Sealed 9:42 PM. Next: Water · 6:30 AM');
  });

  it('never claims that nothing changed since the seal', () => {
    const card = homeBeforeCard([moment('a', 'Lift', at(7, 0), prep())], NOW, 'Private event');
    expect(`${card!.title} ${card!.note}`).not.toMatch(/nothing changed|current|up to date/i);
  });

  it('is absent when the Moment is not sealed, cancelled, locked in, past, or too far off', () => {
    const cases = [
      moment('u', 'Unsealed', at(7, 0)),
      moment('c', 'Cancelled', at(7, 0), prep({ cancelledAtIso: at(5, 0) })),
      moment('l', 'Locked', at(7, 0), prep({ lockedInAtIso: at(5, 50) })),
      moment('p', 'Past', at(5, 0), prep()),
      moment('f', 'Far', new Date(NOW.getTime() + HOME_BEFORE_WINDOW_MS + 60_000).toISOString(), prep()),
    ];
    for (const m of cases) expect(homeBeforeCard([m], NOW, 'Private event')).toBeNull();
  });

  it('picks the soonest, and hides a private title', () => {
    const card = homeBeforeCard(
      [moment('b', 'Later', at(11, 0), prep()), moment('a', 'Secret', at(7, 0), prep(), { masked: true })],
      NOW,
      'Private event',
    );
    expect(card!.momentId).toBe('a');
    expect(card!.eyebrow).toBe('Before Private event · 7:00 AM');
  });

  it('says only "Sealed" when no reviewed step is still ahead', () => {
    const card = homeBeforeCard([moment('a', 'Lift', at(7, 0), prep({ steps: [] }))], NOW, 'Private event');
    expect(card!.note).toBe('Sealed 9:42 PM.');
  });
});

describe('Return', () => {
  const back = (extra: Record<string, unknown> = {}) => prep({ returnedAtIso: at(23, 24, 18), ...extra });

  it('shows once the member is back and the replay is unanswered — even for last night', () => {
    const card = homeReturnCard([moment('d', 'Team dinner', at(19, 30, 18), back())], NOW, 'Private event');
    expect(card).toMatchObject({ kind: 'return', momentId: 'd', title: 'Back from Team dinner', action: 'Replay · 1 question' });
    expect(card!.note).toBe('Made it back 11:24 PM');
  });

  it('is absent before the member has returned, after the replay, when cancelled, skipped, or stale', () => {
    expect(homeReturnCard([moment('a', 'A', at(19, 0, 18), prep())], NOW, 'P')).toBeNull();
    expect(homeReturnCard([moment('a', 'A', at(19, 0, 18), back({ replay: 'yes' }))], NOW, 'P')).toBeNull();
    expect(homeReturnCard([moment('a', 'A', at(19, 0, 18), back({ cancelledAtIso: at(20, 0, 18) }))], NOW, 'P')).toBeNull();
    expect(homeReturnCard([moment('a', 'A', at(19, 0, 18), back())], NOW, 'P', new Set(['a']))).toBeNull();
    const stale = new Date(NOW.getTime() - HOME_RETURN_WINDOW_MS - 60_000).toISOString();
    expect(homeReturnCard([moment('a', 'A', at(19, 0, 16), back({ returnedAtIso: stale }))], NOW, 'P')).toBeNull();
  });

  it('never infers a return from the clock', () => {
    const ended = moment('a', 'A', at(19, 0, 18), prep(), { endAtIso: at(21, 0, 18) });
    expect(homeReturnCard([ended], NOW, 'P')).toBeNull();
  });
});

describe('the cards only open the Moment', () => {
  const dir = join(__dirname, '..', 'cinematic');
  const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, '');
  const view = strip(readFileSync(join(dir, 'HomeMomentCards.tsx'), 'utf8'));
  const container = strip(readFileSync(join(dir, 'HomeCinematicContainer.tsx'), 'utf8'));

  it('draws nothing when neither applies', () => {
    expect(view).toContain('if (!before && !back) return null;');
  });

  it('writes nothing: no store update, seal, lock-in or replay from Home', () => {
    expect(view).not.toMatch(/updateMoment|setPreparation|seal\(|lockIn|setReplay|useMomentsStore/);
    expect(container).toContain('onOpen={(id) => router.push(`/moment/${id}`)}');
    expect(container).not.toMatch(/store\.(update|add|remove|set)\w*\(/);
  });

  it('Skip only hides the card in memory', () => {
    expect(container).toContain('onSkipReturn={(id) => setSkippedReturns((prev) => new Set(prev).add(id))}');
  });
});
