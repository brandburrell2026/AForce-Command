/**
 * calendarOccurrence — pure helpers for telling calendar occurrences apart and
 * for noticing when a sealed plan's calendar event has moved or gone.
 *
 * No storage, no network, no device module. Inputs are the minimal event shape
 * AFORCE already reads (id, title, times, calendar id) and the opaque link a
 * sealed Moment keeps (`calendarSource {eventId, startAtIso}`).
 *
 * Recurring events (verified against expo-calendar 15.0.8 source): the event
 * `id` is the EVENT row id on Android (Instances.EVENT_ID) and the
 * `calendarItemIdentifier` on iOS, so every occurrence of one series shares
 * one `id`. An occurrence is therefore identified by id + start instant.
 *
 * Every comparison is on UTC instants, so a device time-zone change or a
 * daylight-saving boundary never changes an occurrence's identity.
 */
import type { CalendarEventLike } from '@/services/momentClassification';

/** How far an occurrence of the same event may shift and still count as "the
 * same occurrence, moved". Past this it is reported as changed, not tracked. */
export const OCCURRENCE_MOVE_WINDOW_MS = 12 * 3_600_000;

/** Earlier-today lookback of the calendar read, shared by the bridge and the
 * change detector so both agree on what was visible. */
export const CALENDAR_READ_LOOKBACK_MS = 6 * 3_600_000;

export interface CalendarReadWindow {
  startIso: string;
  endIso: string;
}

export function calendarReadWindow(nowIso: string, horizonDays: number): CalendarReadWindow {
  const now = Date.parse(nowIso);
  return {
    startIso: new Date(now - CALENDAR_READ_LOOKBACK_MS).toISOString(),
    endIso: new Date(now + horizonDays * 24 * 3_600_000).toISOString(),
  };
}

/** Normalise an instant to canonical ISO so equal instants compare equal. */
export function instantIso(value: string): string | null {
  const t = Date.parse(value);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

/** Key for one occurrence: the series id plus the start instant. */
export function occurrenceKey(eventId: string, startAtIso: string): string {
  return `${eventId}@${instantIso(startAtIso) ?? startAtIso}`;
}

/**
 * Id of the derived calendar Moment. Occurrence-specific, so two occurrences
 * of one recurring event never share an id. Epoch milliseconds keep the id
 * free of characters that need escaping in a route parameter.
 */
export function calendarMomentId(eventId: string, startAtIso: string): string {
  const t = Date.parse(startAtIso);
  return `cal-${eventId}@${Number.isFinite(t) ? t : startAtIso}`;
}

/**
 * Prepared-mark lookup. Marks written before occurrence-specific keys are
 * keyed by the bare event id; they still apply, but only when that event id
 * has a single occurrence in view, so a mark never spreads across a series.
 */
export function preparedMarkFor(
  marks: Readonly<Record<string, string>>,
  eventId: string,
  startAtIso: string,
  occurrencesInView: number,
): string | undefined {
  return marks[occurrenceKey(eventId, startAtIso)] ?? (occurrencesInView <= 1 ? marks[eventId] : undefined);
}

/**
 * Collapse the same invitation seen through more than one calendar: same
 * title (trimmed, case-insensitive) and same start instant. The first one
 * read wins. Distinct occurrences of a series have different starts, so they
 * are kept.
 */
export function dedupeCalendarEvents(events: readonly CalendarEventLike[]): CalendarEventLike[] {
  const seen = new Set<string>();
  const out: CalendarEventLike[] = [];
  for (const e of events) {
    const key = `${(e.title ?? '').trim().toLowerCase()}|${instantIso(e.startAtIso) ?? e.startAtIso}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

export interface OccurrenceRef {
  eventId: string;
  startAtIso: string;
}

export type OccurrenceMatch =
  | { kind: 'same' }
  | { kind: 'moved'; toStartAtIso: string }
  | { kind: 'gone' };

/**
 * Where is the occurrence a plan was sealed for, among what is on the
 * calendar now? Same id + same start instant is unchanged. Otherwise the
 * nearest same-id occurrence within OCCURRENCE_MOVE_WINDOW_MS is the moved
 * one. Anything else is gone from that time (cancelled, moved a long way, or
 * its calendar was switched off): the caller words it as "changed".
 */
export function matchOccurrence(
  link: OccurrenceRef,
  candidates: readonly OccurrenceRef[],
): OccurrenceMatch {
  const linkIso = instantIso(link.startAtIso);
  const linkMs = Date.parse(link.startAtIso);
  if (linkIso === null) return { kind: 'gone' };
  const sameId = candidates.filter((c) => c.eventId === link.eventId);
  if (sameId.some((c) => instantIso(c.startAtIso) === linkIso)) return { kind: 'same' };
  let best: { iso: string; gap: number } | null = null;
  for (const c of sameId) {
    const iso = instantIso(c.startAtIso);
    if (iso === null) continue;
    const gap = Math.abs(Date.parse(iso) - linkMs);
    if (gap <= OCCURRENCE_MOVE_WINDOW_MS && (!best || gap < best.gap)) best = { iso, gap };
  }
  return best ? { kind: 'moved', toStartAtIso: best.iso } : { kind: 'gone' };
}

/** What the last successful calendar read saw. Held in memory only. */
export interface CalendarSnapshot {
  events: readonly CalendarEventLike[];
  window: CalendarReadWindow;
}

export interface SealedCalendarLinkInput {
  id: string;
  source: string;
  calendarSource?: { eventId: string; startAtIso: string };
  preparation?: { sealedAtIso?: string; cancelledAtIso?: string; returnedAtIso?: string } | null;
}

export type SealedCalendarChange =
  | { kind: 'moved'; toStartAtIso: string }
  | { kind: 'gone' };

/**
 * For every sealed Moment that carries a calendar link, say whether its
 * calendar event moved or went. Pure: nothing is edited, cancelled or
 * re-sealed. A Moment is left out (no claim made) when:
 *  - there is no snapshot (not connected, access off, read failed),
 *  - the snapshot is empty (an empty read is not evidence that every event went),
 *  - the sealed start lies outside the window that was read.
 * Returned map is keyed by Moment id.
 */
export function detectSealedCalendarChanges(
  moments: readonly SealedCalendarLinkInput[],
  snapshot: CalendarSnapshot | null,
): Record<string, SealedCalendarChange> {
  const out: Record<string, SealedCalendarChange> = {};
  if (!snapshot || snapshot.events.length === 0) return out;
  const from = Date.parse(snapshot.window.startIso);
  const to = Date.parse(snapshot.window.endIso);
  const refs: OccurrenceRef[] = snapshot.events.map((e) => ({
    eventId: e.id,
    startAtIso: e.startAtIso,
  }));
  for (const m of moments) {
    const link = m.calendarSource;
    if (
      m.source !== 'manual' ||
      !link ||
      !m.preparation?.sealedAtIso ||
      m.preparation.cancelledAtIso ||
      m.preparation.returnedAtIso
    )
      continue;
    const at = Date.parse(link.startAtIso);
    if (!Number.isFinite(at) || at < from || at > to) continue;
    const match = matchOccurrence(link, refs);
    if (match.kind === 'moved') out[m.id] = { kind: 'moved', toStartAtIso: match.toStartAtIso };
    else if (match.kind === 'gone') out[m.id] = { kind: 'gone' };
  }
  return out;
}
