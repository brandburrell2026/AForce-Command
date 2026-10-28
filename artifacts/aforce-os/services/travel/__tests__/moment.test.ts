import { describe, it, expect } from 'vitest';
import { createJourney } from '../journey';
import { travelMoment, mergeTravelMoment, TRAVEL_MOMENT_ID } from '../moment';
const input = { flightNumber: 'DL2465', origin: 'LGA', destination: 'FLL', departureDate: '2026-10-29', departureTime: '07:05', utcOffset: '-04:00' };
describe('journey-derived Travel Moment', () => {
  it('projects the saved itinerary at the correct instant without a second persisted copy', () => {
    const journey = createJourney(input);
    const moment = travelMoment(journey)!;
    expect(moment.id).toBe(TRAVEL_MOMENT_ID);
    expect(moment.title).toBe('LGA → FLL · DL2465');
    expect(moment.startAtIso).toBe('2026-10-29T11:05:00.000Z');
    expect(moment.type).toBe('travel');
    expect(moment.source).toBe('manual');
    expect(moment.prepGoal).toContain('UTC-04:00');
  });
  it('replaces a projection without duplicates and removes it when finished/deleted', () => {
    const journey = createJourney(input);
    const prior = mergeTravelMoment([], journey);
    const updated = createJourney({ ...input, departureTime: '10:45' });
    const merged = mergeTravelMoment(prior, updated);
    expect(merged).toHaveLength(1);
    expect(merged[0].startAtIso).toBe('2026-10-29T14:45:00.000Z');
    expect(mergeTravelMoment(merged, { ...updated, completedAt: new Date().toISOString() })).toEqual([]);
    expect(mergeTravelMoment(merged, null)).toEqual([]);
  });
});
