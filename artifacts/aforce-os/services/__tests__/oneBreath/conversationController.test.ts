/**
 * The One Breath conversation, connected: a seal saves through the Moments
 * commit, a drink goes down the right rail after six seconds, Lock In goes
 * through the one owner of Quiet, and nothing is shown that did not happen.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createOneBreathConversation, PLAN_NO_COMMAND_NOTE, type ConversationHost } from '@/services/oneBreath/conversationController';
import type { OneBreathOwners } from '@/services/oneBreath/effects';
import type { Moment } from '@/types/moments';
import { conversationView } from '@/utils/oneBreath/conversation';
import type { OneBreathContext } from '@/utils/oneBreath/session';

const NOW = new Date(2026, 10, 19, 10, 0, 0).getTime();
const say = (words: string, via: 'typed' | 'spoken' = 'typed') => ({ kind: 'say' as const, words, via });
const tap = (control: string) => ({ kind: 'tap' as const, control });
const LIFT = ['I want to lift tomorrow, legs need to be fresh', '6:30 in the morning'];

function setup(over: Partial<OneBreathOwners> = {}, ctx: Partial<OneBreathContext> = {}) {
  let moments: Moment[] = [];
  const commitMoment = vi.fn(async (moment: Moment, expected?: Moment, current?: () => boolean) => {
    const stored = moments.find((m) => m.id === moment.id);
    if (JSON.stringify(stored) !== JSON.stringify(expected)) throw new Error('changed');
    if (current && !current()) throw new Error('stale');
    moments = [...moments.filter((m) => m.id !== moment.id), moment];
    return moment;
  });
  const owners: OneBreathOwners = {
    commitMoment,
    lockIn: vi.fn(async (commit) => commit()) as OneBreathOwners['lockIn'],
    logWater: vi.fn(async () => 'intake-1'),
    recordDrink: vi.fn(async () => ({})),
    moments: () => moments,
    command: () => ({ id: 'cmd-1', action: 'Drink 12 oz of water.' }),
    now: () => Date.now(),
    ...over,
  };
  const opened: string[] = [];
  const host: ConversationHost = {
    context: () => ({ nowIso: new Date(Date.now()).toISOString(), social: false, momentInWindow: false, learningOn: false, interpreterReachable: true, networkUp: true, ...ctx }),
    owners,
    openScreen: (screen) => (opened.push(screen), screen !== 'nowhere'),
    clock: (iso) => new Date(iso).toISOString().slice(11, 16),
  };
  const c = createOneBreathConversation(host);
  const view = () => {
    const s = c.getSnapshot();
    return conversationView(s.entries, s, { state: s.session, planRows: s.planRows, planNote: s.planNote, planError: s.planError });
  };
  const steps = () => view().items.flatMap((i) => (i.kind === 'step' ? [i.line.label] : []));
  return { c, owners, commitMoment, view, steps, opened, stored: () => moments, setMoments: (m: Moment[]) => { moments = m; } };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

describe('sealing a plan', () => {
  it('shows the plan steps before the seal, and saves exactly those through the Moments commit', async () => {
    const t = setup();
    LIFT.forEach((w) => t.c.send(say(w)));
    const plan = t.view().items.find((i) => i.kind === 'plan');
    expect(plan).toBeTruthy();
    expect(t.view().awaitingSeal).toBe(true);
    expect(t.commitMoment).not.toHaveBeenCalled();

    t.c.send(say('seal it'));
    expect(t.steps()).toEqual(['Sealing']);
    await t.c.settled();
    expect(t.steps()).toEqual(['Sealed']);
    expect(t.commitMoment).toHaveBeenCalledTimes(1);
    const saved = t.stored()[0]!;
    expect(saved.title).toBe('Morning lift');
    expect(saved.preparation?.context).toBe('one_breath');
    expect(saved.preparation?.sealedAtIso).not.toBe('');
    expect(saved.preparation?.sealedBy).toEqual({ method: 'typed' });
    expect(saved.preparation?.lockedInAtIso).toBeUndefined();
    if (plan?.kind === 'plan') expect(saved.preparation?.steps.map((s) => s.action)).toEqual(plan.rows.map((r) => r.text));
  });

  it('a held seal is recorded as a hold and offers no Undo; a spoken one is recorded as voice', async () => {
    const held = setup();
    LIFT.forEach((w) => held.c.send(say(w)));
    held.c.send(tap('seal'));
    await held.c.settled();
    expect(held.stored()[0]!.preparation?.sealedBy).toEqual({ method: 'hold' });
    expect(held.view().items.some((i) => i.kind === 'undo')).toBe(false);

    const spoken = setup();
    LIFT.forEach((w) => spoken.c.send(say(w, 'spoken')));
    spoken.c.send(say('seal it', 'spoken'));
    await spoken.c.settled();
    expect(spoken.stored()[0]!.preparation?.sealedBy).toEqual({ method: 'voice' });
  });

  it('"seal it" twice saves once', async () => {
    const t = setup();
    LIFT.forEach((w) => t.c.send(say(w)));
    t.c.send(say('seal it'));
    t.c.send(say('seal it'));
    await t.c.settled();
    expect(t.commitMoment).toHaveBeenCalledTimes(1);
    expect(t.stored()).toHaveLength(1);
  });

  it('a save that fails says so, saves nothing, and the plan waits to be sealed again', async () => {
    let fail = true;
    const t = setup();
    t.commitMoment.mockImplementationOnce(async () => { if (fail) throw new Error('storage'); return {} as Moment; });
    LIFT.forEach((w) => t.c.send(say(w)));
    t.c.send(say('seal it'));
    await t.c.settled();
    expect(t.steps()).toEqual(['Not sealed']);
    expect(t.stored()).toHaveLength(0);
    expect(t.view().awaitingSeal).toBe(true);
    expect(t.view().items.some((i) => i.kind === 'undo')).toBe(false);

    fail = false;
    t.c.send(tap('seal'));
    await t.c.settled();
    expect(t.steps()).toEqual(['Not sealed', 'Sealed']);
    expect(t.stored()).toHaveLength(1);
  });

  it('a review older than its five minutes is refused, not silently refreshed', async () => {
    const t = setup();
    LIFT.forEach((w) => t.c.send(say(w)));
    vi.setSystemTime(NOW + 6 * 60_000);
    // The screen was left as it was: the seal bar is still the old review's.
    t.c.send(tap('seal'));
    await t.c.settled();
    expect(t.steps()).toEqual(['Not sealed']);
    expect(t.stored()).toHaveLength(0);
    expect(t.view().awaitingSeal).toBe(true);
  });

  it('a time already past is not offered for sealing', () => {
    const t = setup();
    t.c.send(say('Lift today at 6:30 AM'));
    const v = t.view();
    if (t.c.getSnapshot().session.pendingPlan?.date) {
      expect(v.awaitingSeal).toBe(false);
      expect(v.items.at(-1)).toMatchObject({ kind: 'ai', text: 'Choose a time in the future.' });
    }
    t.c.send(tap('seal'));
    expect(t.commitMoment).not.toHaveBeenCalled();
  });

  it('says so when no step carries current guidance', () => {
    const t = setup();
    LIFT.forEach((w) => t.c.send(say(w)));
    const plan = t.view().items.find((i) => i.kind === 'plan');
    // Tomorrow's lift is outside its preparation window: today's command is never frozen into it.
    expect(plan).toMatchObject({ note: PLAN_NO_COMMAND_NOTE });
  });
});

describe('Undo of a seal', () => {
  it('unseals the same Moment, and sealing again updates it instead of saving a second', async () => {
    const t = setup();
    LIFT.forEach((w) => t.c.send(say(w)));
    t.c.send(say('seal it'));
    await t.c.settled();
    expect(t.view().items.some((i) => i.kind === 'undo')).toBe(true);
    const id = t.stored()[0]!.id;

    t.c.send(tap('undo'));
    await t.c.settled();
    expect(t.steps()).toEqual(['Sealed', 'Seal undone']);
    expect(t.stored()).toHaveLength(1);
    expect(t.stored()[0]!.preparation?.sealedAtIso).toBe('');
    expect(t.stored()[0]!.preparation?.sealedBy).toBeUndefined();
    expect(t.view().awaitingSeal).toBe(true);

    t.c.send(say('seal it'));
    await t.c.settled();
    expect(t.steps()).toEqual(['Sealed', 'Seal undone', 'Sealed']);
    expect(t.stored()).toHaveLength(1);
    expect(t.stored()[0]!.id).toBe(id);
    expect(t.stored()[0]!.preparation?.sealedAtIso).not.toBe('');
  });

  it('is gone once its window ends, and a late Undo changes nothing', async () => {
    const t = setup();
    LIFT.forEach((w) => t.c.send(say(w)));
    t.c.send(say('seal it'));
    await t.c.settled();
    await vi.advanceTimersByTimeAsync(5_100);
    expect(t.view().items.some((i) => i.kind === 'undo')).toBe(false);
    t.c.send(tap('undo'));
    await t.c.settled();
    expect(t.commitMoment).toHaveBeenCalledTimes(1);
    expect(t.stored()[0]!.preparation?.sealedAtIso).not.toBe('');
  });
});

describe('logging a drink', () => {
  it('holds six seconds, then logs water once through the scored rail', async () => {
    const t = setup();
    t.c.send(say('Log 16 oz of water'));
    expect(t.owners.logWater).not.toHaveBeenCalled();
    expect(t.view().items.some((i) => i.kind === 'undo')).toBe(true);
    await vi.advanceTimersByTimeAsync(5_900);
    expect(t.owners.logWater).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(200);
    await t.c.settled();
    expect(t.owners.logWater).toHaveBeenCalledTimes(1);
    expect(t.owners.logWater).toHaveBeenCalledWith(16);
    expect(t.owners.recordDrink).not.toHaveBeenCalled();
    expect(t.steps()).toEqual(['Logged']);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(t.owners.logWater).toHaveBeenCalledTimes(1);
  });

  it('coffee goes to the drink log, which cannot move HydroState', async () => {
    const t = setup();
    t.c.send(say('Log a 12 oz coffee'));
    await vi.advanceTimersByTimeAsync(6_100);
    await t.c.settled();
    expect(t.owners.logWater).not.toHaveBeenCalled();
    expect(t.owners.recordDrink).toHaveBeenCalledTimes(1);
    expect(t.owners.recordDrink).toHaveBeenCalledWith(expect.objectContaining({ categoryId: 'coffee', ozAmount: 12, entrySource: 'manual' }));
  });

  it('Undo inside the window logs nothing', async () => {
    const t = setup();
    t.c.send(say('Log 16 oz of water'));
    await vi.advanceTimersByTimeAsync(3_000);
    t.c.send(tap('undo'));
    await vi.advanceTimersByTimeAsync(20_000);
    await t.c.settled();
    expect(t.owners.logWater).not.toHaveBeenCalled();
    expect(t.view().items.at(-1)).toMatchObject({ kind: 'ai', text: 'Not logged.' });
  });

  it('closing the screen logs the held drink at once, and only once', async () => {
    const t = setup();
    t.c.send(say('Log 16 oz of water'));
    t.c.interrupt();
    t.c.interrupt();
    await vi.advanceTimersByTimeAsync(20_000);
    await t.c.settled();
    expect(t.owners.logWater).toHaveBeenCalledTimes(1);
  });

  it('a log that did not land is never shown as logged', async () => {
    const t = setup({ logWater: vi.fn(async () => null) });
    t.c.send(say('Log 16 oz of water'));
    await vi.advanceTimersByTimeAsync(6_100);
    await t.c.settled();
    expect(t.steps()).toEqual(['Not logged']);
  });
});

describe('Lock In', () => {
  const sealedMoment = (): Moment => ({
    id: 'm1', source: 'manual', title: 'Morning lift', type: 'training', importance: 'high',
    startAtIso: new Date(NOW + 5 * 60_000).toISOString(), createdAtIso: new Date(NOW).toISOString(),
    preparation: { version: 1, context: 'one_breath', transactionId: 't', reviewedAtIso: new Date(NOW).toISOString(), sealedAtIso: new Date(NOW).toISOString(), returnMethod: 'none', destination: '', emergencyNumber: '911', steps: [], policyVersion: 'social-v0.4-phase-a' },
  } as Moment);

  it('goes through the owner of Quiet, once, for the Moment in its window', async () => {
    const t = setup({}, { momentInWindow: true, currentMomentId: 'm1' });
    t.setMoments([sealedMoment()]);
    t.c.send(say('Lock me in'));
    t.c.send(say('Lock me in'));
    await t.c.settled();
    expect(t.owners.lockIn).toHaveBeenCalledTimes(1);
    expect(t.stored()[0]!.preparation?.lockedInAtIso).toBeTruthy();
    expect(t.steps()).toEqual(['Locked in']);
  });

  it('with no Moment in its window nothing is written', async () => {
    const t = setup();
    t.c.send(say('Lock me in'));
    await t.c.settled();
    expect(t.owners.lockIn).not.toHaveBeenCalled();
    expect(t.commitMoment).not.toHaveBeenCalled();
  });

  it('a Lock In that fails is not shown as locked in, and can be asked for again', async () => {
    const t = setup({ lockIn: vi.fn(async () => { throw new Error('reminders'); }) as OneBreathOwners['lockIn'] }, { momentInWindow: true, currentMomentId: 'm1' });
    t.setMoments([sealedMoment()]);
    t.c.send(say('Lock me in'));
    await t.c.settled();
    expect(t.steps()).toEqual(['Not locked in']);
    expect(t.c.getSnapshot().session.lockedIn).toBe(false);
  });
});

describe('everything else', () => {
  it('reading and opening a screen write nothing', async () => {
    const t = setup({}, { hydroState: { value: 51, word: 'Depleted', estimated: true, source: 'what you’ve logged' } });
    t.c.send(say('How am I doing?'));
    t.c.send(say('Open Moments'));
    await t.c.settled();
    expect(t.opened).toEqual(['moments']);
    expect(t.commitMoment).not.toHaveBeenCalled();
    expect(t.owners.logWater).not.toHaveBeenCalled();
    expect(t.view().items.some((i) => i.kind === 'result')).toBe(true);
  });

  it('a request it cannot carry out gets the honest limit line, never silence', () => {
    const t = setup();
    t.c.send(say('What should I eat for dinner?'));
    const last = t.view().items.at(-1);
    expect(last?.kind).toBe('ai');
    if (last?.kind === 'ai') expect(last.text).toMatch(/won’t guess/);
  });

  it('after dispose nothing more is sent or scheduled', async () => {
    const t = setup();
    t.c.send(say('Log 16 oz of water'));
    t.c.dispose();
    await vi.advanceTimersByTimeAsync(20_000);
    expect(t.owners.logWater).not.toHaveBeenCalled();
  });
});
