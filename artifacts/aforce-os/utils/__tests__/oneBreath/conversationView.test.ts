/**
 * The One Breath conversation screen shows only what really happened.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { conversationStatus, conversationView, effectKey, type ConversationEntry, type EffectResults } from '@/utils/oneBreath/conversation';
import { emptyOneBreathState, oneBreathTurn, type OneBreathInput } from '@/utils/oneBreath/session';
import { BASE_CONTEXT, say, wait } from './drive';

function play(inputs: OneBreathInput[]): ConversationEntry[] {
  let state = emptyOneBreathState();
  return inputs.map((input) => {
    const turn = oneBreathTurn(state, input, BASE_CONTEXT);
    state = turn.state;
    return { input, turn };
  });
}
const none: EffectResults = { done: new Set(), failed: new Set() };
const allDone = (entries: ConversationEntry[]): EffectResults => ({ done: new Set(entries.flatMap((e, i) => e.turn.effects.map((x) => effectKey(i, x.id)))), failed: new Set() });
const kinds = (entries: ConversationEntry[], results = none) => conversationView(entries, results).items.map((i) => i.kind);
const LIFT = [say('I want to lift tomorrow, legs need to be fresh'), say('6:30 in the morning')];

describe('conversation · the exchange', () => {
  it('shows the member\'s words, the one question, then what was heard and the read-back', () => {
    const entries = play(LIFT);
    expect(kinds(entries)).toEqual(['me', 'ai', 'me', 'heard', 'ai']);
    const view = conversationView(entries, none);
    expect(view.items[1]).toMatchObject({ kind: 'ai', text: 'What time?' });
    expect(view.items[3]).toEqual({ kind: 'heard', key: 't1-heard', rows: [
      { label: 'Moment', value: 'Morning lift' }, { label: 'Day', value: 'Fri, Nov 20' }, { label: 'Time', value: '6:30 AM' }, { label: 'Goal', value: 'Legs fresh' },
    ] });
  });

  it('the seal bar appears only for a complete plan, and goes once it is sealed', () => {
    expect(conversationView(play([say('Lift at 6:30')]), none).awaitingSeal).toBe(false);
    const ready = conversationView(play(LIFT), none);
    expect(ready.awaitingSeal).toBe(true);
    expect(ready.plan?.title).toBe('Morning lift');
    expect(conversationView(play([...LIFT, say('seal it')]), none).awaitingSeal).toBe(false);
  });

  it('choices are offered only on the latest reply', () => {
    const one = conversationView(play([say('Lift at 6:30')]), none);
    expect(one.items.at(-1)).toMatchObject({ kind: 'ai', choices: ['6:30 AM', '6:30 PM'] });
    const two = conversationView(play([say('Lift at 6:30'), say('How am I doing?')]), none);
    expect(two.items.filter((i) => i.kind === 'ai' && i.choices)).toHaveLength(0);
  });

  it('"How am I doing?" shows the card with the owner\'s number, word and estimate flag', () => {
    const view = conversationView(play([say('How am I doing?')]), none);
    expect(view.items.at(-1)).toEqual({ kind: 'result', key: 't0-result', value: 51, word: 'Behind', estimated: true });
  });
});

describe('conversation · never shows what did not happen', () => {
  const sealed = play([...LIFT, say('seal it')]);
  const step = (results: EffectResults) => conversationView(sealed, results).items.find((i) => i.kind === 'step');

  it('"Sealed" is shown only after the save is reported done', () => {
    expect(step(none)).toMatchObject({ line: { label: 'Sealing', tone: 'waiting' } });
    expect(JSON.stringify(conversationView(sealed, none).items)).not.toMatch(/"Sealed"|Saved once/);
    expect(step(allDone(sealed))).toMatchObject({ line: { n: 1, label: 'Sealed', note: 'By you · typed', text: 'Saved once. Morning lift · Fri, Nov 20 6:30 AM.', tone: 'accent' } });
  });

  it('a save that failed says so and never reads as sealed', () => {
    const failed = { done: new Set<string>(), failed: new Set(sealed.flatMap((e, i) => e.turn.effects.map((x) => effectKey(i, x.id)))) };
    expect(step(failed)).toMatchObject({ line: { label: 'Not sealed' } });
    expect(JSON.stringify(conversationView(sealed, failed).items)).toContain('Nothing was saved.');
    expect(conversationView(sealed, failed).items.some((i) => i.kind === 'undo')).toBe(false);
  });

  it('a drink is "Logging" while pending and "Logged" only once the log is reported', () => {
    const pending = play([say('Log a 12 oz coffee')]);
    expect(kinds(pending)).toEqual(['me', 'ai', 'undo']);
    expect(JSON.stringify(conversationView(pending, none).items)).not.toContain('Logged');
    const committed = play([say('Log a 12 oz coffee'), wait(6000)]);
    const before = conversationView(committed, none).items.find((i) => i.kind === 'step');
    expect(before).toMatchObject({ line: { label: 'Logging' } });
    const after = conversationView(committed, allDone(committed)).items.find((i) => i.kind === 'step');
    expect(after).toMatchObject({ line: { label: 'Logged', text: 'Saved once. 12 oz coffee.' } });
  });

  it('Undo is shown only on the latest turn', () => {
    const moved = play([say('Log a 12 oz coffee'), say('How am I doing?')]);
    expect(conversationView(moved, allDone(moved)).items.filter((i) => i.kind === 'undo')).toHaveLength(0);
  });

  it('the status word: Standby, Listening, Operating while a write is in progress', () => {
    expect(conversationStatus([], none, false)).toBe('Standby');
    expect(conversationStatus([], none, true)).toBe('Listening');
    expect(conversationStatus(sealed, none, false)).toBe('Operating');
    expect(conversationStatus(sealed, allDone(sealed), false)).toBe('Standby');
  });
});

describe('conversation · containment', () => {
  const ROOT = join(__dirname, '..', '..', '..');
  const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const VIEW = strip(readFileSync(join(ROOT, 'components/oneBreath/OneBreathConversation.tsx'), 'utf8'));
  const MODEL = strip(readFileSync(join(ROOT, 'utils/oneBreath/conversation.ts'), 'utf8'));

  it('the screen and its builder cannot save, log or send anything themselves', () => {
    for (const src of [VIEW, MODEL]) expect(src).not.toMatch(/fetch\(|AsyncStorage|SecureStore|momentsStore|commitReviewedMoment|logIntake|scoringEngine|statusColor|@\/services\//);
  });

  it('holding seals only when the hold completes; letting go cancels', () => {
    expect(VIEW).toContain('onPressIn={start}');
    expect(VIEW).toContain('onPressOut={cancel}');
    expect(VIEW).toContain('timer.current = setTimeout(() => { timer.current = null; onSeal(); }, T.holdMs);');
  });

  it('no colour is written into the screen', () => {
    expect(VIEW).not.toMatch(/#[0-9a-fA-F]{6}\b|rgba?\(/);
  });
});
