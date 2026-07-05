import { describe, it, expect } from 'vitest';
import {
  assembleCoachContext,
  nextProactiveUtterance,
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
const ctx = (o: Partial<CoachSignals> = {}) => assembleCoachContext(signals(o));

describe('Section 64 Step 2 — nextProactiveUtterance (silence gate + dedupe)', () => {
  it('stays SILENT and resets the key when nothing adds value (default silence)', () => {
    expect(nextProactiveUtterance('recovery_window', ctx())).toEqual({ key: null, utterance: null });
    expect(nextProactiveUtterance(null, ctx())).toEqual({ key: null, utterance: null });
  });

  it('speaks a new high-value moment, then dedupes the identical one', () => {
    const first = nextProactiveUtterance(null, ctx({ recoveryWindowActive: true }));
    expect(first.key).toBe('recovery_window');
    expect(first.utterance).not.toBeNull();

    const again = nextProactiveUtterance(first.key, ctx({ recoveryWindowActive: true }));
    expect(again).toEqual({ key: 'recovery_window', utterance: null }); // never repeats
  });

  it('re-speaks when the command itself changes (key encodes the command)', () => {
    const a = nextProactiveUtterance(null, ctx({ urgency: 'high', commandAction: 'Drink 16 oz water.' }));
    expect(a.key).toBe('urgent_command:Drink 16 oz water.');
    expect(a.utterance).not.toBeNull();

    const b = nextProactiveUtterance(a.key, ctx({ urgency: 'high', commandAction: 'Add electrolytes now.' }));
    expect(b.key).toBe('urgent_command:Add electrolytes now.');
    expect(b.utterance).not.toBeNull();
  });

  it('does not re-speak a command already acted on (no nagging → silent)', () => {
    expect(
      nextProactiveUtterance(null, ctx({ urgency: 'high', commandFollowedToday: true })),
    ).toEqual({ key: null, utterance: null });
  });

  it('silence resets the key, so a returning trigger re-speaks', () => {
    const silent = nextProactiveUtterance('recovery_window', ctx()); // window closed → silent
    expect(silent.key).toBeNull();
    const back = nextProactiveUtterance(silent.key, ctx({ recoveryWindowActive: true }));
    expect(back.utterance).not.toBeNull(); // reopened → speaks again
  });
});
