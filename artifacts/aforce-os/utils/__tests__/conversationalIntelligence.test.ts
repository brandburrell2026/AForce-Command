import { describe, it, expect } from 'vitest';
import {
  assembleCoachContext,
  decideProactiveSpeech,
  proactiveLine,
  type CoachSignals,
} from '../intelligence/conversationalIntelligence';

function signals(over: Partial<CoachSignals> = {}): CoachSignals {
  return {
    level: 'BALANCED',
    score: 72,
    urgency: 'low',
    commandAction: 'Drink 16 oz water.',
    commandFollowedToday: false,
    recoveryWindowActive: false,
    hasDailyLesson: false,
    ...over,
  };
}

const ctx = (over: Partial<CoachSignals> = {}) => assembleCoachContext(signals(over));

describe('Section 64 — assembleCoachContext', () => {
  it('derives the persona mode from the band and carries every signal', () => {
    const c = assembleCoachContext(signals({ level: 'PEAK', score: 91 }));
    expect(c.mode).toBe('peak');
    expect(c.score).toBe(91);
    expect(c.commandAction).toBe('Drink 16 oz water.');
  });
});

describe('Section 64 — decideProactiveSpeech (Silent Intelligence)', () => {
  it('stays SILENT when nothing adds value (Principle 6)', () => {
    expect(decideProactiveSpeech(ctx())).toMatchObject({ speak: false, trigger: null });
  });

  it('speaks Water-First on an unacted high/critical command', () => {
    expect(decideProactiveSpeech(ctx({ urgency: 'high' })).trigger).toBe('urgent_command');
    expect(decideProactiveSpeech(ctx({ urgency: 'critical' })).trigger).toBe('urgent_command');
  });

  it('does NOT speak the command once it has been acted on (no nagging)', () => {
    expect(decideProactiveSpeech(ctx({ urgency: 'high', commandFollowedToday: true }))).toMatchObject({
      speak: false,
      trigger: null,
    });
  });

  it('speaks to an open Recovery Window and to a ready daily lesson', () => {
    expect(decideProactiveSpeech(ctx({ recoveryWindowActive: true })).trigger).toBe('recovery_window');
    expect(decideProactiveSpeech(ctx({ hasDailyLesson: true })).trigger).toBe('daily_lesson');
  });

  it('honors Water-First priority: urgent > recovery > lesson', () => {
    expect(
      decideProactiveSpeech(ctx({ urgency: 'high', recoveryWindowActive: true, hasDailyLesson: true })).trigger,
    ).toBe('urgent_command');
    expect(decideProactiveSpeech(ctx({ recoveryWindowActive: true, hasDailyLesson: true })).trigger).toBe(
      'recovery_window',
    );
  });
});

describe('Section 64 — proactiveLine', () => {
  it('returns null when the policy says stay silent', () => {
    expect(proactiveLine(ctx())).toBeNull();
  });

  it('maps a trigger to its coachIntelligence key + mode', () => {
    const line = proactiveLine(ctx({ level: 'DEPLETED', urgency: 'critical' }));
    expect(line).toMatchObject({ lineKey: 'coachIntelligence.urgent_command', mode: 'depleted' });
    expect(line?.params.action).toBe('Drink 16 oz water.');
  });
});
