/**
 * One Breath scripted tests — CB1–CB14, L1–L2, D1–D9, S1–S10.
 *
 * Inputs are exactly as scripted in the approved prototype
 * (`reference/one-breath/prototype/index.html`, `cbRun()` and `txRun()`);
 * expected results are the One Breath Final Build Spec's tables. Where the two
 * differ (D7, D8) the prototype's wording is used, as approved by Brandon on
 * 2026-11-20.
 *
 * A scenario marked `it.fails` is not built yet: it fails today and is reported
 * as an expected failure. When a slice makes it pass, vitest fails that
 * `it.fails`, and the marker comes off in the same PR. Built so far: CB1, CB3,
 * CB4, CB5, CB7, CB8, CB10, CB12, CB13, CB14, L1, L2, D9, S7, S10. Each scenario asserts at least one thing the empty session cannot
 * do, so none passes by accident.
 *
 * These run the session contract only. They are not device evidence.
 */
import { describe, it, expect } from 'vitest';
import { duplicateWriteIds, run, say, scan, tap, wait, writes } from './drive';

const LIFT = 'Lift tomorrow at 6:30 AM';
const LMNT = { name: 'LMNT', categoryId: 'electrolyte', packageOz: 16 };
const GATORADE = { name: 'Gatorade', categoryId: 'sports', packageOz: 20 };
const WATER = { name: 'Water', categoryId: 'water', packageOz: 8.5 };

describe('One Breath · conversation tests (CB1–CB14)', () => {
  it('CB1 · multi-turn workout, moved to 7, sealed once, then Quiet', () => {
    const r = run([
      say('I want to lift tomorrow, legs need to be fresh'),
      say('6:30 in the morning'),
      say('Can I go at 7 instead?'),
      say('seal it'),
    ]);
    expect(r.turns[0].reply.outcome).toBe('ask');
    expect(r.turns[1].reply.outcome).toBe('read_back');
    expect(r.turns[2].state.pendingPlan?.time).toBe('7:00 AM');
    expect(r.of('save_moment')).toHaveLength(1);
    expect(r.of('save_moment')[0].plan.goal).toMatch(/legs fresh/i);
    expect(r.of('enter_quiet')).toHaveLength(1);
    expect(r.last.status).toBe('quiet');
  });

  it.fails('CB2 · follow-up answers from the plan without asking again', () => {
    const r = run([say('Lift tomorrow at 6:30 AM, legs fresh'), say('When should I leave the house?')]);
    expect(r.last.reply.request).toBe('prepare');
    expect(r.last.reply.outcome).toBe('act');
    expect(r.last.reply.claims?.every((c) => !!c.source)).toBe(true);
    expect(r.last.state.pendingPlan).toBeDefined();
    expect(writes(r.effects)).toEqual([]);
  });

  it('CB3 · ambiguous time asks one question and makes no plan', () => {
    const r = run([say('Lift at 6:30')]);
    expect(r.last.reply.outcome).toBe('ask');
    expect(r.last.reply.question).toBeTruthy();
    expect(r.last.state.pendingPlan?.time).toBeUndefined();
    expect(writes(r.effects)).toEqual([]);
  });

  it('CB4 · "No, Saturday" moves the plan and keeps the literal words', () => {
    const r = run([say(LIFT), say('No, Saturday')]);
    expect(r.last.reply.outcome).toBe('read_back');
    expect(r.last.state.pendingPlan?.day).toMatch(/^Sat/);
    expect(r.last.state.pendingPlan?.heard).toContain('No, Saturday');
    expect(writes(r.effects)).toEqual([]);
  });

  it('CB5 · "How am I doing?" is an estimate with its source', () => {
    const r = run([say('How am I doing?')]);
    expect(r.last.reply.request).toBe('status');
    expect(r.last.reply.outcome).toBe('act');
    expect(r.last.reply.claims?.length).toBeGreaterThan(0);
    expect(r.last.reply.claims?.every((c) => !!c.source && c.estimate === true)).toBe(true);
    expect(writes(r.effects)).toEqual([]);
  });

  it.fails('CB6 · a 12 oz coffee is logged once, with Undo, and One Breath sets no credit', () => {
    const r = run([say('Log a 12 oz coffee')]);
    expect(r.of('log_drink')).toHaveLength(1);
    expect(r.of('log_drink')[0]).toMatchObject({ categoryId: 'coffee', oz: 12 });
    expect(r.last.reply.undo?.ms).toBe(6000);
    expect(r.last.reply.text).toMatch(/partial credit/i);
  });

  it('CB7 · no reviewed answer, so no guess', () => {
    const r = run([say('Should I take creatine before I lift?')]);
    expect(r.last.reply.outcome).toBe('limit');
    expect(r.last.reply.claims ?? []).toEqual([]);
    expect(writes(r.effects)).toEqual([]);
  });

  it('CB8 · a topic change leaves the plan pending, not sealed', () => {
    const r = run([say(LIFT), say("What's coming up this week?")]);
    expect(r.last.reply.request).toBe('upcoming');
    expect(r.last.reply.outcome).toBe('act');
    expect(r.last.state.pendingPlan).toBeDefined();
    expect(r.of('save_moment')).toEqual([]);
  });

  it.fails('CB9 · send: preview, "send it", 5-second cancellable outbox, sent once', () => {
    const r = run([say("Let Annette know I'm heading home"), say('send it'), wait(5000)], { social: true });
    expect(r.turns[0].reply.outcome).toBe('read_back');
    expect(r.turns[0].effects).toEqual([]);
    expect(r.turns[1].state.outbox[0]).toMatchObject({ to: 'Annette', state: 'pending', msLeft: 5000 });
    expect(r.turns[1].effects).toEqual([]);
    expect(r.of('send_message')).toHaveLength(1);
    expect(r.last.state.outbox[0].state).toBe('sent');
  });

  it('CB10 · interpreter unreachable: words kept, nothing saved, retry or type', () => {
    const r = run([say(LIFT)], { interpreterReachable: false });
    expect(r.last.reply.outcome).toBe('unavailable');
    expect(r.last.state.words).toContain(LIFT);
    expect(r.last.state.pendingPlan).toBeUndefined();
    expect(writes(r.effects)).toEqual([]);
  });

  it.fails('CB11 · learning off: sealing and finishing Replay creates no lesson', () => {
    const r = run([say(LIFT), say('seal it'), tap('replay', 'Okay'), tap('lesson', 'no')], { learningOn: false });
    expect(r.of('save_moment')).toHaveLength(1);
    // Replay is not built in the session yet, so this stays an expected failure
    // rather than passing only because nothing can create a lesson.
    expect(r.turns[2].reply.outcome).toBe('act');
    expect(r.of('save_lesson')).toEqual([]);
  });

  it('CB12 · spoken input reaches the same plan as typing it', () => {
    const typed = run([say(LIFT, 'typed')]);
    const spoken = run([say(LIFT, 'spoken')]);
    expect(spoken.last.reply.outcome).toBe('read_back');
    expect(spoken.last.state.pendingPlan).toEqual(typed.last.state.pendingPlan);
  });

  it('CB13 · a second "seal it" changes nothing and makes no duplicate', () => {
    const r = run([say(LIFT), say('seal it'), say('seal it')]);
    expect(r.of('save_moment')).toHaveLength(1);
    expect(r.last.reply.outcome).toBe('already_done');
    expect(r.last.reply.text).toMatch(/already sealed/i);
    expect(duplicateWriteIds(r.effects)).toEqual([]);
  });

  it('CB14 · a surgery mention gets timing only and a clinician referral', () => {
    const r = run([say('Leg day tomorrow at 6:30 AM. I had knee surgery three weeks ago but I feel fine.')]);
    expect(r.last.reply.outcome).toBe('safety');
    expect(r.last.reply.text).toMatch(/clinician/i);
    expect(r.last.state.pendingPlan?.time).toBe('6:30 AM');
    expect(writes(r.effects)).toEqual([]);
  });
});

describe('One Breath · Lock In only inside a Moment window (L1–L2)', () => {
  it('L1 · no Moment starting: says none is active and offers to plan one', () => {
    const r = run([say('Lock me in')], { momentInWindow: false });
    expect(r.last.reply.request).toBe('lock_in');
    expect(r.last.reply.outcome).toBe('not_active');
    expect(r.of('lock_in')).toEqual([]);
    expect(r.last.state.lockedIn).toBe(false);
  });

  it('L2 · a Moment in its window: Lock In starts, once', () => {
    const r = run([say('Lock me in'), say('Lock me in')], { momentInWindow: true });
    expect(r.turns[0].reply.outcome).toBe('act');
    expect(r.of('lock_in')).toHaveLength(1);
    expect(r.last.state.lockedIn).toBe(true);
  });
});

describe('One Breath · drink tests (D1–D9)', () => {
  it.fails('D1 · scan an LMNT, then "Log it": logged as an electrolyte drink', () => {
    const r = run([scan('0850012345012', LMNT), tap('log')]);
    expect(r.turns[0].reply.outcome).toBe('ask');
    expect(r.turns[0].effects).toEqual([]);
    expect(r.of('log_drink')).toHaveLength(1);
    expect(r.of('log_drink')[0]).toMatchObject({ categoryId: 'electrolyte', oz: 16 });
  });

  it.fails('D2 · scan a Gatorade, then "Log it": logged as a sports drink', () => {
    const r = run([scan('0052000123456', GATORADE), tap('log')]);
    expect(r.of('log_drink')).toHaveLength(1);
    expect(r.of('log_drink')[0]).toMatchObject({ categoryId: 'sports', oz: 20 });
  });

  it.fails('D3 · scan, then close without logging: nothing logged', () => {
    const r = run([scan('0012345000019', WATER), tap('close')]);
    expect(r.turns[0].state.scanned?.barcode).toBe('0012345000019');
    expect(r.last.state.scanned).toBeUndefined();
    expect(r.of('log_drink')).toEqual([]);
  });

  it.fails('D4 · "Had an LMNT": one question about the amount, then logged', () => {
    const r = run([say('Had an LMNT'), say('16 ounces')]);
    expect(r.turns[0].reply.outcome).toBe('ask');
    expect(r.turns[0].effects).toEqual([]);
    expect(r.of('log_drink')).toHaveLength(1);
    expect(r.of('log_drink')[0]).toMatchObject({ categoryId: 'electrolyte', oz: 16 });
  });

  it.fails('D5 · "Drank a 20 oz Gatorade": logged directly with Undo', () => {
    const r = run([say('Drank a 20 oz Gatorade')]);
    expect(r.of('log_drink')).toHaveLength(1);
    expect(r.of('log_drink')[0]).toMatchObject({ categoryId: 'sports', oz: 20 });
    expect(r.last.reply.undo?.ms).toBe(6000);
  });

  it.fails('D6 · unknown barcode: says so, offers a category pick, never guesses', () => {
    const r = run([scan('012345678905')]);
    expect(r.last.reply.outcome).toBe('ask');
    expect(r.last.reply.choices?.length).toBeGreaterThan(1);
    expect(r.last.state.scanned?.categoryId).toBeUndefined();
    expect(r.of('log_drink')).toEqual([]);
  });

  it.fails('D7 · "Had a 12 oz Celsius": logged as an energy drink', () => {
    const r = run([say('Had a 12 oz Celsius')]);
    expect(r.of('log_drink')).toHaveLength(1);
    expect(r.of('log_drink')[0]).toMatchObject({ categoryId: 'energy', oz: 12 });
    expect(r.last.reply.text).toMatch(/partial credit/i);
  });

  it.fails('D8 · Log tapped twice: one log, not two', () => {
    const r = run([scan('0012345000019', WATER), tap('log'), tap('log')]);
    expect(r.of('log_drink')).toHaveLength(1);
    expect(duplicateWriteIds(r.effects)).toEqual([]);
  });

  it('D9 · "Had two beers" outside Social: not counted, nothing logged', () => {
    const r = run([say('Had two beers')], { social: false });
    expect(r.last.reply.outcome).toBe('not_counted');
    expect(r.of('log_drink')).toEqual([]);
  });
});

describe('One Breath · Social tests (S1–S10)', () => {
  const SEND = [say("Let Annette know I'm heading home"), say('send it')];

  it.fails('S1 · sent once after the 5-second outbox', () => {
    const r = run([...SEND, wait(5000), wait(5000)], { social: true });
    expect(r.turns[0].reply.outcome).toBe('read_back');
    expect(r.of('send_message')).toHaveLength(1);
    expect(duplicateWriteIds(r.effects)).toEqual([]);
  });

  it.fails('S2 · Undo inside 5 seconds: nothing is delivered', () => {
    const r = run([...SEND, wait(1500), tap('undo'), wait(5000)], { social: true });
    expect(r.turns[3].reply.outcome).toBe('undone');
    expect(r.last.state.outbox[0].state).toBe('cancelled');
    expect(r.of('send_message')).toEqual([]);
  });

  it.fails('S3 · after delivery: no Undo, and nothing implies a recall', () => {
    const r = run([...SEND, wait(5000), tap('undo')], { social: true });
    expect(r.of('send_message')).toHaveLength(1);
    expect(r.turns[2].reply.undo).toBeUndefined();
    expect(r.last.reply.outcome).not.toBe('undone');
    expect(r.last.state.outbox[0].state).toBe('sent');
  });

  it.fails('S4 · "share it" shares the plan only', () => {
    const r = run([say("Share tonight's plan with Brandon"), say('share it')], { social: true });
    expect(r.turns[0].reply.outcome).toBe('read_back');
    expect(r.of('share_plan')).toHaveLength(1);
    expect(r.of('share_plan')[0].to).toBe('Brandon');
    expect(r.of('share_plan')[0].fields).toEqual(['plan']);
  });

  it.fails('S5 · a new invite can be accepted, declined or left for later; nothing shared first', () => {
    const r = run([tap('invite', 'Tasha')], { social: true });
    expect(r.last.reply.choices).toEqual(expect.arrayContaining(['Accept', 'Decline', 'Decide later']));
    expect(r.of('share_plan')).toEqual([]);
    expect(r.of('send_message')).toEqual([]);
  });

  it.fails('S6 · "Made it back" is sent only because the member said it', () => {
    const r = run([say('Made it back')], { social: true });
    expect(r.last.reply.request).toBe('made_it_back');
    expect(r.of('made_it_back')).toHaveLength(1);
  });

  it('S7 · no "Made it back": nothing implies the member arrived', () => {
    const r = run([say('Dinner with Lilia Friday at 8 pm'), say('seal it'), wait(8 * 60 * 60 * 1000)], { social: true });
    expect(r.of('save_moment')).toHaveLength(1);
    expect(r.of('made_it_back')).toEqual([]);
    expect(r.last.reply.text).not.toMatch(/made it back|home safe|arrived/i);
  });

  it.fails('S8 · connection drops in the outbox window: not sent twice, state is shown', () => {
    const r = run([...SEND, wait(5000), tap('retry'), wait(5000)], { social: true, networkUp: false });
    expect(r.turns[2].state.outbox[0].state).toBe('unknown');
    expect(r.turns[2].reply.choices).toEqual(expect.arrayContaining(['Retry', 'Not now']));
    expect(r.of('send_message').length).toBeLessThanOrEqual(1);
    expect(duplicateWriteIds(r.effects)).toEqual([]);
  });

  it.fails('S9 · removing someone ends access at once, with Undo only while allowed', () => {
    const r = run([tap('remove', 'Tasha')], { social: true });
    expect(r.last.reply.outcome).toBe('approved');
    expect(r.last.reply.undo?.reverses).toMatch(/Tasha/);
    expect(r.of('share_plan')).toEqual([]);
  });

  it('S10 · dinner with drinks seals as a Social Moment; nothing about alcohol is shared', () => {
    const r = run(
      [say('Dinner with Lilia Friday at 8 pm, probably a couple of drinks'), tap('who', 'Lilia'), tap('share', 'Not now'), say('seal it')],
      { social: true },
    );
    expect(r.of('save_moment')).toHaveLength(1);
    expect(r.of('save_moment')[0].plan.type).toBe('social');
    expect(r.of('save_moment')[0].plan.title).toBe('Dinner with Lilia');
    expect(r.of('share_plan')).toEqual([]);
    expect(r.of('log_drink')).toEqual([]);
  });
});
