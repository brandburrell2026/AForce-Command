/**
 * The open One Breath plan on the conversation screen: sealed, Lock In, Quiet,
 * Plans changed and Heading back, shown from the saved Moment and closed only
 * through the Moments commit. Nothing is shown that the store does not hold.
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cancelPlan, lockInMoment, returnFromPlan, type OneBreathOwners } from '@/services/oneBreath/effects';
import type { Moment } from '@/types/moments';
import { LOCK_IN_NOT_YET } from '@/utils/oneBreath/lockInWindow';
import { OPEN_PLAN_LINES, openOneBreathPlan, openPlanItems, openPlanPhase } from '@/utils/oneBreath/openPlan';
import { emptyOneBreathState, oneBreathTurn, planStillOpenLine, type OneBreathContext } from '@/utils/oneBreath/session';

const START = new Date(2026, 10, 21, 18, 0, 0);
const prep = (over: Record<string, unknown> = {}) => ({ version: 1, context: 'one_breath', transactionId: 't', reviewedAtIso: '2026-11-20T10:00:00Z', sealedAtIso: '2026-11-20T10:00:00Z', returnMethod: 'none', destination: '', emergencyNumber: '911', steps: [], policyVersion: 'social-v0.4-phase-a', ...over });
const moment = (preparation?: unknown, over: Partial<Moment> = {}): Moment => ({ id: 'm', source: 'manual', title: 'Dinner', type: 'social', importance: 'high', startAtIso: START.toISOString(), createdAtIso: '2026-11-20T10:00:00Z', preparation, ...over } as Moment);
const LOCKED = { lockedInAtIso: '2026-11-21T22:45:00Z' };
const before = START.getTime() - 60 * 60_000;
const inWindow = START.getTime() - 5 * 60_000;
const labels = (items: ReturnType<typeof openPlanItems>) => items.flatMap((i) => (i.kind === 'actions' ? i.actions.map((a) => a.label) : []));
const said = (items: ReturnType<typeof openPlanItems>) => items.flatMap((i) => (i.kind === 'ai' ? [i.text] : []));

function owners(start: Moment[]) {
  let moments = start;
  const commitMoment = vi.fn(async (next: Moment, expected?: Moment) => {
    if (JSON.stringify(moments.find((m) => m.id === next.id)) !== JSON.stringify(expected)) throw new Error('changed');
    moments = [...moments.filter((m) => m.id !== next.id), next];
    return next;
  });
  const o: OneBreathOwners = {
    commitMoment,
    lockIn: vi.fn(async (commit) => commit()) as OneBreathOwners['lockIn'],
    logWater: vi.fn(async () => 'intake-1'),
    undoWater: vi.fn(async () => true),
    recordDrink: vi.fn(async () => ({})),
    moments: () => moments,
    command: () => ({ id: 'c', action: 'Drink water.' }),
    now: () => inWindow,
  };
  return { o, commitMoment, stored: () => moments[0]! };
}

describe('One Breath · the open plan on the conversation screen', () => {
  it('finds the one open One Breath plan and nothing else', () => {
    expect(openOneBreathPlan([])).toBeUndefined();
    expect(openOneBreathPlan([moment(prep({ context: 'social' }))])).toBeUndefined();
    expect(openOneBreathPlan([moment(prep({ returnedAtIso: '2026-11-21T23:00:00Z' }))])).toBeUndefined();
    expect(openOneBreathPlan([moment(prep({ cancelledAtIso: '2026-11-21T23:00:00Z' }))])).toBeUndefined();
    expect(openOneBreathPlan([moment(prep())])?.id).toBe('m');
    expect(openPlanPhase(moment(prep({ sealedAtIso: '' })))).toBe('draft');
    expect(openPlanPhase(moment(prep()))).toBe('sealed');
    expect(openPlanPhase(moment(prep(LOCKED)))).toBe('quiet');
  });

  it('a sealed plan shows its row; Lock In is offered only once its window is open', () => {
    const early = openPlanItems({ moment: moment(prep()), mode: 'rest', nowMs: before });
    expect(early[0]).toMatchObject({ kind: 'moment', title: 'Dinner', pill: 'Sealed' });
    expect(said(early)).toEqual([`${OPEN_PLAN_LINES.sealed} ${LOCK_IN_NOT_YET}`]);
    expect(labels(early)).toEqual([]);
    const open = openPlanItems({ moment: moment(prep()), mode: 'rest', nowMs: inWindow });
    expect(said(open)).toEqual([OPEN_PLAN_LINES.sealed]);
    expect(labels(open)).toEqual(['Lock In']);
  });

  it('Quiet shows the existing Quiet words and the two existing ways out', () => {
    const quiet = openPlanItems({ moment: moment(prep(LOCKED)), mode: 'rest', nowMs: inWindow });
    expect(quiet[0]).toMatchObject({ kind: 'moment', pill: 'Locked in' });
    expect(said(quiet)).toEqual(['Go perform. Phone down. We’ll be quiet.']);
    expect(labels(quiet)).toEqual(['Plans changed?', 'Heading back?']);
  });

  it('Plans changed and Heading back keep the existing choices, with the member’s own emergency number', () => {
    const m = moment(prep({ ...LOCKED, emergencyNumber: '112', returnMethod: 'ride', destination: 'Home' }));
    const change = openPlanItems({ moment: m, mode: 'change', nowMs: inWindow });
    expect(said(change)).toEqual(['What changed?']);
    expect(labels(change)).toEqual(['My plan is cancelled', 'Back to Quiet', 'Emergency? 112']);
    const back = openPlanItems({ moment: m, mode: 'return', nowMs: inWindow });
    expect(said(back)[0]).toBe(`${OPEN_PLAN_LINES.back} ride · Home`);
    expect(labels(back)).toEqual(['Made it back ✓', 'Open Uber', 'Open Lyft', 'Back to Quiet']);
    expect(back.find((i) => i.kind === 'actions')).toMatchObject({ note: OPEN_PLAN_LINES.ride });
  });

  it('buttons wait while an action is being carried out, and a failure is said plainly', () => {
    const items = openPlanItems({ moment: moment(prep(LOCKED)), mode: 'return', nowMs: inWindow, working: 'made_it_back', error: OPEN_PLAN_LINES.saveFailed });
    const actions = items.find((i) => i.kind === 'actions');
    expect(actions?.kind === 'actions' && actions.actions.every((a) => a.disabled)).toBe(true);
    expect(said(items).at(-1)).toBe(OPEN_PLAN_LINES.saveFailed);
  });

  it('a plan that is not sealed shows nothing here', () => {
    expect(openPlanItems({ moment: moment(prep({ sealedAtIso: '' })), mode: 'rest', nowMs: inWindow })).toEqual([]);
  });
});

describe('One Breath · closing the open plan through its owner', () => {
  it('Lock In goes through the one owner of Quiet, once', async () => {
    const { o, commitMoment, stored } = owners([moment(prep())]);
    await lockInMoment(o, 'm');
    expect(o.lockIn).toHaveBeenCalledTimes(1);
    expect(stored().preparation?.lockedInAtIso).toBeTruthy();
    await lockInMoment(o, 'm');
    expect(commitMoment).toHaveBeenCalledTimes(1);
  });

  it('"Made it back" closes a locked-in plan as returned, once, and drops private safety context', async () => {
    const { o, commitMoment, stored } = owners([moment(prep(LOCKED), { safetyContext: { kind: 'x' } } as never)]);
    await returnFromPlan(o, 'm');
    expect(stored().preparation?.returnedAtIso).toBeTruthy();
    expect(stored().preparation?.cancelledAtIso).toBeUndefined();
    expect(stored().safetyContext).toBeUndefined();
    await returnFromPlan(o, 'm');
    expect(commitMoment).toHaveBeenCalledTimes(1);
  });

  it('a plan that was never locked in cannot be marked as returned', async () => {
    const { o, commitMoment } = owners([moment(prep())]);
    await expect(returnFromPlan(o, 'm')).rejects.toThrow();
    expect(commitMoment).not.toHaveBeenCalled();
  });

  it('"My plan is cancelled" closes it as cancelled and never records a return', async () => {
    const { o, commitMoment, stored } = owners([moment(prep(LOCKED))]);
    await cancelPlan(o, 'm');
    expect(stored().preparation?.cancelledAtIso).toBeTruthy();
    expect(stored().preparation?.returnedAtIso).toBeUndefined();
    // A second tap, or a tap on "Made it back" afterwards, changes nothing.
    await cancelPlan(o, 'm');
    await returnFromPlan(o, 'm');
    expect(commitMoment).toHaveBeenCalledTimes(1);
    expect(stored().preparation?.returnedAtIso).toBeUndefined();
  });

  it('a failed save is reported, not swallowed', async () => {
    const { o } = owners([moment(prep(LOCKED))]);
    (o.commitMoment as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('offline'));
    await expect(cancelPlan(o, 'm')).rejects.toThrow('offline');
  });
});

describe('One Breath · one open plan at a time', () => {
  const ctx = (over: Partial<OneBreathContext> = {}): OneBreathContext => ({ nowIso: new Date(before).toISOString(), social: false, momentInWindow: false, learningOn: false, interpreterReachable: true, networkUp: true, ...over });
  const say = (words: string) => ({ kind: 'say' as const, words, via: 'typed' as const });

  it('a new plan is not started while a sealed plan is open; nothing is saved', () => {
    const turn = oneBreathTurn(emptyOneBreathState(), say('I want to lift tomorrow at 6:30 in the morning'), ctx({ openPlanTitle: 'Dinner' }));
    expect(turn.reply.text).toBe(planStillOpenLine('Dinner'));
    expect(turn.state.pendingPlan).toBeUndefined();
    expect(turn.effects).toEqual([]);
  });

  it('everything else still works during Quiet: a drink is still logged', () => {
    const turn = oneBreathTurn(emptyOneBreathState(), say('log 16 oz water'), ctx({ openPlanTitle: 'Dinner', undoAfterLog: () => true }));
    expect(turn.effects.map((e) => e.kind)).toEqual(['log_drink']);
  });

  it('with no open plan, planning is unchanged', () => {
    const turn = oneBreathTurn(emptyOneBreathState(), say('I want to lift tomorrow at 6:30 in the morning'), ctx());
    expect(turn.state.pendingPlan?.title).toBeTruthy();
  });
});

describe('One Breath · the screen carries these out through the owners only', () => {
  const src = readFileSync(join(__dirname, '..', '..', '..', 'components', 'oneBreath', 'OneBreathConversationScreen.tsx'), 'utf8');
  it('Lock In, cancel and return are the effects functions; the screen writes no Moment itself', () => {
    expect(src).toMatch(/lockInMoment\(owners, plan\.id\)/);
    expect(src).toMatch(/cancelPlan\(owners, plan\.id\)/);
    expect(src).toMatch(/returnFromPlan\(owners, plan\.id\)/);
    expect(src).not.toMatch(/lockedInAtIso|returnedAtIso|cancelledAtIso/);
  });
  it('"Plan cancelled." is said only once the store no longer holds the open plan', () => {
    expect(src).toMatch(/cancelled && !openPlan/);
  });
  it('what the member types under "What changed?" meets the existing safety gate before anything else', () => {
    const gate = src.indexOf('evaluateMomentSafety(said');
    expect(gate).toBeGreaterThan(-1);
    expect(src.indexOf('controller.revise(')).toBeGreaterThan(gate);
    // Nothing private is kept from those words here.
    expect(src).not.toMatch(/withAlcoholContext|safetyContext/);
  });
  it('a Replay answer is saved through the Moments commit, and a rule only through the lessons service', () => {
    expect(src).toMatch(/saveReplay\(owners, replayFor, answer\)/);
    expect(src).toMatch(/approveLessonFromReplay\(/);
  });
  it('leaving the tab settles what is held and carries an open Undo', () => {
    expect(src).toMatch(/useFocusEffect\(\s*React\.useCallback\(\(\) => \{\s*return \(\) => controller\.close\(\);/);
  });
});
