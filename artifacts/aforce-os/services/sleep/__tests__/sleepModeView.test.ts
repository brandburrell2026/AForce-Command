import { describe, it, expect } from 'vitest';
import {
  resolveSleepModeView, CHECKLIST_DEFS, SLEEP_PHASES, SLEEP_GATED_NOTICE,
  localDayKey, shouldFoldSleepAvg, foldSevenNightAvg, primaryCtaAction,
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
    expect(v.hero.ring.valueLabel).toBe('7.9 h'); // RC-2 ruling E (item 3): unit-spacing normalization
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
        { key: 'hrv', label: 'HRV', value: null, unit: ' ms', real: true },      // no value → drop
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
    expect(v.recovery.metrics.find((m) => m.label === 'HRV')?.value).toBe('58 ms'); // RC-2 ruling E (item 3): unit-spacing normalization
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

describe('H1 — kill switch (sleep_mode_enabled) keeps its semantics', () => {
  it('enabled (or omitted, for legacy callers) → no gated notice', () => {
    expect(r('idle').gatedNotice).toBeNull(); // fixtures omit the field
    expect(
      resolveSleepModeView({ ...SLEEP_FIXTURES['idle'], sleepModeEnabled: true }).gatedNotice,
    ).toBeNull();
  });
  it('disabled → the exact legacy internal-preview copy, never silent', () => {
    const v = resolveSleepModeView({ ...SLEEP_FIXTURES['idle'], sleepModeEnabled: false });
    expect(v.gatedNotice).toBe(SLEEP_GATED_NOTICE);
    expect(v.gatedNotice).toBe('INTERNAL PREVIEW — sleep_mode_enabled is off for the public build.');
  });
});

describe('H2 — once-per-calendar-day EMA fold guard', () => {
  const TODAY = '2026-08-03';
  it('first fold of the day (no stored guard) → folds', () => {
    expect(shouldFoldSleepAvg(null, TODAY, 7.5)).toBe(true);
    expect(shouldFoldSleepAvg(undefined, TODAY, 7.5)).toBe(true);
  });
  it('remount on the same day (guard === today) → does NOT fold again', () => {
    expect(shouldFoldSleepAvg(TODAY, TODAY, 7.5)).toBe(false);
  });
  it('next day (stale guard) → folds', () => {
    expect(shouldFoldSleepAvg('2026-08-02', '2026-08-04', 7.5)).toBe(true);
  });
  it('malformed stored guard → treated as absent (folds once), never a permanent skip', () => {
    for (const bad of ['garbage', '2026-8-3', '08-03-2026', '', '2026-08-03T00:00:00Z']) {
      expect(shouldFoldSleepAvg(bad, TODAY, 7.5), JSON.stringify(bad)).toBe(true);
    }
  });
  it('missing sleepLastNight → never folds, regardless of guard', () => {
    expect(shouldFoldSleepAvg(null, TODAY, null)).toBe(false);
    expect(shouldFoldSleepAvg('2026-08-02', TODAY, null)).toBe(false);
    expect(shouldFoldSleepAvg(null, TODAY, Number.NaN)).toBe(false);
  });
  it('foldSevenNightAvg preserves the exact existing EMA math (alpha 1/7)', () => {
    expect(foldSevenNightAvg(null, 7.5)).toBe(7.5); // first value seeds the average
    expect(foldSevenNightAvg(7.0, 7.7)).toBeCloseTo(7.0 + (7.7 - 7.0) / 7, 10);
    expect(foldSevenNightAvg(Number.NaN, 6.5)).toBe(6.5); // corrupt stored avg → reseed
  });
  it('localDayKey is a stable local YYYY-MM-DD', () => {
    // Local-time constructor keeps this deterministic across timezones.
    expect(localDayKey(new Date(2026, 7, 3, 23, 59).getTime())).toBe('2026-08-03');
    expect(localDayKey(new Date(2026, 0, 9, 0, 0).getTime())).toBe('2026-01-09');
  });
});

describe('H3 — primary CTA action semantics', () => {
  it('hydrate not yet done → completes the primary item', () => {
    expect(primaryCtaAction([])).toBe('complete_hydrate');
    expect(primaryCtaAction(['screens_down', 'breathe'])).toBe('complete_hydrate');
  });
  it('hydrate already done → focuses the checklist instead', () => {
    expect(primaryCtaAction(['hydrate'])).toBe('focus_checklist');
    expect(primaryCtaAction(['hydrate', 'screens_down', 'dim_lights', 'breathe', 'cool_room'])).toBe('focus_checklist');
  });
});
