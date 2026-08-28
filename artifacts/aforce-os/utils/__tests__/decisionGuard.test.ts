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
