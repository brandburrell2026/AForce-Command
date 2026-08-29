/**
 * Editorial Home — pure presentation logic (E2, founder ruling 2026-08-29).
 *
 * Everything here is a pure function of its arguments so the law lock
 * (components/__tests__/editorialHomeLaw.test.ts) can pin the rulings:
 * the pressure field consumes the canonical score alone; unknown identity
 * renders nothing; masthead furniture is a truthful date, never an issue
 * number.
 */

/**
 * Pressure-field intensity — presentation of the ALREADY-canonical
 * HydroState. Pure and monotone: pressure rises exactly as the state falls.
 * Consumes the clamped engine score and nothing else — no derivation, no
 * memory, no second calculation. An unknown reading returns null and the
 * field is not rendered at all (an unlit instrument, not a dimmed guess).
 */
export function pressureIntensity(score: number | null | undefined): number | null {
  if (score === null || score === undefined || Number.isNaN(score)) return null;
  const clamped = Math.max(0, Math.min(100, score));
  return (100 - clamped) / 100;
}

/**
 * R3 — member furniture. A known first name passes through untouched; an
 * unknown identity renders NOTHING. No fallback word is ever fabricated.
 */
export function memberFurniture(firstName: string | null | undefined): string | null {
  if (typeof firstName !== 'string') return null;
  const trimmed = firstName.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * R1 — truthful date furniture ("SAT · AUG 29"). A pure function of the
 * provided date; no counter, no issue numbering, no synthetic sequence.
 */
export function mastheadDateLabel(now: Date, locale?: string): string {
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(now);
  const month = new Intl.DateTimeFormat(locale, { month: 'short' }).format(now);
  return `${weekday} · ${month} ${now.getDate()}`.toUpperCase();
}
