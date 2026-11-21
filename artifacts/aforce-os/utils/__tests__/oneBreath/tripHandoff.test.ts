import { describe, it, expect } from 'vitest';
import { tripHandoff } from '@/utils/oneBreath/tripHandoff';
import { emptyOneBreathState } from '@/utils/oneBreath/session';

const NOW = new Date(2026, 10, 19, 10);
const base = { session: emptyOneBreathState(), travelAvailable: true, now: NOW };

describe('One Breath · handing a trip to Travel', () => {
  it('a flight sentence goes to Travel with the words as said', () => {
    expect(tripHandoff('I\u2019m flying to Miami Friday', base)).toEqual({ pathname: '/travel-intelligence', params: { trip: 'I\u2019m flying to Miami Friday' } });
    expect(tripHandoff('Delta 1432 tomorrow', base)?.pathname).toBe('/travel-intelligence');
  });

  it('an ordinary plan, a drink or a question stays in One Breath', () => {
    for (const words of ['Lift tomorrow at 6:30 AM', 'Log 16 oz of water', 'How am I doing?', 'Dinner in Miami Friday at 7 PM']) {
      expect(tripHandoff(words, base), words).toBeNull();
    }
  });

  it('nothing is handed off where Travel is not available', () => {
    expect(tripHandoff('I\u2019m flying to Miami Friday', { ...base, travelAvailable: false })).toBeNull();
  });

  it('an answer to an open question is never mistaken for a new trip', () => {
    const asking = { ...emptyOneBreathState(), askingDrink: { categoryId: 'water', name: 'water' } as never };
    expect(tripHandoff('I\u2019m flying to Miami Friday', { ...base, session: asking })).toBeNull();
  });
});
