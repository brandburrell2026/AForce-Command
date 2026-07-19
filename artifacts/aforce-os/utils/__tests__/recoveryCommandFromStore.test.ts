/**
 * Store → RecoveryCommand adapter: builds a valid, derivable command from live
 * data without fabricating a dose.
 */
import { describe, it, expect } from 'vitest';
import { buildRecoveryCommand, parseEngineActionCopy } from '../recovery/recoveryCommandFromStore';
import { deriveRecoveryCommandView, validateRecoveryCommand } from '../recovery/recoveryCommand';

const NOW = Date.parse('2026-07-18T12:00:00.000Z');
const MIN = 60_000;

const src = {
  commandId: 'cmd-1',
  title: 'Start with water',
  instruction: 'Drink 12oz water',
  primaryActionLabel: "I've had the water",
  rationale: 'Stay ahead of the curve',
  recheckInSeconds: 15 * 60,
  sourceVersion: 'engine@live',
};

describe('parseEngineActionCopy — strips the recheck clause (spec §2/§7)', () => {
  it('splits title/instruction and removes "Recheck in …" so the countdown is the ONLY recheck', () => {
    const r = parseEngineActionCopy('Start with water — 20 oz now. Recheck in 15 minutes.');
    expect(r.title).toBe('Start with water');
    expect(r.instruction).toBe('20 oz now.');
    expect(`${r.title} ${r.instruction}`.toLowerCase()).not.toContain('recheck');
  });

  it('handles no separator (title only, empty instruction)', () => {
    expect(parseEngineActionCopy('Add electrolytes. Recheck in 15 minutes.')).toEqual({ title: 'Add electrolytes', instruction: '' });
  });

  it('leaves a clean action without a recheck clause intact', () => {
    expect(parseEngineActionCopy('Add electrolytes — one serving now.')).toEqual({ title: 'Add electrolytes', instruction: 'one serving now.' });
  });

  it('never leaves a stray trailing separator', () => {
    const r = parseEngineActionCopy('Hold steady — you are on pace. Recheck in 20 minutes.');
    expect(r.instruction).toBe('you are on pace.');
    expect(r.instruction).not.toMatch(/[—-]\s*$/);
  });
});

describe('buildRecoveryCommand', () => {
  it('produces a valid command whose timeline is created ≤ recheck ≤ expires', () => {
    const cmd = buildRecoveryCommand(src, NOW);
    expect(validateRecoveryCommand(cmd).valid).toBe(true);
    expect(Date.parse(cmd.createdAt)).toBe(NOW);
    expect(Date.parse(cmd.recheckAt)).toBe(NOW + 15 * MIN);
    expect(Date.parse(cmd.expiresAt)).toBeGreaterThan(Date.parse(cmd.recheckAt));
  });

  it('passes the engine instruction through verbatim and NEVER fabricates a dose', () => {
    const cmd = buildRecoveryCommand(src, NOW);
    expect(cmd.instruction).toBe('Drink 12oz water');
    expect(cmd.quantity).toBeUndefined(); // no structured dose supplied → none invented
  });

  it('only sets a dose when one is explicitly supplied', () => {
    const cmd = buildRecoveryCommand({ ...src, quantity: { value: 20, unit: 'oz' } }, NOW);
    expect(cmd.quantity).toEqual({ value: 20, unit: 'oz' });
  });

  it('clamps a negative recheck to now and stays derivable', () => {
    const cmd = buildRecoveryCommand({ ...src, recheckInSeconds: -30 }, NOW);
    expect(Date.parse(cmd.recheckAt)).toBe(NOW);
    const view = deriveRecoveryCommandView(cmd, NOW);
    expect(view.valid).toBe(true);
    expect(view.countdown).toBe('00:00');
  });

  it('derives cleanly end-to-end: countdown + duration from the built timeline', () => {
    const view = deriveRecoveryCommandView(buildRecoveryCommand(src, NOW), NOW + 5 * MIN);
    expect(view.countdown).toBe('10:00');
    expect(view.durationLabel).toBe('15 MIN');
  });
});
