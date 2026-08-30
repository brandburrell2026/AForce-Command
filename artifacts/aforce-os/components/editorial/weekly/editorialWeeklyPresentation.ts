/**
 * editorialWeeklyPresentation — furniture for WEEKLY REPORT, The Feature (E5).
 *
 * Deliberately thin. Every NUMBER on the Feature comes from `buildWeeklyV3Model`
 * and `performanceAgeBarAxis` — the resolvers the live V3 dashboard already
 * uses, reused rather than re-authored, so the honest-data rules they encode
 * stay enforced on paper too. This module adds no metric, no derivation and no
 * threshold; it formats masthead furniture and nothing else.
 *
 * FOUNDER DECISION D2 (2026-08-30): the Feature's period furniture is the REAL
 * date range of the reported window. Not a week number — none is persisted
 * anywhere and deriving one would be new furniture — and never an issue number,
 * which E2's Ruling R1 bans outright.
 */

/** Uppercase is a print convention, applied here because the editorial layer
 *  bans `textTransform` in components (a CSS transform is invisible to the
 *  string a screen reader receives). Scripts without case are unaffected. */
function shortDayUpper(iso: string, locale?: string): string | null {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  try {
    return new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    })
      .format(new Date(ms))
      .toLocaleUpperCase(locale);
  } catch {
    return null;
  }
}

/**
 * The reported window as editorial period furniture — "AUG 2 – AUG 8".
 *
 * Returns `null` when either boundary is unparseable: the masthead then renders
 * nothing rather than a fabricated or half-formed period. Absence is allowed on
 * this layer; invention is not.
 */
export function featureDateRange(
  weekStartISO: string,
  weekEndISO: string,
  locale?: string,
): string | null {
  const start = shortDayUpper(weekStartISO, locale);
  const end = shortDayUpper(weekEndISO, locale);
  if (!start || !end) return null;
  return `${start} – ${end}`;
}
