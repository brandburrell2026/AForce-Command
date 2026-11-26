/**
 * Hydration tab (cinematic) — the words on the screen, as pure functions.
 *
 * Reference: the "Every tab, one system." prototype's Hydration tab and
 * App Spec v1.8.2 Appendix G §3 · Hydration tab ("Keep: the ring, recent
 * intake…"). Real values only. Nothing here changes intake, the target or a
 * score, and the ring is capped at a full circle while the text always shows
 * the true total.
 */
import { homeClock } from '@/components/home/cinematic/homeCinematicLogic';

export interface HydrationHeroModel {
  /** The big number, or an em dash when nothing has been logged and there is no history. */
  amount: string;
  /** "of 96 oz starting target · logged" */
  line: string;
  ring: { progress: number; value: string; label: string };
  /** "44% of starting target" */
  percentLine: string;
  /** "Estimated from what you logged · 6:12 PM" */
  sourceLine: string;
}

export function hydrationHero(
  consumedOz: number,
  targetOz: number,
  lastLoggedAt: Date | null,
  /** False while the 96 oz figure is the same starting point for everyone (RA-N8). */
  targetIsPersonal: boolean,
): HydrationHeroModel {
  const consumed = Number.isFinite(consumedOz) ? Math.max(0, Math.round(consumedOz)) : 0;
  const target = Number.isFinite(targetOz) && targetOz > 0 ? Math.round(targetOz) : 0;
  const ratio = target > 0 ? consumed / target : 0;
  const targetWord = targetIsPersonal ? 'target' : 'starting target';
  const logged = lastLoggedAt != null && !Number.isNaN(lastLoggedAt.getTime());
  return {
    amount: String(consumed),
    line: `of ${target} oz ${targetWord} · logged`,
    // The arc stops at a full circle; the number beside it is never capped.
    ring: { progress: Math.max(0, Math.min(1, ratio)), value: `${consumed} oz`, label: `of ${target}` },
    percentLine: `${Math.round(ratio * 100)}% of ${targetWord}`,
    sourceLine: logged ? `Estimated from what you logged · ${homeClock(lastLoggedAt!)}` : 'Nothing logged yet today.',
  };
}

/** Display the newest entries without reordering the scoring engine's history. */
export function recentHydrationEvents<T extends { loggedAt: Date }>(events: readonly T[]): T[] {
  return [...events].sort((a, b) => b.loggedAt.getTime() - a.loggedAt.getTime()).slice(0, 4);
}
