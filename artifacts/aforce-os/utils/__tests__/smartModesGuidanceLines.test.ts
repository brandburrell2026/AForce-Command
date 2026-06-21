import { describe, it, expect } from 'vitest';

import {
  deriveActiveModes,
  selectModeGuidanceLines,
  type SmartModeContext,
} from '../modes/smartModes';

const ctx = (over: Partial<SmartModeContext> = {}): SmartModeContext => ({
  heatIndexC: null,
  workoutMinutesToday: 0,
  hydrationScore: 80,
  goalProgress: 0.5,
  isTravelDay: false,
  ...over,
});

describe('selectModeGuidanceLines', () => {
  it('returns nothing when no modes are active', () => {
    expect(selectModeGuidanceLines([])).toEqual([]);
  });

  it('returns only the primary mode when travel is not active', () => {
    const { active } = deriveActiveModes(ctx({ heatIndexC: 35 }));
    expect(selectModeGuidanceLines(active).map((m) => m.id)).toEqual(['heat']);
  });

  it('guarantees the travel line even when a higher-priority mode is primary', () => {
    const { active } = deriveActiveModes(ctx({ heatIndexC: 35, isTravelDay: true }));
    // Heat outranks travel, so travel is demoted to a chip in the header —
    // but its Travel Protocol guidance line must still surface.
    expect(active[0].id).toBe('heat');
    expect(selectModeGuidanceLines(active).map((m) => m.id)).toEqual(['heat', 'travel']);
  });

  it('does not duplicate travel when travel is already the primary mode', () => {
    const { active } = deriveActiveModes(ctx({ isTravelDay: true }));
    expect(active[0].id).toBe('travel');
    expect(selectModeGuidanceLines(active).map((m) => m.id)).toEqual(['travel']);
  });
});
