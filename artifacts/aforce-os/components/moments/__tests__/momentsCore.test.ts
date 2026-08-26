/**
 * AForce Moments core — unit tests over the pure recommendation engine
 * (services/momentRecommendation.ts) and presentation module. The contract:
 * windows and actions come from config tunables (never inlined), the ritual
 * is always the four stages in order with time-derived states, evidence
 * carries only real signals (missing inputs degrade confidence, never
 * fabricate), Water-First (primary is always hydration), and no numeric
 * moment score exists anywhere.
 */
import { describe, it, expect } from 'vitest';

import type { Moment } from '@/types/moments';
import { af } from '@/theme';
import {
  buildRecommendation,
  surfaceableMoments,
  nextMoment,
} from '@/services/momentRecommendation';
import {
  MOMENT_PREP_WINDOW_MIN,
  MOMENT_HYDRATE_OZ,
} from '@/config/hydroStateModel';
import {
  accentForType,
  windowPosture,
  startsIn,
  daySummary,
  buildListRow,
  ritualStageA11yLabel,
  stageStateLabelKey,
} from '../momentsPresentation';

const NOW = '2026-08-12T17:38:00.000Z'; // 22 min before a 6:00 PM (18:00Z) moment

function moment(overrides: Partial<Moment> = {}): Moment {
  return {
    id: 'm1',
    source: 'manual',
    title: 'Investor Meeting',
    type: 'work',
    importance: 'high',
    startAtIso: '2026-08-12T18:00:00.000Z',
    createdAtIso: '2026-08-12T09:00:00.000Z',
    ...overrides,
  };
}

describe('buildRecommendation — windows and actions from config', () => {
  const rec = buildRecommendation(moment(), { hydrationPct: 62, streakDays: 5 }, NOW);

  it('derives the prep window from MOMENT_PREP_WINDOW_MIN (work: 60→30 before)', () => {
    expect(MOMENT_PREP_WINDOW_MIN.work).toEqual({ startBefore: 60, endBefore: 30 });
    expect(rec.prepWindowStartIso).toBe('2026-08-12T17:00:00.000Z');
    expect(rec.prepWindowEndIso).toBe('2026-08-12T17:30:00.000Z');
  });

  it('is Water-First: primary is always hydration with config ounces + best-before', () => {
    expect(rec.primaryAction.kind).toBe('hydrate');
    expect(rec.primaryAction.labelParams).toMatchObject({ oz: MOMENT_HYDRATE_OZ.work[0] });
    // best-before = window midpoint (fraction 0.5 in config)
    expect(rec.primaryAction.bestBeforeIso).toBe('2026-08-12T17:15:00.000Z');
  });

  it('never exceeds two actions; work carries only the primary', () => {
    expect(rec.secondaryAction).toBeUndefined();
    expect(buildRecommendation(moment({ type: 'training' }), {}, NOW).secondaryAction?.kind).toBe(
      'electrolytes',
    );
    expect(buildRecommendation(moment({ type: 'travel' }), {}, NOW).secondaryAction?.kind).toBe(
      'breathe',
    );
  });
});

describe('buildRecommendation — the four-stage ritual', () => {
  it('is always PAUSE → HYDRATE → LOCK IN → PERFORM with time-derived states', () => {
    const rec = buildRecommendation(moment(), {}, NOW);
    expect(rec.ritual.map((s) => s.key)).toEqual(['pause', 'hydrate', 'lock_in', 'perform']);
    // At NOW (17:38Z): pause window passed, hydrate best-before passed,
    // lock-in (17:45Z) not yet reached, perform upcoming.
    expect(rec.ritual.map((s) => s.state)).toEqual([
      'completed',
      'completed',
      'upcoming',
      'upcoming',
    ]);
  });

  it('inside the hydrate window the hydrate stage is active', () => {
    const rec = buildRecommendation(moment(), {}, '2026-08-12T17:05:00.000Z');
    expect(rec.ritual[1]).toMatchObject({ key: 'hydrate', state: 'active' });
  });

  it('I\'M READY (preparedAtIso) completes the prep stages', () => {
    const rec = buildRecommendation(moment({ preparedAtIso: NOW }), {}, NOW);
    expect(rec.ritual.slice(0, 3).every((s) => s.state === 'completed')).toBe(true);
    expect(rec.ritual[3]!.state).toBe('active'); // perform armed
  });
});

describe('buildRecommendation — fail-closed evidence', () => {
  it('cites only real signals; missing hydration lowers confidence, never fabricates', () => {
    const withSignals = buildRecommendation(moment(), { hydrationPct: 62 }, NOW);
    expect(withSignals.evidence.integrity).toBe('matched');
    expect(withSignals.evidence.confidence).toBe('high');
    expect(withSignals.evidence.items.some((i) => i.key === 'hydration_progress')).toBe(true);

    const bare = buildRecommendation(moment(), {}, NOW);
    expect(bare.evidence.confidence).toBe('medium');
    expect(bare.evidence.items.some((i) => i.key === 'hydration_progress')).toBe(false);
    // timing + type always present (the founder's no-wearable fallback)
    expect(bare.evidence.items.map((i) => i.key)).toEqual(
      expect.arrayContaining(['moment_timing', 'moment_type']),
    );
  });

  it('exposes no numeric score anywhere on the recommendation', () => {
    const rec = buildRecommendation(moment(), { hydrationPct: 62 }, NOW) as unknown as Record<
      string,
      unknown
    >;
    expect(Object.keys(rec)).not.toContain('score');
    expect(rec['confidence']).toMatch(/^(high|medium|low)$/); // enum, never a number
  });
});

describe('surfacing', () => {
  const set: Moment[] = [
    moment({ id: 'past', startAtIso: '2026-08-12T11:30:00.000Z' }), // earlier today
    moment({ id: 'next', startAtIso: '2026-08-12T18:00:00.000Z' }),
    moment({ id: 'later', startAtIso: '2026-08-13T01:15:00.000Z' }),
    moment({ id: 'beyond', startAtIso: '2026-08-14T18:00:00.000Z' }), // outside horizon
    moment({ id: 'yesterday', startAtIso: '2026-08-11T18:00:00.000Z' }),
  ];

  it('keeps today + horizon, drops yesterday and beyond, sorts soonest first', () => {
    expect(surfaceableMoments(set, NOW).map((m) => m.id)).toEqual(['past', 'next', 'later']);
  });

  it('nextMoment is the first not-yet-started', () => {
    expect(nextMoment(set, NOW)?.id).toBe('next');
  });
});

describe('presentation', () => {
  it('accents map per founder comp (green/amber/violet), never statusColor', () => {
    expect(accentForType('work')).toBe(af.green);
    expect(accentForType('training')).toBe(af.amber);
    expect(accentForType('travel')).toBe(af.travel);
  });

  it('windowPosture + startsIn are deterministic from nowIso', () => {
    const rec = buildRecommendation(moment(), {}, NOW);
    expect(windowPosture(rec, moment().startAtIso, NOW)).toBe('active');
    expect(startsIn(moment().startAtIso, NOW)).toEqual({ hours: 0, minutes: 22 });
    expect(startsIn(moment().startAtIso, '2026-08-12T19:00:00.000Z')).toBeNull();
  });

  it('every ritual stage state is readable as WORDS, not just a green', () => {
    // completed / active are named; an upcoming stage's clock time is its own
    // label (stageStateLabelKey returns null and the row renders the time).
    expect(stageStateLabelKey('completed')).toBe('moments.stage_done');
    expect(stageStateLabelKey('active')).toBe('moments.do_this_now');
    expect(stageStateLabelKey('upcoming')).toBeNull();
    // No two states share a word — colour is never the only differentiator.
    const labelled = ['completed', 'active'] as const;
    expect(new Set(labelled.map(stageStateLabelKey)).size).toBe(labelled.length);
  });

  it('a ritual stage announces as ONE sentence: what it is, where it stands, what to do', () => {
    expect(ritualStageA11yLabel('HYDRATE', 'DO THIS NOW', 'Drink 12 oz of water')).toBe(
      'HYDRATE, DO THIS NOW, Drink 12 oz of water',
    );
    // An empty piece must not leave a dangling separator mid-sentence.
    expect(ritualStageA11yLabel('PERFORM', '', 'Enter the meeting prepared')).toBe(
      'PERFORM, Enter the meeting prepared',
    );
    expect(ritualStageA11yLabel('PAUSE', '   ', '')).toBe('PAUSE');
  });

  it('list rows carry posture + accent; daySummary counts prep-worthy honestly', () => {
    const rec = buildRecommendation(moment(), {}, NOW);
    const row = buildListRow(moment(), rec, NOW);
    expect(row).toMatchObject({ momentId: 'm1', posture: 'active', accent: af.green });
    expect(
      daySummary([moment(), moment({ id: 'm2', importance: 'low' })]),
    ).toEqual({ total: 2, prepWorthy: 1 });
  });
});
