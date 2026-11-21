/**
 * Airport names for "Tell AFORCE your trip": a short, exact list. Nothing is
 * matched loosely and nothing points at a code the app does not know.
 */
import { describe, it, expect } from 'vitest';
import airportTimeZones from '@/data/airportTimeZones.json';
import { AIRPORT_NAME_ENTRIES, airportNameKey, airportsNamed } from '../travel/airportNames';
import { CITY_REGISTRY } from '../travel/cityRegistry';
import { parseSpokenTrip } from '../travel/spokenTrip';

const zones = airportTimeZones as Record<string, string>;
const NOW = new Date(2026, 10, 19, 10, 0);
const p = (s: string) => parseSpokenTrip(s, NOW);

describe('airport names', () => {
  it('every code on the list is an airport the app already knows', () => {
    const unknown = AIRPORT_NAME_ENTRIES.flatMap((e) => e.codes).filter((code) => !zones[code]);
    expect([...new Set(unknown)]).toEqual([]);
  });

  it('a spot check of names against the time zone each airport is in', () => {
    const zone = (name: string) => zones[airportsNamed(name)!.codes[0]!];
    expect(zone('Newark')).toBe('America/New_York');
    expect(zone('Boston')).toBe('America/New_York');
    expect(zone('Denver')).toBe('America/Denver');
    expect(zone('Honolulu')).toBe('Pacific/Honolulu');
    expect(zone('Heathrow')).toBe('Europe/London');
    expect(zone('Charles de Gaulle')).toBe('Europe/Paris');
    expect(zone('Amsterdam')).toBe('Europe/Amsterdam');
    expect(zone('Narita')).toBe('Asia/Tokyo');
    expect(zone('Mexico City')).toBe('America/Mexico_City');
    expect(zone('Johannesburg')).toBe('Africa/Johannesburg');
  });

  it('a name means one airport only when one is plainly meant', () => {
    expect(airportsNamed('Newark')).toEqual({ codes: ['EWR'], name: 'newark' });
    expect(airportsNamed("O'Hare")?.codes).toEqual(['ORD']);
    expect(airportsNamed('LaGuardia Airport')?.codes).toEqual(['LGA']);
    expect(airportsNamed('Boston Logan International Airport')?.codes).toEqual(['BOS']);
    expect(airportsNamed('St. Louis')?.codes).toEqual(['STL']);
    expect(airportsNamed('Fort-Lauderdale')?.codes).toEqual(['FLL']);
  });

  it('a shared or multi-airport name gives every airport and picks none', () => {
    expect(airportsNamed('Houston')).toEqual({ codes: ['IAH', 'HOU'], name: 'Houston' });
    expect(airportsNamed('Portland')?.codes).toEqual(['PDX', 'PWM']);
    expect(airportsNamed('San Jose')?.codes).toEqual(['SJC', 'SJO']);
    expect(airportsNamed('São Paulo')?.codes).toEqual(['GRU', 'CGH']);
  });

  it('nothing is matched loosely', () => {
    for (const said of ['bost', 'new', 'port', 'springfield', 'the airport', '', 'houston texas area']) expect(airportsNamed(said), said).toBeNull();
  });

  it('does not take over a featured city, which keeps its own airports', () => {
    for (const city of CITY_REGISTRY) {
      for (const name of [city.name, ...city.aliases]) expect(airportsNamed(name), name).toBeNull();
    }
  });

  it('keys ignore case, punctuation, accents and the words "airport" and "international"', () => {
    expect(airportNameKey("  O'HARE International Airport ")).toBe('ohare');
    expect(airportNameKey('Bogotá')).toBe('bogota');
  });
});

describe('the trip parser with airport names', () => {
  it('fills the sentences that failed before', () => {
    expect(p('United 88 from Newark to San Francisco December 3 at 8 am').fields).toEqual({ flightNumber: 'UA88', origin: 'EWR', destination: 'SFO', date: '2026-12-03', time: '08:00' });
    expect(p('jetblue 12 from boston to miami tomorrow at 7:15 am').fields).toEqual({ flightNumber: 'B612', origin: 'BOS', destination: 'MIA', date: '2026-11-20', time: '07:15' });
    expect(p('delta 40 from atlanta to heathrow friday at 6 pm').fields).toMatchObject({ origin: 'ATL', destination: 'LHR' });
    expect(p('flying to fort lauderdale saturday').fields).toEqual({ destination: 'FLL', date: '2026-11-21' });
  });

  it('asks which airport when a name has several, for either end', () => {
    const t = p('united 5 from houston to washington tomorrow at 9 am');
    expect(t.fields).toEqual({ flightNumber: 'UA5', date: '2026-11-20', time: '09:00' });
    expect(t.notes).toEqual(['Departure: Houston has IAH, HOU. Type the one you mean.', 'Arrival: Washington has DCA, IAD. Type the one you mean.']);
  });

  it('a named airport inside a multi-airport city is taken as said', () => {
    expect(p('from laguardia to dulles tomorrow').fields).toMatchObject({ origin: 'LGA', destination: 'IAD' });
    expect(p('from new york to dulles tomorrow').fields.origin).toBeUndefined();
  });

  it('an unlisted place is still left blank with the same note', () => {
    expect(p('from springfield to lax tomorrow').notes).toEqual(['Departure: “springfield” isn’t an airport AFORCE knows by name. Type its three-letter code.']);
  });
});
