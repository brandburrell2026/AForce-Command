import { describe, it, expect } from 'vitest';
import {
  resolveNightOutCommandView,
  confidenceLabel,
  freshnessLabel,
  isApprovedAdjustOz,
  NIGHT_OUT_ADJUST_OZ,
  type NightOutCommandInput,
} from '../commandPresentation';
import { makeCommandTimer, resolveCommandTimerView } from '../commandTimer';

const T0 = Date.UTC(2026, 0, 1, 22, 0, 0);
const MIN = 60 * 1000;

function baseInput(over: Partial<NightOutCommandInput> = {}): NightOutCommandInput {
  return {
    score: 76,
    stateLabel: 'BALANCED',
    interpretation: 'Holding steady.',
    hasActionableCommand: true,
    commandTitle: 'Water first',
    commandInstruction: 'Drink 12 oz water',
    doseOz: 12,
    reason: 'Stay ahead of the curve',
    confidenceLevel: 'high',
    freshnessAgeMs: 2 * MIN,
    reassessMinutes: 20,
    windowMinutes: 20,
    timerView: null,
    ...over,
  };
}

describe('NO-c command presentation modes', () => {
  it('pre-session: has a Water-First command, START WATER, and NO countdown before acceptance', () => {
    const v = resolveNightOutCommandView(baseInput());
    expect(v.mode).toBe('pre-session');
    expect(v.now.cta).toBe('START WATER');
    expect(v.now.windowLabel).toBe('Complete within 20 minutes');
    expect(v.now.remainingLabel).toBeUndefined(); // no active countdown yet
    expect(v.now.showAdjust).toBe(true);
    expect(v.now.showNotNow).toBe(true);
  });

  it('no-command: shows the calm message, never a fabricated command', () => {
    const v = resolveNightOutCommandView(baseInput({ hasActionableCommand: false }));
    expect(v.mode).toBe('no-command');
    expect(v.now.calmMessage).toBe("You're exactly where you should be. No action needed.");
    expect(v.now.cta).toBeNull();
    expect(v.now.title).toBe('');
  });

  it('active: after acceptance the timer view drives COMPLETE WATER + remaining time', () => {
    const timer = makeCommandTimer('cmd', 20 * MIN, T0);
    const v = resolveNightOutCommandView(
      baseInput({ timerView: resolveCommandTimerView(timer, T0 + 5 * MIN) }),
    );
    expect(v.mode).toBe('active');
    expect(v.now.cta).toBe('COMPLETE WATER');
    expect(v.now.remainingLabel).toBe('15:00');
    expect(v.now.windowLabel).toBe('15:00 remaining');
  });

  it('active + expired: still COMPLETE WATER (expiry never auto-completes)', () => {
    const timer = makeCommandTimer('cmd', 1 * MIN, T0);
    const v = resolveNightOutCommandView(
      baseInput({ timerView: resolveCommandTimerView(timer, T0 + 5 * MIN) }),
    );
    expect(v.mode).toBe('active');
    expect(v.now.cta).toBe('COMPLETE WATER');
    expect(v.now.windowLabel).toMatch(/confirm when done/i);
  });

  it('processing: after confirmation shows the neutral reassessing state, no CTA', () => {
    const v = resolveNightOutCommandView(baseInput({ justCompleted: true }));
    expect(v.mode).toBe('processing');
    expect(v.now.processingLabel).toBe('Water confirmed. Reassessing…');
    expect(v.now.cta).toBeNull();
  });

  it('an invalid timer view falls back to pre-session (safe recoverable), not a broken active state', () => {
    const v = resolveNightOutCommandView(
      baseInput({ timerView: { status: 'invalid', remainingMs: 0, remainingSec: 0, elapsedMs: 0, expired: false } }),
    );
    expect(v.mode).toBe('pre-session');
    expect(v.now.cta).toBe('START WATER');
  });
});

describe('NO-c confidence + freshness are not fabricated', () => {
  it('maps confidence to High / Moderate / Limited', () => {
    expect(confidenceLabel('high')).toBe('High');
    expect(confidenceLabel('medium')).toBe('Moderate');
    expect(confidenceLabel('low')).toBe('Limited');
  });

  it('limited confidence and missing freshness both say "waiting for fresher confirmed signals"', () => {
    expect(freshnessLabel(null, 'high')).toMatch(/Waiting for fresher/);
    expect(freshnessLabel(5 * MIN, 'low')).toMatch(/Waiting for fresher/);
    expect(freshnessLabel(2 * MIN, 'high')).toBe('Updated 2 min ago');
    expect(freshnessLabel(20 * 1000, 'high')).toBe('Updated just now');
  });

  it('low confidence surfaces the Limited banner in the view', () => {
    const v = resolveNightOutCommandView(baseInput({ confidenceLevel: 'low', freshnessAgeMs: null }));
    expect(v.now.confidenceLabel).toBe('Limited');
    expect(v.now.limitedConfidence).toBe(true);
    expect(v.now.freshnessLabel).toMatch(/Waiting for fresher/);
  });
});

describe('NO-c Adjust uses approved amounts only', () => {
  it('accepts approved oz and rejects arbitrary/unsafe values', () => {
    for (const oz of NIGHT_OUT_ADJUST_OZ) expect(isApprovedAdjustOz(oz)).toBe(true);
    expect(isApprovedAdjustOz(13)).toBe(false);
    expect(isApprovedAdjustOz(0)).toBe(false);
    expect(isApprovedAdjustOz(999)).toBe(false);
    expect(isApprovedAdjustOz(-8)).toBe(false);
  });
});
