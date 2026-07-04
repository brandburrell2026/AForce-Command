import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  deriveResponseTimeline,
  personalDataDurationDays,
  isResponseTimelineReady,
} from '../intelligence/responseTimeline';
import type { CommandEvent } from '../intelligence/commandEvents';
import {
  RESPONSE_TIMELINE_WINDOW_MS,
  RESPONSE_TIMELINE_BUCKET_MS,
  RESPONSE_TIMELINE_MIN_DATA_DAYS,
} from '../../config/hydroStateModel';

const NOW = 1_700_000_000_000;
const DAY = 24 * 60 * 60 * 1000;

function conf(id: string, ageDays: number, followed: boolean, commandType?: string): CommandEvent {
  return {
    id,
    kind: 'command_confirmation',
    occurredAtMs: NOW - ageDays * DAY,
    localDayIndex: Math.floor((NOW - ageDays * DAY) / DAY),
    source: 'test',
    followed,
    delta: 999, // present on purpose — the timeline must ignore it (Score-Protection)
    ...(commandType !== undefined ? { commandType } : {}),
  };
}

describe('Section 60 — personalDataDurationDays', () => {
  it('is 0 on an empty ledger (no fabrication)', () => {
    expect(personalDataDurationDays([], NOW)).toBe(0);
  });
  it('measures whole days from the earliest event', () => {
    const events = [conf('a', 65, true, 'hydration_maintain'), conf('b', 3, true, 'hydration_maintain')];
    expect(personalDataDurationDays(events, NOW)).toBe(65);
  });
  it('is 0 when the earliest event is in the future', () => {
    const future: CommandEvent = { ...conf('f', 0, true, 'hydration_maintain'), occurredAtMs: NOW + DAY };
    expect(personalDataDurationDays([future], NOW)).toBe(0);
  });
});

describe('Section 60 — isResponseTimelineReady (data-maturity gate)', () => {
  it('is false below the threshold and true at/above it', () => {
    const young = [conf('y', RESPONSE_TIMELINE_MIN_DATA_DAYS - 5, true, 'hydration_maintain')];
    const mature = [conf('m', RESPONSE_TIMELINE_MIN_DATA_DAYS + 5, true, 'hydration_maintain')];
    expect(isResponseTimelineReady(young, NOW)).toBe(false);
    expect(isResponseTimelineReady(mature, NOW)).toBe(true);
  });
});

describe('Section 60 — deriveResponseTimeline', () => {
  it('produces contiguous, newest-first buckets spanning the window', () => {
    const buckets = deriveResponseTimeline([], NOW);
    expect(buckets.length).toBe(Math.ceil(RESPONSE_TIMELINE_WINDOW_MS / RESPONSE_TIMELINE_BUCKET_MS));
    expect(buckets[0].endMs).toBe(NOW);
    expect(buckets[0].startMs).toBeLessThan(buckets[0].endMs);
    // Every bucket empty on an empty ledger.
    for (const b of buckets) expect(Object.keys(b.perCategory)).toHaveLength(0);
  });

  it('buckets confirmations by age and tallies per category', () => {
    const events = [
      conf('h1', 2, true, 'hydration_maintain'), // week 0
      conf('h2', 3, false, 'hydration_maintain'), // week 0
      conf('r1', 10, true, 'recovery_reset'), // week 1
    ];
    const buckets = deriveResponseTimeline(events, NOW);
    expect(buckets[0].perCategory.hydration).toEqual({ sampleSize: 2, followed: 1, followedRate: 0.5 });
    expect(buckets[1].perCategory.recovery).toEqual({ sampleSize: 1, followed: 1, followedRate: 1 });
    // No recovery in week 0, no hydration in week 1.
    expect(buckets[0].perCategory.recovery).toBeUndefined();
    expect(buckets[1].perCategory.hydration).toBeUndefined();
  });

  it('ignores unknown command types and events outside the window', () => {
    const events = [
      conf('u', 2, true, 'not_a_category'),
      conf('n', 2, true), // no commandType
      conf('old', 200, true, 'hydration_maintain'), // beyond the 90-day window
    ];
    const buckets = deriveResponseTimeline(events, NOW);
    for (const b of buckets) expect(Object.keys(b.perCategory)).toHaveLength(0);
  });
});

describe('Section 60 — Score-Protection structural invariant', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(resolve(here, '..', 'intelligence', 'responseTimeline.ts'), 'utf8');

  it('imports nothing that could couple it to score', () => {
    const re = /(?:import|export)[^'"]*?from\s+['"]([^'"]+)['"]/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src)) !== null) {
      expect(m[1], `forbidden import ${m[1]}`).not.toMatch(
        /react-native|(^|\/)store(\/|$)|scoringEngine|statusColor|reducer/i,
      );
    }
  });

  it('never reads a confirmation delta', () => {
    expect(src).not.toMatch(/\.delta\b/);
  });
});
