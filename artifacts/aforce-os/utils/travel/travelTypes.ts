/**
 * Travel Intelligence — shared types (T1, pure engine).
 *
 * Trips and legs are NOT defined here: they are the existing, governed
 * `TravelTrip` / `TravelLeg` from @workspace/api-zod (PR-TRAVEL-INTELLIGENCE).
 * This module only adds what Travel Intelligence 2.0 layers on top — where a
 * value came from, the travel state, dayparts and display places.
 *
 * Provenance is mandatory. Every value the UI shows carries a source so the
 * screen can say "live", "forecast", "you entered" and so on. A value that is
 * not available is `null` with source 'unavailable' — never a guess and never
 * a mock dressed up as live data.
 */

/** Where a displayed value came from. */
export type Provenance =
  | 'live' // fetched now from a provider (e.g. Open-Meteo current conditions)
  | 'forecast' // provider forecast for a future time
  | 'member' // the member typed it
  | 'calendar' // read from a selected calendar event
  | 'health' // read from Apple Health with permission
  | 'computed' // math on the values above (time difference, countdown)
  | 'guidance' // an existing AFORCE rule from config, not a measurement
  | 'unavailable'; // not known — shown as a dash

export interface Sourced<T> {
  value: T | null;
  source: Provenance;
  /** Provider observation instant (epoch ms) when the source supplies one. */
  observedAtMs?: number;
}

export function unavailable<T>(): Sourced<T> {
  return { value: null, source: 'unavailable' };
}

/** A place on a trip. `cityId` is set only when it matched the registry. */
export interface TravelPlace {
  /** Registry id (e.g. 'miami') or null for an unsupported city. */
  cityId: string | null;
  /** Display name, exactly as resolved or as the member typed it. */
  name: string;
  /** IANA time zone, or null when unknown. */
  timezone: string | null;
  latitude: number | null;
  longitude: number | null;
}

/** Travel state shown on screen. 'none' = the trip is not surfaced now. */
export type TravelState =
  | 'none'
  | 'preparing'
  | 'in_transit'
  | 'arriving'
  | 'acclimating'
  | 'ready';

export type Daypart = 'morning' | 'day' | 'sunset' | 'night';
