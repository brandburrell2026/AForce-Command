import { describe, it, expect } from 'vitest';

import {
  deriveLocationAdjustedHydrationTarget,
  locationCanAdjustTarget,
} from '../location/locationHydrationTarget';

/** Default: enabled, 8-serving / 12-oz-per-serving target, zero adder. */
const input = (over: Partial<Parameters<typeof deriveLocationAdjustedHydrationTarget>[0]> = {}) => ({
  baseTargetUnits: 8,
  ozPerUnit: 12,
  environmentalAdderOz: 0,
  locationEnabled: true,
  ...over,
});

describe('deriveLocationAdjustedHydrationTarget', () => {
  it('flag OFF is a byte-identical no-op even with a positive adder', () => {
    const r = deriveLocationAdjustedHydrationTarget(
      input({ locationEnabled: false, environmentalAdderOz: 14 }),
    );
    expect(r.adjustedTargetUnits).toBe(8);
    expect(r.baseTargetUnits).toBe(8);
    expect(r.addedUnits).toBe(0);
    expect(r.addedOz).toBe(0);
    expect(r.hasAdjustment).toBe(false);
  });

  it('flag ON with a capped adder raises the target by whole servings', () => {
    // 12 oz / 12 oz-per-serving = +1 serving
    const r = deriveLocationAdjustedHydrationTarget(input({ environmentalAdderOz: 12 }));
    expect(r.baseTargetUnits).toBe(8);
    expect(r.adjustedTargetUnits).toBe(9);
    expect(r.addedUnits).toBe(1);
    expect(r.addedOz).toBe(12);
    expect(r.hasAdjustment).toBe(true);
  });

  it('rounds oz→servings to the nearest serving', () => {
    // 14 / 12 = 1.17 → 1 serving
    expect(
      deriveLocationAdjustedHydrationTarget(input({ environmentalAdderOz: 14 })).addedUnits,
    ).toBe(1);
    // 18 / 12 = 1.5 → 2 servings
    expect(
      deriveLocationAdjustedHydrationTarget(input({ environmentalAdderOz: 18 })).addedUnits,
    ).toBe(2);
  });

  it('treats a sub-serving adder (rounds to 0) as no adjustment', () => {
    // 5 / 12 = 0.42 → 0 servings → displayed target must not move
    const r = deriveLocationAdjustedHydrationTarget(input({ environmentalAdderOz: 5 }));
    expect(r.adjustedTargetUnits).toBe(8);
    expect(r.hasAdjustment).toBe(false);
    expect(r.addedUnits).toBe(0);
  });

  it('zero or negative adder is a no-op', () => {
    expect(
      deriveLocationAdjustedHydrationTarget(input({ environmentalAdderOz: 0 })).hasAdjustment,
    ).toBe(false);
    expect(
      deriveLocationAdjustedHydrationTarget(input({ environmentalAdderOz: -7 })).hasAdjustment,
    ).toBe(false);
  });

  it('fails closed on an unusable oz-per-serving ratio', () => {
    expect(
      deriveLocationAdjustedHydrationTarget(
        input({ ozPerUnit: 0, environmentalAdderOz: 12 }),
      ).hasAdjustment,
    ).toBe(false);
    expect(
      deriveLocationAdjustedHydrationTarget(
        input({ ozPerUnit: Number.NaN, environmentalAdderOz: 12 }),
      ).hasAdjustment,
    ).toBe(false);
  });

  it('sanitizes a junk base target to a sane minimum', () => {
    const r = deriveLocationAdjustedHydrationTarget(
      input({ baseTargetUnits: 0, environmentalAdderOz: 12 }),
    );
    expect(r.baseTargetUnits).toBe(1);
    expect(r.adjustedTargetUnits).toBe(2);
  });
});

describe('locationCanAdjustTarget (no-fabrication gate)', () => {
  it('allows adjustment only for a live reading with the flag on', () => {
    expect(locationCanAdjustTarget(true, 'live')).toBe(true);
  });

  it('never lets a MOCK snapshot move the target', () => {
    expect(locationCanAdjustTarget(true, 'mock')).toBe(false);
  });

  it('never adjusts when not yet loaded / disabled (null source)', () => {
    expect(locationCanAdjustTarget(true, null)).toBe(false);
  });

  it('never adjusts when the flag is off, even with a live source', () => {
    expect(locationCanAdjustTarget(false, 'live')).toBe(false);
  });

  it('proves mock source cannot inflate the target end-to-end', () => {
    const mockGated = deriveLocationAdjustedHydrationTarget({
      baseTargetUnits: 8,
      ozPerUnit: 12,
      environmentalAdderOz: 14, // capped mock adder
      locationEnabled: locationCanAdjustTarget(true, 'mock'),
    });
    expect(mockGated.adjustedTargetUnits).toBe(8);
    expect(mockGated.hasAdjustment).toBe(false);
  });
});
