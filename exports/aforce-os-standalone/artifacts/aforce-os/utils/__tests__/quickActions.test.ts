import { describe, expect, it } from 'vitest';

import {
  deriveQuickActions,
  type RecentIntake,
} from '../logging/quickActions';

function ev(overrides: Partial<RecentIntake> = {}): RecentIntake {
  return {
    fluidType: 'water',
    oz: 12,
    flavor: null,
    loggedAt: 1_000,
    ...overrides,
  };
}

describe('deriveQuickActions', () => {
  it('always offers Log water + Complete Cycle even with no history', () => {
    const actions = deriveQuickActions({ recentEvents: [] });
    expect(actions.map((a) => a.id)).toEqual(['log_water', 'complete_cycle']);
    const water = actions[0];
    expect(water.fluidType).toBe('water');
    expect(water.ozOverride).toBe(12);
    expect(water.detail).toBe('+12 oz Water');
    const cycle = actions[1];
    expect(cycle.fluidType).toBe('aforce_stick');
  });

  it('prepends Repeat Last when there is prior intake', () => {
    const actions = deriveQuickActions({
      recentEvents: [ev({ fluidType: 'water', oz: 24, loggedAt: 5_000 })],
    });
    expect(actions.map((a) => a.id)).toEqual([
      'repeat_last',
      'log_water',
      'complete_cycle',
    ]);
    const repeat = actions[0];
    expect(repeat.fluidType).toBe('water');
    expect(repeat.ozOverride).toBe(24);
    expect(repeat.detail).toBe('+24 oz Water');
    expect(repeat.flavorLabel).toBeUndefined();
  });

  it('repeats the genuinely most recent intake, not array order', () => {
    const actions = deriveQuickActions({
      recentEvents: [
        ev({ fluidType: 'water', oz: 8, loggedAt: 1_000 }),
        ev({ fluidType: 'aforce_stick', oz: 16, loggedAt: 9_000 }),
        ev({ fluidType: 'water', oz: 12, loggedAt: 4_000 }),
      ],
    });
    const repeat = actions[0];
    expect(repeat.id).toBe('repeat_last');
    expect(repeat.fluidType).toBe('aforce_stick');
    expect(repeat.ozOverride).toBe(16);
  });

  it('carries the flavor label when repeating a flavored AForce intake', () => {
    const actions = deriveQuickActions({
      recentEvents: [
        ev({ fluidType: 'aforce_stick', oz: 16, flavor: 'berry', loggedAt: 2 }),
      ],
    });
    const repeat = actions[0];
    expect(repeat.flavorLabel).toBe('Berry');
    expect(repeat.detail).toBe('AForce Stick — Berry');
  });

  it('treats unflavored intake as having no flavor label', () => {
    const actions = deriveQuickActions({
      recentEvents: [
        ev({ fluidType: 'aforce_stick', oz: 16, flavor: 'unflavored' }),
      ],
    });
    expect(actions[0].flavorLabel).toBeUndefined();
  });

  it('honors a custom default water serving', () => {
    const actions = deriveQuickActions({
      recentEvents: [],
      defaultWaterOz: 20,
    });
    const water = actions.find((a) => a.id === 'log_water')!;
    expect(water.ozOverride).toBe(20);
    expect(water.label).toBe('LOG 20 OZ');
    expect(water.detail).toBe('+20 oz Water');
  });

  it('ignores intake with a non-finite timestamp', () => {
    const actions = deriveQuickActions({
      recentEvents: [ev({ loggedAt: Number.NaN })],
    });
    expect(actions.map((a) => a.id)).toEqual(['log_water', 'complete_cycle']);
  });
});
