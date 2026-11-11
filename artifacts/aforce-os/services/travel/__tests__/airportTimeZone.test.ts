import { describe, it, expect } from 'vitest';
import { resolveDepartureZone } from '../airportTimeZone';

describe('departure airport local time', () => {
  it('resolves the pilot flight without asking for an offset', () => {
    expect(resolveDepartureZone('lga', '2026-10-29', '07:05')).toEqual({ timeZone: 'America/New_York', utcOffset: '-04:00', error: null });
  });
  it('uses the travel date, including DST and fractional-hour zones', () => {
    expect(resolveDepartureZone('JFK', '2026-11-01', '14:30').utcOffset).toBe('-05:00');
    expect(resolveDepartureZone('LHR', '2026-07-01', '12:00').utcOffset).toBe('+01:00');
    expect(resolveDepartureZone('DEL', '2026-10-29', '07:05').utcOffset).toBe('+05:30');
    expect(resolveDepartureZone('KTM', '2026-10-29', '07:05').utcOffset).toBe('+05:45');
    expect(resolveDepartureZone('SYD', '2026-10-29', '07:05').utcOffset).toBe('+11:00');
  });
  it('never guesses an unknown airport or an ambiguous/nonexistent wall time', () => {
    expect(resolveDepartureZone('ZZZ', '2026-10-29', '07:05').utcOffset).toBeNull();
    expect(resolveDepartureZone('JFK', '2026-11-01', '01:30').error).toContain('occurs twice');
    expect(resolveDepartureZone('JFK', '2026-03-08', '02:30').error).toContain('does not exist');
    expect(resolveDepartureZone('JFK', '2026-02-30', '12:00').utcOffset).toBeNull();
  });
});
