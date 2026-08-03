import { describe, it, expect } from 'vitest';
import {
  resolveCruiseModeView,
  CRUISE_DISCLAIMER,
  EMPTY_SELF_LOG,
  type CruiseModeInput,
} from '../cruiseModeView';
import { CRUISE_FIXTURES } from '../cruiseModeFixtures';

const r = (k: keyof typeof CRUISE_FIXTURES) => resolveCruiseModeView(CRUISE_FIXTURES[k]);

describe('resolveCruiseModeView — readiness bands', () => {
  it('high real score → LOCKED IN, green', () => {
    const v = r('live-locked-in');
    expect(v.readiness.posture).toBe('ready');
    expect(v.readiness.statusKey).toBe('LOCKED_IN');
    expect(v.readiness.tone).toBe('green');
    expect(v.readiness.score).toBe(88);
    expect(v.readiness.ring.progress).toBeCloseTo(0.88, 5);
  });

  it('mid real score, nothing logged → BALANCED, cyan', () => {
    const v = r('live-balanced');
    expect(v.readiness.statusKey).toBe('BALANCED');
    expect(v.readiness.tone).toBe('cyan');
    expect(v.readiness.recheckLabel).toMatch(/Next check in \d+ min/);
  });

  it('logged heavy day + hot port erodes into RECOVERING/RESET', () => {
    const rec = r('live-recovering');
    expect(['RECOVERING', 'RESET_NEEDED']).toContain(rec.readiness.statusKey);
    const reset = r('live-reset-needed');
    expect(reset.readiness.statusKey).toBe('RESET_NEEDED');
    expect(reset.readiness.tone).toBe('red');
  });

  it('uses live conditions flag reflects the OpenWeather source', () => {
    expect(r('live-balanced').readiness.usesLiveConditions).toBe(true);
    expect(r('pilot-fallback').readiness.usesLiveConditions).toBe(false);
    expect(r('offline').readiness.usesLiveConditions).toBe(false);
  });
});

describe('honesty — building state never fabricates a score', () => {
  it('null score → building posture, em-dash, no recheck', () => {
    const v = r('building');
    expect(v.readiness.posture).toBe('building');
    expect(v.readiness.score).toBeNull();
    expect(v.readiness.scoreLabel).toBe('—');
    expect(v.readiness.statusKey).toBeNull();
    expect(v.readiness.statusLabel).toBe('BUILDING SIGNAL');
    expect(v.readiness.recheckLabel).toBeNull();
    expect(v.readiness.ring.progress).toBe(0);
  });

  it('building recovery card shows honest deferral, no risk', () => {
    const v = r('building');
    expect(v.recovery.hasSignal).toBe(false);
    expect(v.recovery.reasons).toHaveLength(0);
    expect(v.recovery.emptyCopy).toMatch(/once your readiness signal is established/i);
  });
});

describe('honesty — environment shows only real, present values', () => {
  it('live source → LIVE chip + all 5 real cells, wind is a real number', () => {
    const v = r('live-balanced').environment;
    expect(v.source.key).toBe('live');
    expect(v.source.label).toBe('LIVE');
    expect(v.hasLiveData).toBe(true);
    expect(v.cells.map((c) => c.key).sort()).toEqual(['heat', 'humidity', 'sun', 'temp', 'wind']);
    const wind = v.cells.find((c) => c.key === 'wind');
    expect(wind?.value).toMatch(/^\d+ kts$/);
  });

  it('offline → OFFLINE chip, NO environment cells (never invents weather)', () => {
    const v = r('offline').environment;
    expect(v.source.key).toBe('offline');
    expect(v.hasLiveData).toBe(false);
    expect(v.cells).toHaveLength(0);
    expect(v.conditions).toBeNull();
  });

  it('loading → FETCHING chip, no cells yet', () => {
    const v = r('loading').environment;
    expect(v.source.key).toBe('loading');
    expect(v.cells).toHaveLength(0);
  });

  it('server fallback → PILOT DATA chip (honestly labelled, not "live")', () => {
    const v = r('pilot-fallback').environment;
    expect(v.source.key).toBe('pilot');
    expect(v.source.label).toBe('PILOT DATA');
    expect(v.hasLiveData).toBe(true); // baseline numbers exist, just not from the live feed
  });

  it('heat-index cell gets an amber/red accent only when hot', () => {
    const hot = r('live-recovering').environment.cells.find((c) => c.key === 'heat');
    expect(['amber', 'red']).toContain(hot?.accentTone);
    // A mild environment carries no heat accent.
    const mild = resolveCruiseModeView({
      ...CRUISE_FIXTURES['live-balanced'],
      env: { ...CRUISE_FIXTURES['live-balanced'].env!, ambientTempF: 78, humidityPct: 40 },
    }).environment.cells.find((c) => c.key === 'heat');
    expect(mild?.accentTone).toBeUndefined();
  });

  it('journey intensity derives from the guest-declared excursion risk, hidden when none', () => {
    expect(r('live-balanced').environment.journeyIntensity).toBeNull(); // excursionRisk 'none'
    expect(r('port-day-logged').environment.journeyIntensity?.label).toBe('MODERATE');
  });
});

describe('honesty — self-log is first-party, never assumed', () => {
  it('empty log → every behavioural row reads "not logged / not set", empty hint present', () => {
    const v = r('live-balanced').day;
    expect(v.loggedAnything).toBe(false);
    expect(v.emptyHint).toMatch(/Nothing is assumed for you/i);
    const drinks = v.rows.find((row) => row.id === 'drinks');
    expect(drinks?.set).toBe(false);
    expect(drinks?.value).toBe('None logged');
    const sleep = v.rows.find((row) => row.id === 'sleep');
    expect(sleep?.value).toBe('Not provided');
  });

  it('populated log → rows reflect the guest values and mark themselves set', () => {
    const v = r('port-day-logged').day;
    expect(v.loggedAnything).toBe(true);
    expect(v.emptyHint).toBeNull();
    expect(v.dayModeLabel).toBe('Port Day');
    const drinks = v.rows.find((row) => row.id === 'drinks');
    expect(drinks?.set).toBe(true);
    expect(drinks?.value).toBe('1');
    const excursion = v.rows.find((row) => row.id === 'excursion');
    expect(excursion?.value).toBe('3 hr');
  });

  it('3+ drinks flags the drinks row amber', () => {
    const v = r('live-recovering').day.rows.find((row) => row.id === 'drinks');
    expect(v?.value).toBe('3');
    expect(v?.tone).toBe('amber');
  });

  it('rhythm is a labelled template that tracks day mode (guidance, not the real schedule)', () => {
    expect(r('live-balanced').day.rhythm[0]).toBe('Morning'); // sea day
    expect(r('port-day-logged').day.rhythm[0]).toBe('Pre-port hydrate'); // port day
  });
});

describe('recovery demand', () => {
  it('low risk + nothing logged → no-signal honest copy', () => {
    const v = r('live-locked-in').recovery;
    expect(v.hasSignal).toBe(false);
    expect(v.emptyCopy).toMatch(/No elevated recovery demand detected/i);
  });

  it('heavy logged day → real reasons surface', () => {
    const v = r('live-reset-needed').recovery;
    expect(v.hasSignal).toBe(true);
    expect(v.reasons.length).toBeGreaterThan(0);
    expect(v.reasons.length).toBeLessThanOrEqual(5);
  });
});

describe('log-water CTA is real or an honest preview', () => {
  it('wired → real Log water action, no preview note', () => {
    const v = r('live-balanced').logWater;
    expect(v.available).toBe(true);
    expect(v.label).toBe('Log water');
    expect(v.previewNote).toBeNull();
  });
  it('not wired → labelled Preview', () => {
    const v = r('log-water-preview').logWater;
    expect(v.available).toBe(false);
    expect(v.previewNote).toMatch(/Preview/i);
  });
});

describe('static scaffold + compliance', () => {
  it('carries the port-day checklist and cruise badges through', () => {
    const v = r('live-balanced');
    expect(v.checklist.length).toBeGreaterThan(0);
    expect(v.badges.length).toBeGreaterThan(0);
  });
  it('always renders the non-diagnostic compliance disclaimer', () => {
    expect(r('building').disclaimer).toBe(CRUISE_DISCLAIMER);
    expect(r('live-balanced').disclaimer).toMatch(/not a medical, diagnostic, safety, or navigation tool/i);
  });
  it('passes reduced-motion through', () => {
    expect(r('reduced-motion').reducedMotion).toBe(true);
    expect(r('live-balanced').reducedMotion).toBe(false);
  });
});

describe('resolver is pure — never mutates its input', () => {
  it('empty-log fixture is untouched after resolve', () => {
    const input: CruiseModeInput = {
      hydrationScore: 76, minutesSinceLastIntake: 40, env: null, envLoading: false,
      envError: false, portId: 'cozumel', ports: [], log: EMPTY_SELF_LOG,
      logWaterAvailable: true, reducedMotion: false,
    };
    const snapshot = JSON.stringify(input);
    resolveCruiseModeView(input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});
