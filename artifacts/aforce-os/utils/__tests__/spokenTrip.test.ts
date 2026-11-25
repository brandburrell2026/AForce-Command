import { describe, it, expect } from 'vitest';
import { parseSpokenTrip, spokenTripSummary, tripForForm } from '../travel/spokenTrip';

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
    // Boise is known by name since 2026-11-20; Springfield (there are many) is not.
    const r = p('from springfield to miami');
    expect(r.fields).toEqual({ destination: 'MIA' });
    expect(r.notes[0]).toContain('“springfield” isn’t an airport AFORCE knows by name');
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

// 19 Nov 2026 is a Thursday.
describe('parseSpokenTrip · the sentences members actually say (2026-11-20)', () => {
  it('a weekday is the coming one; "this Friday" too', () => {
    expect(p('flying to Miami Sunday').fields).toEqual({ destination: 'MIA', date: '2026-11-22' });
    expect(p('from JFK to LAX Friday at 9 am').fields).toEqual({ origin: 'JFK', destination: 'LAX', date: '2026-11-20', time: '09:00' });
    expect(p('delta 5 from jfk to lax this saturday at 9 pm').fields).toMatchObject({ date: '2026-11-21', time: '21:00' });
  });

  it('"next Friday" is not guessed: the airports still fill and a note asks for the date', () => {
    const t = p('from JFK to LAX next Friday at 9 am');
    expect(t.fields).toEqual({ origin: 'JFK', destination: 'LAX', time: '09:00' });
    expect(t.notes).toEqual(['Date: “next Friday” can mean two different dates. Say the date, like “November 27”.']);
  });

  it('a weekday said on that weekday is not guessed either', () => {
    const t = p('united 2210 from EWR to SFO thursday at 8 am');
    expect(t.fields.date).toBeUndefined();
    expect(t.notes).toEqual(['Date: today is Thursday. Say “today”, or the date you mean.']);
  });

  it('a month date wins over a weekday in the same sentence', () => {
    expect(p('delta 5 from jfk to lax friday december 4 at 9 am').fields.date).toBe('2026-12-04');
  });

  it('24-hour times, and a part of the day', () => {
    expect(p('American 45 from Miami to Los Angeles on December 3 at 14:30').fields.time).toBe('14:30');
    expect(p('at 07:15').fields.time).toBe('07:15');
    expect(p('at 00:40').fields.time).toBe('00:40');
    expect(p('at 7 in the evening').fields.time).toBe('19:00');
    expect(p('at 6:30 in the morning').fields.time).toBe('06:30');
    expect(p('at 11 at night').fields.time).toBe('23:00');
  });

  it('a clock time with no AM or PM is not guessed, and says why', () => {
    const t = p('delta 5 from jfk to lax saturday at 9');
    expect(t.fields.time).toBeUndefined();
    expect(t.notes).toEqual(['Departure time: “9” could be morning or evening. Say AM or PM.']);
    expect(p('delta 5 saturday at 9:30').notes).toEqual(['Departure time: “9:30” could be morning or evening. Say AM or PM.']);
  });

  it('a flight number is never mistaken for a time, nor a time for a flight number', () => {
    expect(p('delta 1430 from jfk to lax tomorrow').fields).toEqual({ flightNumber: 'DL1430', origin: 'JFK', destination: 'LAX', date: '2026-11-20' });
    expect(p('tomorrow at 14:30 from jfk to lax').fields.flightNumber).toBeUndefined();
  });

  it('an arrival time is kept apart from the departure time', () => {
    const t = p('United 88 from EWR to San Francisco December 3 at 8 am landing at 11:15 am');
    expect(t.fields).toEqual({ flightNumber: 'UA88', origin: 'EWR', destination: 'SFO', date: '2026-12-03', time: '08:00', arrivalTime: '11:15' });
    expect(p('delta 5 from jfk to lax tomorrow arriving at 12:30 pm').fields).toMatchObject({ arrivalTime: '12:30' });
    expect(p('delta 5 from jfk to lax tomorrow arriving at 12:30 pm').fields.time).toBeUndefined();
  });

  it('the arrival date is filled only when it was said, never assumed', () => {
    expect(p('delta 5 from jfk to lax tomorrow at 11 pm landing at 2 am').fields.arrivalDate).toBeUndefined();
    expect(p('delta 5 from jfk to lax tomorrow at 11 pm landing november 21 at 2 am').fields).toMatchObject({ arrivalDate: '2026-11-21', arrivalTime: '02:00' });
  });

  it('a way back becomes a second leg with the airports swapped', () => {
    const t = p('United 88 from EWR to San Francisco December 3 at 8 am returning December 7 at 5 pm on United 99');
    expect(t.fields).toEqual({ flightNumber: 'UA88', origin: 'EWR', destination: 'SFO', date: '2026-12-03', time: '08:00' });
    expect(t.returnLeg).toEqual({ flightNumber: 'UA99', origin: 'SFO', destination: 'EWR', date: '2026-12-07', time: '17:00' });
  });

  it('the way back never borrows the outbound flight number, date or time', () => {
    const t = p('delta 5 from jfk to lax tomorrow at 9 am coming back sunday');
    expect(t.returnLeg).toEqual({ origin: 'LAX', destination: 'JFK', date: '2026-11-22' });
  });

  it('the way back has no airports when the way out is missing one', () => {
    expect(p('flying to Miami tomorrow returning sunday').returnLeg).toEqual({ date: '2026-11-22' });
  });

  it('no return is invented when none was said', () => {
    expect(p('delta 5 from jfk to lax tomorrow at 9 am').returnLeg).toBeUndefined();
  });

  it('a three-letter code that is not a real airport is not passed on', () => {
    const t = p('delta 5 from xqz to lax tomorrow');
    expect(t.fields.origin).toBeUndefined();
    expect(t.fields.destination).toBe('LAX');
    expect(t.notes).toEqual(['Departure: “XQZ” isn’t an airport code AFORCE knows. Check it and type it.']);
  });

  it('an airline named without a flight number is remembered, and no number is made up', () => {
    const t = p('flying delta to lax monday at 7 in the evening');
    expect(t.fields.flightNumber).toBeUndefined();
    expect(t.airline).toBe('DL');
    expect(p('delta 5 to lax monday').airline).toBeUndefined();
  });
});

describe('tripForForm · what today\'s form can save', () => {
  it('holds back an arrival time heard without an arrival date, and says so', () => {
    const t = tripForForm(p('delta 5 from jfk to lax tomorrow at 9 am landing at 12:30 pm'));
    expect(t.fields).toEqual({ flightNumber: 'DL5', origin: 'JFK', destination: 'LAX', date: '2026-11-20', time: '09:00' });
    expect(t.notes).toEqual(['Arrival time: heard 12:30. Add the arrival date to use it.']);
    expect(spokenTripSummary(t)).not.toContain('arrival time');
  });

  it('passes an arrival time through when its date was said', () => {
    const t = tripForForm(p('delta 5 from jfk to lax tomorrow at 11 pm landing november 21 at 2 am'));
    expect(t.fields).toMatchObject({ arrivalDate: '2026-11-21', arrivalTime: '02:00' });
    expect(t.notes).toEqual([]);
  });

  it('changes nothing for a trip with no arrival time', () => {
    const trip = p('delta 5 from jfk to lax tomorrow at 9 am');
    expect(tripForForm(trip)).toBe(trip);
  });
});

