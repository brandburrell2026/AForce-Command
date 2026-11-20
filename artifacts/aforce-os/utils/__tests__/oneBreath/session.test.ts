/**
 * One Breath session — the turns it can answer so far, and the safety
 * properties that hold for every turn.
 */
import { describe, it, expect } from 'vitest';
import { ONE_BREATH_LINES } from '@/utils/oneBreath/session';
import { PHRASING_SET } from './phrasingSet';
import { run, say, scan, tap, wait, writes } from './drive';

describe('One Breath session · built so far', () => {
  it('keeps the member\'s words even when nothing can be reached', () => {
    const r = run([say('Lift tomorrow at 6:30 AM')], { interpreterReachable: false });
    expect(r.last.reply.text).toBe(ONE_BREATH_LINES.unavailable);
    expect(r.last.state.words).toEqual(['Lift tomorrow at 6:30 AM']);
  });

  it('the window comes from context, not from the interpreter\'s say-so', () => {
    const lying = () => ({ request: 'lock_in' as const, outcome: 'act' as const });
    const state = { sealed: [], outbox: [], words: [], lockedIn: false, logged: 0 };
    // Imported lazily to pass a custom interpreter.
    return import('@/utils/oneBreath/session').then(({ oneBreathTurn }) => {
      const turn = oneBreathTurn(state, { kind: 'say', words: 'Lock me in', via: 'typed' }, {
        nowIso: '2026-11-19T16:00:00.000Z', social: false, momentInWindow: false, learningOn: true, interpreterReachable: true, networkUp: true,
      }, lying);
      expect(turn.reply.outcome).toBe('not_active');
      expect(turn.effects).toEqual([]);
    });
  });

  it('Lock In is keyed to the Moment, so a repeat can only be carried out once', () => {
    const r = run([say('Lock me in'), say('lock in')], { momentInWindow: true, currentMomentId: 'm1' });
    expect(r.of('lock_in')).toEqual([{ kind: 'lock_in', id: 'lock-in:m1' }]);
    expect(r.last.reply.outcome).toBe('already_done');
  });

  it('a request that is understood but not built changes nothing and claims nothing', () => {
    const r = run([say('When should I leave the house?'), say("Let Annette know I'm heading home"), say("Share tonight's plan with Brandon")], { social: true });
    for (const t of r.turns) {
      expect(t.reply.outcome).toBe('not_built');
      expect(t.reply.text).toBe('');
      expect(t.effects).toEqual([]);
    }
    expect(r.turns.map((t) => t.reply.request)).toEqual(['prepare', 'send_message', 'share_plan']);
  });

  it('an unknown barcode can never be logged by tapping Log', () => {
    const r = run([scan('012345678905'), tap('log'), tap('log'), wait(6000)]);
    expect(r.effects).toEqual([]);
  });
});

describe('One Breath session · planning a Moment', () => {
  const LIFT = 'Lift tomorrow at 6:30 AM';

  it('a plan is saved only by "seal it" on a complete read-back', () => {
    for (const words of ['yes', 'ok', 'sounds good', 'do it', 'confirm']) {
      const r = run([say(LIFT), say(words)]);
      expect(r.of('save_moment'), words).toEqual([]);
      expect(r.last.state.pendingPlan, words).toBeDefined();
    }
    expect(run([say(LIFT), say("don't seal it")]).of('save_moment')).toEqual([]);
  });

  it('"seal it" with nothing waiting saves nothing', () => {
    const r = run([say('seal it')]);
    expect(r.effects).toEqual([]);
    expect(r.last.reply.text).toBe(ONE_BREATH_LINES.noPlan);
  });

  it('an incomplete plan cannot be sealed', () => {
    const r = run([say('Lift at 6:30'), say('seal it')]);
    expect(r.of('save_moment')).toEqual([]);
  });

  it('asks for the time, then the day, one question at a time', () => {
    const r = run([say('Lift at 6:30'), say('6:30 AM'), say('Saturday')]);
    expect(r.turns[0].reply.question).toBe('6:30 in the morning or evening?');
    expect(r.turns[0].reply.choices).toEqual(['6:30 AM', '6:30 PM']);
    expect(r.turns[1].reply.question).toBe(ONE_BREATH_LINES.askDay);
    expect(r.last.reply.outcome).toBe('read_back');
    expect(r.last.state.pendingPlan).toMatchObject({ title: 'Morning lift', day: 'Sat, Nov 21', time: '6:30 AM', date: '2026-11-21', time24: '06:30' });
  });

  it('names the plan, keeps the goal, and reads back exactly what will be saved', () => {
    const r = run([say('I want to lift tomorrow, legs need to be fresh'), say('6:30 in the morning')]);
    expect(r.last.state.pendingPlan).toMatchObject({ title: 'Morning lift', goal: 'Legs fresh', day: 'Fri, Nov 20', time: '6:30 AM' });
    expect(r.last.reply.text).toBe("Morning lift, Fri, Nov 20 at 6:30 AM. Goal: Legs fresh. Say 'seal it' to confirm.");
    const sealed = run([say('I want to lift tomorrow, legs need to be fresh'), say('6:30 in the morning'), say('seal it')]);
    expect(sealed.of('save_moment')[0].plan).toEqual(r.last.state.pendingPlan);
  });

  it('a change keeps the plan pending and never saves', () => {
    const r = run([say(LIFT), say('Can I go at 7 instead?'), say('No, Saturday')]);
    expect(r.last.state.pendingPlan).toMatchObject({ day: 'Sat, Nov 21', time: '7:00 AM' });
    expect(r.effects).toEqual([]);
  });

  it('a different plan with the same words seals under the same id, so a retry cannot save twice', () => {
    const a = run([say(LIFT), say('seal it')]).of('save_moment')[0].id;
    const b = run([say(LIFT), say('seal it')]).of('save_moment')[0].id;
    expect(a).toBe(b);
    expect(run([say(LIFT), say('No, Saturday'), say('seal it')]).of('save_moment')[0].id).not.toBe(a);
  });

  it('a medical mention keeps the timing and leaves the health detail out of the plan', () => {
    const r = run([say('Leg day tomorrow at 6:30 AM. I had knee surgery three weeks ago but I feel fine.')]);
    const plan = r.last.state.pendingPlan!;
    expect(plan.title).toBe('Leg day');
    expect(JSON.stringify(plan)).not.toMatch(/surgery|knee/i);
  });

  it('plan steps are not invented here', () => {
    expect(run([say(LIFT)]).last.state.pendingPlan?.steps).toEqual([]);
  });
});

describe('One Breath session · drinks', () => {
  it('logs a clear drink once, repeats the rules\' credit note, and opens a 6-second Undo', () => {
    const r = run([say('Log a 12 oz coffee')]);
    expect(r.of('log_drink')).toEqual([{ kind: 'log_drink', id: 'drink:0:coffee:12', categoryId: 'coffee', name: 'coffee', oz: 12 }]);
    expect(r.last.reply.text).toBe('Logged 12 oz coffee. Partial credit pending.');
    expect(r.last.reply.undo).toEqual({ reverses: 'Logged 12 oz coffee', ms: 6000 });
  });

  it('says nothing about credit when the hydration rules say nothing', () => {
    const r = run([say('Log a 12 oz coffee')], { creditNote: undefined });
    expect(r.last.reply.text).toBe('Logged 12 oz coffee.');
  });

  it('Undo inside the window asks for that one log to be reversed; after it, Undo does nothing', () => {
    const inside = run([say('Had 16 ounces of water'), wait(3000), tap('undo')]);
    expect(inside.of('undo_drink')).toEqual([{ kind: 'undo_drink', id: 'undo:drink:0:water:16', of: 'drink:0:water:16' }]);
    expect(inside.last.reply.outcome).toBe('undone');
    const late = run([say('Had 16 ounces of water'), wait(6000), tap('undo')]);
    expect(late.of('undo_drink')).toEqual([]);
    expect(run([say('Had 16 ounces of water'), tap('undo'), tap('undo')]).of('undo_drink')).toHaveLength(1);
  });

  it('two separate drinks are two logs with different ids', () => {
    const r = run([say('Had 16 ounces of water'), say('Had 16 ounces of water')]);
    expect(r.of('log_drink').map((e) => e.id)).toEqual(['drink:0:water:16', 'drink:1:water:16']);
  });

  it('takes the category from the app\'s drink catalog and never picks between two', () => {
    expect(run([say('Had a 16 oz LMNT')]).of('log_drink')[0]).toMatchObject({ categoryId: 'electrolyte', name: 'LMNT' });
    expect(run([say('drank 12 oz of Pedialyte')]).of('log_drink')[0]).toMatchObject({ categoryId: 'electrolyte' });
    expect(run([say('had a 16 oz Monster')]).of('log_drink')[0]).toMatchObject({ categoryId: 'energy_drink' });
  });

  it('a drink the catalog does not list is asked about, not filed somewhere', () => {
    const r = run([say('had a 16 oz AFORCE')]);
    expect(r.of('log_drink')).toEqual([]);
    expect(r.last.reply.outcome).toBe('ask');
  });

  it('reads amounts in ounces, millilitres, litres and cups, and refuses unclear ones', () => {
    const oz = (words: string) => run([say(words)]).of('log_drink')[0]?.oz;
    expect(oz('add a 16.9 oz bottle of water')).toBe(16.9);
    expect(oz('log 500 ml of water')).toBe(16.9);
    expect(oz('i drank 1 liter of water')).toBe(33.8);
    expect(oz('had 2 cups of water')).toBe(16);
    expect(oz('log 16 or 20 oz of water')).toBeUndefined();
    expect(oz('had a cup of joe')).toBeUndefined();
    expect(oz('log 900 oz of water')).toBeUndefined();
  });

  it('a scan logs only on "Log it", with the amount from the package', () => {
    const r = run([scan('0850012345012', { name: 'LMNT', categoryId: 'electrolyte', packageOz: 16 })]);
    expect(r.last.reply.text).toBe('LMNT, 16 oz. Log it?');
    expect(r.last.reply.choices).toEqual(['Log it', 'Not now']);
    expect(r.effects).toEqual([]);
  });
});

describe('One Breath session · read-only requests', () => {
  it('repeats HydroState with its source and says when it is an estimate', () => {
    const r = run([say('How am I doing?')]);
    expect(r.last.reply.text).toBe('HydroState 51, Behind. That\u2019s an estimate. From drinks you logged today.');
    expect(r.last.reply.claims).toEqual([{ text: 'HydroState 51, Behind.', source: 'drinks you logged today', estimate: true }]);
  });

  it('a measured value is not called an estimate', () => {
    const r = run([say('How am I doing?')], { hydroState: { value: 82, word: 'Balanced', estimated: false, source: 'Phantom', asOf: 'synced 2m ago' } });
    expect(r.last.reply.text).toBe('HydroState 82, Balanced. From Phantom, synced 2m ago.');
  });

  it('says so when HydroState cannot be read, and states no number', () => {
    const r = run([say('How am I doing?')], { hydroState: undefined });
    expect(r.last.reply.text).toBe(ONE_BREATH_LINES.statusUnavailable);
    expect(r.last.reply.claims).toBeUndefined();
    expect(r.last.reply.text).not.toMatch(/\d/);
  });

  it('lists what the Moments store holds, and nothing when it is empty or unreadable', () => {
    expect(run([say("What's coming up this week?")]).last.reply.text).toBe('Morning lift \u00b7 Fri, Nov 20 6:30 AM.');
    expect(run([say("What's coming up?")], { upcoming: [] }).last.reply.text).toBe(ONE_BREATH_LINES.upcomingNone);
    expect(run([say("What's coming up?")], { upcoming: undefined }).last.reply.text).toBe(ONE_BREATH_LINES.upcomingUnavailable);
  });

  it('opens a named screen by key and asks when the destination is unclear', () => {
    expect(run([say('Pull up hydration')]).of('open_screen')).toEqual([{ kind: 'open_screen', id: 'open:hydration', screen: 'hydration' }]);
    expect(run([say('Show my Circle')]).of('open_screen')[0].screen).toBe('circle');
    expect(run([say('show me what aforce remembers')]).of('open_screen')[0].screen).toBe('remembers');
    const vague = run([say('open it')]);
    expect(vague.last.reply.question).toBe(ONE_BREATH_LINES.askScreen);
    expect(vague.effects).toEqual([]);
  });

  it('every "open a screen" phrase the rules accept lands on a screen, never a dead end', () => {
    for (const p of PHRASING_SET.filter((x) => x.request === 'open_screen' && x.outcome === 'act')) {
      expect(run([say(p.text)]).of('open_screen'), `${p.id} ${p.text}`).toHaveLength(1);
    }
  });

  it('reading never writes, and never disturbs a plan that is waiting', () => {
    const r = run([say('Lift tomorrow at 6:30 AM'), say('How am I doing?'), say("What's next"), say('Pull up hydration')]);
    expect(writes(r.effects)).toEqual([]);
    expect(r.last.state.pendingPlan?.title).toBe('Morning lift');
  });
});

/** Clear drink phrases (of 45) that log without a question today. A floor, so it cannot quietly get worse. */
const DIRECT_LOG_FLOOR = 43;

describe('One Breath session · for every written request', () => {
  it('a single utterance never writes more than its phrase allows, and only a drink log or Lock In', () => {
    for (const p of PHRASING_SET) {
      const r = run([say(p.text)], { social: p.social, momentInWindow: p.inWindow });
      const w = writes(r.effects);
      expect(w.length, `${p.id} ${p.text}`).toBeLessThanOrEqual(p.writes);
      for (const e of w) expect(['log_drink', 'lock_in'], p.id).toContain(e.kind);
    }
  });

  it('most clear drink phrases log directly; the rest ask instead of guessing', () => {
    const clear = PHRASING_SET.filter((p) => p.request === 'log_drink' && p.outcome === 'act');
    const logged = clear.filter((p) => run([say(p.text)]).of('log_drink').length === 1);
    const asked = clear.filter((p) => run([say(p.text)]).last.reply.outcome === 'ask');
    expect(logged.length + asked.length).toBe(clear.length);
    expect(logged.length).toBeGreaterThanOrEqual(DIRECT_LOG_FLOOR);
  });
});
