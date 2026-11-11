/**
 * Travel Intelligence 2.0 — atmosphere tones.
 *
 * The type-only city atmosphere (used until licensed city photography
 * exists) is a dark daypart tone behind the city name. Every tone keeps
 * af.textPrimary (#F7F4EF) above 12:1 and af.textSecondary above 6:1, so the
 * atmosphere can never cost legibility. Pure data; no react-native import.
 */
import type { Daypart } from '@/utils/travel/travelTypes';

export const travelTone: Record<Daypart, string> & { unknown: string } = {
  morning: '#1E242A', // cool slate — calm, early light
  day: '#222A31', // clear architectural daylight, kept dark for text
  sunset: '#2E1C12', // warm, restrained glow
  night: '#0B0C10', // deep black — also the quiet LOCK-IN field
  unknown: '#121313', // af.surface — no zone, no daypart
};
