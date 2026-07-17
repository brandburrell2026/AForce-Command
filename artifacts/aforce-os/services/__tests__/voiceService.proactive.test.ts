/**
 * Section 64 — Conversational Intelligence Architecture™ (Step 2 wiring).
 *
 * Tests the proactive, speak-first path (`buildProactiveCoachLine`): the
 * Silent-Intelligence gate (Water-First priority + silence when nothing adds
 * value), the flag gate, the observation-only language guard on every emitted
 * line, and Score-Protection (pure, no score mutation, no side-effecting action).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import i18n from 'i18next';
import en from '../../locales/en.json';

import {
  buildProactiveCoachLine,
  type VoiceContext,
  type ProactiveCoachExtras,
} from '../voiceService';
import { isCompliantCoachLine } from '../../utils/intelligence/conversationalLanguage';
import type { ScoreEngineOutput, PerformanceLevel } from '../../types';
import type { CommandUrgency } from '../../utils/intelligence/commandCategory';

// voiceService imports `i18next` directly (not the RN-pulling i18nService), so
// initialize the English bundle here with the same config the app uses.
beforeAll(async () => {
  if (!i18n.isInitialized) {
    await i18n.init({
      lng: 'en',
      fallbackLng: 'en',
      resources: { en: { translation: en } },
      interpolation: { escapeValue: false },
      returnNull: false,
    });
  }
});

const ACTION = 'Drink 16 oz water.';
const FLAGS_ON = { conversational_intelligence_enabled: true } as const;
const FLAGS_OFF = { conversational_intelligence_enabled: false } as const;

interface CtxOpts {
  level?: PerformanceLevel;
  score?: number;
  urgency?: CommandUrgency;
  action?: string;
  inRecoveryWindow?: boolean;
}

/** Minimal VoiceContext — only the fields the proactive path reads. */
function makeCtx(opts: CtxOpts = {}): VoiceContext {
  const {
    level = 'BALANCED', score = 70, urgency = 'low',
    action = ACTION, inRecoveryWindow = false,
  } = opts;
  return {
    engineOutput: {
      score,
      performanceState: { level, score },
      command: { action, urgencyLevel: urgency },
      social: inRecoveryWindow ? { inRecoveryWindow: true } : null,
    } as unknown as ScoreEngineOutput,
  };
}

function extras(e: Partial<ProactiveCoachExtras> = {}): ProactiveCoachExtras {
  return { commandFollowedToday: false, hasDailyLesson: false, ...e };
}

describe('Section 64 — proactive coach (buildProactiveCoachLine)', () => {
  it('stays silent when the flag is OFF, even with an urgent unacted command', () => {
    const out = buildProactiveCoachLine(makeCtx({ urgency: 'high' }), extras(), FLAGS_OFF);
    expect(out).toBeNull();
  });

  it('speaks Water-First on an urgent, unacted command', () => {
    const out = buildProactiveCoachLine(makeCtx({ urgency: 'high', action: ACTION }), extras(), FLAGS_ON);
    expect(out).not.toBeNull();
    expect(out!.intent).toBe('PROACTIVE_COACH');
    expect(out!.transcript).toBe('');
    expect(out!.action).toEqual({ type: 'NONE' });
    expect(out!.spoken).toBe(`Now — ${ACTION}`);
  });

  it('never nags: an already-followed command does not trigger the urgent line', () => {
    const out = buildProactiveCoachLine(
      makeCtx({ urgency: 'critical' }),
      extras({ commandFollowedToday: true }),
      FLAGS_ON,
    );
    expect(out).toBeNull();
  });

  it('honours Water-First priority: urgent command wins over recovery window and daily lesson', () => {
    const out = buildProactiveCoachLine(
      makeCtx({ urgency: 'high', inRecoveryWindow: true }),
      extras({ hasDailyLesson: true }),
      FLAGS_ON,
    );
    expect(out!.spoken).toBe(`Now — ${ACTION}`);
  });

  it('speaks the recovery-window line when the window is open and no urgent command is pending', () => {
    const out = buildProactiveCoachLine(
      makeCtx({ urgency: 'low', inRecoveryWindow: true }),
      extras({ commandFollowedToday: true, hasDailyLesson: true }),
      FLAGS_ON,
    );
    expect(out!.spoken).toBe(`Recovery window's open. ${ACTION}`);
  });

  it('speaks the daily-lesson line when only a notable lesson is ready', () => {
    const out = buildProactiveCoachLine(
      makeCtx({ urgency: 'low' }),
      extras({ commandFollowedToday: true, hasDailyLesson: true }),
      FLAGS_ON,
    );
    expect(out!.spoken).toBe('Your body taught us something today — worth a look.');
  });

  it('stays silent when nothing adds value (Constitution Principle 6)', () => {
    const out = buildProactiveCoachLine(
      makeCtx({ urgency: 'low', inRecoveryWindow: false }),
      extras({ commandFollowedToday: true, hasDailyLesson: false }),
      FLAGS_ON,
    );
    expect(out).toBeNull();
  });

  it('every emitted line passes the §64 observation-only language guard', () => {
    const speakingCases: Array<[CtxOpts, Partial<ProactiveCoachExtras>]> = [
      [{ urgency: 'high' }, {}],
      [{ urgency: 'low', inRecoveryWindow: true }, { commandFollowedToday: true }],
      [{ urgency: 'low' }, { commandFollowedToday: true, hasDailyLesson: true }],
    ];
    for (const [c, e] of speakingCases) {
      const out = buildProactiveCoachLine(makeCtx(c), extras(e), FLAGS_ON);
      expect(out, JSON.stringify(c)).not.toBeNull();
      expect(isCompliantCoachLine(out!.spoken), out!.spoken).toBe(true);
    }
  });

  it('Score-Protection: pure, never mutates the score, never emits a side-effecting action', () => {
    const ctx = makeCtx({ urgency: 'high', score: 55 });
    const first = buildProactiveCoachLine(ctx, extras(), FLAGS_ON);
    const second = buildProactiveCoachLine(ctx, extras(), FLAGS_ON);
    // Input snapshot is untouched…
    expect(ctx.engineOutput.score).toBe(55);
    // …output is deterministic (pure aside from the `at` timestamp)…
    expect(first!.spoken).toBe(second!.spoken);
    expect(first!.intent).toBe(second!.intent);
    // …and the proactive line is informational only — no score-mutating action.
    expect(first!.action.type).toBe('NONE');
  });
});
