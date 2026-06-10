import { describe, it, expect } from 'vitest';
import {
  deriveRitualSteps,
  deriveTodaysProtocol,
  deriveAthleteMode,
  hydrationPercent,
  readinessLabel,
  ATHLETE_MILESTONE_TIERS,
  type HydrationInputs,
} from '../homeDashboard';

function inputs(over: Partial<HydrationInputs> = {}): HydrationInputs {
  return {
    unitsConsumedToday: 0,
    dailyTarget: 8,
    performanceLevel: 'BALANCED',
    ...over,
  };
}

describe('deriveRitualSteps', () => {
  it('returns the four ritual steps in order', () => {
    const ids = deriveRitualSteps(inputs()).map((s) => s.id);
    expect(ids).toEqual(['pause', 'hydrate', 'lock_in', 'perform']);
  });

  it('lights up nothing and marks PAUSE active on a fresh day', () => {
    const steps = deriveRitualSteps(inputs());
    expect(steps.every((s) => !s.complete)).toBe(true);
    expect(steps.find((s) => s.active)?.id).toBe('pause');
  });

  it('does not pre-illuminate PAUSE until the first intake is logged', () => {
    // PAUSE no longer keys off the persistent urineSignal field (which
    // carries a non-zero server default), so a fresh day with zero intake
    // never lights it up. It illuminates only from real intake.
    const fresh = deriveRitualSteps(inputs());
    expect(fresh.find((s) => s.id === 'pause')?.complete).toBe(false);

    const afterSip = deriveRitualSteps(inputs({ unitsConsumedToday: 0.5 }));
    expect(afterSip.find((s) => s.id === 'pause')?.complete).toBe(true);
    expect(afterSip.find((s) => s.id === 'hydrate')?.complete).toBe(false);
    expect(afterSip.find((s) => s.active)?.id).toBe('hydrate');
  });

  it('completes HYDRATE + PAUSE after the first intake', () => {
    const steps = deriveRitualSteps(inputs({ unitsConsumedToday: 1 }));
    expect(steps.find((s) => s.id === 'pause')?.complete).toBe(true);
    expect(steps.find((s) => s.id === 'hydrate')?.complete).toBe(true);
    expect(steps.find((s) => s.id === 'lock_in')?.complete).toBe(false);
    expect(steps.find((s) => s.active)?.id).toBe('lock_in');
  });

  it('completes LOCK IN at halfway to target', () => {
    const steps = deriveRitualSteps(inputs({ unitsConsumedToday: 4, dailyTarget: 8 }));
    expect(steps.find((s) => s.id === 'lock_in')?.complete).toBe(true);
  });

  it('only completes PERFORM at target AND a ready engine band', () => {
    const atTargetDepleted = deriveRitualSteps(
      inputs({ unitsConsumedToday: 8, dailyTarget: 8, performanceLevel: 'DEPLETED' }),
    );
    expect(atTargetDepleted.find((s) => s.id === 'perform')?.complete).toBe(false);

    const atTargetPeak = deriveRitualSteps(
      inputs({ unitsConsumedToday: 8, dailyTarget: 8, performanceLevel: 'PEAK' }),
    );
    expect(atTargetPeak.find((s) => s.id === 'perform')?.complete).toBe(true);
    expect(atTargetPeak.some((s) => s.active)).toBe(false);
  });

  it('never pre-illuminates a later step before an earlier one', () => {
    // halfway reached but engine not ready: lock_in done, perform not.
    const steps = deriveRitualSteps(
      inputs({ unitsConsumedToday: 4, dailyTarget: 8, performanceLevel: 'RECOVERING' }),
    );
    expect(steps.find((s) => s.id === 'perform')?.complete).toBe(false);
  });

  it('treats negative inputs as zero', () => {
    const steps = deriveRitualSteps(inputs({ unitsConsumedToday: -5 }));
    expect(steps.every((s) => !s.complete)).toBe(true);
  });
});

describe('deriveTodaysProtocol', () => {
  it('returns morning / midday / evening blocks with product labels', () => {
    const blocks = deriveTodaysProtocol({ unitsConsumedToday: 0, dailyTarget: 8 });
    expect(blocks.map((b) => b.id)).toEqual(['morning', 'midday', 'evening']);
    expect(blocks.map((b) => b.label)).toEqual([
      'Hydration Stick',
      'AForce Can',
      'Recovery Protocol',
    ]);
  });

  it('completes blocks as intake progresses toward target', () => {
    expect(
      deriveTodaysProtocol({ unitsConsumedToday: 0, dailyTarget: 8 }).map((b) => b.complete),
    ).toEqual([false, false, false]);
    expect(
      deriveTodaysProtocol({ unitsConsumedToday: 1, dailyTarget: 8 }).map((b) => b.complete),
    ).toEqual([true, false, false]);
    expect(
      deriveTodaysProtocol({ unitsConsumedToday: 4, dailyTarget: 8 }).map((b) => b.complete),
    ).toEqual([true, true, false]);
    expect(
      deriveTodaysProtocol({ unitsConsumedToday: 8, dailyTarget: 8 }).map((b) => b.complete),
    ).toEqual([true, true, true]);
  });

  it('guards a zero / invalid target without dividing by zero', () => {
    const blocks = deriveTodaysProtocol({ unitsConsumedToday: 1, dailyTarget: 0 });
    expect(blocks.every((b) => b.complete)).toBe(true);
  });
});

describe('deriveAthleteMode', () => {
  it('chases the first tier from a zero streak', () => {
    const m = deriveAthleteMode(0);
    expect(m.milestoneDays).toBe(7);
    expect(m.progress).toBe(0);
    expect(m.daysRemaining).toBe(7);
    expect(m.achievedTop).toBe(false);
  });

  it('reports partial progress toward the active tier', () => {
    const m = deriveAthleteMode(4);
    expect(m.milestoneDays).toBe(7);
    expect(m.daysRemaining).toBe(3);
    expect(m.progress).toBeCloseTo(4 / 7);
  });

  it('rolls to the next tier once a tier is reached', () => {
    const m = deriveAthleteMode(7);
    expect(m.milestoneDays).toBe(14);
    expect(m.daysRemaining).toBe(7);
  });

  it('flags the top tier as achieved', () => {
    const m = deriveAthleteMode(120);
    expect(m.achievedTop).toBe(true);
    expect(m.progress).toBe(1);
    expect(m.daysRemaining).toBe(0);
    expect(m.milestoneDays).toBe(ATHLETE_MILESTONE_TIERS[ATHLETE_MILESTONE_TIERS.length - 1]);
  });

  it('floors negative streaks to zero', () => {
    const m = deriveAthleteMode(-3);
    expect(m.streakDays).toBe(0);
    expect(m.milestoneDays).toBe(7);
  });
});

describe('hydrationPercent', () => {
  it('computes an integer percent of target', () => {
    expect(hydrationPercent(0, 8)).toBe(0);
    expect(hydrationPercent(4, 8)).toBe(50);
    expect(hydrationPercent(8, 8)).toBe(100);
  });

  it('caps at 100 when over target', () => {
    expect(hydrationPercent(20, 8)).toBe(100);
  });

  it('handles invalid target safely', () => {
    expect(hydrationPercent(1, 0)).toBe(100);
    expect(hydrationPercent(0, 0)).toBe(0);
  });
});

describe('readinessLabel', () => {
  it('maps each engine band to a caption', () => {
    expect(readinessLabel('PEAK')).toBe('READY TO PERFORM');
    expect(readinessLabel('BALANCED')).toBe('HOLDING STEADY');
    expect(readinessLabel('RECOVERING')).toBe('RECOVER & REBUILD');
    expect(readinessLabel('DEPLETED')).toBe('REHYDRATE NOW');
  });
});
