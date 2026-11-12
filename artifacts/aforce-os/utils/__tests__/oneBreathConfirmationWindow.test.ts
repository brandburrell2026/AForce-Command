import { describe, it, expect } from 'vitest';

import {
  ONE_BREATH_CONFIRM_WINDOW_MS,
  ONE_BREATH_SEAL_UNDO_MS,
} from '@/config/hydroStateModel';
import {
  beginReadBack,
  classifyUtterance,
  heard,
  initialWindow,
  messageReadBack,
  planReadBack,
  readBackDurationMs,
  readBackFinished,
  sealUndoAvailable,
  sealedByHold,
  secondsLeft,
  shareReadBack,
  tick,
  windowEndLine,
  windowOpenLine,
  windowStrip,
  type WindowState,
} from '../oneBreath/confirmationWindow';

const T0 = 1_000_000;
/** A window that has just opened at T0. */
const opened = (intent: 'seal' | 'send' | 'share' = 'seal'): WindowState =>
  readBackFinished(beginReadBack(initialWindow(intent)), T0);
const say = (s: WindowState, text: string, at = T0 + 1000) => heard(s, classifyUtterance(text), at);

describe('classifyUtterance', () => {
  it.each(['seal it', 'Seal it.', 'lock it in', 'okay, seal it'])('"%s" confirms a seal', (t) => {
    expect(classifyUtterance(t)).toMatchObject({ kind: 'confirm', intent: 'seal' });
  });
  it('"send it" and "share it" confirm their own intent', () => {
    expect(classifyUtterance('send it')).toMatchObject({ kind: 'confirm', intent: 'send' });
    expect(classifyUtterance('share it')).toMatchObject({ kind: 'confirm', intent: 'share' });
  });
  it.each(['approve', 'confirm', 'yes', 'okay', 'sounds good', 'Yeah', 'go ahead'])(
    '"%s" is not an accepted phrase (V2)',
    (t) => expect(classifyUtterance(t).kind).toBe('not_a_phrase'),
  );
  it.each(["don't", 'not yet', 'wait', 'no', "don't seal it", 'no, do not lock it in'])(
    '"%s" is a negation, even with the phrase inside (V2)',
    (t) => expect(classifyUtterance(t).kind).toBe('negation'),
  );
  it.each(['make it 7', 'move it to 7:30', 'change it to 7 PM', 'No, Saturday', 'can I go at 7 instead?'])(
    '"%s" is a change (V3, V15)',
    (t) => expect(classifyUtterance(t).kind).toBe('change'),
  );
  it('questions and topic changes are "other"', () => {
    expect(classifyUtterance('What should I eat before?').kind).toBe('other');
    expect(classifyUtterance("Actually, what's coming up this week?").kind).toBe('other');
  });
  it('hear it again, undo and empty input', () => {
    expect(classifyUtterance('hear it again').kind).toBe('hear_again');
    expect(classifyUtterance('undo').kind).toBe('undo');
    expect(classifyUtterance('   ').kind).toBe('unclear');
  });
  it('low recognition confidence is unclear and never confirms', () => {
    expect(classifyUtterance('seal it', 0.4).kind).toBe('unclear');
    expect(classifyUtterance('seal it', 0.95).kind).toBe('confirm');
    expect(heard(opened(), classifyUtterance('seal it', 0.4), T0 + 1000).effect).toBe('none');
  });
});

describe('window lifecycle (V1, V13, V14)', () => {
  it('is closed during the read-back and says so', () => {
    const s = beginReadBack(initialWindow());
    expect(s.phase).toBe('reading');
    expect(windowStrip(s, T0)).toBe('Listening opens after the read-back.');
  });
  it('"seal it" during the read-back does nothing and says it was outside the window', () => {
    const r = say(beginReadBack(initialWindow()), 'seal it');
    expect(r.effect).toBe('none');
    expect(r.message).toBe("Heard 'seal it' outside the window · nothing happened.");
  });
  it('opens window 1 with a countdown when the read-back ends', () => {
    const s = opened();
    expect(s.phase).toBe('open');
    expect(s.number).toBe(1);
    expect(windowOpenLine(s)).toBe('Confirmation window 1 · open');
    expect(windowStrip(s, T0)).toBe("Listening for 'Seal it' · 7s");
    expect(windowStrip(s, T0 + 1500)).toBe("Listening for 'Seal it' · 6s");
  });
  it('"seal it" inside the window confirms once and records the end state', () => {
    const r = say(opened(), 'seal it');
    expect(r.effect).toBe('confirm');
    expect(r.message).toBe("Heard 'seal it' inside the window · sealed");
    expect(r.state.history).toEqual([{ number: 1, end: 'confirmed_by_voice' }]);
    // A second "seal it" after the window closed never confirms again (CB13).
    expect(say(r.state, 'seal it', T0 + 2000).effect).toBe('none');
  });
  it('closes after the window length with "nothing heard"', () => {
    const s = tick(opened(), T0 + ONE_BREATH_CONFIRM_WINDOW_MS);
    expect(s.phase).toBe('closed');
    expect(s.history).toEqual([{ number: 1, end: 'timed_out' }]);
    expect(windowEndLine('timed_out', 'seal')).toBe('Closed after 7 seconds · nothing heard');
    expect(secondsLeft(s, T0 + ONE_BREATH_CONFIRM_WINDOW_MS)).toBe(0);
  });
  it('"seal it" after the window closed does nothing', () => {
    const r = say(opened(), 'seal it', T0 + ONE_BREATH_CONFIRM_WINDOW_MS + 1);
    expect(r.effect).toBe('none');
    expect(r.message).toContain('outside the window');
    expect(r.state.history).toEqual([{ number: 1, end: 'timed_out' }]);
  });
  it('only a fresh read-back reopens a closed window, as the next number', () => {
    const closed = tick(opened(), T0 + ONE_BREATH_CONFIRM_WINDOW_MS);
    const again = say(closed, 'hear it again', T0 + 9000);
    expect(again.effect).toBe('read_again');
    const reopened = readBackFinished(beginReadBack(again.state), T0 + 12_000);
    expect(reopened.number).toBe(2);
    expect(say(reopened, 'lock it in', T0 + 13_000).effect).toBe('confirm');
  });
  it('speaking never opens or extends a window', () => {
    const s = opened();
    const after = say(s, 'what time is it', T0 + 6000).state;
    expect(after.phase).toBe('closed');
    expect(readBackFinished(after, T0 + 6500)).toBe(after); // no read-back started
  });
});

describe('approval phrases, negation and changes (V2, V3, V15)', () => {
  it.each(['yes', 'okay', 'confirm', 'approve', 'sounds good'])('"%s" gets the phrase prompt and keeps the window', (t) => {
    const r = say(opened(), t);
    expect(r.effect).toBe('none');
    expect(r.message).toBe("Say 'seal it' to confirm.");
    expect(r.state.phase).toBe('open');
  });
  it('a negation cancels and records "you said no"', () => {
    const r = say(opened(), 'not yet');
    expect(r.effect).toBe('cancel');
    expect(r.message).toBe('Nothing saved.');
    expect(r.state.history.at(-1)?.end).toBe('said_no');
    expect(windowEndLine('said_no', 'seal')).toBe('Closed · you said no');
  });
  it('a change closes the window as corrected; the rebuilt read-back opens window 2', () => {
    const r = say(opened(), 'make it 7');
    expect(r.effect).toBe('rebuild');
    expect(r.state.history.at(-1)?.end).toBe('corrected');
    const next = readBackFinished(beginReadBack(r.state), T0 + 4000);
    expect(next.number).toBe(2);
  });
  it('a follow-up question closes the window as "asked something else"', () => {
    const r = say(opened(), 'What should I eat before?');
    expect(r.effect).toBe('answer');
    expect(r.state.history.at(-1)?.end).toBe('asked_else');
  });
  it('the wrong confirmation for the pending intent does not act', () => {
    expect(say(opened('send'), 'seal it').message).toBe("Say 'send it' to confirm.");
    expect(say(opened('send'), 'send it').effect).toBe('confirm');
    expect(say(opened('send'), 'send it').message).toBe("Heard 'send it' inside the window · sending");
  });
});

describe('hold to seal (Part 8.1.8)', () => {
  it('works during the read-back, with no window', () => {
    const s = sealedByHold(beginReadBack(initialWindow()));
    expect(s.phase).toBe('closed');
    expect(s.history).toEqual([{ number: 0, end: 'sealed_by_hold' }]);
  });
  it('ends an open window as sealed by hold', () => {
    expect(sealedByHold(opened()).history).toEqual([{ number: 1, end: 'sealed_by_hold' }]);
    expect(windowEndLine('sealed_by_hold', 'seal')).toBe('Closed · sealed by hold');
  });
});

describe('undo after a seal (V4)', () => {
  it('is available for the undo window only', () => {
    expect(sealUndoAvailable(T0, T0)).toBe(true);
    expect(sealUndoAvailable(T0, T0 + ONE_BREATH_SEAL_UNDO_MS - 1)).toBe(true);
    expect(sealUndoAvailable(T0, T0 + ONE_BREATH_SEAL_UNDO_MS)).toBe(false);
    expect(sealUndoAvailable(T0, T0 - 1)).toBe(false);
  });
  it('"undo" is surfaced as its own effect', () => {
    expect(say(initialWindow(), 'undo').effect).toBe('undo');
  });
});

describe('read-backs (Part 6.1.1, V6)', () => {
  const now = Date.parse('2026-11-12T20:00:00Z');
  it('reads a plan back with day, time and the phrase', () => {
    expect(
      planReadBack({
        title: 'Morning lift',
        startAtIso: '2026-11-13T11:30:00Z',
        nowMs: now,
        timeZone: 'America/New_York',
        delta: 'Nothing changed from last time',
      }),
    ).toBe("Morning lift, tomorrow at 6:30 AM. Nothing changed from last time. Say 'seal it' to lock it in.");
  });
  it('uses the weekday within a week and a date beyond it', () => {
    const base = { title: 'Lift', nowMs: now, timeZone: 'America/New_York' };
    expect(planReadBack({ ...base, startAtIso: '2026-11-14T15:00:00Z' })).toBe(
      "Lift, Saturday at 10:00 AM. Say 'seal it' to lock it in.",
    );
    expect(planReadBack({ ...base, startAtIso: '2026-11-25T15:00:00Z' })).toBe(
      "Lift, Wed, Nov 25 at 10:00 AM. Say 'seal it' to lock it in.",
    );
  });
  it('reads back the recipient and exact text before a send', () => {
    expect(messageReadBack('Annette', "I'm heading home")).toBe("Sending Annette: I'm heading home. Say 'send it.'");
    expect(shareReadBack('Annette', 'your lift plan')).toBe("Sharing your lift plan with Annette. Say 'share it.'");
  });
});

describe('read-back duration', () => {
  it('scales with the words and never drops below the floor', () => {
    expect(readBackDurationMs('Seal it.')).toBe(1500);
    const line = "Morning lift, tomorrow at 6:30 AM. Nothing changed from last time. Say 'seal it' to lock it in.";
    expect(readBackDurationMs(line)).toBe(Math.ceil((18 / 2.5) * 1000));
  });
});
