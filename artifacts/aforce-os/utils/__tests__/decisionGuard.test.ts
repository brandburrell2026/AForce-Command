/**
 * DECISION GUARD battery — the directive-named final seam
 * (aforce-world-class-release.md: "Decision Guard can block every output"
 * :137; zero-tolerance "impossible or unsafe numerical recommendation" and
 * "commercial influence over RecoveryCommand" :1145-1160; §13 commerce
 * neutrality phrase class; §16 deterministic enforcement outside the model).
 *
 * Contract pinned here:
 *  - approved commands pass through guardEngineOutput by REFERENCE
 *    (identity-sensitive consumers: voice dedupe, facade/slice memos,
 *    adaptEngineOutputForRecheck's same-reference no-op contract);
 *  - each block reason fires deterministically on its directive-anchored
 *    trigger, on either copy surface (action or explanation);
 *  - the neutral fallback is a FIXED POINT of the guard (a blocked
 *    command can never cascade);
 *  - Score Protection: blocking replaces command copy only — score,
 *    riskTimer, and performance state pass through by reference.
 */

import { describe, expect, it } from 'vitest';

import {
  DECISION_GUARD_FALLBACK_ACTION,
  DECISION_GUARD_FALLBACK_EXPLANATION,
  evaluateEngineCommand,
  guardEngineOutput,
} from '../intelligence/decisionGuard';
import { DECISION_GUARD_MAX_DOSE_OZ } from '../../config/hydroStateModel';
import { BLOCKING_PROHIBITED_CONCEPTS } from '../intelligence/languageGate/runtimeClaimScan';
import type { Command, ScoreEngineOutput } from '../../types';

const cmd = (over: Partial<Command> = {}): Command => ({
  id: 'cmd-test',
  action: 'Drink 12oz water — steady pace.',
  explanation: 'Recent intake is active.',
  urgencyLevel: 'medium',
  estimatedImpact: '+5 to score',
  ...over,
});

const engineOutput = (command: Command): ScoreEngineOutput =>
  ({
    score: 76,
    performanceState: { level: 'BALANCED' },
    riskTimer: { minutes: 45 },
    command,
  }) as unknown as ScoreEngineOutput;

describe('evaluateEngineCommand — deterministic verdicts', () => {
  it('approves representative canonical copy', () => {
    for (const action of [
      'Drink 12oz water',
      'Hold steady — you are on pace.',
      'Drink 16 ounces now.',
      `Drink ${DECISION_GUARD_MAX_DOSE_OZ} oz across the day.`, // ceiling inclusive
      'Drink 12.5 oz with your next meal.',
    ]) {
      expect(evaluateEngineCommand(cmd({ action }))).toEqual({ verdict: 'approved' });
    }
  });

  it('malformed: missing command, empty id, empty action', () => {
    expect(evaluateEngineCommand(null)).toEqual({ verdict: 'blocked', reason: 'malformed' });
    expect(evaluateEngineCommand(undefined)).toEqual({ verdict: 'blocked', reason: 'malformed' });
    expect(evaluateEngineCommand(cmd({ id: '' }))).toEqual({ verdict: 'blocked', reason: 'malformed' });
    expect(evaluateEngineCommand(cmd({ action: '' }))).toEqual({ verdict: 'blocked', reason: 'malformed' });
  });

  it('unsafe_dose: any oz token outside (0, ceiling] blocks — either surface', () => {
    for (const action of [
      'Drink 900 oz now',
      `Drink ${DECISION_GUARD_MAX_DOSE_OZ + 1} ounces of water`,
      'Drink 0 oz and wait',
      'Start with 8 oz, then 400 oz before noon', // any single bad token blocks
    ]) {
      expect(evaluateEngineCommand(cmd({ action }))).toEqual({
        verdict: 'blocked',
        reason: 'unsafe_dose',
      });
    }
    expect(
      evaluateEngineCommand(cmd({ explanation: 'The engine computed 750 oz of loss to replace now.' })),
    ).toEqual({ verdict: 'blocked', reason: 'unsafe_dose' });
  });

  it('commercial_bias: the §13-named steering phrases block', () => {
    expect(evaluateEngineCommand(cmd({ action: 'Stick preferred for this window.' }))).toEqual({
      verdict: 'blocked',
      reason: 'commercial_bias',
    });
    expect(
      evaluateEngineCommand(cmd({ explanation: 'Bring an AForce stick tonight.' })),
    ).toEqual({ verdict: 'blocked', reason: 'commercial_bias' });
  });

  it('blocked_language: §42 block-severity concepts block (dynamic, non-brittle)', () => {
    // Pull a real concept from the registry so this test tracks governance,
    // not a hardcoded phrase.
    const concept = BLOCKING_PROHIBITED_CONCEPTS[0];
    expect(concept, 'registry must expose at least one blocking concept').toBeTruthy();
    const res = evaluateEngineCommand(cmd({ action: `Drink water — ${concept} today.` }));
    expect(res).toEqual({ verdict: 'blocked', reason: 'blocked_language' });
  });
});

describe('guardEngineOutput — delivery semantics', () => {
  it('approved: SAME engineOutput reference, no clone', () => {
    const out = engineOutput(cmd());
    const g = guardEngineOutput(out);
    expect(g.result).toEqual({ verdict: 'approved' });
    expect(g.engineOutput).toBe(out);
    expect(g.engineOutput.command).toBe(out.command);
  });

  it('blocked: command copy replaced with the neutral fallback; id and urgency survive', () => {
    const bad = cmd({ action: 'Drink 900 oz now', urgencyLevel: 'high' });
    const g = guardEngineOutput(engineOutput(bad));
    expect(g.result).toEqual({ verdict: 'blocked', reason: 'unsafe_dose' });
    expect(g.engineOutput.command.action).toBe(DECISION_GUARD_FALLBACK_ACTION);
    expect(g.engineOutput.command.explanation).toBe(DECISION_GUARD_FALLBACK_EXPLANATION);
    expect(g.engineOutput.command.id).toBe('cmd-test');
    expect(g.engineOutput.command.urgencyLevel).toBe('high');
  });

  it('Score Protection: blocking touches command copy ONLY — score/riskTimer/state pass by reference', () => {
    const out = engineOutput(cmd({ action: 'Drink 900 oz now' }));
    const g = guardEngineOutput(out);
    expect(g.engineOutput).not.toBe(out);
    expect(g.engineOutput.score).toBe(out.score);
    expect(g.engineOutput.riskTimer).toBe(out.riskTimer);
    expect(g.engineOutput.performanceState).toBe(out.performanceState);
  });

  it('FIXED POINT: the fallback itself passes the guard — a blocked command cannot cascade', () => {
    const g = guardEngineOutput(engineOutput(cmd({ action: 'Drink 900 oz now' })));
    const again = guardEngineOutput(g.engineOutput);
    expect(again.result).toEqual({ verdict: 'approved' });
    expect(again.engineOutput).toBe(g.engineOutput);
  });

  it('fallback copy is dose-free, clock-free, and product-free (containment doctrine)', () => {
    for (const text of [DECISION_GUARD_FALLBACK_ACTION, DECISION_GUARD_FALLBACK_EXPLANATION]) {
      expect(text).not.toMatch(/\d+\s*(oz|ounce|stick|serving)/i);
      expect(text).not.toMatch(/recheck in \d/i);
      expect(text).not.toMatch(/AForce/);
    }
  });
});


// ───────────────────────────── RP-4 · dose-MODIFIER class (founder ruling R5)

describe('R5 — dose-modifying language is part of the threat model, as a CLASS', () => {
  const blockedExamples: Array<[string, string]> = [
    ['percent + delta verb',        'Add 20% to your intake.'],
    ['percent + delta verb, other', 'Reduce your intake by 15%.'],
    ['percent + comparative',       'Take 25% more water this hour.'],
    ['percent + intake noun',       'Cut your water 10% for now.'],
    ['multiplier + intake noun',    'Double your water until sunset.'],
    ['multiplier + intake noun 2',  'Drink twice the electrolytes today.'],
    ['multiplier + intake noun 3',  'Halve your intake this evening.'],
    ['delta verb + noun + number',  'Increase your water by 8 oz.'],
    ['delta verb + noun + compar.', 'Boost your hydration with extra fluids.'],
  ];

  it.each(blockedExamples)('BLOCKS %s: %s', async (_label, text) => {
    const { evaluateDeliverableCopy } = await import('../intelligence/decisionGuard');
    const r = evaluateDeliverableCopy(text);
    expect(r.verdict).toBe('blocked');
    expect(r.verdict === 'blocked' && r.reason).toBe('dose_modifier');
  });

  const approvedExamples: Array<[string, string]> = [
    // Canonical commands — absolute in-bounds doses are the command's job.
    ['canonical dose',       'Sip 12 oz of water now.'],
    ['canonical recovery',   'Recovery needed: 20 oz water + 2 sticks.'],
    ['water-first deferral', 'Water first — your current command sets the amount.'],
    // Measurements and consequences are observations, not modifiers.
    ['measured percent',     'Hydration 63% of target.'],
    ['consequence line',     'Without action, your score drops to 52 in 30 min.'],
    ['streak observation',   'Day 5 of consistent hydration.'],
    ['rewritten heat line',  'Heat is opening your recovery window faster.'],
  ];

  it.each(approvedExamples)('approves %s: %s', async (_label, text) => {
    const { evaluateDeliverableCopy } = await import('../intelligence/decisionGuard');
    expect(evaluateDeliverableCopy(text).verdict).toBe('approved');
  });

  it.each([
    ['spelled-out percent', 'Take 20 percent more water this hour.'],
    ['fullwidth percent',   'Add 20％ to your intake.'],
    ['Nx multiplier',       'Aim for 1.5x your water today.'],
  ])('BLOCKS hardened form — %s: %s', async (_l, text) => {
    const { evaluateDeliverableCopy } = await import('../intelligence/decisionGuard');
    expect(evaluateDeliverableCopy(text).verdict).toBe('blocked');
  });

  // The adversarial review executed the guard against paraphrases of the R5
  // offender and found these six APPROVED. Each is a dose modifier in a form
  // the lexicons missed: comparative riding a canonical verb, spelled-out
  // numbers, inflected multipliers, and the "up your <noun>" directive.
  it.each([
    ['comparative + canonical verb',   'Drink an extra 12 oz of water.'],
    ['comparative + canonical verb 2', 'Sip 8 oz more before the session.'],
    ['up-directive + spoken percent',  'Up your intake 20 percent.'],
    ['spelled-out number percent',     'Increase hydration twenty percent.'],
    ['inflected multiplier',           'Your intake should be halved today.'],
    ['article as implicit count',      'Have an extra stick tonight.'],
  ])('BLOCKS review-found bypass — %s: %s', async (_l, text) => {
    const { evaluateDeliverableCopy } = await import('../intelligence/decisionGuard');
    const r = evaluateDeliverableCopy(text);
    expect(r.verdict).toBe('blocked');
    expect(r.verdict === 'blocked' && r.reason).toBe('dose_modifier');
  });

  it.each([
    // "set up / warm up" are not the up-directive — phrasal verbs pass.
    ['phrasal up', 'Set up your water reminder for 8 AM.'],
    // A word-count beside a comparative without an intake noun is prose.
    ['prose comparative', 'Read one more article about hydration science.'],
  ])('approves hardening negative — %s: %s', async (_l, text) => {
    const { evaluateDeliverableCopy } = await import('../intelligence/decisionGuard');
    expect(evaluateDeliverableCopy(text).verdict).toBe('approved');
  });

  it('newlines are sentence boundaries — a title cannot fuse with a body', async () => {
    const { evaluateDeliverableCopy } = await import('../intelligence/decisionGuard');
    // Fused into one "sentence", 'Double'+'water' would false-positive class B.
    expect(evaluateDeliverableCopy('Double dinner\nWater first — your current command sets the amount.').verdict)
      .toBe('approved');
  });

  it('member-authored LABELS are names, not instructions — the modifier class does not apply', async () => {
    const g = await import('../intelligence/decisionGuard');
    for (const title of ['Double water polo practice', 'Halve marathon split review', 'Add-a-thon fundraiser dinner']) {
      // As a TITLE: approved — blocking it would silently kill the member's
      // own reminder for an event they named.
      expect(g.evaluateDeliverableLabel(title).verdict, `label: ${title}`).toBe('approved');
    }
    // The SAME text as command copy is still blocked — the exemption is the
    // slot, never the string.
    expect(g.evaluateDeliverableCopy('Double water polo practice').verdict).toBe('blocked');
    // And a label keeps every other protection: unsafe doses still block.
    expect(g.evaluateDeliverableLabel('Chug 500 oz challenge').verdict).toBe('blocked');
  });

  it('both notification seams route the TITLE through the label evaluator', () => {
    const { readFileSync } = require('node:fs') as typeof import('node:fs');
    const { join } = require('node:path') as typeof import('node:path');
    for (const rel of ['services/momentNotifications.ts', 'services/notifications.ts']) {
      const src = readFileSync(join(__dirname, '..', '..', rel), 'utf8');
      expect(src, `${rel} title must use evaluateDeliverableLabel`).toMatch(
        /evaluateDeliverableLabel\((?:copy\.)?title\)/,
      );
      expect(src, `${rel} body must keep the FULL check`).toMatch(
        /evaluateDeliverableCopy\((?:copy\.)?body\)/,
      );
    }
  });

  it('the guard blocks a command whose EXPLANATION carries a modifier', async () => {
    const { evaluateEngineCommand } = await import('../intelligence/decisionGuard');
    const r = evaluateEngineCommand({
      id: 'cmd-x',
      action: 'Sip 12 oz of water now.',
      explanation: 'Heat is opening your recovery window faster. Add 20% to your intake.',
      urgencyLevel: 'medium',
      estimatedImpact: '',
    } as never);
    expect(r.verdict).toBe('blocked');
    expect(r.verdict === 'blocked' && r.reason).toBe('dose_modifier');
  });

  it('the neutral fallback is still a fixed point of the WIDENED guard', async () => {
    const g = await import('../intelligence/decisionGuard');
    expect(g.evaluateDeliverableCopy(g.DECISION_GUARD_FALLBACK_ACTION).verdict).toBe('approved');
    expect(g.evaluateDeliverableCopy(g.DECISION_GUARD_FALLBACK_EXPLANATION).verdict).toBe('approved');
  });

  it('SWEEP — every live coach.* string in every locale passes the widened guard', async () => {
    // The zero-false-positive proof, and the lock on the copy itself: the one
    // known offender (coach.context_heat_high, "Add 20% to your intake") must
    // be REWRITTEN, not blocklisted — restoring it fails this sweep.
    const { evaluateDeliverableCopy } = await import('../intelligence/decisionGuard');
    const { readdirSync, readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const dir = join(__dirname, '..', '..', 'locales');
    const SUBS: Record<string, string | number> = {
      count: 5, projected: 52, minutes: 30, pct: 60, oz: 12, ozMin: 12, ozMax: 16,
      min: 20, score: 70, name: 'Berry Blast', time: '9:15 AM', hours: 2, days: 3,
    };
    const render = (tpl: string) =>
      tpl.replace(/\{\{(\w+)\}\}/g, (_m, k) => String(SUBS[k] ?? 4));
    let checked = 0;
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
      const j = JSON.parse(readFileSync(join(dir, f), 'utf8'));
      for (const [key, value] of Object.entries(j.coach ?? {})) {
        if (typeof value !== 'string') continue;
        checked++;
        const r = evaluateDeliverableCopy(render(value));
        expect(r.verdict, `${f} coach.${key}: "${value}"`).toBe('approved');
      }
    }
    expect(checked).toBeGreaterThan(40);
  });
});
