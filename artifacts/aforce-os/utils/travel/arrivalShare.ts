/**
 * Travel Intelligence 2.0 — shareable arrival card payload (pure).
 *
 * Identity, not data. The card carries ONLY:
 *   - the city name,
 *   - the AFORCE line ("New city. Same standard."),
 *   - the atmosphere (a licensed city photo when the registry has one, else
 *     the daypart tone).
 *
 * It must never carry a date, time, flight number, origin, weather, health
 * or hydration value. A dated, located card tells strangers the member is
 * away from home; health data is never shareable here (Constitution
 * Principle 7; SS-06 private-by-default). `arrivalSharePayload` builds the
 * card from a deliberately narrow input type so those fields cannot be
 * passed in, and the payload lock test asserts the output shape.
 *
 * Nothing here shares anything: the member must tap Share and choose a
 * destination in the OS sheet.
 */
import { travelTone } from '@/theme/travelTokens';

import type { Atmosphere } from './cityRegistry';

export const ARRIVAL_SHARE_LINE = 'New city. Same standard.';
export const ARRIVAL_SHARE_EYEBROW = 'Welcome to';

/** The only inputs the card may read. */
export interface ArrivalShareInput {
  cityName: string;
  atmosphere: Atmosphere;
}

export interface ArrivalSharePayload {
  eyebrow: typeof ARRIVAL_SHARE_EYEBROW;
  cityName: string;
  line: typeof ARRIVAL_SHARE_LINE;
  /** Licensed photo URI, or null for the type-only card. */
  photoUri: string | null;
  /** Background tone for the type-only card. */
  tone: string;
  /** Text for text-only destinations. Same content as the card. */
  message: string;
}

/** City names are short display names; anything else is not a city. */
function cleanCityName(name: string): string {
  // Letters, spaces and the punctuation real city names use (St. John's,
  // Port-au-Prince). Digits and symbols are dropped, so a stray time, date or
  // flight number can never ride along on the card.
  return name
    .replace(/[^\p{L}\s'’.\-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40);
}

export function arrivalSharePayload(input: ArrivalShareInput): ArrivalSharePayload | null {
  const cityName = cleanCityName(input.cityName);
  if (!cityName) return null;
  const photo = input.atmosphere.kind === 'photo' ? input.atmosphere.photo : null;
  const daypart = input.atmosphere.daypart;
  return {
    eyebrow: ARRIVAL_SHARE_EYEBROW,
    cityName,
    line: ARRIVAL_SHARE_LINE,
    photoUri: photo?.uri ?? null,
    tone: daypart ? travelTone[daypart] : travelTone.unknown,
    message: `${ARRIVAL_SHARE_EYEBROW} ${cityName}. ${ARRIVAL_SHARE_LINE}`,
  };
}
