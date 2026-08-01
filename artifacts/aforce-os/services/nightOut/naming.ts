/**
 * AForce Night Out Protocol — canonical public naming (NO-b).
 *
 * Single source of truth for the public-facing names, so screens never hardcode
 * "Social Mode" again. "Social Mode" survives ONLY as a documented internal
 * legacy alias for stored data / routes / deep links / analytics compatibility
 * (see `NIGHT_OUT_LEGACY_ALIAS` in `./sessionState.ts`); it must never render
 * on a user-facing surface (governance NO-1).
 */

/** Public screen title. */
export const NIGHT_OUT_PUBLIC_NAME = 'NIGHT OUT' as const;
/** Official product/system name. */
export const NIGHT_OUT_OFFICIAL_NAME = 'AForce Night Out Protocol' as const;
/** Public descriptor. */
export const NIGHT_OUT_DESCRIPTOR = 'Private Evening Protocol' as const;
/** Small eyebrow above the title (from the approved concept hierarchy). */
export const NIGHT_OUT_EYEBROW = 'AFORCE PROTOCOL' as const;

/** Retired public term — must not appear on any user-facing surface. */
export const RETIRED_PUBLIC_TERMS = ['Social Mode', 'SOCIAL MODE', 'Night Owl'] as const;
