import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { emptyOneBreathState, oneBreathTurn } from '@/utils/oneBreath/session';
import { oneBreathTripRoute } from '@/utils/oneBreath/tripHandoff';

const now = new Date(2026, 10, 25, 10);
const flight = "I'm flying to Miami Friday";
const internal = { dev: false, internalTestflight: true };
function route(over: Partial<Parameters<typeof oneBreathTripRoute>[0]> = {}) {
  return oneBreathTripRoute({ words: flight, flags: { travel_mode_enabled: true },
    session: emptyOneBreathState(), hasOpenPlan: false, unsafe: false, now, context: internal, ...over });
}

describe('Travel handoff from the active One Breath conversation', () => {
  it('hands a new flight to trip entry with the exact words and no plan write', () => {
    const session = emptyOneBreathState();
    const before = JSON.stringify(session);
    expect(route({ session })).toEqual({ pathname: '/travel-intelligence', params: { trip: flight } });
    expect(JSON.stringify(session)).toBe(before);
  });

  it('keeps ordinary plans, drinks, status and navigation in One Breath', () => {
    for (const words of ['Dinner in Miami Friday at 7 PM', 'Log a 12 oz coffee', 'How am I doing?', 'Open moments', 'I have a flight Friday at 6 AM']) {
      expect(route({ words }), words).toBeNull();
    }
  });

  it('honours the Travel opt-in and the public-build clamp', () => {
    expect(route({ flags: { travel_mode_enabled: false } })).toBeNull();
    expect(route({ context: { dev: false, internalTestflight: false } })).toBeNull();
  });

  it('does not abandon a real pending plan or drink question when a flight is said', () => {
    const context = { nowIso: now.toISOString(), social: false, momentInWindow: false,
      learningOn: false, interpreterReachable: true, networkUp: true };
    for (const words of ['Lift tomorrow', 'I drank some water']) {
      const turn = oneBreathTurn(emptyOneBreathState(), { kind: 'say', words, via: 'typed' }, context);
      expect(!!(turn.state.pendingPlan || turn.state.askingDrink), words).toBe(true);
      expect(route({ session: turn.state }), words).toBeNull();
    }
  });

  it('leaves active plans and safety requests with their existing owner', () => {
    expect(route({ hasOpenPlan: true })).toBeNull();
    expect(route({ unsafe: true })).toBeNull();
    expect(route({ session: { ...emptyOneBreathState(), lockedIn: true } })).toBeNull();
  });

  it('allows a trip after logging while the existing carried Undo remains intact', () => {
    const session = { ...emptyOneBreathState(), loggedUndo: { id: 'coffee-1', label: '12 oz coffee', msLeft: 4000 } };
    expect(route({ session })).not.toBeNull();
    expect(session.loggedUndo.msLeft).toBe(4000);
  });

  it('is connected to the conversation that the beta route actually mounts, for typed and spoken words', () => {
    const source = readFileSync(resolve(__dirname, '../../../components/oneBreath/OneBreathConversationScreen.tsx'), 'utf8');
    expect(source).toContain('const trip = oneBreathTripRoute({');
    expect(source).toContain('session: controller.getSnapshot().session');
    expect(source).toContain('unsafe: !!evaluateMomentSafety(said, alcoholDisclosure(said))');
    expect(source).toContain('hear(text.trim(), "spoken")');
    expect(source).toContain('hear(said, "typed")');
    expect(source.indexOf('if (trip) {')).toBeLessThan(source.indexOf('controller.send({ kind: "say", words: said, via })'));
  });
});
