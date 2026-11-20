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
    const state = { sealed: [], outbox: [], words: [], lockedIn: false };
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
    const r = run([say('Log a 12 oz coffee'), say('When should I leave the house?'), say("Let Annette know I'm heading home")], { social: true });
    for (const t of r.turns) {
      expect(t.reply.outcome).toBe('not_built');
      expect(t.reply.text).toBe('');
      expect(t.effects).toEqual([]);
    }
    expect(r.turns.map((t) => t.reply.request)).toEqual(['log_drink', 'prepare', 'send_message']);
  });

  it('taps, scans and waiting do nothing yet', () => {
    const r = run([scan('012345678905'), tap('log'), wait(6000)]);
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

describe('One Breath session · for every written request', () => {
  it('the only thing a single utterance can change today is Lock In, inside its window', () => {
    for (const p of PHRASING_SET) {
      const r = run([say(p.text)], { social: p.social, momentInWindow: p.inWindow });
      const w = writes(r.effects);
      if (p.request === 'lock_in' && p.inWindow) expect(w.map((e) => e.kind), p.id).toEqual(['lock_in']);
      else expect(w, p.id).toEqual([]);
    }
  });
});
