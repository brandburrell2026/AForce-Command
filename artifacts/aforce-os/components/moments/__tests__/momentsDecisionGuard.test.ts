/**
 * Moments × Decision Guard — the founder-authorized extension of the #876
 * seam into the notification qualification chain (directive §10: "… recent
 * commands → notification fatigue → safety → Decision Guard →
 * RecoveryCommand eligibility").
 *
 * CONSCIOUS REPIN (RP-3, 2026-08-31): the table-era pins are superseded by
 * the one-hydration-action law. Pinned here now:
 *  - scheduled notifications are CONTEXT-ONLY — no action, no oz, ever;
 *  - the in-app guard judges the canonical-command MIRROR structurally and
 *    textually, and a blocked mirror is DROPPED (silence), never rewritten
 *    into Moment-minted copy;
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
  evaluateDeliverableCopy,
  evaluateMomentAction,
  guardMomentRecommendation,
} from '@/utils/intelligence/decisionGuard';
import { DECISION_GUARD_MAX_DOSE_OZ } from '@/config/hydroStateModel';
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

describe('planner — scheduled notifications are context-only (RP-3)', () => {
  it('a poisoned action cannot reach a notification, because NO action reaches a notification', () => {
    // The old law dropped the poisoned candidate; the new architecture makes
    // the poison unreachable — the planner builds its rec commandless, so
    // the plan carries prep-window context and nothing else.
    const poisoned = localMoment(3, { id: 'm-poisoned' });
    const clean = localMoment(6, { id: 'm-clean' });
    const plan = planMomentNotifications([poisoned, clean], DEFAULT_MOMENT_NOTIFY_PREFS, NOW);
    expect(plan.map((p) => p.momentId)).toEqual(['m-poisoned', 'm-clean']);
    for (const p of plan) {
      const blob = JSON.stringify(p);
      expect(blob).not.toMatch(/\d+\s*oz/i);
      expect(blob).not.toMatch(/actionKey|hydrate/);
    }
  });

  it('a real moment of every type still plans', () => {
    const types: Moment['type'][] = ['work', 'performance', 'training', 'travel', 'recovery', 'personal'];
    for (const [i, type] of types.entries()) {
      const m = localMoment(4, { id: `m-real-${type}`, type });
      const plan = planMomentNotifications([m], DEFAULT_MOMENT_NOTIFY_PREFS, NOW);
      expect(plan, `type ${type} (#${i}) must still plan`).toHaveLength(1);
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
  // through to the real builder — so this IS a production-real rec, carrying
  // the canonical command mirror the way useMomentsData supplies it.
  const CANON = { id: 'cmd-balanced', action: 'Sip 12 oz of water now.' };
  const rec = () => buildRecommendation(localMoment(3, { id: 'm-guard' }), { canonicalCommand: CANON }, NOW);

  it('approved: SAME rec reference — production is byte-identical', () => {
    const input = rec();
    const g = guardMomentRecommendation(input);
    expect(g.result).toEqual({ verdict: 'approved' });
    expect(g.rec).toBe(input);
  });

  it('blocked primary → DROPPED, hydrate stage with it — silence, never a minted substitute', () => {
    // CONSCIOUS REPIN (RP-3): the old degrade path minted "Hydrate — water
    // first", itself a Moment-originated hydration action. A Moment that
    // cannot faithfully mirror the command says nothing.
    const input = rec();
    const poisoned = {
      ...input,
      primaryAction: { ...input.primaryAction!, labelParams: { oz: 900, ozMin: 900, ozMax: 900 } },
    };
    const g = guardMomentRecommendation(poisoned);
    expect(g.result).toEqual({ verdict: 'blocked', reason: 'unsafe_dose' });
    expect(g.rec.primaryAction).toBeUndefined();
    expect(g.rec.ritual.some((st) => st.key === 'hydrate')).toBe(false);
  });

  it('blocked secondary → dropped (optional everywhere); primary untouched', () => {
    const input = rec();
    const poisoned = {
      ...input,
      secondaryAction: {
        kind: 'breathe' as const,
        labelKey: 'moments.action.breathe',
        labelParams: { oz: -4 },
      },
    };
    const g = guardMomentRecommendation(poisoned);
    expect(g.result.verdict).toBe('blocked');
    expect(g.rec.secondaryAction).toBeUndefined();
    expect(g.rec.primaryAction).toBe(input.primaryAction);
  });

  it('poisoned ritual stage → DROPPED; the surviving order is preserved', () => {
    // CONSCIOUS REPIN (RP-3): no neutral rewrite — an out-of-contract stage
    // is removed, exactly like a blocked mirror.
    const input = rec();
    const poisoned = {
      ...input,
      ritual: input.ritual.map((s) =>
        s.key === 'hydrate' ? { ...s, instructionParams: { ozMin: 700, ozMax: 900 } } : s,
      ),
    };
    const g = guardMomentRecommendation(poisoned);
    expect(g.result).toEqual({ verdict: 'blocked', reason: 'unsafe_dose' });
    expect(g.rec.ritual.some((st) => st.key === 'hydrate')).toBe(false);
    expect(g.rec.ritual.map((st) => st.key)).toEqual(['pause', 'lock_in', 'perform']);
  });

  it('FIXED POINT: a guarded rec re-guards approved', () => {
    const input = rec();
    const poisoned = {
      ...input,
      primaryAction: { ...input.primaryAction!, labelParams: { oz: 900 } },
    };
    const once = guardMomentRecommendation(poisoned);
    const twice = guardMomentRecommendation(once.rec);
    expect(twice.result).toEqual({ verdict: 'approved' });
    expect(twice.rec).toBe(once.rec);
  });
});

describe('mirror locale keys — pure passthrough, nothing authored', () => {
  it('en.json carries the canonical_command passthroughs and no hydrate authoring keys', async () => {
    const en = (await import('@/locales/en.json')).default as {
      moments: { action: Record<string, string>; ritual: Record<string, string> };
    };
    // The mirror template adds NOTHING to the command — a Moment may not
    // reword, qualify, or decorate the hydration action.
    expect(en.moments.action['canonical_command']).toBe('{{action}}');
    expect(en.moments.ritual['canonical_command']).toBe('{{action}}');
    for (const dead of ['hydrate_exact', 'hydrate_range', 'hydrate_fallback', 'electrolytes']) {
      expect(en.moments.action[dead], `moments.action.${dead} must be gone`).toBeUndefined();
    }
    expect(en.moments.ritual['hydrate']).toBeUndefined();
    expect(en.moments.ritual['hydrate_fallback']).toBeUndefined();
  });
});
