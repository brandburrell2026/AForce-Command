/**
 * Moments × Decision Guard — the founder-authorized extension of the #876
 * seam into the notification qualification chain (directive §10: "… recent
 * commands → notification fatigue → safety → Decision Guard →
 * RecoveryCommand eligibility").
 *
 * Pinned here:
 *  - the pure planner DROPS a candidate whose recommendation carries an
 *    out-of-contract deliverable action (fail-closed, like quiet hours) —
 *    and keeps planning clean candidates around it;
 *  - production behavior is unchanged: every real MOMENT_HYDRATE_OZ value
 *    is inside the guard's dose contract, so today's plans are identical;
 *  - the guard primitives themselves (evaluateMomentAction /
 *    evaluateDeliverableCopy) judge deterministically.
 *
 * The sync bridge's rendered-copy backstop is source-pinned in
 * store/__tests__/decisionGuardSeam.lock.test.ts (notificationHonesty
 * idiom — the bridge is IO; the seam lock proves the gate precedes the
 * schedule call).
 */
import { describe, it, expect, vi } from 'vitest';

import type { Moment } from '@/types/moments';
import { buildRecommendation } from '@/services/momentRecommendation';
import {
  planMomentNotifications,
  DEFAULT_MOMENT_NOTIFY_PREFS,
} from '@/services/momentNotifications';
import {
  DECISION_GUARD_MOMENT_ACTION_FALLBACK_KEY,
  DECISION_GUARD_MOMENT_RITUAL_FALLBACK_KEY,
  evaluateDeliverableCopy,
  evaluateMomentAction,
  guardMomentRecommendation,
} from '@/utils/intelligence/decisionGuard';
import {
  DECISION_GUARD_MAX_DOSE_OZ,
  MOMENT_HYDRATE_OZ,
} from '@/config/hydroStateModel';
import { BLOCKING_PROHIBITED_CONCEPTS } from '@/utils/intelligence/languageGate/runtimeClaimScan';

// Poison exactly one moment's recommendation through the real builder:
// the mock delegates to the actual module and corrupts only the marker
// moment's oz params — everything else is production-real.
vi.mock('@/services/momentRecommendation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/momentRecommendation')>();
  return {
    ...actual,
    buildRecommendation: (
      moment: Moment,
      signals: Parameters<typeof actual.buildRecommendation>[1],
      nowIso: string,
    ) => {
      const rec = actual.buildRecommendation(moment, signals, nowIso);
      if (moment.id === 'm-poisoned') {
        return {
          ...rec,
          primaryAction: {
            ...rec.primaryAction,
            labelParams: { ozMin: 900, ozMax: 900, oz: 900 },
          },
        };
      }
      return rec;
    },
  };
});

const NOW = new Date(2026, 7, 12, 12, 0, 0).toISOString();

function localMoment(hoursFromNow: number, overrides: Partial<Moment> = {}): Moment {
  const start = new Date(2026, 7, 12, 12, 0, 0);
  start.setMinutes(start.getMinutes() + Math.round(hoursFromNow * 60));
  return {
    id: overrides.id ?? `m-${hoursFromNow}`,
    source: 'manual',
    title: 'Investor Meeting',
    type: 'work',
    importance: 'high',
    startAtIso: start.toISOString(),
    createdAtIso: NOW,
    ...overrides,
  } as Moment;
}

describe('planner — Decision Guard is the last qualification step', () => {
  it('drops a candidate whose action left the dose contract; clean candidates still plan', () => {
    const poisoned = localMoment(3, { id: 'm-poisoned' });
    const clean = localMoment(6, { id: 'm-clean' });
    const plan = planMomentNotifications([poisoned, clean], DEFAULT_MOMENT_NOTIFY_PREFS, NOW);
    expect(plan.map((p) => p.momentId)).toEqual(['m-clean']);
  });

  it('production behavior unchanged: a real moment of every type still plans', () => {
    for (const [i, type] of (Object.keys(MOMENT_HYDRATE_OZ) as Moment['type'][]).entries()) {
      const m = localMoment(4, { id: `m-real-${type}`, type });
      const plan = planMomentNotifications([m], DEFAULT_MOMENT_NOTIFY_PREFS, NOW);
      expect(plan, `type ${type} (#${i}) must still plan`).toHaveLength(1);
    }
  });

  it('every configured MOMENT_HYDRATE_OZ value is inside the guard contract (non-vacuous)', () => {
    for (const [type, [lo, hi]] of Object.entries(MOMENT_HYDRATE_OZ)) {
      expect(lo, `${type} low bound`).toBeGreaterThan(0);
      expect(hi, `${type} high bound`).toBeLessThanOrEqual(DECISION_GUARD_MAX_DOSE_OZ);
    }
  });
});

describe('evaluateMomentAction — structural verdicts', () => {
  const action = (params?: Record<string, string | number>) => ({
    labelKey: 'moments.action.hydrate_exact',
    labelParams: params,
  });

  it('approves in-contract actions (with and without params)', () => {
    expect(evaluateMomentAction(action({ oz: 12, ozMin: 12, ozMax: 16 }))).toEqual({
      verdict: 'approved',
    });
    expect(evaluateMomentAction({ labelKey: 'moments.action.breathe' })).toEqual({
      verdict: 'approved',
    });
  });

  it('blocks out-of-bounds, zero, negative, non-finite, and non-numeric oz params', () => {
    const cases: Record<string, string | number>[] = [
      { oz: DECISION_GUARD_MAX_DOSE_OZ + 1 },
      { ozMax: 900 },
      { ozMin: 0 },
      { oz: -8 },
      { oz: Number.NaN },
      { oz: '16' },
    ];
    for (const params of cases) {
      expect(evaluateMomentAction(action(params))).toEqual({
        verdict: 'blocked',
        reason: 'unsafe_dose',
      });
    }
  });

  it('blocks a malformed action (missing labelKey)', () => {
    expect(evaluateMomentAction({ labelKey: '' })).toEqual({
      verdict: 'blocked',
      reason: 'malformed',
    });
  });
});

describe('evaluateDeliverableCopy — rendered-string verdicts', () => {
  it('approves real rendered notification copy', () => {
    for (const text of [
      'Investor Meeting in 60 min',
      'Hydrate 16 oz.',
      'Begin hydration - 12-16 oz. Best before 2:30 PM.',
    ]) {
      expect(evaluateDeliverableCopy(text)).toEqual({ verdict: 'approved' });
    }
  });

  it('blocks a member-authored title that smuggles an unsafe dose', () => {
    expect(evaluateDeliverableCopy('Chug 500 oz challenge in 60 min')).toEqual({
      verdict: 'blocked',
      reason: 'unsafe_dose',
    });
  });

  it('blocks the §13 commercial-steering phrase class', () => {
    expect(evaluateDeliverableCopy('Bring an AForce stick to the meeting')).toEqual({
      verdict: 'blocked',
      reason: 'commercial_bias',
    });
  });

  it('blocks §42 block-severity concepts (registry-driven, non-brittle)', () => {
    const concept = BLOCKING_PROHIBITED_CONCEPTS[0];
    expect(concept).toBeTruthy();
    expect(evaluateDeliverableCopy(`Meeting prep — ${concept} today`)).toEqual({
      verdict: 'blocked',
      reason: 'blocked_language',
    });
  });
});

describe('guardMomentRecommendation — in-app delivery semantics', () => {
  // The delegating mock passes any id other than 'm-poisoned' straight
  // through to the real builder — so this IS a production-real rec.
  const rec = () => buildRecommendation(localMoment(3, { id: 'm-guard' }), {}, NOW);

  it('approved: SAME rec reference — production is byte-identical', () => {
    const input = rec();
    const g = guardMomentRecommendation(input);
    expect(g.result).toEqual({ verdict: 'approved' });
    expect(g.rec).toBe(input);
  });

  it('blocked primary → neutral water-first fallback; kind + timing survive', () => {
    const input = rec();
    const poisoned = {
      ...input,
      primaryAction: { ...input.primaryAction, labelParams: { oz: 900, ozMin: 900, ozMax: 900 } },
    };
    const g = guardMomentRecommendation(poisoned);
    expect(g.result).toEqual({ verdict: 'blocked', reason: 'unsafe_dose' });
    expect(g.rec.primaryAction.kind).toBe('hydrate'); // Water-First pin holds
    expect(g.rec.primaryAction.labelKey).toBe(DECISION_GUARD_MOMENT_ACTION_FALLBACK_KEY);
    expect(g.rec.primaryAction.labelParams).toBeUndefined();
    expect(g.rec.primaryAction.bestBeforeIso).toBe(input.primaryAction.bestBeforeIso);
  });

  it('blocked secondary → dropped (optional everywhere); primary untouched', () => {
    const input = rec();
    const poisoned = {
      ...input,
      secondaryAction: {
        kind: 'electrolytes' as const,
        labelKey: 'moments.action.electrolytes',
        labelParams: { oz: -4 },
      },
    };
    const g = guardMomentRecommendation(poisoned);
    expect(g.result.verdict).toBe('blocked');
    expect(g.rec.secondaryAction).toBeUndefined();
    expect(g.rec.primaryAction).toBe(input.primaryAction);
  });

  it('poisoned ritual stage → neutral instruction; 4 stages, order preserved', () => {
    const input = rec();
    const poisoned = {
      ...input,
      ritual: input.ritual.map((s) =>
        s.key === 'hydrate' ? { ...s, instructionParams: { ozMin: 700, ozMax: 900 } } : s,
      ),
    };
    const g = guardMomentRecommendation(poisoned);
    expect(g.result).toEqual({ verdict: 'blocked', reason: 'unsafe_dose' });
    expect(g.rec.ritual).toHaveLength(4);
    expect(g.rec.ritual.map((s) => s.key)).toEqual(input.ritual.map((s) => s.key));
    const hydrate = g.rec.ritual.find((s) => s.key === 'hydrate')!;
    expect(hydrate.instructionKey).toBe(DECISION_GUARD_MOMENT_RITUAL_FALLBACK_KEY);
    expect(hydrate.instructionParams).toBeUndefined();
  });

  it('FIXED POINT: a guarded rec re-guards approved', () => {
    const input = rec();
    const poisoned = {
      ...input,
      primaryAction: { ...input.primaryAction, labelParams: { oz: 900 } },
    };
    const once = guardMomentRecommendation(poisoned);
    const twice = guardMomentRecommendation(once.rec);
    expect(twice.result).toEqual({ verdict: 'approved' });
    expect(twice.rec).toBe(once.rec);
  });
});

describe('fallback locale copy — present, containment-clean', () => {
  it('en.json carries both EN-only fallback keys with dose/clock/product-free copy', async () => {
    const en = (await import('@/locales/en.json')).default as {
      moments: { action: Record<string, string>; ritual: Record<string, string> };
    };
    const action = en.moments.action['hydrate_fallback'];
    const ritual = en.moments.ritual['hydrate_fallback'];
    expect(action).toBeTruthy();
    expect(ritual).toBeTruthy();
    for (const text of [action, ritual]) {
      expect(text).not.toMatch(/\d+\s*(oz|ounce|stick|serving)/i);
      expect(text).not.toMatch(/recheck in \d/i);
      expect(text).not.toMatch(/AForce/);
      expect(text.toLowerCase()).toContain('water'); // water-first survives
      expect(evaluateDeliverableCopy(text)).toEqual({ verdict: 'approved' });
    }
  });
});
