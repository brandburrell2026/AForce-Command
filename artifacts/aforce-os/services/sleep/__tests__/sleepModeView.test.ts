import { describe, it, expect } from 'vitest';
import {
  resolveSleepModeView, CHECKLIST_DEFS, SLEEP_PHASES,
  type SleepModeInput,
} from '../sleepModeView';
import { SLEEP_FIXTURES } from '../sleepModeFixtures';

const r = (k: keyof typeof SLEEP_FIXTURES) => resolveSleepModeView(SLEEP_FIXTURES[k]);

describe('resolveSleepModeView — state rendering', () => {
  it('idle → IDLE hero + countdown ring to protocol', () => {
    const v = r('idle');
    expect(v.hero.state).toBe('IDLE');
    expect(v.hero.ring.kind).toBe('countdown');
    expect(v.hero.ring.caption).toBe('MIN TO PROTOCOL');
    expect(v.lifecycle.activeIndex).toBe(0);
  });

  it('pre_sleep → PRE-SLEEP hero + min-to-window', () => {
    const v = r('pre-sleep-ready');
    expect(v.hero.state).toBe('PRE-SLEEP');
    expect(v.hero.ring.caption).toBe('MIN TO WINDOW');
    expect(v.target.countdownCopy).toMatch(/Recovery window opens in \d+ minutes/);
  });

  it('recovery_window → RECOVERY WINDOW, ring OPEN', () => {
    const v = r('recovery-window');
    expect(v.hero.state).toBe('RECOVERY WINDOW');
    expect(v.hero.ring.valueLabel).toBe('OPEN');
    expect(v.hero.ring.progress).toBe(1);
  });

  it('morning → uses real last-night sleep in the ring + sentence', () => {
    const v = r('morning');
    expect(v.hero.state).toBe('MORNING');
    expect(v.hero.ring.valueLabel).toBe('7.9h');
    expect(v.hero.description).toMatch(/stronger than your recent average/);
  });

  it('lifecycle indicator marks past phases done and one active', () => {
    const v = r('recovery-window');
    const active = v.lifecycle.states.filter((s) => s.active);
    expect(active).toHaveLength(1);
    expect(v.lifecycle.systemDerived).toBe(true);
    expect(v.lifecycle.states.map((s) => s.key)).toEqual([...SLEEP_PHASES]);
  });
});

describe('checklist + CTA behavior', () => {
  it('0 complete → START', () => {
    expect(r('pre-sleep-ready').checklist.primaryCta).toBe('start');
    expect(r('pre-sleep-ready').checklist.primaryCtaLabel).toBe('START PRE-SLEEP PROTOCOL');
    expect(r('pre-sleep-ready').checklist.progressLabel).toBe('0 / 5 complete');
  });
  it('partial → CONTINUE', () => {
    const v = r('pre-sleep-active');
    expect(v.checklist.primaryCta).toBe('continue');
    expect(v.checklist.completedCount).toBe(3);
    expect(v.checklist.progressLabel).toBe('3 / 5 complete');
  });
  it('all → COMPLETE', () => {
    const v = r('recovery-window');
    expect(v.checklist.primaryCta).toBe('complete');
    expect(v.checklist.completedCount).toBe(v.checklist.totalCount);
  });
  it('hydrate is the primary, product-backed item', () => {
    const v = r('idle');
    const hydrate = v.checklist.items.find((i) => i.id === 'hydrate');
    expect(hydrate?.primary).toBe(true);
    expect(v.checklist.items.filter((i) => i.primary)).toHaveLength(1);
    expect(v.checklist.items).toHaveLength(CHECKLIST_DEFS.length);
  });
  it('done state reflects completed ids exactly', () => {
    const v = r('pre-sleep-active');
    const done = v.checklist.items.filter((i) => i.done).map((i) => i.id).sort();
    expect(done).toEqual(['dim_lights', 'hydrate', 'screens_down']);
  });
});

describe('health source states', () => {
  it('connected → View Source cta', () => {
    const v = r('pre-sleep-ready');
    expect(v.health.chip).toBe('connected');
    expect(v.health.chipLabel).toBe('Connected');
    expect(v.health.cta).toBe('view_source');
  });
  it('waiting → Connect cta + honest freshness', () => {
    const v = r('waiting-signals');
    expect(v.health.chip).toBe('waiting');
    expect(v.health.cta).toBe('connect');
    expect(v.health.freshness).toBe('No recent signal');
  });
  it('not connected → Connect + "No source connected"', () => {
    const v = r('health-disconnected');
    expect(v.health.chip).toBe('not_connected');
    expect(v.health.freshness).toBe('No source connected');
  });
  it('needs attention (offline sync fail) → Manage Connection', () => {
    const v = r('offline');
    expect(v.health.chip).toBe('needs_attention');
    expect(v.health.cta).toBe('manage');
  });
});

describe('recovery readiness — honest posture, no fabricated metrics', () => {
  it('not connected → connect posture, hydration framed as strongest signal', () => {
    const v = r('health-disconnected');
    expect(v.recovery.posture).toBe('connect');
    expect(v.recovery.interpretation).toMatch(/hydration remains the strongest available signal/i);
    expect(v.recovery.metrics).toHaveLength(0);
  });
  it('connected but no data → waiting posture', () => {
    const v = r('waiting-signals');
    expect(v.recovery.posture).toBe('waiting');
    expect(v.recovery.metrics).toHaveLength(0);
  });
  it('low confidence → limited posture, low labeled BUILDING (not failure)', () => {
    const v = r('low-confidence');
    expect(v.recovery.posture).toBe('limited');
    expect(v.recovery.confidenceLabel).toBe('BUILDING');
  });
  it('ready posture only with real signals + non-low confidence', () => {
    const v = r('pre-sleep-ready');
    expect(v.recovery.posture).toBe('ready');
    expect(v.recovery.interpretation).toMatch(/ready to recover/i);
  });
  it('NEVER surfaces a metric without a real value', () => {
    // Craft an input claiming a metric but with value null / real=false — must be dropped.
    const input: SleepModeInput = {
      ...SLEEP_FIXTURES['pre-sleep-ready'],
      sleepLastNight: null,
      recoveryMetrics: [
        { key: 'hrv', label: 'HRV', value: null, unit: 'ms', real: true },      // no value → drop
        { key: 'resting_hr', label: 'Resting HR', value: 55, unit: ' bpm', real: false }, // not real → drop
      ],
    };
    const v = resolveSleepModeView(input);
    expect(v.recovery.metrics).toHaveLength(0);
  });
  it('only real+valued metrics survive, formatted with unit', () => {
    const v = r('pre-sleep-ready');
    const labels = v.recovery.metrics.map((m) => m.label);
    expect(labels).toContain('HRV');
    expect(v.recovery.metrics.every((m) => m.real)).toBe(true);
    expect(v.recovery.metrics.find((m) => m.label === 'HRV')?.value).toBe('58ms');
  });
});

describe('mode shells + guidance + compliance', () => {
  it('loading / offline modes pass through', () => {
    expect(r('loading').mode).toBe('loading');
    expect(r('offline').mode).toBe('offline');
  });
  it('no target → honest copy, ring kind none, cannot edit-derived countdown', () => {
    const v = r('no-target');
    expect(v.target.timeLabel).toBe('—:—');
    expect(v.hero.ring.kind).toBe('none');
    expect(v.target.countdownCopy).toMatch(/Set a sleep target/);
  });
  it('guidance is concise + non-diagnostic', () => {
    const v = r('idle');
    expect(v.guidance.title).toBe('ABOUT SLEEP MODE');
    expect(v.guidance.secondary).toMatch(/does not diagnose or treat/i);
    expect(v.guidance.body).not.toMatch(/cure|treat|diagnos/i);
  });
  it('header carries the redesign identity', () => {
    const v = r('idle');
    expect(v.header.title).toBe('SLEEP MODE');
    expect(v.header.tagline).toBe('Recover. Rehydrate. Reset.');
  });
});
