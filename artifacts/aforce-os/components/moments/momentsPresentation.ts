/**
 * momentsPresentation — pure display decisions for AForce Moments
 * (Phases 1–2, founder approval 2026-08-12). Deterministic: callers pass
 * `nowIso`; no store reads, no I/O. All product logic lives in
 * services/momentRecommendation.ts — this module only decides how a
 * recommendation RENDERS (accents, countdown copy pieces, window posture,
 * list rows), mirroring the V3-screen presentation-module pattern.
 */

import type { Moment, MomentRecommendation, MomentType } from '@/types/moments';
import { af } from '@/theme';

/** Category accent — feature tints per founder comp; never statusColor.ts. */
export function accentForType(type: MomentType): string {
  switch (type) {
    case 'training':
      return af.amber;
    case 'travel':
      return af.travel;
    case 'recovery':
    case 'personal':
      return af.textTertiary;
    case 'work':
    case 'performance':
    default:
      return af.green;
  }
}

export type MomentWindowPosture =
  | 'completed' // moment start has passed
  | 'active' // now inside the prep window (or between window end and start)
  | 'upcoming'; // before the prep window opens

export function windowPosture(
  rec: MomentRecommendation,
  momentStartIso: string,
  nowIso: string,
): MomentWindowPosture {
  const nowMs = Date.parse(nowIso);
  if (nowMs >= Date.parse(momentStartIso)) return 'completed';
  if (nowMs >= Date.parse(rec.prepWindowStartIso)) return 'active';
  return 'upcoming';
}

/** "Starts in" pieces: {hours, minutes} — component renders "4h 7m" / "22 min". */
export function startsIn(momentStartIso: string, nowIso: string): { hours: number; minutes: number } | null {
  const diffMin = Math.round((Date.parse(momentStartIso) - Date.parse(nowIso)) / 60_000);
  if (!Number.isFinite(diffMin) || diffMin <= 0) return null;
  return { hours: Math.floor(diffMin / 60), minutes: diffMin % 60 };
}

/** Locale-free clock label (e.g. "2:00 PM") — device-locale via Intl. */
export function clockLabel(isoTime: string): string {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(
    new Date(isoTime),
  );
}

export function prepWindowLabel(rec: MomentRecommendation): string {
  return `${clockLabel(rec.prepWindowStartIso)} – ${clockLabel(rec.prepWindowEndIso)}`;
}

/** PRIVATE EVENT masking — components pass t('moments.private_event'). */
export function displayTitle(moment: Moment, privateLabel: string): string {
  return moment.masked ? privateLabel : moment.title;
}

export interface MomentListRowView {
  momentId: string;
  time: string;
  title: string;
  /** i18n-ready status pieces the component assembles. */
  posture: MomentWindowPosture;
  prepWindow: string;
  accent: string;
  type: MomentType;
  prepared: boolean;
}

export function buildListRow(
  moment: Moment,
  rec: MomentRecommendation,
  nowIso: string,
): MomentListRowView {
  return {
    momentId: moment.id,
    time: clockLabel(moment.startAtIso),
    title: moment.title, // masked handled by callers via displayTitle
    posture: windowPosture(rec, moment.startAtIso, nowIso),
    prepWindow: prepWindowLabel(rec),
    accent: accentForType(moment.type),
    type: moment.type,
    prepared: Boolean(moment.preparedAtIso),
  };
}

/** Prepare-My-Day summary: total vs prep-worthy (high/moderate importance). */
export function daySummary(moments: readonly Moment[]): { total: number; prepWorthy: number } {
  return {
    total: moments.length,
    prepWorthy: moments.filter((m) => m.importance !== 'low').length,
  };
}
