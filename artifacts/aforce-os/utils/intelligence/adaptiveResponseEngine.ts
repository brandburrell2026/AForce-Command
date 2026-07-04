/**
 * Section 59 — Adaptive Response Engine™ (extends Decision Memory, STEP 1).
 *
 * Reads the append-only Command-Event Ledger — the SAME canonical record the
 * rest of Decision Memory reads — and derives, per response category, a Personal
 * Response Library entry: What Worked (the user's own follow-through linked to
 * their own energy) and Confidence After Action (which grows only with real
 * observations). It builds NO parallel data store (brief build rule #6) and adds
 * NO new capture stream — categories whose live ledger source is not wired yet
 * stay 'insufficient' rather than fabricate a response.
 *
 * HARD LOCKS (mirror commandAdaptiveLearning):
 *  - Score-Protection: reads recorded confirmations only; never reads into,
 *    awards, mutates, or fabricates score. A confirmation's `delta` is
 *    deliberately ignored — only followed/total and self-reported energy count.
 *  - No fabrication: a category needs ADAPTIVE_RESPONSE_MIN_SAMPLES in-window
 *    before it is 'ready'; below that it stays 'insufficient' with null payloads
 *    and MUST have no downstream effect. An outcome we cannot ground in the
 *    user's own energy is 'unknown', never invented.
 *  - Pure + RN-free (type-only imports) so it runs under the vitest pure runner.
 *
 * Language: this module emits STRUCTURED data only. Any copy rendered from it is
 * governed by responseLanguage.ts (cause-and-effect only).
 */
import { eventsInWindow, type CommandEvent } from './commandEvents';
import { isCommandCategory, type CommandCategory } from './commandCategory';
import {
  ADAPTIVE_RESPONSE_WINDOW_MS,
  ADAPTIVE_RESPONSE_MIN_SAMPLES,
  ADAPTIVE_RESPONSE_CONFIDENCE_FULL_SAMPLES,
  ADAPTIVE_RESPONSE_OUTCOME_ENERGY_DELTA,
} from '../../config/hydroStateModel';
import {
  RESPONSE_CATEGORIES,
  type ResponseCategory,
  type ResponseOutcome,
  type AdaptiveResponseProfile,
  type PersonalResponseEntry,
} from '../../types/adaptiveResponse';

/**
 * Which Section-59 category a followed AForce command belongs to. Only the
 * categories the Command-Event Ledger can attribute today are mapped; the
 * remaining response categories (heat, sleep, caffeine, alcohol, travel, cramp,
 * recovery_speed, performance_consistency) have no live ledger source yet and so
 * stay 'insufficient' — their sources wire in as separate, approved steps.
 */
const COMMAND_CATEGORY_TO_RESPONSE: Record<CommandCategory, ResponseCategory> = {
  hydration_urgent: 'hydration',
  hydration_maintain: 'hydration',
  morning_reset: 'hydration',
  recovery_reset: 'recovery',
  performance_activation: 'training',
};

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/** A fresh, empty (insufficient) entry for a category. */
function emptyEntry(category: ResponseCategory): PersonalResponseEntry {
  return { category, status: 'insufficient', sampleSize: 0, whatWorked: null, confidenceAfterAction: null };
}

/** Mean self-reported energy across the given day buckets, or null when none. */
function meanEnergyForDays(
  dayEnergy: Map<number, { sum: number; count: number }>,
  days: ReadonlySet<number>,
  include: boolean,
): number | null {
  let sum = 0;
  let count = 0;
  for (const [day, agg] of dayEnergy) {
    if (days.has(day) === include) {
      sum += agg.sum;
      count += agg.count;
    }
  }
  return count > 0 ? sum / count : null;
}

/**
 * Cause-and-effect outcome for a category: compare the user's mean energy on
 * days they FOLLOWED a command of that category against days they did not. A
 * genuine delta (≥ threshold) reads as improved/declined; otherwise steady;
 * 'unknown' when either side lacks a self-report (no fabrication).
 */
function deriveOutcome(
  actionDays: ReadonlySet<number>,
  dayEnergy: Map<number, { sum: number; count: number }>,
): ResponseOutcome {
  if (actionDays.size === 0) return 'unknown';
  const onAction = meanEnergyForDays(dayEnergy, actionDays, true);
  const offAction = meanEnergyForDays(dayEnergy, actionDays, false);
  if (onAction === null || offAction === null) return 'unknown';
  const delta = onAction - offAction;
  if (delta >= ADAPTIVE_RESPONSE_OUTCOME_ENERGY_DELTA) return 'improved';
  if (delta <= -ADAPTIVE_RESPONSE_OUTCOME_ENERGY_DELTA) return 'declined';
  return 'steady';
}

/**
 * Derive the full Personal Response Library from the ledger. Every category is
 * always present (Build 100% · Show 10%); only those with enough real signal are
 * 'ready'.
 *
 * @param events   full ledger (any kinds; only confirmations + check-ins read)
 * @param now      evaluation clock (ms epoch)
 * @param windowMs rolling window; defaults to 30 days, clamped to > 0
 */
export function deriveAdaptiveResponseProfile(
  events: readonly CommandEvent[],
  now: number = Date.now(),
  windowMs: number = ADAPTIVE_RESPONSE_WINDOW_MS,
): AdaptiveResponseProfile {
  const profile = Object.fromEntries(
    RESPONSE_CATEGORIES.map((c) => [c, emptyEntry(c)]),
  ) as AdaptiveResponseProfile;
  if (!isFiniteNumber(now)) return profile;

  const span =
    isFiniteNumber(windowMs) && windowMs > 0 ? windowMs : ADAPTIVE_RESPONSE_WINDOW_MS;
  const inWindow = eventsInWindow(events, now - span, now);

  // Self-reported energy per day, for the cause-and-effect outcome linkage.
  const dayEnergy = new Map<number, { sum: number; count: number }>();
  // Per-category tallies + the days a command of that category was followed.
  const followedDays = new Map<ResponseCategory, Set<number>>();
  const followedCount = new Map<ResponseCategory, number>();

  for (const e of inWindow) {
    if (e.kind === 'voice_checkin') {
      if (!isFiniteNumber(e.energy)) continue;
      const agg = dayEnergy.get(e.localDayIndex) ?? { sum: 0, count: 0 };
      agg.sum += e.energy;
      agg.count += 1;
      dayEnergy.set(e.localDayIndex, agg);
      continue;
    }
    if (e.kind !== 'command_confirmation') continue;
    // Unknown / missing commandType cannot be attributed → ignored (no fabrication).
    if (!isCommandCategory(e.commandType)) continue;
    const category = COMMAND_CATEGORY_TO_RESPONSE[e.commandType];
    const entry = profile[category];
    entry.sampleSize += 1;
    if (e.followed) {
      const days = followedDays.get(category) ?? new Set<number>();
      days.add(e.localDayIndex);
      followedDays.set(category, days);
      followedCount.set(category, (followedCount.get(category) ?? 0) + 1);
    }
  }

  // Finalize: only sample-gated categories expose a rate, outcome, and confidence.
  for (const category of RESPONSE_CATEGORIES) {
    const entry = profile[category];
    const followed = followedCount.get(category) ?? 0;
    if (entry.sampleSize >= ADAPTIVE_RESPONSE_MIN_SAMPLES) {
      const outcome = deriveOutcome(followedDays.get(category) ?? new Set(), dayEnergy);
      entry.status = 'ready';
      entry.whatWorked = {
        sampleSize: entry.sampleSize,
        followed,
        followedRate: followed / entry.sampleSize,
        outcome,
      };
      entry.confidenceAfterAction = Math.min(
        1,
        entry.sampleSize / ADAPTIVE_RESPONSE_CONFIDENCE_FULL_SAMPLES,
      );
    }
  }

  return profile;
}

/** Convenience accessor: one category's entry (always defined). */
export function personalResponse(
  profile: AdaptiveResponseProfile,
  category: ResponseCategory,
): PersonalResponseEntry {
  return profile[category];
}
