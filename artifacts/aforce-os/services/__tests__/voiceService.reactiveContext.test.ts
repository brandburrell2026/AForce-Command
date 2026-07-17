/**
 * Section 64 Step 4 — Reactive full-context response (spec rule 5).
 *
 * When a user initiates, the coach answers with full context already loaded —
 * current HydroState, active Recovery Window status, recent Adaptive Response
 * patterns, and the relevant Personal Response Library entry — "never starting
 * from zero." These tests assert the four sources compose when present AND that
 * the path degrades gracefully when any is empty (the first-week reality of a
 * new user with no library is a valid answer, never a crash).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import i18n from 'i18next';
import en from '../../locales/en.json';
import {
  composeReactiveContext, processTranscript, type VoiceContext,
} from '../voiceService';
import { isCompliantCoachLine } from '../../utils/intelligence/conversationalLanguage';
import type { ScoreEngineOutput } from '../../types';
import type {
  AdaptiveResponseProfile, PersonalResponseEntry, ResponseCategory, ResponseOutcome,
} from '../../types/adaptiveResponse';

// voiceService imports i18next directly; init the English bundle so the reactive
// buildResponse renders (mirrors the proactive test).
beforeAll(async () => {
  if (!i18n.isInitialized) {
    await i18n.init({
      lng: 'en', fallbackLng: 'en',
      resources: { en: { translation: en } },
      interpolation: { escapeValue: false }, returnNull: false,
    });
  }
});

const FLAGS_ON = { conversational_intelligence_enabled: true } as const;
const FLAGS_OFF = { conversational_intelligence_enabled: false } as const;

const ALL_CATEGORIES: ResponseCategory[] = [
  'heat', 'hydration', 'recovery', 'sleep', 'caffeine', 'alcohol',
  'travel', 'training', 'cramp', 'recovery_speed', 'performance_consistency',
];

function insufficient(category: ResponseCategory): PersonalResponseEntry {
  return { category, status: 'insufficient', sampleSize: 0, whatWorked: null, confidenceAfterAction: null };
}
function ready(category: ResponseCategory, outcome: ResponseOutcome, confidence: number): PersonalResponseEntry {
  return {
    category, status: 'ready', sampleSize: 8,
    whatWorked: { sampleSize: 8, followed: 6, followedRate: 0.75, outcome },
    confidenceAfterAction: confidence,
  };
}
/** A full profile — every category insufficient — then apply the ready overrides. */
function makeProfile(overrides: Partial<Record<ResponseCategory, PersonalResponseEntry>> = {}): AdaptiveResponseProfile {
  const p = {} as AdaptiveResponseProfile;
  for (const c of ALL_CATEGORIES) p[c] = overrides[c] ?? insufficient(c);
  return p;
}

interface CtxOpts { score?: number; inRecoveryWindow?: boolean; adaptiveProfile?: AdaptiveResponseProfile; }
function makeCtx(opts: CtxOpts = {}): VoiceContext {
  const { score = 72, inRecoveryWindow = false, adaptiveProfile } = opts;
  return {
    engineOutput: {
      score,
      performanceState: { level: 'BALANCED', score },
      command: { action: 'Drink 16 oz water.', urgencyLevel: 'low' },
      riskTimer: { minutes: 20, seconds: 0, urgency: 'low' },
      social: inRecoveryWindow ? { inRecoveryWindow: true } : null,
    } as unknown as ScoreEngineOutput,
    ...(adaptiveProfile ? { adaptiveProfile } : {}),
  };
}

describe('Section 64 rule 5 — composeReactiveContext', () => {
  it('is inert in production: flag OFF returns null (reactive path unchanged)', () => {
    const load = composeReactiveContext(makeCtx({ adaptiveProfile: makeProfile() }), FLAGS_OFF);
    expect(load).toBeNull();
  });

  it('composes ALL FOUR sources when all are present', () => {
    const profile = makeProfile({
      hydration: ready('hydration', 'improved', 0.9),
      recovery: ready('recovery', 'steady', 0.6),
    });
    const load = composeReactiveContext(makeCtx({ score: 78, inRecoveryWindow: true, adaptiveProfile: profile }), FLAGS_ON);
    expect(load).not.toBeNull();
    // 1 HydroState, 2 Recovery Window, 3 Adaptive patterns, 4 Personal Library
    expect(load!.sources).toEqual(
      expect.arrayContaining(['hydroState', 'recoveryWindow', 'adaptivePatterns', 'personalLibrary']),
    );
    expect(load!.sources).toHaveLength(4);
    expect(load!.hydroState.score).toBe(78);
    expect(load!.recoveryWindowActive).toBe(true);
    // strongest ready entry wins (hydration @0.9 over recovery @0.6)
    expect(load!.personalEntry?.category).toBe('hydration');
    expect(load!.learnedPatterns).toEqual(expect.arrayContaining(['hydration', 'recovery']));
    // detail reflects all four and stays observation-only
    expect(load!.detail).toContain('Readiness 78');
    expect(load!.detail).toContain('Recovery window open');
    // own-data co-occurrence of the MEASURED variable (logged energy), not readiness, not causal
    expect(load!.detail).toContain('On days you followed your hydration response, your logged energy has tended to run higher');
    expect(load!.detail).not.toMatch(/readiness (rose|tended)/i); // never attribute readiness to the behavior
    expect(isCompliantCoachLine(load!.detail)).toBe(true);
  });

  it('degrades gracefully for a brand-new user with NO library — never from zero, never a crash', () => {
    // No adaptiveProfile at all, no recovery window.
    const load = composeReactiveContext(makeCtx({ score: 65 }), FLAGS_ON);
    expect(load).not.toBeNull();
    // The always-loaded sources still answer — HydroState + Recovery Window status.
    expect(load!.sources).toEqual(['hydroState', 'recoveryWindow']);
    expect(load!.learnedPatterns).toEqual([]);
    expect(load!.personalEntry).toBeNull();
    expect(load!.detail).toContain('Readiness 65'); // not empty — never "starts from zero"
    expect(isCompliantCoachLine(load!.detail)).toBe(true);
  });

  it('degrades gracefully when the library exists but every entry is insufficient', () => {
    const load = composeReactiveContext(makeCtx({ adaptiveProfile: makeProfile() }), FLAGS_ON);
    expect(load).not.toBeNull();
    expect(load!.sources).toEqual(['hydroState', 'recoveryWindow']);
    expect(load!.personalEntry).toBeNull();
    expect(isCompliantCoachLine(load!.detail)).toBe(true);
  });

  it('partial: a ready library but no active recovery window still loads three sources', () => {
    const profile = makeProfile({ training: ready('training', 'improved', 0.8) });
    const load = composeReactiveContext(makeCtx({ inRecoveryWindow: false, adaptiveProfile: profile }), FLAGS_ON);
    expect(load!.sources).toEqual(expect.arrayContaining(['hydroState', 'recoveryWindow', 'adaptivePatterns', 'personalLibrary']));
    expect(load!.recoveryWindowActive).toBe(false);
    expect(load!.detail).not.toContain('Recovery window open'); // status loaded but not asserted when closed
    expect(load!.personalEntry?.category).toBe('training');
    expect(isCompliantCoachLine(load!.detail)).toBe(true);
  });

  it('the composed detail is observation-only for every outcome (no risk/diagnosis/prevent, no comparison)', () => {
    (['improved', 'steady', 'declined', 'unknown'] as ResponseOutcome[]).forEach((outcome) => {
      const profile = makeProfile({ hydration: ready('hydration', outcome, 0.7) });
      const load = composeReactiveContext(makeCtx({ inRecoveryWindow: true, adaptiveProfile: profile }), FLAGS_ON);
      expect(isCompliantCoachLine(load!.detail)).toBe(true);
    });
  });

  it('a non-finite score is omitted, never spoken as "Readiness NaN" (qa gap 1)', () => {
    [NaN, Infinity, -Infinity].forEach((score) => {
      const load = composeReactiveContext(makeCtx({ score, inRecoveryWindow: true }), FLAGS_ON);
      expect(load!.detail).not.toMatch(/NaN|Infinity/);
      expect(load!.detail).not.toContain('Readiness');
      expect(load!.detail).toContain('Recovery window open'); // other sources still answer
      expect(isCompliantCoachLine(load!.detail)).toBe(true);
    });
  });

  it("an 'unknown'-outcome ready entry is a learned pattern but NOT a personal-library source (sources match the line, qa gap 2)", () => {
    const profile = makeProfile({ hydration: ready('hydration', 'unknown', 0.9) });
    const load = composeReactiveContext(makeCtx({ adaptiveProfile: profile }), FLAGS_ON);
    expect(load!.learnedPatterns).toContain('hydration');       // still a learned pattern
    expect(load!.sources).toContain('adaptivePatterns');
    expect(load!.sources).not.toContain('personalLibrary');     // no directional line → no source
    expect(load!.personalEntry).toBeNull();
    expect(load!.detail).toContain('Your hydration pattern is building');
    expect(load!.detail).not.toContain('On days you followed');
  });

  it("a malformed 'ready' entry with null whatWorked contributes a pattern but no personal line (qa gap 3)", () => {
    const malformed: PersonalResponseEntry = {
      category: 'hydration', status: 'ready', sampleSize: 6, whatWorked: null, confidenceAfterAction: 0.9,
    };
    const load = composeReactiveContext(makeCtx({ adaptiveProfile: makeProfile({ hydration: malformed }) }), FLAGS_ON);
    expect(load!.learnedPatterns).toContain('hydration');
    expect(load!.personalEntry).toBeNull();                     // never feeds composeContextDetail
    expect(isCompliantCoachLine(load!.detail)).toBe(true);
  });

  it('confidence tie-break is deterministic; a null-confidence entry loses to a positive one (qa gap 4)', () => {
    // equal confidence → earliest category in profile order wins (heat before hydration)
    const tie = composeReactiveContext(makeCtx({ adaptiveProfile: makeProfile({
      heat: ready('heat', 'improved', 0.8), hydration: ready('hydration', 'improved', 0.8),
    }) }), FLAGS_ON);
    expect(tie!.personalEntry?.category).toBe('heat');
    // null confidence must lose to a positive one, never win by coercion surprise
    const nullConf: PersonalResponseEntry = {
      category: 'heat', status: 'ready', sampleSize: 6,
      whatWorked: { sampleSize: 6, followed: 4, followedRate: 0.66, outcome: 'improved' },
      confidenceAfterAction: null,
    };
    const load = composeReactiveContext(makeCtx({ adaptiveProfile: makeProfile({
      heat: nullConf, hydration: ready('hydration', 'improved', 0.5),
    }) }), FLAGS_ON);
    expect(load!.personalEntry?.category).toBe('hydration');
  });
});

describe('Section 64 rule 5 — processTranscript enrichment', () => {
  const profile = makeProfile({ hydration: ready('hydration', 'improved', 0.9) });

  it('no flags argument → response is unchanged (every existing caller is safe)', () => {
    const ctx = makeCtx({ inRecoveryWindow: true, adaptiveProfile: profile });
    const base = processTranscript('log a stick', ctx);
    expect(base.detail ?? '').not.toContain('Readiness');
  });

  it('flag OFF → response is unchanged (production binary)', () => {
    const ctx = makeCtx({ inRecoveryWindow: true, adaptiveProfile: profile });
    const off = processTranscript('log a stick', ctx, FLAGS_OFF);
    expect(off.detail ?? '').not.toContain('Readiness');
  });

  it('flag ON → the answer carries the loaded context, in one exchange', () => {
    const ctx = makeCtx({ score: 80, inRecoveryWindow: true, adaptiveProfile: profile });
    const on = processTranscript('log a stick', ctx, FLAGS_ON);
    expect(on.detail).toContain('Readiness 80');
    expect(on.detail).toContain('On days you followed your hydration response, your logged energy has tended to run higher');
    expect(isCompliantCoachLine(on.detail!)).toBe(true);
  });
});
