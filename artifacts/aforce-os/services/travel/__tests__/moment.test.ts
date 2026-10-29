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

describe('one displayed flight', () => {
  it('consolidates the explicit manual duplicate without deleting its record or readiness', () => {
    const journey = createJourney(input);
    const manual = { ...travelMoment(journey)!, id: 'manual-flight', title: 'Flight to FLL', preparedAtIso: '2026-10-28T20:00:00.000Z' };
    const before = JSON.stringify(manual);
    const displayed = mergeTravelMoment([manual], journey);
    expect(displayed).toHaveLength(1);
    expect(displayed[0].id).toBe(TRAVEL_MOMENT_ID);
    expect(displayed[0].preparedAtIso).toBe(manual.preparedAtIso);
    expect(JSON.stringify(manual)).toBe(before);
    expect(mergeTravelMoment([manual], null)).toEqual([manual]);
    expect(mergeTravelMoment([manual], { ...journey, completedAt: new Date().toISOString() })).toEqual([]);
  });
  it('preserves other times, destinations, sources, and independently named travel plans', () => {
    const journey = createJourney(input);
    const base = { ...travelMoment(journey)!, id: 'manual', title: 'Flight to FLL' };
    const others = [
      { ...base, id: 'other-time', startAtIso: '2026-10-29T14:45:00.000Z' },
      { ...base, id: 'other-destination', title: 'Flight to MIA' },
      { ...base, id: 'other-plan', title: 'Airport pickup' },
      { ...base, id: 'calendar', source: 'calendar' as const },
    ];
    expect(mergeTravelMoment(others, journey)).toHaveLength(5);
  });
});
