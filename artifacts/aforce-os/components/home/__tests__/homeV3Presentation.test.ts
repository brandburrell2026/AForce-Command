/**
 * homeV3Presentation — unit tests for the Home V3 dashboard's pure
 * presentation decisions. The honest-data contract is the point: missing
 * readings render an em dash, the chip never implies a connection that
 * doesn't exist, and "Live" is claimed only inside the freshness window.
 */
import { describe, it, expect } from 'vitest';

import {
  formatSleepHours,
  formatHrvMs,
  formatHydrationPct,
  resolveHealthChip,
  trendTile,
  LIVE_WINDOW_MS,
} from '../homeV3Presentation';

const NOW = 1_754_800_000_000;

describe('formatSleepHours', () => {
  it('formats fractional hours as Xh MMm', () => {
    expect(formatSleepHours(7.68)).toBe('7h 41m');
    expect(formatSleepHours(8)).toBe('8h 00m');
    expect(formatSleepHours(0.5)).toBe('0h 30m');
  });
  it('em-dashes missing/invalid readings — never invents a number', () => {
    expect(formatSleepHours(null)).toBe('—');
    expect(formatSleepHours(undefined)).toBe('—');
    expect(formatSleepHours(-1)).toBe('—');
    expect(formatSleepHours(Number.NaN)).toBe('—');
  });
});

describe('formatHrvMs', () => {
  it('rounds and applies the leading-space unit rule (RC-2 #586)', () => {
    expect(formatHrvMs(64.7)).toBe('65 ms');
    expect(formatHrvMs(65)).toBe('65 ms');
  });
  it('em-dashes missing/invalid readings', () => {
    expect(formatHrvMs(null)).toBe('—');
    expect(formatHrvMs(undefined)).toBe('—');
    expect(formatHrvMs(0)).toBe('—');
    expect(formatHrvMs(Number.NaN)).toBe('—');
  });
});

describe('formatHydrationPct', () => {
  it('renders clamped whole percents', () => {
    expect(formatHydrationPct(5, 8)).toBe('63%');
    expect(formatHydrationPct(8, 8)).toBe('100%');
    expect(formatHydrationPct(0, 8)).toBe('0%');
    expect(formatHydrationPct(-2, 8)).toBe('0%');
  });
  it('em-dashes when no target is set (never divides by zero)', () => {
    expect(formatHydrationPct(5, 0)).toBe('—');
    expect(formatHydrationPct(5, Number.NaN)).toBe('—');
  });
});

describe('resolveHealthChip', () => {
  it('returns null when no provider has contributed — the chip never implies a connection', () => {
    expect(resolveHealthChip({ sources: [], freshestFetchedAtMs: NOW, now: NOW })).toBeNull();
  });
  it('names Apple Health when present and claims Live only inside the window', () => {
    const live = resolveHealthChip({
      sources: ['apple_health'],
      freshestFetchedAtMs: NOW - LIVE_WINDOW_MS + 1000,
      now: NOW,
    });
    expect(live).toEqual({ label: 'Apple Health', live: true });
    const stale = resolveHealthChip({
      sources: ['apple_health'],
      freshestFetchedAtMs: NOW - LIVE_WINDOW_MS - 1000,
      now: NOW,
    });
    expect(stale).toEqual({ label: 'Apple Health', live: false });
  });
  it('never claims Live without a freshness timestamp, even with sources', () => {
    expect(resolveHealthChip({ sources: ['whoop'], freshestFetchedAtMs: null, now: NOW })).toEqual({
      label: 'WHOOP',
      live: false,
    });
  });
  it('never claims Live for a future (clock-skewed) timestamp', () => {
    expect(
      resolveHealthChip({ sources: ['apple_health'], freshestFetchedAtMs: NOW + 60_000, now: NOW }),
    ).toEqual({ label: 'Apple Health', live: false });
  });
  it('labels a single non-Apple provider by its real name and multiples by count', () => {
    expect(resolveHealthChip({ sources: ['oura'], freshestFetchedAtMs: NOW, now: NOW })).toEqual({
      label: 'Oura Ring',
      live: true,
    });
    expect(
      resolveHealthChip({ sources: ['whoop', 'oura'], freshestFetchedAtMs: NOW, now: NOW }),
    ).toEqual({ label: '2 sources', live: true });
    // apple_health wins the name whenever present, matching the comp
    expect(
      resolveHealthChip({ sources: ['whoop', 'apple_health'], freshestFetchedAtMs: NOW, now: NOW }),
    ).toEqual({ label: 'Apple Health', live: true });
  });
});

describe('trendTile', () => {
  it('maps direction to the home.v3 i18n key; only rising is positive', () => {
    expect(trendTile('rising')).toEqual({ i18nKey: 'trend_rising', positive: true });
    expect(trendTile('falling')).toEqual({ i18nKey: 'trend_falling', positive: false });
    expect(trendTile('flat')).toEqual({ i18nKey: 'trend_steady', positive: false });
  });
});
