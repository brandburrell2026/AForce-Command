/**
 * RC-2 Ruling A (2026-08-06) — the ADAPTER, not just the reduction, needs
 * direct coverage. Mirrors `appleHealth.stepsAdapter.test.ts`'s rationale
 * (S2): `appleHealth.sleepAggregation.test.ts` covers
 * `reduceSleepByIntervalUnion`/`selectSleepIntervals`'s pure logic. It does
 * NOT cover the boundary where a real device bug actually originates:
 * turning HealthKit's raw `HKCategorySample[]` into `SleepInterval[]` —
 * `s.sourceRevision?.source?.name`, the non-array/malformed-input branches,
 * a non-numeric `value`. A wrong optional chain or an unexpected response
 * shape here produces a wrong sleep total (or a silent empty selection)
 * with the reduction itself never seeing anything wrong.
 *
 * `mapCategorySamplesToSleepIntervals` (services/appleHealth.ts) is the
 * extracted pure function under test. Fixtures mirror the REAL
 * `CategorySample` shape from the installed
 * `@kingstinct/react-native-healthkit@14.0.2`: `{ startDate, endDate, value,
 * sourceRevision: { source: { name } } }` — the same `sourceRevision` path
 * `toDiagnosticSample` already reads for quantity samples in this file.
 */
import { describe, it, expect } from 'vitest';

import { mapCategorySamplesToSleepIntervals } from '../appleHealth';

describe('mapCategorySamplesToSleepIntervals', () => {
  it('maps a well-formed real-shape entry to a SleepInterval', () => {
    const samples = [
      {
        startDate: new Date('2026-08-05T23:00:00.000Z'),
        endDate: new Date('2026-08-05T23:30:00.000Z'),
        value: 4,
        sourceRevision: { source: { name: "Brandon's Apple Watch" } },
      },
    ];
    expect(mapCategorySamplesToSleepIntervals(samples)).toEqual([
      {
        startMs: new Date('2026-08-05T23:00:00.000Z').getTime(),
        endMs: new Date('2026-08-05T23:30:00.000Z').getTime(),
        value: 4,
        sourceName: "Brandon's Apple Watch",
      },
    ]);
  });

  it('maps multiple real-shape entries across sources and values', () => {
    const samples = [
      { startDate: new Date('2026-08-05T23:00:00.000Z'), endDate: new Date('2026-08-05T23:30:00.000Z'), value: 3, sourceRevision: { source: { name: "Brandon's Apple Watch" } } },
      { startDate: new Date('2026-08-05T23:00:00.000Z'), endDate: new Date('2026-08-06T06:30:00.000Z'), value: 1, sourceRevision: { source: { name: 'iPhone' } } },
    ];
    expect(mapCategorySamplesToSleepIntervals(samples)).toHaveLength(2);
  });

  it('non-array input (e.g. a single object, undefined, a string) yields empty, never throws', () => {
    expect(mapCategorySamplesToSleepIntervals(undefined)).toEqual([]);
    expect(mapCategorySamplesToSleepIntervals(null)).toEqual([]);
    expect(mapCategorySamplesToSleepIntervals('not an array')).toEqual([]);
    expect(mapCategorySamplesToSleepIntervals({ value: 1 })).toEqual([]);
  });

  it('empty array input yields empty array', () => {
    expect(mapCategorySamplesToSleepIntervals([])).toEqual([]);
  });

  it('an entry missing `sourceRevision` entirely falls back to sourceName "unknown"', () => {
    const samples = [
      { startDate: new Date('2026-08-05T23:00:00.000Z'), endDate: new Date('2026-08-05T23:30:00.000Z'), value: 1 },
    ];
    expect(mapCategorySamplesToSleepIntervals(samples)).toEqual([
      {
        startMs: new Date('2026-08-05T23:00:00.000Z').getTime(),
        endMs: new Date('2026-08-05T23:30:00.000Z').getTime(),
        value: 1,
        sourceName: 'unknown',
      },
    ]);
  });

  it('an entry with `sourceRevision.source.name` missing (objects present but nameless) falls back to "unknown"', () => {
    const samples = [
      {
        startDate: new Date('2026-08-05T23:00:00.000Z'),
        endDate: new Date('2026-08-05T23:30:00.000Z'),
        value: 1,
        sourceRevision: { source: {} },
      },
    ];
    expect(mapCategorySamplesToSleepIntervals(samples)[0].sourceName).toBe('unknown');
  });

  it('an entry missing `startDate` is dropped entirely (cannot form an interval without it)', () => {
    const samples = [
      { endDate: new Date('2026-08-05T23:30:00.000Z'), value: 1, sourceRevision: { source: { name: 'iPhone' } } },
      { startDate: new Date('2026-08-05T23:00:00.000Z'), endDate: new Date('2026-08-05T23:30:00.000Z'), value: 1, sourceRevision: { source: { name: 'iPhone' } } },
    ];
    expect(mapCategorySamplesToSleepIntervals(samples)).toHaveLength(1);
  });

  it('an entry missing `endDate` is dropped entirely (cannot form an interval without it)', () => {
    const samples = [
      { startDate: new Date('2026-08-05T23:00:00.000Z'), value: 1, sourceRevision: { source: { name: 'iPhone' } } },
    ];
    expect(mapCategorySamplesToSleepIntervals(samples)).toEqual([]);
  });

  it('an entry with a non-numeric `value` is dropped entirely — never defaulted to a real HealthKit value like 0 (inBed)', () => {
    const samples = [
      { startDate: new Date('2026-08-05T23:00:00.000Z'), endDate: new Date('2026-08-05T23:30:00.000Z'), value: '3', sourceRevision: { source: { name: 'iPhone' } } },
      { startDate: new Date('2026-08-05T23:00:00.000Z'), endDate: new Date('2026-08-05T23:30:00.000Z'), sourceRevision: { source: { name: 'iPhone' } } },
    ];
    expect(mapCategorySamplesToSleepIntervals(samples)).toEqual([]);
  });

  it('accepts `startDate`/`endDate` already given as ISO strings (not just Date instances)', () => {
    const samples = [
      {
        startDate: '2026-08-05T23:00:00.000Z',
        endDate: '2026-08-05T23:30:00.000Z',
        value: 4,
        sourceRevision: { source: { name: 'iPhone' } },
      },
    ];
    const result = mapCategorySamplesToSleepIntervals(samples);
    expect(result).toHaveLength(1);
    expect(result[0].startMs).toBe(new Date('2026-08-05T23:00:00.000Z').getTime());
    expect(result[0].endMs).toBe(new Date('2026-08-05T23:30:00.000Z').getTime());
  });

  it('an entry with an unparseable date string is dropped rather than propagating NaN', () => {
    const samples = [
      { startDate: 'not-a-date', endDate: '2026-08-05T23:30:00.000Z', value: 4, sourceRevision: { source: { name: 'iPhone' } } },
      { startDate: '2026-08-05T23:00:00.000Z', endDate: 'also-not-a-date', value: 4, sourceRevision: { source: { name: 'iPhone' } } },
    ];
    expect(mapCategorySamplesToSleepIntervals(samples)).toEqual([]);
  });

  it('a null entry in the array is filtered out rather than throwing on `s?.startDate`', () => {
    const samples = [
      null,
      { startDate: new Date('2026-08-05T23:00:00.000Z'), endDate: new Date('2026-08-05T23:30:00.000Z'), value: 4, sourceRevision: { source: { name: 'iPhone' } } },
    ];
    expect(mapCategorySamplesToSleepIntervals(samples)).toHaveLength(1);
  });

  it('inBed(0) and awake(2) samples are still mapped (exclusion happens at selection, not adaptation)', () => {
    const samples = [
      { startDate: new Date('2026-08-05T22:00:00.000Z'), endDate: new Date('2026-08-05T23:00:00.000Z'), value: 0, sourceRevision: { source: { name: 'iPhone' } } },
      { startDate: new Date('2026-08-06T02:00:00.000Z'), endDate: new Date('2026-08-06T02:10:00.000Z'), value: 2, sourceRevision: { source: { name: 'iPhone' } } },
    ];
    const result = mapCategorySamplesToSleepIntervals(samples);
    expect(result).toHaveLength(2);
    expect(result.map((i) => i.value)).toEqual([0, 2]);
  });
});
