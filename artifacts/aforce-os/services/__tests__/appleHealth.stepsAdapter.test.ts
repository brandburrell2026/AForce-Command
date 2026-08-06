/**
 * RC-2 independent-verdict review (S2) — the ADAPTER, not just the
 * reduction, needs direct coverage.
 *
 * `appleHealth.stepsAggregation.test.ts` covers `reduceStepsByBucketMax`'s
 * pure bucket-math (6 fixtures). It does NOT cover the boundary where a
 * real device bug actually originates: turning HealthKit's raw per-source
 * statistics-collection response into `StepsSourceBucket[]` —
 * `entry.sumQuantity?.quantity ?? 0`, `entry.source?.name`, the
 * non-array/malformed-input branches. A wrong optional chain or an
 * unexpected response shape here produces a wrong number (or the B1.3
 * silent-zero) with the reduction itself never seeing anything wrong.
 *
 * `mapStatsToBuckets` (services/appleHealth.ts) is the extracted pure
 * function under test. Fixtures below mirror the REAL
 * `QueryStatisticsResponseFromSingleSource` shape from the installed
 * `@kingstinct/react-native-healthkit@14.0.2`
 * (`src/types/QuantityType.ts`): `{ source: { name }, sumQuantity: { unit,
 * quantity }, startDate, ... }`.
 */
import { describe, it, expect } from 'vitest';

import { mapStatsToBuckets } from '../appleHealth';

describe('mapStatsToBuckets', () => {
  it('maps a well-formed real-shape entry to a StepsSourceBucket', () => {
    const entries = [
      {
        source: { name: 'iPhone' },
        sumQuantity: { unit: 'count', quantity: 420 },
        startDate: new Date('2026-08-05T09:00:00.000Z'),
        endDate: new Date('2026-08-05T10:00:00.000Z'),
      },
    ];
    expect(mapStatsToBuckets(entries)).toEqual([
      { sourceName: 'iPhone', startDate: '2026-08-05T09:00:00.000Z', quantity: 420 },
    ]);
  });

  it('maps multiple real-shape entries across sources and hours', () => {
    const entries = [
      {
        source: { name: 'iPhone' },
        sumQuantity: { unit: 'count', quantity: 400 },
        startDate: new Date('2026-08-05T09:00:00.000Z'),
      },
      {
        source: { name: "Brandon's Apple Watch" },
        sumQuantity: { unit: 'count', quantity: 420 },
        startDate: new Date('2026-08-05T09:00:00.000Z'),
      },
    ];
    expect(mapStatsToBuckets(entries)).toEqual([
      { sourceName: 'iPhone', startDate: '2026-08-05T09:00:00.000Z', quantity: 400 },
      { sourceName: "Brandon's Apple Watch", startDate: '2026-08-05T09:00:00.000Z', quantity: 420 },
    ]);
  });

  it('non-array input (e.g. a single object, undefined, a string) yields empty, never throws', () => {
    expect(mapStatsToBuckets(undefined)).toEqual([]);
    expect(mapStatsToBuckets(null)).toEqual([]);
    expect(mapStatsToBuckets('not an array')).toEqual([]);
    expect(mapStatsToBuckets({ source: { name: 'iPhone' } })).toEqual([]);
  });

  it('empty array input yields empty array', () => {
    expect(mapStatsToBuckets([])).toEqual([]);
  });

  it('an entry missing `source` entirely falls back to sourceName "unknown"', () => {
    const entries = [
      {
        sumQuantity: { unit: 'count', quantity: 300 },
        startDate: new Date('2026-08-05T09:00:00.000Z'),
      },
    ];
    expect(mapStatsToBuckets(entries)).toEqual([
      { sourceName: 'unknown', startDate: '2026-08-05T09:00:00.000Z', quantity: 300 },
    ]);
  });

  it('an entry with `source.name` missing (source object present but nameless) falls back to "unknown"', () => {
    const entries = [
      {
        source: {},
        sumQuantity: { unit: 'count', quantity: 150 },
        startDate: new Date('2026-08-05T09:00:00.000Z'),
      },
    ];
    expect(mapStatsToBuckets(entries)).toEqual([
      { sourceName: 'unknown', startDate: '2026-08-05T09:00:00.000Z', quantity: 150 },
    ]);
  });

  it('an entry missing `sumQuantity` entirely defaults quantity to 0, not undefined/NaN', () => {
    const entries = [
      {
        source: { name: 'iPhone' },
        startDate: new Date('2026-08-05T09:00:00.000Z'),
      },
    ];
    expect(mapStatsToBuckets(entries)).toEqual([
      { sourceName: 'iPhone', startDate: '2026-08-05T09:00:00.000Z', quantity: 0 },
    ]);
  });

  it('an entry with `sumQuantity.quantity` missing (unit present, no reading) defaults to 0', () => {
    const entries = [
      {
        source: { name: 'iPhone' },
        sumQuantity: { unit: 'count' },
        startDate: new Date('2026-08-05T09:00:00.000Z'),
      },
    ];
    expect(mapStatsToBuckets(entries)).toEqual([
      { sourceName: 'iPhone', startDate: '2026-08-05T09:00:00.000Z', quantity: 0 },
    ]);
  });

  it('an entry missing `startDate` is dropped entirely (cannot be bucketed without a key)', () => {
    const entries = [
      { source: { name: 'iPhone' }, sumQuantity: { unit: 'count', quantity: 400 } },
      {
        source: { name: "Brandon's Apple Watch" },
        sumQuantity: { unit: 'count', quantity: 200 },
        startDate: new Date('2026-08-05T09:00:00.000Z'),
      },
    ];
    expect(mapStatsToBuckets(entries)).toEqual([
      { sourceName: "Brandon's Apple Watch", startDate: '2026-08-05T09:00:00.000Z', quantity: 200 },
    ]);
  });

  it('accepts a `startDate` already given as an ISO string (not just a Date instance)', () => {
    const entries = [
      {
        source: { name: 'iPhone' },
        sumQuantity: { unit: 'count', quantity: 100 },
        startDate: '2026-08-05T09:00:00.000Z',
      },
    ];
    expect(mapStatsToBuckets(entries)).toEqual([
      { sourceName: 'iPhone', startDate: '2026-08-05T09:00:00.000Z', quantity: 100 },
    ]);
  });

  it('a null entry in the array is filtered out rather than throwing on `entry?.startDate`', () => {
    const entries = [
      null,
      {
        source: { name: 'iPhone' },
        sumQuantity: { unit: 'count', quantity: 100 },
        startDate: new Date('2026-08-05T09:00:00.000Z'),
      },
    ];
    expect(mapStatsToBuckets(entries)).toEqual([
      { sourceName: 'iPhone', startDate: '2026-08-05T09:00:00.000Z', quantity: 100 },
    ]);
  });
});
