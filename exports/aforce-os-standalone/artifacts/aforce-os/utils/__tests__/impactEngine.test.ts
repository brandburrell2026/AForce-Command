import { describe, it, expect } from 'vitest';

import {
  deriveImpact,
  foldCommandConfidence,
  type ImpactContext,
} from '../impact/impactEngine';

const BASE: ImpactContext = {
  behaviorCompleted: true,
  hydrationBefore: 50,
  hydrationAfter: 50,
  signalConfidence: 1,
};

describe('deriveImpact', () => {
  it('headlines a fast hydration recovery as "Stabilized faster"', () => {
    const r = deriveImpact({ ...BASE, hydrationBefore: 40, hydrationAfter: 70 });
    expect(r.summary).toBe('Stabilized faster');
    expect(r.trend).toBe('rising');
    expect(r.outcomeAligned).toBe(true);
    expect(r.commandConfidence).toBeGreaterThan(0.5);
  });

  it('headlines the strongest signal — recovery — when it improves most', () => {
    const r = deriveImpact({
      ...BASE,
      hydrationBefore: 50,
      hydrationAfter: 51,
      recoveryBefore: 0,
      recoveryAfter: 10,
    });
    expect(r.summary).toBe('Recovery improved');
    expect(r.trend).toBe('rising');
    expect(r.outcomeAligned).toBe(true);
  });

  it('headlines heat relief when pressure drops the most', () => {
    const r = deriveImpact({
      ...BASE,
      hydrationBefore: 50,
      hydrationAfter: 50,
      heatPressureBefore: 0.8,
      heatPressureAfter: 0.3,
    });
    expect(r.summary).toBe('Heat pressure reduced');
    expect(r.trend).toBe('rising');
  });

  it('does not claim impact when the command was not executed', () => {
    const r = deriveImpact({
      ...BASE,
      behaviorCompleted: false,
      hydrationBefore: 40,
      hydrationAfter: 70,
    });
    expect(r.summary).toBe('Command not yet executed');
    expect(r.outcomeAligned).toBe(false);
    expect(r.commandConfidence).toBeLessThan(0.5);
    // Reinforcement stays water-first and never a downer.
    expect(r.reinforcement.toLowerCase()).toContain('water');
  });

  it('reads "Holding steady" when nothing moved', () => {
    const r = deriveImpact({ ...BASE });
    expect(r.summary).toBe('Holding steady');
    expect(r.trend).toBe('flat');
    expect(r.outcomeAligned).toBe(false);
  });

  it('keeps reinforcement positive even on a falling trend', () => {
    const r = deriveImpact({ ...BASE, hydrationBefore: 70, hydrationAfter: 40 });
    expect(r.trend).toBe('falling');
    expect(r.outcomeAligned).toBe(false);
    expect(r.reinforcement.toLowerCase()).toContain('water');
  });

  it('confidence rises with signal quality for the same outcome', () => {
    const strong = deriveImpact({
      ...BASE,
      hydrationBefore: 40,
      hydrationAfter: 70,
      signalConfidence: 1,
    });
    const weak = deriveImpact({
      ...BASE,
      hydrationBefore: 40,
      hydrationAfter: 70,
      signalConfidence: 0.4,
    });
    expect(strong.commandConfidence).toBeGreaterThan(weak.commandConfidence);
  });

  it('works on a single available signal (recovery/heat omitted)', () => {
    const r = deriveImpact({ ...BASE, hydrationBefore: 55, hydrationAfter: 75 });
    expect(r.summary).toBe('Stabilized faster');
    expect(r.outcomeAligned).toBe(true);
  });
});

describe('foldCommandConfidence', () => {
  it('moves the prior more for a high-quality observation than a low-quality one', () => {
    const prior = 0.4;
    const highQuality = foldCommandConfidence(prior, {
      commandConfidence: 1,
      signalConfidence: 1,
    });
    const lowQuality = foldCommandConfidence(prior, {
      commandConfidence: 1,
      signalConfidence: 0.2,
    });
    expect(highQuality).toBeGreaterThan(lowQuality);
    expect(highQuality).toBeGreaterThan(prior);
    expect(lowQuality).toBeGreaterThan(prior);
  });

  it('stays clamped within 0..1', () => {
    expect(foldCommandConfidence(1, { commandConfidence: 1, signalConfidence: 1 })).toBeLessThanOrEqual(1);
    expect(foldCommandConfidence(0, { commandConfidence: 0, signalConfidence: 1 })).toBeGreaterThanOrEqual(0);
  });
});
