/**
 * The last differences from the approved prototype, closed inside the One
 * Breath conversation: the safety gate under "What changed?", a changed plan
 * read back and re-sealed, Replay after "Made it back", a saved-but-unsealed
 * plan picked up, and Close returning to where One Breath was opened from.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createOneBreathConversation, type ConversationHost } from '@/services/oneBreath/conversationController';
import { saveReplay, type OneBreathOwners } from '@/services/oneBreath/effects';
import { closeOneBreath, oneBreathOrigin, rememberOneBreathOrigin, resetOneBreathOriginForTests } from '@/services/oneBreathOrigin';
import type { Moment } from '@/types/moments';
import { conversationView, type ConversationItem } from '@/utils/oneBreath/conversation';
import { CONVERSATION_ORB, CONVERSATION_STAGE } from '@/components/oneBreath/OneBreathConversation';
import { contactNumber, openPlanItems, planDraftFromMoment, PLAN_SAFETY_LINES, resumableDraft } from '@/utils/oneBreath/openPlan';
import { changePlan } from '@/utils/oneBreath/planTurn';
import { REPLAY_LINES, replayItems, replayTyping } from '@/utils/oneBreath/replayItems';

vi.mock('@/components/Icon', () => ({ Icon: 'Icon' }));
vi.mock('react-native', () => ({ StyleSheet: { create: (s: unknown) => s }, Text: 'Text', View: 'View', Pressable: 'Pressable', TextInput: 'TextInput', ScrollView: 'ScrollView', Animated: { Value: class {}, View: 'View', timing: () => ({ start: () => {} }) }, AccessibilityInfo: { isReduceMotionEnabled: async () => false } }));
vi.mock('@/components/ui/AFMark', () => ({ AFMark: 'AFMark' }));
vi.mock('@/components/oneBreath/PreparationOrb', () => ({ PreparationOrb: 'PreparationOrb' }));

const NOW = new Date(2026, 10, 19, 10, 0, 0).getTime();
const START = new Date(2026, 10, 20, 18, 30, 0);
const prep = (over: Record<string, unknown> = {}) => ({ version: 1, context: 'one_breath', transactionId: 't', reviewedAtIso: '2026-11-19T10:00:00Z', sealedAtIso: '2026-11-19T10:00:00Z', returnMethod: 'none', destination: '', emergencyNumber: '911', steps: [{ atIso: START.toISOString(), action: 'Water first.' }], policyVersion: 'p', ...over });
const moment = (preparation?: unknown, over: Partial<Moment> = {}): Moment => ({ id: 'm', source: 'manual', title: 'Dinner', type: 'personal', importance: 'high', startAtIso: START.toISOString(), createdAtIso: '2026-11-19T10:00:00Z', preparation, ...over } as Moment);
const LOCKED = { lockedInAtIso: '2026-11-20T23:20:00Z' };
const RETURNED = { ...LOCKED, returnedAtIso: '2026-11-21T02:00:00Z' };
const labels = (items: readonly ConversationItem[]) => items.flatMap((i) => (i.kind === 'actions' ? i.actions.map((a) => a.label) : []));
const said = (items: readonly ConversationItem[]) => items.flatMap((i) => (i.kind === 'ai' ? [i.text] : []));

function setup(start: Moment[], resume?: Moment) {
  let moments = start;
  const commitMoment = vi.fn(async (next: Moment, expected?: Moment, current?: () => boolean) => {
    if (JSON.stringify(moments.find((m) => m.id === next.id)) !== JSON.stringify(expected)) throw new Error('changed');
    if (current && !current()) throw new Error('stale');
    moments = [...moments.filter((m) => m.id !== next.id), next];
    return next;
  });
  const owners: OneBreathOwners = {
    commitMoment,
    lockIn: vi.fn(async (commit) => commit()) as OneBreathOwners['lockIn'],
    logWater: vi.fn(async () => 'intake-1'),
    undoWater: vi.fn(async () => true),
    recordDrink: vi.fn(async () => ({})),
    moments: () => moments,
    command: () => ({ id: 'c', action: 'Drink water.' }),
    now: () => Date.now(),
  };
  const host: ConversationHost = {
    context: () => ({ nowIso: new Date(Date.now()).toISOString(), social: false, momentInWindow: false, learningOn: false, interpreterReachable: true, networkUp: true }),
    owners,
    openScreen: () => true,
    ...(resume ? { resume: () => resume } : {}),
  };
  const c = createOneBreathConversation(host);
  const view = () => {
    const s = c.getSnapshot();
    return conversationView(s.entries, s, { state: s.session, planRows: s.planRows, planNote: s.planNote, planError: s.planError });
  };
  return { c, owners, commitMoment, view, stored: () => moments };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  resetOneBreathOriginForTests();
});
afterEach(() => vi.useRealTimers());

describe('Plans changed · safety first, in the conversation', () => {
  it.each(['emergency', 'driving', 'water', 'pause'] as const)('%s shows the existing headline and choices', (safety) => {
    const items = openPlanItems({ moment: moment(prep({ ...LOCKED, emergencyNumber: '112' })), mode: 'change', nowMs: NOW, safety });
    expect(said(items)).toEqual([PLAN_SAFETY_LINES[safety]]);
    expect(labels(items)).toEqual(
      safety === 'emergency' ? ['Call 112', 'Contact someone', 'Stay here'] : ['Get a ride', 'Contact someone', 'Stay here', 'Emergency? 112'],
    );
  });

  it('"Contact someone" asks for a number and says nothing is shared; only a real number dials', () => {
    const items = openPlanItems({ moment: moment(prep(LOCKED)), mode: 'change', nowMs: NOW, safety: 'pause', contact: true });
    expect(said(items).at(-1)).toBe('Phone number. Opens your phone app. No message or status is shared.');
    expect(contactNumber('+1 (555) 010-2030')).toBe('+15550102030');
    expect(contactNumber('call my sister')).toBeNull();
    expect(contactNumber('12')).toBeNull();
  });
});

describe('Plans changed · a changed time is read back and sealed again', () => {
  it('nothing is written until the member seals; sealing updates the same Moment', async () => {
    const locked = moment(prep(LOCKED));
    const { c, commitMoment, view, stored } = setup([locked]);
    const changed = changePlan(planDraftFromMoment(locked)!, 'make it 8 pm', new Date(NOW))!;
    expect(changed.time).toBe('8:00 PM');
    c.revise(locked, changed, 'make it 8 pm', 'typed');
    expect(view().awaitingSeal).toBe(true);
    expect(commitMoment).not.toHaveBeenCalled();
    c.send({ kind: 'tap', control: 'seal' });
    await c.settled();
    expect(commitMoment).toHaveBeenCalledTimes(1);
    expect(stored()).toHaveLength(1);
    expect(stored()[0]!.id).toBe('m');
    expect(new Date(stored()[0]!.startAtIso).getHours()).toBe(20);
    // As on the existing screen, a re-sealed plan is locked in again when its window opens.
    expect(stored()[0]!.preparation?.sealedAtIso).toBeTruthy();
    expect(stored()[0]!.preparation?.lockedInAtIso).toBeUndefined();
  });

  it('words that are not a day or time change give no plan', () => {
    expect(changePlan(planDraftFromMoment(moment(prep(LOCKED)))!, 'my friend is running late', new Date(NOW))).toBeNull();
  });
});

describe('A plan saved but never sealed is picked up where it was left', () => {
  const draft = moment(prep({ sealedAtIso: '' }), { prepGoal: 'Be sharp' } as Partial<Moment>);

  it('opens on its read-back with the seal bar, and writes nothing', () => {
    expect(resumableDraft(draft)).toBe(true);
    expect(resumableDraft({ ...draft, source: 'calendar' } as Moment)).toBe(false);
    expect(resumableDraft(moment(prep()))).toBe(false);
    const { view, commitMoment } = setup([draft], draft);
    const v = view();
    expect(v.awaitingSeal).toBe(true);
    expect(said(v.items)[0]).toMatch(/^Dinner, Fri, Nov 20 at 6:30 PM\. Goal: Be sharp\./);
    expect(commitMoment).not.toHaveBeenCalled();
  });

  it('sealing it updates that Moment: no second one is saved', async () => {
    const { c, stored } = setup([draft], draft);
    c.send({ kind: 'tap', control: 'seal' });
    await c.settled();
    expect(stored()).toHaveLength(1);
    expect(stored()[0]!.id).toBe('m');
    expect(stored()[0]!.preparation?.sealedAtIso).toBeTruthy();
  });
});

describe('Replay in the conversation', () => {
  const base = { editing: null, returnLabel: 'Good night.', clock: () => '6:30 PM' } as const;

  it('nothing is asked until the return is saved', () => {
    expect(replayItems({ ...base, moment: moment(prep(LOCKED)) })).toEqual([]);
  });

  it('asks the one question with the sealed plan and the existing answers', () => {
    const items = replayItems({ ...base, moment: moment(prep(RETURNED)) });
    expect(said(items)).toEqual(['Good night.', REPLAY_LINES.ask]);
    expect(items.some((i) => i.kind === 'plan')).toBe(true);
    expect(labels(items)).toEqual(['Yes, it worked', 'Partly', 'Not really', 'Skip']);
  });

  it('a miss asks what got in the way; "Something else" waits for the member’s own words', () => {
    const missed = moment(prep({ ...RETURNED, replay: 'partly' }));
    expect(labels(replayItems({ ...base, moment: missed }))).toEqual(['I was rushed', 'Low energy', 'Forgot water', 'Something else', 'Skip']);
    expect(replayTyping({ moment: missed, editing: 'other' })).toBe('note');
    expect(replayTyping({ moment: missed, editing: null })).toBeNull();
  });

  it('a rule is offered only once the note is saved and learning is known to be on', () => {
    const noted = moment(prep({ ...RETURNED, replay: 'not_really', replayObstacle: 'late' }));
    expect(labels(replayItems({ ...base, moment: noted }))).not.toContain('Write a rule for next time');
    expect(labels(replayItems({ ...base, moment: noted, learningOn: true }))).toContain('Write a rule for next time');
    expect(said(replayItems({ ...base, moment: noted, learningOn: false }))).toContain(REPLAY_LINES.learningOff);
    expect(replayTyping({ moment: noted, editing: 'rule' })).toBe('rule');
  });

  it('an answer is one commit on a returned plan and never changes how it ended', async () => {
    const { owners, commitMoment, stored } = setup([moment(prep(RETURNED))]);
    await saveReplay(owners, 'm', { replay: 'yes', replayObstacle: undefined, replayNote: undefined });
    expect(commitMoment).toHaveBeenCalledTimes(1);
    expect(stored()[0]!.preparation).toMatchObject({ replay: 'yes', returnedAtIso: RETURNED.returnedAtIso });
    const open = setup([moment(prep(LOCKED))]);
    await expect(saveReplay(open.owners, 'm', { replay: 'yes' })).rejects.toThrow();
    expect(open.commitMoment).not.toHaveBeenCalled();
  });
});

describe('Close returns to where One Breath was opened from', () => {
  const router = () => ({ canGoBack: vi.fn(() => true), back: vi.fn(), navigate: vi.fn(), replace: vi.fn() });

  it('as a tab, it goes back to the tab the member was on; only tabs are remembered', () => {
    rememberOneBreathOrigin('/journal');
    rememberOneBreathOrigin('/one-breath-tab');
    rememberOneBreathOrigin('/travel-intelligence');
    expect(oneBreathOrigin()).toBe('/journal');
    const r = router();
    closeOneBreath(r, '/one-breath-tab');
    expect(r.navigate).toHaveBeenCalledWith('/journal');
    expect(r.back).not.toHaveBeenCalled();
  });

  it('opened over another screen, it goes back to that screen; with no history, Home', () => {
    const r = router();
    closeOneBreath(r, '/one-breath');
    expect(r.back).toHaveBeenCalledTimes(1);
    const none = router();
    none.canGoBack.mockReturnValue(false);
    closeOneBreath(none, '/one-breath');
    expect(none.replace).toHaveBeenCalledWith('/');
  });

  it('the tab bar is hidden on One Breath in internal builds', () => {
    const layout = readFileSync(join(__dirname, '..', '..', '..', 'app', '(tabs)', '_layout.tsx'), 'utf8');
    const tab = layout.slice(layout.indexOf('name="one-breath-tab"', layout.indexOf('<Tabs')));
    expect(tab.slice(0, tab.indexOf('<Tabs.Screen'))).toMatch(/momentsFirst \? \{ tabBarStyle: \{ display: 'none' as const \} \}/);
  });
});

describe('The conversation orb', () => {
  it('is 20% larger than the prototype’s 176pt stage', () => {
    expect(CONVERSATION_STAGE).toBe(211);
    expect(CONVERSATION_ORB).toBe(108);
  });
});
