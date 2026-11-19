/**
 * Home's two Moment cards — the words on them, as pure functions.
 *
 * Reference: the approved prototype's Home shows a "Before the Moment" card
 * ahead of a sealed Moment and a "Return" card after one. Both appear only
 * when they apply; most of the time there is nothing under the panel.
 *
 * Only what the app really knows is said. The Before card reports the seal
 * and the next reviewed step. It does not claim that nothing changed since
 * the seal, because nothing in the app checks that. The Return card appears
 * only after the member has recorded that they are back.
 */
import type { Moment } from '@/types/moments';
import { homeClock, isMomentSealed } from './homeCinematicLogic';

/** A sealed Moment gets its Before card this long ahead of its start. */
export const HOME_BEFORE_WINDOW_MS = 12 * 3_600_000;
/** A finished Moment keeps its Return card this long after the member is back. */
export const HOME_RETURN_WINDOW_MS = 24 * 3_600_000;

export interface HomeMomentCardModel {
  kind: 'before' | 'return';
  momentId: string;
  eyebrow: string;
  title: string;
  note: string;
  action: string;
}

function name(m: Moment, privateLabel: string): string {
  return m.masked ? privateLabel : m.title;
}

/** The soonest sealed Moment that starts within the window and is not yet locked in. */
export function homeBeforeCard(moments: readonly Moment[], now: Date, privateLabel: string): HomeMomentCardModel | null {
  const nowMs = now.getTime();
  const m = [...moments]
    .filter((x) => {
      const p = x.preparation;
      const start = Date.parse(x.startAtIso);
      return (
        isMomentSealed(x) &&
        !p!.lockedInAtIso &&
        !p!.returnedAtIso &&
        Number.isFinite(start) &&
        start > nowMs &&
        start - nowMs <= HOME_BEFORE_WINDOW_MS
      );
    })
    .sort((a, b) => Date.parse(a.startAtIso) - Date.parse(b.startAtIso))[0];
  if (!m) return null;
  const p = m.preparation!;
  const sealed = new Date(p.sealedAtIso);
  const nextStep = [...p.steps]
    .filter((s) => Date.parse(s.atIso) > nowMs)
    .sort((a, b) => Date.parse(a.atIso) - Date.parse(b.atIso))[0];
  const sealedLine = Number.isNaN(sealed.getTime()) ? 'Sealed.' : `Sealed ${homeClock(sealed)}.`;
  return {
    kind: 'before',
    momentId: m.id,
    eyebrow: `Before ${name(m, privateLabel)} · ${homeClock(new Date(m.startAtIso))}`,
    title: 'Your preparation is set.',
    note: nextStep
      ? `${sealedLine} Next: ${nextStep.action} · ${homeClock(new Date(nextStep.atIso))}`
      : sealedLine,
    action: 'Open',
  };
}

/** The most recent Moment the member is back from, with its replay not yet answered. */
export function homeReturnCard(
  moments: readonly Moment[],
  now: Date,
  privateLabel: string,
  skippedIds: ReadonlySet<string> = new Set(),
): HomeMomentCardModel | null {
  const nowMs = now.getTime();
  const m = [...moments]
    .filter((x) => {
      const p = x.preparation;
      if (!p || !p.returnedAtIso || p.cancelledAtIso || p.replay != null || skippedIds.has(x.id)) return false;
      const back = Date.parse(p.returnedAtIso);
      return Number.isFinite(back) && back <= nowMs && nowMs - back <= HOME_RETURN_WINDOW_MS;
    })
    .sort((a, b) => Date.parse(b.preparation!.returnedAtIso!) - Date.parse(a.preparation!.returnedAtIso!))[0];
  if (!m) return null;
  return {
    kind: 'return',
    momentId: m.id,
    eyebrow: 'Return',
    title: `Back from ${name(m, privateLabel)}`,
    note: `Made it back ${homeClock(new Date(m.preparation!.returnedAtIso!))}`,
    action: 'Replay · 1 question',
  };
}
