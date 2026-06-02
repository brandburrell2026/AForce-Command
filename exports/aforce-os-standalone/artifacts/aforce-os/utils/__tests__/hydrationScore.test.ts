import { describe, expect, it } from 'vitest';

import {
  calculateAForceBoost,
  calculateConfidence,
  calculateDailyHydrationProgressBoost,
  calculateDailyWaterTarget,
  calculateHydrationCycleBoost,
  calculateNegativeRiskPenalty,
  calculateRecentWaterBoost,
  generateHydrationCommand,
  generateSignals,
  getHydrationScore,
  getRecheckMinutes,
  getRiskLevel,
  getStatusColor,
  getStatusFromScore,
  shouldActivatePressureMode,
  STATUS_COLOR_TOKEN,
  type HydrationScoreInputs,
  type UserProfile,
} from '../hydrationScore';

const PROFILE: UserProfile = {
  gender:        'male',
  heightInches:  70,
  weightLbs:     180,
  age:           30,
  activityLevel: 'moderate',
};

function inputs(overrides: Partial<HydrationScoreInputs> = {}): HydrationScoreInputs {
  return { profile: PROFILE, ...overrides };
}

describe('getStatusFromScore', () => {
  it('maps every band boundary correctly', () => {
    expect(getStatusFromScore(100)).toBe('OPTIMAL');
    expect(getStatusFromScore(85)).toBe('OPTIMAL');
    expect(getStatusFromScore(84)).toBe('STABLE');
    expect(getStatusFromScore(70)).toBe('STABLE');
    expect(getStatusFromScore(69)).toBe('DECLINING');
    expect(getStatusFromScore(50)).toBe('DECLINING');
    expect(getStatusFromScore(49)).toBe('RISK');
    expect(getStatusFromScore(30)).toBe('RISK');
    expect(getStatusFromScore(29)).toBe('CRITICAL');
    expect(getStatusFromScore(0)).toBe('CRITICAL');
  });

  it('clamps out-of-range scores', () => {
    expect(getStatusFromScore(150)).toBe('OPTIMAL');
    expect(getStatusFromScore(-10)).toBe('CRITICAL');
  });
});

describe('getRiskLevel', () => {
  it('maps the spec bands', () => {
    expect(getRiskLevel(100)).toBe('LOW');
    expect(getRiskLevel(80)).toBe('WATCH');
    expect(getRiskLevel(60)).toBe('MODERATE');
    expect(getRiskLevel(40)).toBe('HIGH');
    expect(getRiskLevel(10)).toBe('CRITICAL');
  });
});

describe('getStatusColor', () => {
  it('returns the right token per band', () => {
    expect(getStatusColor(95)).toBe(STATUS_COLOR_TOKEN.OPTIMAL);
    expect(getStatusColor(75)).toBe(STATUS_COLOR_TOKEN.STABLE);
    expect(getStatusColor(60)).toBe(STATUS_COLOR_TOKEN.DECLINING);
    expect(getStatusColor(40)).toBe(STATUS_COLOR_TOKEN.RISK);
    expect(getStatusColor(10)).toBe(STATUS_COLOR_TOKEN.CRITICAL);
  });
});

describe('getRecheckMinutes', () => {
  it('returns spec cadence per band', () => {
    expect(getRecheckMinutes(95)).toBe(60);
    expect(getRecheckMinutes(75)).toBe(45);
    expect(getRecheckMinutes(60)).toBe(30);
    expect(getRecheckMinutes(40)).toBe(16);
    expect(getRecheckMinutes(10)).toBe(4);
  });
});

describe('shouldActivatePressureMode', () => {
  it('activates when score < 50', () => {
    expect(shouldActivatePressureMode({ score: 49 })).toBe(true);
  });
  it('activates on HIGH/CRITICAL risk', () => {
    expect(shouldActivatePressureMode({ score: 35 })).toBe(true); // HIGH
    expect(shouldActivatePressureMode({ score: 10 })).toBe(true); // CRITICAL
  });
  it('does not activate when stable + no triggers', () => {
    expect(shouldActivatePressureMode({ score: 80 })).toBe(false);
  });
  it('activates when command ignored past half the timer', () => {
    expect(shouldActivatePressureMode({ score: 75, ignoredCommand: true, elapsedTimerPercent: 0.7 })).toBe(true);
    expect(shouldActivatePressureMode({ score: 75, ignoredCommand: true, elapsedTimerPercent: 0.3 })).toBe(false);
  });
  it('activates on a 15+ point drop since last check', () => {
    expect(shouldActivatePressureMode({ score: 70, previousScore: 86 })).toBe(true);
    expect(shouldActivatePressureMode({ score: 70, previousScore: 80 })).toBe(false);
  });
});

describe('calculateDailyWaterTarget', () => {
  it('applies base + male + moderate + height baseline', () => {
    // 180 * 0.5 = 90, +8 male, +4 height (70" → 69-74), +16 moderate = 118
    expect(calculateDailyWaterTarget(PROFILE)).toBe(118);
  });
  it('honors female + short + sedentary minimum clamp', () => {
    const t = calculateDailyWaterTarget({
      ...PROFILE, gender: 'female', heightInches: 60, weightLbs: 110, activityLevel: 'sedentary',
    });
    // 110*0.5=55, +0, -4, +0 = 51 → clamped to 64
    expect(t).toBe(64);
  });
  it('honors 180 max clamp', () => {
    const t = calculateDailyWaterTarget(
      { ...PROFILE, weightLbs: 280, activityLevel: 'athlete', heightInches: 78 },
      { temperatureF: 105 },
      'extreme',
    );
    // 280*0.5=140, +8, +8, +32, +24 (105°F), +32 (extreme) = 244 → clamped to 180
    expect(t).toBe(180);
  });
  it('handles non_binary +4 oz', () => {
    const a = calculateDailyWaterTarget({ ...PROFILE, gender: 'non_binary' });
    const b = calculateDailyWaterTarget({ ...PROFILE, gender: 'female' });
    expect(a - b).toBe(4);
  });
});

describe('calculateNegativeRiskPenalty', () => {
  it('returns 0 when nothing wrong', () => {
    expect(calculateNegativeRiskPenalty(inputs(), 100)).toBe(0);
  });
  it('sums thirst+energy+urine per spec', () => {
    expect(calculateNegativeRiskPenalty(inputs({
      thirstLevel: 5, energyLevel: 1, urineColor: 8,
    }), 100)).toBe(24 + 20 + 35);
  });
  it('applies steps + temp + humidity + workout penalties', () => {
    expect(calculateNegativeRiskPenalty(inputs({
      stepsToday: 16000, temperatureF: 102, humidityPct: 92, workout: 'extreme',
    }), 100)).toBe(18 + 18 + 12 + 22);
  });
  it('applies last-hydration penalty on every threshold', () => {
    expect(calculateNegativeRiskPenalty(inputs({ minutesSinceLastHydration: 70  }), 100)).toBe(5);
    expect(calculateNegativeRiskPenalty(inputs({ minutesSinceLastHydration: 130 }), 100)).toBe(10);
    expect(calculateNegativeRiskPenalty(inputs({ minutesSinceLastHydration: 200 }), 100)).toBe(16);
    expect(calculateNegativeRiskPenalty(inputs({ minutesSinceLastHydration: 300 }), 100)).toBe(22);
  });
  it('applies sleep prep penalty when score below 75 within 2h of bed', () => {
    const p = calculateNegativeRiskPenalty(inputs({
      thirstLevel: 5, urineColor: 2, minutesUntilBedtime: 90,
    }), 100);
    // thirst:24 + urine:2 = 26 → running 74 < 75 → +5 sleep = 31
    expect(p).toBe(31);
  });
  it('applies stronger sleep penalty within 1h of bed when score below 65', () => {
    const p = calculateNegativeRiskPenalty(inputs({
      thirstLevel: 5, energyLevel: 2, minutesUntilBedtime: 30,
    }), 100);
    // thirst:24 + energy:14 + sleep:10 = 48
    expect(p).toBe(48);
  });
});

describe('calculateDailyHydrationProgressBoost', () => {
  it('maps target completion percentage to spec boost', () => {
    expect(calculateDailyHydrationProgressBoost(0, 128)).toBe(0);
    expect(calculateDailyHydrationProgressBoost(32, 128)).toBe(5);   // 25%
    expect(calculateDailyHydrationProgressBoost(64, 128)).toBe(10);  // 50%
    expect(calculateDailyHydrationProgressBoost(96, 128)).toBe(15);  // 75%
    expect(calculateDailyHydrationProgressBoost(128, 128)).toBe(20); // 100%
    expect(calculateDailyHydrationProgressBoost(200, 128)).toBe(20); // 100%+
  });
  it('returns 0 on a zero target', () => {
    expect(calculateDailyHydrationProgressBoost(50, 0)).toBe(0);
  });
});

describe('calculateRecentWaterBoost', () => {
  it('maps 2-hour ounces per spec', () => {
    expect(calculateRecentWaterBoost({ waterOuncesLoggedLast2Hours: 8  })).toBe(4);
    expect(calculateRecentWaterBoost({ waterOuncesLoggedLast2Hours: 12 })).toBe(6);
    expect(calculateRecentWaterBoost({ waterOuncesLoggedLast2Hours: 16 })).toBe(8);
    expect(calculateRecentWaterBoost({ waterOuncesLoggedLast2Hours: 20 })).toBe(10);
    expect(calculateRecentWaterBoost({ waterOuncesLoggedLast2Hours: 24 })).toBe(12);
    expect(calculateRecentWaterBoost({ waterOuncesLoggedLast2Hours: 32 })).toBe(16);
  });
  it('counts 2–4h water at 50%', () => {
    // 16 oz in 2h (boost 8) + 16 oz in 2-4h window (boost 8 * 0.5 = 4) = 12
    expect(calculateRecentWaterBoost({
      waterOuncesLoggedLast2Hours: 16,
      waterOuncesLoggedLast4Hours: 32,
    })).toBe(12);
  });
  it('caps at +18', () => {
    expect(calculateRecentWaterBoost({
      waterOuncesLoggedLast2Hours: 64,
      waterOuncesLoggedLast4Hours: 128,
    })).toBe(18);
  });
});

describe('calculateAForceBoost', () => {
  it('credits per-product spec values within 2h', () => {
    expect(calculateAForceBoost({ aforceSticksLoggedLast2Hours: 1 })).toBe(12);
    expect(calculateAForceBoost({ aforceRTDsLoggedLast2Hours: 1 })).toBe(14);
    expect(calculateAForceBoost({ aforceCanisterServingsLast2Hours: 1 })).toBe(10);
    expect(calculateAForceBoost({ aforceEnergyDrinksLast2Hours: 1 })).toBe(8);
  });
  it('caps at +18', () => {
    expect(calculateAForceBoost({
      aforceSticksLoggedLast2Hours: 5,
    })).toBe(18);
  });
  it('halves older AForce intake', () => {
    // 0 in last 2h, 1 stick today → 12 * 0.5 = 6
    expect(calculateAForceBoost({
      aforceSticksLoggedToday: 1,
      aforceSticksLoggedLast2Hours: 0,
    })).toBe(6);
  });
});

describe('calculateHydrationCycleBoost', () => {
  it('returns 0 without both kinds of intake in the 30-min window', () => {
    expect(calculateHydrationCycleBoost({
      waterOuncesLoggedLast2Hours: 16,
    }, 'STABLE')).toBe(0);
    expect(calculateHydrationCycleBoost({
      aforceSticksLoggedLast2Hours: 1,
    }, 'STABLE')).toBe(0);
  });
  it('returns 0 when either log is older than 30 min', () => {
    expect(calculateHydrationCycleBoost({
      waterOuncesLoggedLast2Hours: 16, aforceSticksLoggedLast2Hours: 1,
      minutesSinceLastWater: 25, aforceMinutesSinceLast: 35,
    }, 'STABLE')).toBe(0);
  });
  it('grants +8 in stable', () => {
    expect(calculateHydrationCycleBoost({
      waterOuncesLoggedLast2Hours: 16, aforceSticksLoggedLast2Hours: 1,
      minutesSinceLastWater: 5, aforceMinutesSinceLast: 10,
    }, 'STABLE')).toBe(8);
  });
  it('amplifies for declining/risk/critical', () => {
    const ctx = {
      waterOuncesLoggedLast2Hours: 16, aforceSticksLoggedLast2Hours: 1,
      minutesSinceLastWater: 5, aforceMinutesSinceLast: 10,
    };
    expect(calculateHydrationCycleBoost(ctx, 'DECLINING')).toBe(13);
    expect(calculateHydrationCycleBoost(ctx, 'RISK')).toBe(15);    // 8+8 capped at 15
    expect(calculateHydrationCycleBoost(ctx, 'CRITICAL')).toBe(15); // 8+12 capped at 15
  });
});

describe('generateHydrationCommand', () => {
  it('returns the band default when no context overrides', () => {
    expect(generateHydrationCommand(95, inputs())).toBe('Flow state active. Hold your rhythm.');
    expect(generateHydrationCommand(75, inputs())).toBe('Sip 12 oz of water within the next 45 minutes.');
    expect(generateHydrationCommand(60, inputs())).toBe('Open a water cycle: 16 oz of water with 1 stick.');
    expect(generateHydrationCommand(40, inputs())).toBe('Recovery window open. Complete a water cycle with electrolytes.');
    expect(generateHydrationCommand(20, inputs())).toBe('Recovery needed. Complete one water cycle now to reset.');
  });
  it('overrides with sleep prep within 2h when below optimal', () => {
    expect(generateHydrationCommand(60, inputs({ minutesUntilBedtime: 60 })))
      .toBe('Drink 20 oz of water and take 1 RTD before sleep.');
  });
  it('overrides with heat command above 85°F', () => {
    expect(generateHydrationCommand(60, inputs({ temperatureF: 95 })))
      .toBe('Heat exposure detected. Increase fluid intake now.');
  });
  it('overrides with workout command for moderate+ load', () => {
    expect(generateHydrationCommand(60, inputs({ workout: 'hard' })))
      .toBe('Training load detected. Replace fluids and electrolytes now.');
  });
  it('does not override at OPTIMAL', () => {
    expect(generateHydrationCommand(95, inputs({ workout: 'hard', temperatureF: 100 })))
      .toBe('Flow state active. Hold your rhythm.');
  });
});

describe('generateSignals', () => {
  it('returns 3–5 signals with intake context', () => {
    const sig = generateSignals(60, inputs({
      urineColor: 5, stepsToday: 12000,
      waterOuncesLoggedLast2Hours: 16,
      aforceSticksLoggedLast2Hours: 1,
    }));
    expect(sig.length).toBeGreaterThanOrEqual(3);
    expect(sig.length).toBeLessThanOrEqual(5);
    expect(sig).toContain('Urine color elevated');
    expect(sig).toContain('AForce intake confirmed');
  });
  it('emits boost-fading when only old water exists', () => {
    const sig = generateSignals(60, inputs({
      waterOuncesLoggedLast2Hours: 0,
      waterOuncesLoggedLast4Hours: 24,
    }));
    expect(sig).toContain('Boost fading as intake ages');
  });
});

describe('calculateConfidence', () => {
  it('starts at 70 with nothing provided', () => {
    expect(calculateConfidence(inputs())).toBe(70);
  });
  it('caps at 98 with everything provided', () => {
    expect(calculateConfidence(inputs({
      urineColor: 3, thirstLevel: 2, temperatureF: 80, stepsToday: 4000,
      minutesSinceLastHydration: 30,
    }))).toBe(98);
  });
});

describe('getHydrationScore', () => {
  it('produces a complete output object on healthy inputs', () => {
    const out = getHydrationScore(inputs({
      thirstLevel: 1, energyLevel: 5, urineColor: 1,
      stepsToday: 2000, temperatureF: 65, humidityPct: 35,
      workout: 'none', minutesSinceLastHydration: 30,
    }));
    expect(out.score).toBeGreaterThanOrEqual(85);
    expect(out.status).toBe('OPTIMAL');
    expect(out.riskLevel).toBe('LOW');
    expect(out.recheckMinutes).toBe(60);
    expect(out.pressureMode).toBe(false);
    expect(out.command).toBe('Flow state active. Hold your rhythm.');
    expect(out.dailyWaterTargetOz).toBeGreaterThan(0);
    expect(out.confidence).toBeGreaterThan(70);
    expect(typeof out.nextEvaluationTime).toBe('string');
  });

  it('responds to risk: heat + thirst + dark urine drops to RISK or CRITICAL', () => {
    const out = getHydrationScore(inputs({
      thirstLevel: 5, energyLevel: 2, urineColor: 7,
      temperatureF: 95, humidityPct: 80, stepsToday: 12000,
      workout: 'hard', minutesSinceLastHydration: 200,
    }));
    expect(out.score).toBeLessThan(50);
    expect(['RISK', 'CRITICAL']).toContain(out.status);
    expect(out.pressureMode).toBe(true);
    expect(['LOW', 'WATCH', 'MODERATE']).not.toContain(out.riskLevel);
  });

  it('intake boost lifts the score back into a higher band', () => {
    const baseline = getHydrationScore(inputs({
      thirstLevel: 4, urineColor: 5, minutesSinceLastHydration: 100,
    }));
    const boosted = getHydrationScore(inputs({
      thirstLevel: 4, urineColor: 5, minutesSinceLastHydration: 100,
      waterOuncesLoggedLast2Hours: 24,
      waterOuncesLoggedToday: 64,
      aforceSticksLoggedLast2Hours: 1, aforceSticksLoggedToday: 1,
      minutesSinceLastWater: 5, aforceMinutesSinceLast: 10,
    }));
    expect(boosted.score).toBeGreaterThan(baseline.score);
    expect(boosted.totalPositiveBoost).toBeGreaterThan(0);
    expect(boosted.signals).toContain('AForce intake confirmed');
  });

  it('clamps total positive boost at 40', () => {
    const out = getHydrationScore(inputs({
      thirstLevel: 5, urineColor: 8,
      waterOuncesLoggedLast2Hours: 32, waterOuncesLoggedToday: 200,
      waterOuncesLoggedLast4Hours: 64,
      aforceSticksLoggedLast2Hours: 5, aforceRTDsLoggedLast2Hours: 5,
      minutesSinceLastWater: 5, aforceMinutesSinceLast: 5,
    }));
    expect(out.totalPositiveBoost).toBe(40);
  });

  it('never returns a score outside [0, 100]', () => {
    const lo = getHydrationScore(inputs({
      thirstLevel: 5, energyLevel: 1, urineColor: 8,
      temperatureF: 110, humidityPct: 95, stepsToday: 20000,
      workout: 'extreme', minutesSinceLastHydration: 999,
    }));
    expect(lo.score).toBeGreaterThanOrEqual(0);

    const hi = getHydrationScore(inputs({
      waterOuncesLoggedLast2Hours: 64,
      aforceRTDsLoggedLast2Hours: 5,
    }));
    expect(hi.score).toBeLessThanOrEqual(100);
  });

  it('produces a sleep-prep command when within 2h of bed', () => {
    const out = getHydrationScore(inputs({
      thirstLevel: 3, minutesUntilBedtime: 90,
    }));
    expect(out.command).toBe('Drink 20 oz of water and take 1 RTD before sleep.');
  });

  it('detects pressure mode on a 15+ point drop since last check', () => {
    const out = getHydrationScore(
      inputs({ thirstLevel: 3, urineColor: 5 }),
      { previousScore: 95 },
    );
    // 9 + 16 = 25 penalty → score 75; previous 95; drop 20 ≥ 15
    expect(out.pressureMode).toBe(true);
  });
});
