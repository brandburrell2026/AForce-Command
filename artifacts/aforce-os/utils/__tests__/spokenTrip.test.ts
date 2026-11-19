import { describe, it, expect } from 'vitest';
import { parseSpokenTrip, spokenTripSummary } from '../travel/spokenTrip';

const NOW = new Date(2026, 10, 19, 10, 0); // 19 Nov 2026, local
const p = (s: string) => parseSpokenTrip(s, NOW);

describe('parseSpokenTrip', () => {
  it('the example sentence fills all five fields', () => {
    expect(p('Delta 123 from JFK to Los Angeles on November 14 at 9:05 AM.')).toEqual({
      fields: { flightNumber: 'DL123', origin: 'JFK', destination: 'LAX', date: '2027-11-14', time: '09:05' },
      notes: [],
    });
  });

  it('a date with no year is the next time it comes round, today included', () => {
    expect(p('united 2210 on november 19').fields.date).toBe('2026-11-19');
    expect(p('united 2210 on november 20th').fields.date).toBe('2026-11-20');
    expect(p('united 2210 on the 3rd of January').fields.date).toBe('2027-01-03');
    expect(p('flying december 2, 2026').fields.date).toBe('2026-12-02');
  });

  it('today and tomorrow', () => {
    expect(p('american 100 tomorrow at 6 am').fields).toMatchObject({ flightNumber: 'AA100', date: '2026-11-20', time: '06:00' });
    expect(p('jetblue 45 today at noon').fields).toMatchObject({ flightNumber: 'B645', date: '2026-11-19', time: '12:00' });
  });

  it('times: with a colon, without one, on the hour, a.m./p.m., midnight', () => {
    expect(p('at 9:05 am').fields.time).toBe('09:05');
    expect(p('at 905 pm').fields.time).toBe('21:05');
    expect(p('at 12 a.m.').fields.time).toBe('00:00');
    expect(p('at 12:30 p.m.').fields.time).toBe('12:30');
    expect(p('at midnight').fields.time).toBe('00:00');
    // A bare number is never taken for a time.
    expect(p('delta 123 on november 14').fields.time).toBeUndefined();
    expect(p('at 13:05 pm').fields.time).toBeUndefined();
  });

  it('airline codes are accepted only from the known list — small words are not flights', () => {
    expect(p('AA 123 from MIA to LAX').fields.flightNumber).toBe('AA123');
    expect(p('flight b6 45').fields.flightNumber).toBe('B645');
    expect(p('leaving at 905 on 14 to 5').fields.flightNumber).toBeUndefined();
    expect(p('zz 123').fields.flightNumber).toBeUndefined();
  });

  it('airports: a code as said, a spelled-out code, or a city with one airport', () => {
    expect(p('from miami to seattle').fields).toMatchObject({ origin: 'MIA', destination: 'SEA' });
    expect(p('from j f k to l a x tomorrow').fields).toMatchObject({ origin: 'JFK', destination: 'LAX' });
    expect(p('from SFO to Miami airport on december 1').fields).toMatchObject({ origin: 'SFO', destination: 'MIA' });
  });

  it('a city with several airports is not guessed; the note lists them', () => {
    const r = p('delta 5 from new york to los angeles');
    expect(r.fields.origin).toBeUndefined();
    expect(r.fields.destination).toBe('LAX');
    expect(r.notes).toEqual(['Departure: New York has JFK, LGA, EWR. Type the one you mean.']);
  });

  it('a place it does not know is left blank and said so', () => {
    const r = p('from boise to miami');
    expect(r.fields).toEqual({ destination: 'MIA' });
    expect(r.notes[0]).toContain('“boise” isn’t an airport AFORCE knows by name');
  });

  it('"flying to …" gives the arrival only', () => {
    expect(p('flying to dubai on march 3 2027').fields).toEqual({ destination: 'DXB', date: '2027-03-03' });
  });

  it('an impossible date is dropped, not corrected', () => {
    expect(p('on february 30').fields.date).toBeUndefined();
  });

  it('silence or unrelated words fill nothing', () => {
    expect(p('').fields).toEqual({});
    expect(p('I have a big meeting next week').fields).toEqual({});
  });
});

describe('spokenTripSummary', () => {
  it('names what was filled and asks for a check', () => {
    expect(spokenTripSummary(p('delta 123 from jfk to lax'))).toBe(
      'Filled in: flight number, departure airport, arrival airport. Check each one before saving.',
    );
  });
  it('says so when nothing was', () => {
    expect(spokenTripSummary(p('hello'))).toBe('Nothing was filled in. Try the example, or type the details.');
  });
});
