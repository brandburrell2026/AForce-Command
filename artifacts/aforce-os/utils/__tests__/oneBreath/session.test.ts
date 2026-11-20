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
    const r = run([say('Log a 12 oz coffee'), say('Lift tomorrow at 6:30 AM'), say('How am I doing?')]);
    for (const t of r.turns) {
      expect(t.reply.outcome).toBe('not_built');
      expect(t.reply.text).toBe('');
      expect(t.effects).toEqual([]);
    }
    expect(r.turns.map((t) => t.reply.request)).toEqual(['log_drink', 'plan_moment', 'status']);
  });

  it('taps, scans and waiting do nothing yet', () => {
    const r = run([scan('012345678905'), tap('log'), wait(6000)]);
    expect(r.effects).toEqual([]);
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
