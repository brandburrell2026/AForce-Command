/**
 * Travel Intelligence — City Atmosphere registry (T1, pure engine).
 *
 * The 20 featured destinations, each with its real IANA zone and centre
 * coordinates (used for destination weather). Adding a city is one entry
 * here; nothing else changes.
 *
 * Photography: every `atmospheres` map is EMPTY on purpose. No licensed city
 * photography exists yet, and the brief forbids generic or wrong skylines. A
 * photo is added only with its licence record (`CityPhoto.license`). Until a
 * city/daypart has one, the UI uses the type-only treatment — the same one an
 * unsupported city gets.
 */

import type { Daypart, TravelPlace } from './travelTypes';

export interface CityPhoto {
  /** Bundled asset key or cached URI. */
  uri: string;
  /** Licence identifier and terms reference — required, never blank. */
  license: string;
  /** Photographer / agency credit line. */
  credit: string;
}

export interface CityEntry {
  id: string;
  name: string;
  country: string;
  timezone: string;
  latitude: number;
  longitude: number;
  /** Lower-case alternate names that resolve to this city. */
  aliases: readonly string[];
  /** IATA airport codes served by this city (upper-case). */
  airports: readonly string[];
  /** Licensed photo per daypart. Empty until licensed images are supplied. */
  atmospheres: Partial<Record<Daypart, CityPhoto>>;
}

const c = (
  id: string,
  name: string,
  country: string,
  timezone: string,
  latitude: number,
  longitude: number,
  aliases: string[],
  airports: string[],
): CityEntry => ({ id, name, country, timezone, latitude, longitude, aliases, airports, atmospheres: {} });

export const CITY_REGISTRY: readonly CityEntry[] = [
  // United States
  c('new-york', 'New York', 'US', 'America/New_York', 40.7128, -74.006, ['nyc', 'new york city', 'manhattan'], ['JFK', 'LGA', 'EWR']),
  c('miami', 'Miami', 'US', 'America/New_York', 25.7617, -80.1918, ['miami beach'], ['MIA']),
  c('los-angeles', 'Los Angeles', 'US', 'America/Los_Angeles', 34.0522, -118.2437, ['la', 'l.a.'], ['LAX']),
  c('san-francisco', 'San Francisco', 'US', 'America/Los_Angeles', 37.7749, -122.4194, ['sf', 'san fran'], ['SFO']),
  c('chicago', 'Chicago', 'US', 'America/Chicago', 41.8781, -87.6298, ['chi'], ['ORD', 'MDW']),
  c('las-vegas', 'Las Vegas', 'US', 'America/Los_Angeles', 36.1699, -115.1398, ['vegas'], ['LAS']),
  c('dallas', 'Dallas', 'US', 'America/Chicago', 32.7767, -96.797, [], ['DFW', 'DAL']),
  c('atlanta', 'Atlanta', 'US', 'America/New_York', 33.749, -84.388, [], ['ATL']),
  c('phoenix', 'Phoenix', 'US', 'America/Phoenix', 33.4484, -112.074, [], ['PHX']),
  c('seattle', 'Seattle', 'US', 'America/Los_Angeles', 47.6062, -122.3321, [], ['SEA']),
  // International
  c('london', 'London', 'GB', 'Europe/London', 51.5074, -0.1278, [], ['LHR', 'LGW', 'LCY', 'STN']),
  c('paris', 'Paris', 'FR', 'Europe/Paris', 48.8566, 2.3522, [], ['CDG', 'ORY']),
  c('tokyo', 'Tokyo', 'JP', 'Asia/Tokyo', 35.6762, 139.6503, [], ['NRT', 'HND']),
  c('dubai', 'Dubai', 'AE', 'Asia/Dubai', 25.2048, 55.2708, [], ['DXB']),
  c('singapore', 'Singapore', 'SG', 'Asia/Singapore', 1.3521, 103.8198, [], ['SIN']),
  c('rome', 'Rome', 'IT', 'Europe/Rome', 41.9028, 12.4964, ['roma'], ['FCO', 'CIA']),
  c('barcelona', 'Barcelona', 'ES', 'Europe/Madrid', 41.3874, 2.1686, [], ['BCN']),
  c('toronto', 'Toronto', 'CA', 'America/Toronto', 43.6532, -79.3832, [], ['YYZ', 'YTZ']),
  c('sydney', 'Sydney', 'AU', 'Australia/Sydney', -33.8688, 151.2093, [], ['SYD']),
  c('hong-kong', 'Hong Kong', 'HK', 'Asia/Hong_Kong', 22.3193, 114.1694, ['hk'], ['HKG']),
];

/** Lower-case, accent-free, single-spaced, punctuation-light key. */
export function normalizePlaceQuery(q: string): string {
  return q
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[,()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const INDEX: ReadonlyMap<string, CityEntry> = (() => {
  const m = new Map<string, CityEntry>();
  for (const city of CITY_REGISTRY) {
    m.set(normalizePlaceQuery(city.name), city);
    m.set(city.id, city);
    for (const a of city.aliases) m.set(normalizePlaceQuery(a), city);
    for (const a of city.airports) m.set(normalizePlaceQuery(a), city);
  }
  return m;
})();

export function cityById(id: string | null | undefined): CityEntry | null {
  if (!id) return null;
  return INDEX.get(id) ?? null;
}

export type DestinationResolution =
  | { kind: 'featured'; city: CityEntry }
  | { kind: 'fallback'; name: string };

/**
 * Resolve what the member typed (or a calendar location) to a featured city.
 * Exact name/alias/IATA match, or the leading part before a comma
 * ("Paris, France"). Anything else is a fallback: the name is kept exactly as
 * given and no skyline is ever substituted.
 */
export function resolveDestination(query: string): DestinationResolution | null {
  const trimmed = query.trim();
  if (!trimmed) return null;
  const key = normalizePlaceQuery(trimmed);
  const exact = INDEX.get(key);
  if (exact) return { kind: 'featured', city: exact };
  const lead = normalizePlaceQuery(trimmed.split(',')[0] ?? '');
  const leadHit = lead ? INDEX.get(lead) : undefined;
  if (leadHit) return { kind: 'featured', city: leadHit };
  return { kind: 'fallback', name: trimmed };
}

/** A TravelPlace from a resolution. Fallback places carry no zone/coords —
 *  the data layer fills them from geocoding, or they stay unknown. */
export function placeFromResolution(r: DestinationResolution): TravelPlace {
  if (r.kind === 'featured') {
    return {
      cityId: r.city.id,
      name: r.city.name,
      timezone: r.city.timezone,
      latitude: r.city.latitude,
      longitude: r.city.longitude,
    };
  }
  return { cityId: null, name: r.name, timezone: null, latitude: null, longitude: null };
}

export type Atmosphere =
  | { kind: 'photo'; cityId: string; daypart: Daypart; photo: CityPhoto }
  | { kind: 'type_only'; name: string; daypart: Daypart | null };

/**
 * The background for a place at a daypart: a licensed photo when the
 * registry has one, otherwise the type-only treatment. Never another city's
 * photo, never another daypart's photo for a featured city.
 */
export function atmosphereFor(place: TravelPlace, daypart: Daypart | null): Atmosphere {
  const city = cityById(place.cityId);
  const photo = city && daypart ? city.atmospheres[daypart] : undefined;
  if (city && daypart && photo && photo.license.trim()) {
    return { kind: 'photo', cityId: city.id, daypart, photo };
  }
  return { kind: 'type_only', name: place.name, daypart };
}

/** The featured city serving an IATA airport code, or null. */
export function cityForAirport(iata: string | null | undefined): CityEntry | null {
  if (!iata) return null;
  const code = iata.trim().toUpperCase();
  return CITY_REGISTRY.find((city) => city.airports.includes(code)) ?? null;
}

/**
 * Display place for an existing flight leg's airport. Uses the leg's own,
 * member-confirmed time zone (never the registry's) so the plan stays the
 * source of truth. An airport outside the registry keeps its code as the
 * name and gets the type-only treatment.
 */
export function placeForAirport(iata: string, legTimeZone: string): TravelPlace {
  const city = cityForAirport(iata);
  return {
    cityId: city?.id ?? null,
    name: city?.name ?? iata.trim().toUpperCase(),
    timezone: legTimeZone,
    latitude: city?.latitude ?? null,
    longitude: city?.longitude ?? null,
  };
}
