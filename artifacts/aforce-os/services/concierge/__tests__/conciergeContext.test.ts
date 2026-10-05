/**
 * Grounding context builder — provenance, freshness, demo discipline, no fabrication.
 */
import { describe, it, expect } from 'vitest';
import { buildConciergeContext, freshnessLabel, summariseRecentDays, toLocalIso } from '../conciergeContext';
import { DEFAULT_FLAGS, DEMO_ALL_ON_FLAGS } from '../../../featureFlags/flags';
import type { HistoryEntry, ScoreEngineOutput, UserState } from '../../../types';

const NOW = new Date('2026-10-05T14:05:00');
const H = 60 * 60 * 1000;

function engine(over: Partial<ScoreEngineOutput> = {}): ScoreEngineOutput {
  return {
    score: 72.4,
    performanceState: {
      level: 'BALANCED',
      score: 72,
      color: '#000',
      glowColor: '#000',
      urgency: 'moderate',
      pulseSpeed: 'medium',
      animationStyle: 'pulse',
    },
    pulseConfig: {} as ScoreEngineOutput['pulseConfig'],
    reasons: [{ id: 'r1', text: 'Last log 2h ago', weight: 'negative' }],
    riskTimer: { minutes: 20, seconds: 0, urgency: 'medium' },
    command: {
      id: 'c1',
      action: 'Drink 16 oz water now. Recheck in 20 min.',
      explanation: 'Behind pace.',
      urgencyLevel: 'medium',
      estimatedImpact: '+6',
      confidence: 'medium',
    },
    breakdown: [],
    prediction: { decayPerMinute: 0.1, minutesToDepleted: 300, label: '' },
    social: null,
    ...over,
  } as ScoreEngineOutput;
}

function user(over: Partial<UserState> = {}): UserState {
  return {
    unitsConsumedToday: 3,
    ozConsumedToday: 40,
    aforceUnitsToday: 0,
    intakeEvents: [{ id: 'e1' } as never, { id: 'e2' } as never, { id: 'e3' } as never],
    lastIntakeTime: new Date(NOW.getTime() - 145 * 60_000),
    lastIntakeType: 'water',
    symptomState: 'none',
    symptoms: [],
    urineSignal: 3,
    energyState: 'steady',
    heatLoad: 4,
    sweatRate: 3,
    activityLevel: 5,
    complianceStreak: 2,
    dailyTarget: 8,
    ozTarget: 96,
    isSnoozed: false,
    snoozeUntil: null,
    bodyWeightLbs: 180,
    isAwake: true,
    wakeTime: null,
    overnightLossOz: 0,
    hasSeenMorningCommand: true,
    ...over,
  } as UserState;
}

const history: HistoryEntry[] = [
  { id: 'h1', timestamp: new Date(NOW.getTime() - 2 * H), score: 70, state: 'BALANCED', action: 'x', unitsTaken: 1 },
  { id: 'h2', timestamp: new Date(NOW.getTime() - 26 * H), score: 80, state: 'BALANCED', action: 'x', unitsTaken: 1 },
  { id: 'h3', timestamp: new Date(NOW.getTime() - 27 * H), score: 60, state: 'RECOVERING', action: 'x', unitsTaken: 0 },
  { id: 'syn', timestamp: new Date(NOW.getTime() - 50 * H), score: 76, state: 'BALANCED', action: 'x', unitsTaken: 0, isSynthetic: true },
];

const base = () => ({
  engine: engine(),
  userState: user(),
  history,
  flags: DEFAULT_FLAGS,
  demoMode: false,
  locale: 'en',
  loggedDayCount: 3,
  now: NOW,
  timeZone: 'America/New_York',
});

describe('freshnessLabel', () => {
  it('labels wearable sync by the shared FRESHNESS_WINDOWS and never invents freshness for a missing time', () => {
    const n = NOW.getTime();
    expect(freshnessLabel(n - 1 * H, 'wearable_sync', n)).toBe('fresh');
    expect(freshnessLabel(n - 12 * H, 'wearable_sync', n)).toBe('aging');
    expect(freshnessLabel(n - 30 * H, 'wearable_sync', n)).toBe('stale');
    expect(freshnessLabel(n - 100 * H, 'wearable_sync', n)).toBe('expired');
    expect(freshnessLabel(undefined, 'wearable_sync', n)).toBe('missing');
    expect(freshnessLabel(n + 5 * H, 'wearable_sync', n)).toBe('missing');
  });
});

describe('buildConciergeContext', () => {
  it('carries HydroState, the guarded command, logged intake and provenance labels', () => {
    const ctx = buildConciergeContext(base());
    expect(ctx.hydroState).toMatchObject({ score: 72, level: 'BALANCED', evidence: 'ready', confidence: 'medium' });
    expect(ctx.command).toMatchObject({ action: 'Drink 16 oz water now. Recheck in 20 min.', guard: 'approved' });
    expect(ctx.intake).toEqual({
      ozToday: 40,
      ozTarget: 96,
      unitsToday: 3,
      unitsTarget: 8,
      lastIntakeMinutesAgo: 145,
      provenance: 'logged',
    });
    expect(ctx.capabilities).toEqual(['log_hydration', 'open_screen', 'start_checkin', 'set_reminder']);
    expect(ctx.localTime.hour).toBe(14);
    expect(ctx.localTime.timeZone).toBe('America/New_York');
  });

  it('withholds HydroState while the evidence gate says the score is not yet real', () => {
    const ctx = buildConciergeContext({ ...base(), userState: user({ intakeEvents: [], unitsConsumedToday: 0 }), loggedDayCount: 0 });
    expect(ctx.hydroState).toBeNull();
    const pending = buildConciergeContext({ ...base(), userState: user({ intakeEvents: [], unitsConsumedToday: 0 }), loggedDayCount: null });
    expect(pending.hydroState).toBeNull();
  });

  it('reports no last-intake age when nothing was logged today (never a fabricated gap)', () => {
    const ctx = buildConciergeContext({ ...base(), userState: user({ unitsConsumedToday: 0, intakeEvents: [] }) });
    expect(ctx.intake.lastIntakeMinutesAgo).toBeNull();
  });

  it('emits measured provider signals with freshness and observation times, skipping absent fields', () => {
    const fetchedAt = NOW.getTime() - 10 * H;
    const ctx = buildConciergeContext({
      ...base(),
      userState: user({
        biometrics: {
          whoop: {
            providerId: 'whoop',
            fetchedAt,
            sleepHoursLastNight: 6.5,
            hrvRmssdMs: 48.2,
            restingHeartRate: null,
            recoveryPct: 61,
          },
        },
      }),
    });
    expect(ctx.providers).toEqual([
      { id: 'whoop', connected: true, lastSyncIso: new Date(fetchedAt).toISOString(), freshness: 'aging' },
    ]);
    const ids = ctx.signals.map((s) => s.id);
    expect(ids).toEqual(['whoop.sleep', 'whoop.hrv', 'whoop.recovery']);
    expect(ctx.signals[0]).toMatchObject({ provenance: 'measured', freshness: 'fresh', value: 6.5, unit: 'h' });
    expect(ctx.signals[1]).toMatchObject({ value: 48.2, unit: 'ms', freshness: 'aging' });
  });

  it('DEMO: collapses every provenance to demo, drops journal days, and flags demoMode', () => {
    const ctx = buildConciergeContext({
      ...base(),
      demoMode: true,
      flags: DEMO_ALL_ON_FLAGS,
      userState: user({ biometrics: { oura: { providerId: 'oura', fetchedAt: NOW.getTime() - H, sleepHoursLastNight: 7 } } }),
    });
    expect(ctx.demoMode).toBe(true);
    expect(ctx.intake.provenance).toBe('demo');
    expect(ctx.signals.every((s) => s.provenance === 'demo')).toBe(true);
    expect(ctx.recentDays).toEqual([]);
  });

  it('lists only screens that exist behind their flags', () => {
    const off = buildConciergeContext({ ...base(), flags: { ...DEFAULT_FLAGS, moments_enabled: false, ai_concierge_enabled: false } });
    expect(off.screens).not.toContain('moments');
    expect(off.screens).not.toContain('concierge_memory');
    expect(off.screens).toContain('urine_check');
    const on = buildConciergeContext({ ...base(), flags: DEMO_ALL_ON_FLAGS });
    expect(on.screens).toContain('moments');
    expect(on.screens).toContain('concierge_memory');
  });

  it('passes member-stated facts through untouched and never infers them', () => {
    const ctx = buildConciergeContext({ ...base(), stated: { destination: 'Denver', destinationTimeZone: 'America/Denver' } });
    expect(ctx.stated).toEqual({ destination: 'Denver', destinationTimeZone: 'America/Denver' });
    expect(buildConciergeContext(base()).stated).toBeUndefined();
  });

  it('falls back to the Decision Guard command when the engine command is blocked', () => {
    const ctx = buildConciergeContext({
      ...base(),
      engine: engine({
        command: { id: 'bad', action: 'Drink 300 oz now', explanation: '', urgencyLevel: 'high', estimatedImpact: '' },
      }),
    });
    expect(ctx.command?.guard).toBe('blocked');
    expect(ctx.command?.action).not.toMatch(/300 oz/);
  });
});

describe('summariseRecentDays', () => {
  it('groups real entries by local day, averages scores, counts logs, and never derives oz', () => {
    const days = summariseRecentDays(history, NOW, 7);
    expect(days).toHaveLength(2);
    expect(days[0]).toEqual({ date: '2026-10-05', avgScore: 70, logs: 1, oz: null });
    expect(days[1]).toEqual({ date: '2026-10-04', avgScore: 70, logs: 1, oz: null });
  });
  it('excludes synthetic anchors and entries outside the window', () => {
    const days = summariseRecentDays(history, NOW, 1);
    expect(days.map((d) => d.date)).toEqual(['2026-10-05']);
  });
});

describe('toLocalIso', () => {
  it('renders the device offset, not Z', () => {
    expect(toLocalIso(NOW)).toMatch(/^2026-10-05T14:05:00[+-]\d{2}:\d{2}$/);
  });
});
