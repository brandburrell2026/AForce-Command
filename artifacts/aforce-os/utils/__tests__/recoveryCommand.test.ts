/**
 * Recovery Coach command model — the spec §7/§11 non-negotiables:
 * one object supplies all guidance; countdown/progress/duration derive from
 * recheckAt so they can't disagree; expired/invalid never render as active.
 */
import { describe, it, expect } from 'vitest';
import {
  validateRecoveryCommand,
  deriveRecoveryCommandView,
  formatCountdown,
  RECOVERY_EXPIRED_TITLE,
  RECOVERY_EXPIRED_ACTION,
  RECOVERY_ACK_ACTION,
  RECOVERY_RECHECKING_TITLE,
  RECOVERY_FALLBACK_TITLE,
  type RecoveryCommand,
} from '../recovery/recoveryCommand';

const T0 = Date.parse('2026-07-18T12:00:00.000Z');
const MIN = 60_000;

function cmd(over: Partial<RecoveryCommand> = {}): RecoveryCommand {
  return {
    id: 'rc_1',
    state: 'active',
    title: 'Start with water',
    instruction: 'Drink 20 oz. Recheck in 15 minutes.',
    primaryActionLabel: "I've had the water",
    quantity: { value: 20, unit: 'oz' },
    createdAt: new Date(T0).toISOString(),
    recheckAt: new Date(T0 + 15 * MIN).toISOString(),
    expiresAt: new Date(T0 + 60 * MIN).toISOString(),
    rationale: 'Rehydrating first steadies the next reading.',
    sourceVersion: 'rules@1',
    ...over,
  };
}

describe('formatCountdown', () => {
  it('mm:ss zero-padded, clamped ≥ 0', () => {
    expect(formatCountdown(15 * MIN)).toBe('15:00');
    expect(formatCountdown(4 * MIN + 12_000)).toBe('04:12');
    expect(formatCountdown(9_000)).toBe('00:09');
    expect(formatCountdown(-5000)).toBe('00:00');
  });
});

describe('validateRecoveryCommand', () => {
  it('accepts a well-formed command', () => {
    expect(validateRecoveryCommand(cmd()).valid).toBe(true);
  });
  it('rejects missing / empty required fields', () => {
    expect(validateRecoveryCommand(null).valid).toBe(false);
    expect(validateRecoveryCommand(cmd({ title: '' })).valid).toBe(false);
    expect(validateRecoveryCommand(cmd({ primaryActionLabel: '' })).valid).toBe(false);
  });
  it('rejects bad or out-of-order timestamps', () => {
    expect(validateRecoveryCommand(cmd({ recheckAt: 'not-a-date' })).valid).toBe(false);
    // recheck before created
    expect(validateRecoveryCommand(cmd({ recheckAt: new Date(T0 - MIN).toISOString() })).valid).toBe(false);
    // expires before recheck
    expect(validateRecoveryCommand(cmd({ expiresAt: new Date(T0 + 5 * MIN).toISOString() })).valid).toBe(false);
  });
  it('rejects a non-positive / unknown-unit dose', () => {
    expect(validateRecoveryCommand(cmd({ quantity: { value: 0, unit: 'oz' } })).valid).toBe(false);
    expect(validateRecoveryCommand(cmd({ quantity: { value: 20, unit: 'cups' as never } })).valid).toBe(false);
  });
});

describe('deriveRecoveryCommandView — single source (spec §7/§11)', () => {
  it('countdown, progress, and duration ALL derive from createdAt/recheckAt together', () => {
    // 5 min into a 15-min window
    const v = deriveRecoveryCommandView(cmd(), T0 + 5 * MIN);
    expect(v.countdown).toBe('10:00'); // 15 - 5 remaining
    expect(v.progress).toBeCloseTo(5 / 15, 5);
    expect(v.durationLabel).toBe('15 MIN');

    // change ONLY recheckAt → all three move together, no independent string
    const longer = deriveRecoveryCommandView(cmd({ recheckAt: new Date(T0 + 30 * MIN).toISOString() }), T0 + 5 * MIN);
    expect(longer.countdown).toBe('25:00');
    expect(longer.progress).toBeCloseTo(5 / 30, 5);
    expect(longer.durationLabel).toBe('30 MIN');
  });

  it('the dose shown is exactly command.quantity — never fabricated', () => {
    expect(deriveRecoveryCommandView(cmd(), T0).quantity).toEqual({ value: 20, unit: 'oz' });
    expect(deriveRecoveryCommandView(cmd({ quantity: undefined }), T0).quantity).toBeUndefined();
  });

  it('progress clamps to [0,1]; countdown clamps at 00:00 past recheck', () => {
    expect(deriveRecoveryCommandView(cmd(), T0 - MIN).progress).toBe(0); // before start
    const past = deriveRecoveryCommandView(cmd(), T0 + 20 * MIN); // past recheck, before expiry
    expect(past.progress).toBe(1);
    expect(past.countdown).toBe('00:00');
  });
});

describe('deriveRecoveryCommandView — states (spec §8)', () => {
  it('acknowledged → primary label becomes "Water logged"', () => {
    const v = deriveRecoveryCommandView(cmd({ state: 'acknowledged' }), T0 + MIN);
    expect(v.acknowledged).toBe(true);
    expect(v.primaryActionLabel).toBe(RECOVERY_ACK_ACTION);
  });

  it('rechecking → title becomes "Recheck in progress", timer still visible', () => {
    const v = deriveRecoveryCommandView(cmd({ state: 'rechecking' }), T0 + MIN);
    expect(v.title).toBe(RECOVERY_RECHECKING_TITLE);
    expect(v.timerLabel).toBe('NEXT CHECK');
  });

  it('past expiresAt ALWAYS reads expired (even if stored state is active), progress stopped', () => {
    const v = deriveRecoveryCommandView(cmd({ state: 'active' }), T0 + 61 * MIN);
    expect(v.state).toBe('expired');
    expect(v.title).toBe(RECOVERY_EXPIRED_TITLE);
    expect(v.primaryActionLabel).toBe(RECOVERY_EXPIRED_ACTION);
    expect(v.progress).toBe(1);
    expect(v.countdown).toBe('00:00');
  });

  it('invalid command → safe fallback, never partial guidance', () => {
    const v = deriveRecoveryCommandView(cmd({ instruction: '' }), T0);
    expect(v.valid).toBe(false);
    expect(v.title).toBe(RECOVERY_FALLBACK_TITLE);
    expect(v.primaryActionLabel).toBe(RECOVERY_EXPIRED_ACTION);
  });

  it('offline → exposes an "Updated X min ago" label, does not extend expiry', () => {
    const v = deriveRecoveryCommandView(cmd(), T0 + 7 * MIN, { offline: true });
    expect(v.updatedAgoLabel).toBe('Updated 7 min ago');
    expect(v.state).toBe('active'); // still valid within window; expiry untouched
  });
});

describe('honesty invariant: an expired/invalid command is NEVER shown as active', () => {
  it('no derivation of a stale or invalid command yields an active/acknowledged running state', () => {
    const stale = deriveRecoveryCommandView(cmd({ state: 'active' }), T0 + 90 * MIN); // well past expiry
    expect(['expired']).toContain(stale.state);
    const invalid = deriveRecoveryCommandView(cmd({ createdAt: 'x' }), T0);
    expect(invalid.valid).toBe(false);
    expect(invalid.state).toBe('expired');
  });
});
