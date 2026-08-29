/**
 * Editorial Moments — pure presentation logic (E3, founder ruling
 * 2026-08-29). Kept free of react-native imports so the law lock can
 * exercise it directly.
 */
import type { MomentWindowPosture } from '@/components/moments/momentsPresentation';

/**
 * Node-spine state for a row. The Moments posture vocabulary is exactly
 * `completed | active | upcoming` — this is a 1:1 rename into the spine's
 * own node vocabulary, NOT a new state system. There is deliberately no
 * "clear"/committed node: no such canonical posture exists, so the spec
 * prototype's CLEAR row (and its Lock-In blue) is not implementable under
 * the R2 ruling and is not implemented.
 */
export function spineStateFor(posture: MomentWindowPosture): 'done' | 'live' | 'next' {
  switch (posture) {
    case 'completed':
      return 'done';
    case 'active':
      return 'live';
    case 'upcoming':
      return 'next';
    default: {
      const exhaustive: never = posture;
      throw new Error(`unknown moment posture: ${String(exhaustive)}`);
    }
  }
}

/**
 * Chapter furniture for the ritual ("01"…"04"). Presentation only: derived
 * from the stage's INDEX in the charter-locked `rec.ritual` array, never
 * from stage state, so the numbering can never imply progress the ritual
 * has not made.
 */
export function chapterNumber(index: number): string {
  return String(Math.max(0, Math.trunc(index)) + 1).padStart(2, '0');
}

/**
 * The return idiom. Truthful, locale-formatted date furniture — the same
 * shape the Home masthead carries, and deliberately NOT an issue reference
 * (R1). Pure function of the date handed in.
 */
export function returnLabel(now: Date, locale?: string): string {
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(now);
  const month = new Intl.DateTimeFormat(locale, { month: 'short' }).format(now);
  return `${weekday} · ${month} ${now.getDate()}`.toUpperCase();
}
