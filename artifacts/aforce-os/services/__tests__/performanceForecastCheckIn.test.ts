import { describe, it, expect } from 'vitest';
import {
  derivePerformanceForecast,
  type ForecastCheckIn,
} from '../biometricIntelligence';
import type { ScoreEngineOutput, UserState } from '../../types';

const NOW = new Date(2026, 5, 19, 7, 0);

/** Minimal engine fixture — only the fields the forecast reads matter. */
function engineOf(
  score: number,
  decayPerMinute: number,
  minutesToDepleted: number | null,
  level: 'PEAK' | 'BALANCED' | 'RECOVERING' | 'DEPLETED',
): ScoreEngineOutput {
  return {
    score,
    performanceState: { level, label: level, score, color: '#000' },
    prediction: { decayPerMinute, minutesToDepleted, label: '' },
  } as unknown as ScoreEngineOutput;
}

const USER = {} as unknown as UserState;

const FIXTURES: ScoreEngineOutput[] = [
  engineOf(95, 0.0, null, 'PEAK'), // rising
  engineOf(80, 0.04, null, 'BALANCED'), // rising (decay<=0.05, score>=75)
  engineOf(70, 0.1, null, 'BALANCED'), // stable
  engineOf(50, 0.3, 120, 'RECOVERING'), // declining + deficit clock
  engineOf(30, 0.4, 45, 'DEPLETED'), // declining + deficit clock
];

describe('performanceForecast · backward compatible', () => {
  it('omitting checkIn equals passing undefined', () => {
    for (const e of FIXTURES) {
      expect(derivePerformanceForecast(e, USER, NOW)).toEqual(
        derivePerformanceForecast(e, USER, NOW, undefined),
      );
    }
  });

  it('a checkIn never changes trajectory, projection, or deficit clock (copy-only)', () => {
    const checkIns: ForecastCheckIn[] = [
      { energy: 1, stress: 1 },
      { energy: 5, stress: 5 },
      { energy: 1, stress: 5 },
      { energy: 5, stress: 1 },
      { energy: 3, stress: 3 },
    ];
    for (const e of FIXTURES) {
      const base = derivePerformanceForecast(e, USER, NOW);
      for (const ci of checkIns) {
        const withCi = derivePerformanceForecast(e, USER, NOW, ci);
        expect(withCi.trajectory).toBe(base.trajectory);
        expect(withCi.projection).toBe(base.projection);
        expect(withCi.deficitAt).toBe(base.deficitAt);
      }
    }
  });
});

describe('performanceForecast · check-in headline refinement', () => {
  it('high reported stress drives a stress-aware headline', () => {
    const stable = engineOf(70, 0.1, null, 'BALANCED');
    const r = derivePerformanceForecast(stable, USER, NOW, { energy: 3, stress: 5 });
    expect(r.headline.toLowerCase()).toContain('stress');
  });

  it('low reported energy on a non-declining trajectory leads with water', () => {
    const stable = engineOf(70, 0.1, null, 'BALANCED');
    const r = derivePerformanceForecast(stable, USER, NOW, { energy: 1, stress: 2 });
    expect(r.headline.toLowerCase()).toContain('water');
  });

  it('strong calibration on a stable trajectory reads as trending up', () => {
    const stable = engineOf(70, 0.1, null, 'BALANCED');
    const r = derivePerformanceForecast(stable, USER, NOW, { energy: 5, stress: 1 });
    expect(r.headline.toLowerCase()).toContain('trending up');
  });

  it('does not override the deficit/declining math even with a rosy check-in', () => {
    const declining = engineOf(30, 0.4, 45, 'DEPLETED');
    const base = derivePerformanceForecast(declining, USER, NOW);
    const withCi = derivePerformanceForecast(declining, USER, NOW, { energy: 5, stress: 1 });
    expect(withCi.trajectory).toBe('declining');
    expect(withCi.deficitAt).toBe(base.deficitAt);
  });
});
