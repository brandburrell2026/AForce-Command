import { describe, it, expect } from 'vitest';
import {
  assessDataConfidence,
  performanceAgeDataConfidence,
  impactDataConfidence,
  commandConfidenceDataConfidence,
  evidenceDataConfidence,
  performanceMemoryDataConfidence,
  HIGH_MIN_VERIFIED,
  PARTIAL_WEIGHT,
  VERIFIED_CONFIDENCE_THRESHOLD,
  type DataSignalInput,
} from '../confidence/dataConfidence';
import type { ImpactContext } from '../impact/impactEngine';
import type { PerformanceAgeRawSignals } from '../../services/performanceAgeService';

const sig = (quality: DataSignalInput['quality'], key = 'k'): DataSignalInput => ({
  key,
  quality,
});

describe('assessDataConfidence — core rules', () => {
  it('no signals at all → low (nothing to go on)', () => {
    const r = assessDataConfidence([]);
    expect(r.level).toBe('low');
    expect(r.totalSignals).toBe(0);
    expect(r.coverage).toBe(0);
  });

  it('≥ HIGH_MIN_VERIFIED verified → high', () => {
    const r = assessDataConfidence([sig('verified', 'a'), sig('verified', 'b')]);
    expect(HIGH_MIN_VERIFIED).toBe(2);
    expect(r.level).toBe('high');
    expect(r.verifiedCount).toBe(2);
  });

  it('two verified plus estimated still reads high (multiple verified)', () => {
    const r = assessDataConfidence([
      sig('verified', 'a'),
      sig('verified', 'b'),
      sig('estimated', 'c'),
    ]);
    expect(r.level).toBe('high');
  });

  it('exactly one verified → medium', () => {
    const r = assessDataConfidence([sig('verified', 'a'), sig('estimated', 'b')]);
    expect(r.level).toBe('medium');
    expect(r.verifiedCount).toBe(1);
  });

  it('no verified but ≥1 partial → medium', () => {
    const r = assessDataConfidence([sig('partial', 'a'), sig('estimated', 'b')]);
    expect(r.level).toBe('medium');
  });

  it('only estimated → low', () => {
    const r = assessDataConfidence([sig('estimated', 'a'), sig('estimated', 'b')]);
    expect(r.level).toBe('low');
    expect(r.estimatedCount).toBe(2);
  });

  it('coverage = (verified + 0.5·partial) / total, rounded', () => {
    expect(PARTIAL_WEIGHT).toBe(0.5);
    const r = assessDataConfidence([
      sig('verified', 'a'),
      sig('partial', 'b'),
      sig('estimated', 'c'),
    ]);
    // (1 + 0.5) / 3 = 0.5
    expect(r.coverage).toBe(0.5);
    expect(r.verifiedCount).toBe(1);
    expect(r.partialCount).toBe(1);
    expect(r.estimatedCount).toBe(1);
  });

  it('echoes the inputs in order (debug trace) without aliasing', () => {
    const input = [sig('verified', 'x'), sig('partial', 'y')];
    const r = assessDataConfidence(input);
    expect(r.signals).toEqual(input);
    expect(r.signals).not.toBe(input);
  });
});

// ─── Performance Age adapter ──────────────────────────────────────────

const baseRaw: PerformanceAgeRawSignals = {
  actualAge: 30,
  recoveryCapacity: 70,
  sleepHours: 7.5,
  workoutMinutes: 45,
  strain: 12,
  activityLevel: 6,
  complianceStreak: 5,
  activeDays: 10,
  nowMs: 1_000,
};

describe('performanceAgeDataConfidence', () => {
  it('all signals present → high (3 verified hydration/recovery/sleep + partial activity)', () => {
    const r = performanceAgeDataConfidence(baseRaw);
    expect(r.verifiedCount).toBe(3);
    expect(r.partialCount).toBe(1);
    expect(r.level).toBe('high');
  });

  it('activity is never verified — even with a real activityLevel it is partial', () => {
    const r = performanceAgeDataConfidence({
      ...baseRaw,
      complianceStreak: null,
      recoveryCapacity: null,
      sleepHours: null,
    });
    expect(r.verifiedCount).toBe(0);
    expect(r.partialCount).toBe(1); // activity only
    expect(r.level).toBe('medium');
  });

  it('activity falls back to workout/strain proxy as partial when no activityLevel', () => {
    const r = performanceAgeDataConfidence({
      ...baseRaw,
      complianceStreak: null,
      recoveryCapacity: null,
      sleepHours: null,
      activityLevel: null,
      workoutMinutes: 30,
      strain: null,
    });
    expect(r.partialCount).toBe(1);
    expect(r.level).toBe('medium');
  });

  it('one verified sub-score → medium', () => {
    const r = performanceAgeDataConfidence({
      ...baseRaw,
      recoveryCapacity: null,
      sleepHours: null,
      activityLevel: null,
      workoutMinutes: null,
      strain: null,
    });
    expect(r.verifiedCount).toBe(1); // hydration only
    expect(r.estimatedCount).toBe(3);
    expect(r.level).toBe('medium');
  });

  it('no real signals at all → low', () => {
    const r = performanceAgeDataConfidence({
      ...baseRaw,
      complianceStreak: null,
      recoveryCapacity: null,
      sleepHours: null,
      activityLevel: null,
      workoutMinutes: null,
      strain: null,
    });
    expect(r.level).toBe('low');
    expect(r.estimatedCount).toBe(4);
  });

  it('a recorded streak of 0 is a real signal (verified), not estimated', () => {
    const r = performanceAgeDataConfidence({
      ...baseRaw,
      complianceStreak: 0,
      recoveryCapacity: null,
      sleepHours: null,
      activityLevel: null,
      workoutMinutes: null,
      strain: null,
    });
    expect(r.verifiedCount).toBe(1);
    expect(r.level).toBe('medium');
  });
});

// ─── Impact / Command Confidence / Evidence adapters ──────────────────

const baseCtx: ImpactContext = {
  behaviorCompleted: true,
  hydrationBefore: 60,
  hydrationAfter: 72,
  signalConfidence: 1,
};

describe('impactDataConfidence', () => {
  it('strong signal + recovery + heat present → high (3 verified)', () => {
    const r = impactDataConfidence({
      ...baseCtx,
      signalConfidence: 1,
      recoveryBefore: 2,
      recoveryAfter: 4,
      heatPressureBefore: 0.6,
      heatPressureAfter: 0.3,
    });
    expect(r.verifiedCount).toBe(3);
    expect(r.level).toBe('high');
  });

  it('threshold: signalConfidence ≥ 0.7 verifies the command signal', () => {
    expect(VERIFIED_CONFIDENCE_THRESHOLD).toBe(0.7);
    const r = impactDataConfidence({ ...baseCtx, signalConfidence: 0.7 });
    expect(r.signals[0]).toEqual({ key: 'command', quality: 'verified' });
    expect(r.level).toBe('medium'); // only 1 verified
  });

  it('phone floor (signalConfidence 0.4) → command is partial → medium', () => {
    const r = impactDataConfidence({ ...baseCtx, signalConfidence: 0.4 });
    expect(r.signals[0].quality).toBe('partial');
    expect(r.level).toBe('medium');
  });

  it('no signal confidence (0) and no recovery/heat → low', () => {
    const r = impactDataConfidence({ ...baseCtx, signalConfidence: 0 });
    expect(r.signals[0].quality).toBe('estimated');
    expect(r.level).toBe('low');
  });

  it('signalConfidence gates only the command floor, not recovery completeness', () => {
    // sc=0 ⇒ command estimated, but a measured recovery pair is still verified.
    const r = impactDataConfidence({
      ...baseCtx,
      signalConfidence: 0,
      recoveryBefore: 1,
      recoveryAfter: 3,
    });
    expect(r.signals[0].quality).toBe('estimated'); // command
    expect(r.signals[1].quality).toBe('verified'); // recovery
    expect(r.level).toBe('medium');
  });

  it('recovery/heat need BOTH before & after to count as verified', () => {
    const r = impactDataConfidence({
      ...baseCtx,
      signalConfidence: 0,
      recoveryBefore: 1, // after missing
      heatPressureAfter: 0.2, // before missing
    });
    expect(r.verifiedCount).toBe(0);
    expect(r.level).toBe('low');
  });

  it('non-finite hydration → command estimated, but a measured recovery+heat pair still reads high', () => {
    const r = impactDataConfidence({
      ...baseCtx,
      hydrationBefore: Number.NaN,
      signalConfidence: 1,
      recoveryBefore: 1,
      recoveryAfter: 3,
      heatPressureBefore: 0.5,
      heatPressureAfter: 0.2,
    });
    expect(r.signals[0].quality).toBe('estimated'); // command
    expect(r.verifiedCount).toBe(2); // recovery + heat
    expect(r.level).toBe('high');
  });

  it('command + evidence wrappers are parity with impactDataConfidence', () => {
    const ctx: ImpactContext = {
      ...baseCtx,
      signalConfidence: 0.4,
      recoveryBefore: 0,
      recoveryAfter: 2,
    };
    const base = impactDataConfidence(ctx);
    expect(commandConfidenceDataConfidence(ctx)).toEqual(base);
    expect(evidenceDataConfidence(ctx)).toEqual(base);
  });
});

// ─── Performance Memory adapter ───────────────────────────────────────

describe('performanceMemoryDataConfidence', () => {
  it('0 logged days → low (estimated)', () => {
    const r = performanceMemoryDataConfidence(0);
    expect(r.level).toBe('low');
  });

  it('1 logged day → medium (partial)', () => {
    const r = performanceMemoryDataConfidence(1);
    expect(r.level).toBe('medium');
    expect(r.partialCount).toBe(1);
  });

  it('caps at medium — self-report never reaches high regardless of depth', () => {
    const r = performanceMemoryDataConfidence(90);
    expect(r.level).toBe('medium');
    expect(r.verifiedCount).toBe(0);
  });

  it('invalid counts (negative / NaN) → low', () => {
    expect(performanceMemoryDataConfidence(-3).level).toBe('low');
    expect(performanceMemoryDataConfidence(Number.NaN).level).toBe('low');
  });
});
