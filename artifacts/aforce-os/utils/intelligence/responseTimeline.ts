/**
 * Section 60 — Response Timeline™ (Phase 2 query layer over Decision Memory).
 *
 * A pure QUERY over the append-only Command-Event Ledger — the same canonical
 * record Section 59 reads. It projects the user's response activity into
 * time-ordered buckets (per Section-59 category) so a later surface can show how
 * responses evolved over weeks. It builds NO new data store and adds NO capture.
 *
 * Data-maturity gate (spec Section 60 / build rule #7): the timeline is only
 * meaningful once the user has enough personal history. `isResponseTimelineReady`
 * reports whether that threshold is met; a consumer surfaces the timeline only
 * when the feature flag is ON *and* this returns true.
 *
 * HARD LOCKS (mirror the rest of Decision Memory):
 *  - Pure + RN-free (type-only imports) so it runs under the vitest pure runner.
 *  - Score-Protection: reads recorded confirmations only — `delta` is never read,
 *    and it never reads into / awards / mutates / fabricates score.
 *  - No fabrication: empty history → zero duration and empty buckets; an
 *    unattributable command type is ignored, never bucketed.
 */
import { eventsInWindow, type CommandEvent } from './commandEvents';
import { responseCategoryForCommandType } from './adaptiveResponseEngine';
import {
  RESPONSE_TIMELINE_WINDOW_MS,
  RESPONSE_TIMELINE_BUCKET_MS,
  RESPONSE_TIMELINE_MIN_DATA_DAYS,
} from '../../config/hydroStateModel';
import type { ResponseCategory } from '../../types/adaptiveResponse';

const DAY_MS = 24 * 60 * 60 * 1000;

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/** Per-category response activity within one time bucket. */
export interface ResponseTimelineCell {
  sampleSize: number;
  followed: number;
  followedRate: number;
}

/** One time bucket of the Response Timeline (window `[startMs, endMs)`). */
export interface ResponseTimelineBucket {
  startMs: number;
  endMs: number;
  /** Categories with ≥1 confirmation in this bucket; others omitted (no fabrication). */
  perCategory: Partial<Record<ResponseCategory, ResponseTimelineCell>>;
}

/**
 * Whole days of personal history in the ledger: `(now − earliest event) / day`,
 * floored. 0 when there is no event, or when the earliest event is in the future
 * (no fabrication). `now` is injected for testability.
 */
export function personalDataDurationDays(
  events: readonly CommandEvent[],
  now: number = Date.now(),
): number {
  if (!isFiniteNumber(now)) return 0;
  let earliest = Infinity;
  for (const e of events) {
    if (isFiniteNumber(e.occurredAtMs) && e.occurredAtMs > 0 && e.occurredAtMs < earliest) {
      earliest = e.occurredAtMs;
    }
  }
  if (!Number.isFinite(earliest) || earliest > now) return 0;
  return Math.floor((now - earliest) / DAY_MS);
}

/**
 * Whether enough personal history exists for the Response Timeline to be shown
 * (spec Section 60: ~60–90 days). Defaults to the config threshold.
 */
export function isResponseTimelineReady(
  events: readonly CommandEvent[],
  now: number = Date.now(),
  minDays: number = RESPONSE_TIMELINE_MIN_DATA_DAYS,
): boolean {
  return personalDataDurationDays(events, now) >= minDays;
}

/**
 * Build the Response Timeline: newest-first buckets over the trailing window,
 * each holding per-category confirmation activity. Reads command_confirmation
 * events only; `delta` is never read (Score-Protection). Buckets are contiguous
 * across the window — a bucket with no activity is present with an empty map.
 *
 * `buckets[0]` is the most recent. `now`/`windowMs`/`bucketMs` are injected for
 * testability; invalid window/bucket fall back to the config defaults.
 */
export function deriveResponseTimeline(
  events: readonly CommandEvent[],
  now: number = Date.now(),
  windowMs: number = RESPONSE_TIMELINE_WINDOW_MS,
  bucketMs: number = RESPONSE_TIMELINE_BUCKET_MS,
): ResponseTimelineBucket[] {
  if (!isFiniteNumber(now)) return [];
  const span = isFiniteNumber(windowMs) && windowMs > 0 ? windowMs : RESPONSE_TIMELINE_WINDOW_MS;
  const bucket = isFiniteNumber(bucketMs) && bucketMs > 0 ? bucketMs : RESPONSE_TIMELINE_BUCKET_MS;
  const windowStart = now - span;

  const numBuckets = Math.ceil(span / bucket);
  const buckets: ResponseTimelineBucket[] = [];
  for (let i = 0; i < numBuckets; i++) {
    const end = now - i * bucket;
    const start = Math.max(windowStart, now - (i + 1) * bucket);
    buckets.push({ startMs: start, endMs: end, perCategory: {} });
  }

  for (const e of eventsInWindow(events, windowStart, now)) {
    if (e.kind !== 'command_confirmation') continue;
    const category = responseCategoryForCommandType(e.commandType);
    if (category === null) continue;
    // Bucket by age from `now`; clamp the exact windowStart edge into the oldest.
    let idx = Math.floor((now - e.occurredAtMs) / bucket);
    if (idx < 0) idx = 0;
    if (idx >= numBuckets) idx = numBuckets - 1;
    const b = buckets[idx];
    const cell = b.perCategory[category] ?? { sampleSize: 0, followed: 0, followedRate: 0 };
    cell.sampleSize += 1;
    if (e.followed) cell.followed += 1;
    b.perCategory[category] = cell;
  }

  for (const b of buckets) {
    for (const cat of Object.keys(b.perCategory) as ResponseCategory[]) {
      const cell = b.perCategory[cat]!;
      cell.followedRate = cell.sampleSize > 0 ? cell.followed / cell.sampleSize : 0;
    }
  }

  return buckets;
}
