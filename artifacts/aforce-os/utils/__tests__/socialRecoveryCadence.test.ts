/**
 * Ruling #2 — one cadence framing per state in the social recovery window.
 *
 * While the user is awake the window runs as a timed 15-minute recheck LOOP;
 * the single "before sleep" command is the night's TERMINAL closer, shown only
 * once they're winding down (`isAwake === false`). These assert the branch
 * selection in `generateSocialCommand`, keyed off the sleep/awake signal.
 */
import { describe, it, expect, vi } from 'vitest';

// copy.ts → services/i18nService → react-native, which vitest can't collect.
// Stub i18n so the pure command-selection logic is testable in isolation; the
// command IDs (what we assert) are literals, independent of translation.
vi.mock('../../services/i18nService', () => ({ default: { t: (k: string) => k } }));

import { generateSocialCommand } from '../scoring/copy';

const recoveryWindow = { inRecoveryWindow: true, active: false } as never;
const makeState = (isAwake: boolean) => ({ isAwake } as never);

describe('generateSocialCommand — one cadence per state (ruling #2)', () => {
  it('awake in the recovery window → the 15-min LOOP command (countdown-driven)', () => {
    const cmd = generateSocialCommand(makeState(true), recoveryWindow);
    expect(cmd?.id).toBe('cmd-social-recovery-loop');
    expect(cmd?.action).toBe('coach.social_recovery_loop_action');
  });

  it('winding down (!isAwake) → the terminal "before sleep" command (no loop)', () => {
    const cmd = generateSocialCommand(makeState(false), recoveryWindow);
    expect(cmd?.id).toBe('cmd-social-recovery');
    expect(cmd?.action).toBe('coach.social_recovery_action');
  });

  it('never emits both framings — the two states resolve to different commands', () => {
    const awake = generateSocialCommand(makeState(true), recoveryWindow);
    const asleep = generateSocialCommand(makeState(false), recoveryWindow);
    expect(awake?.id).not.toBe(asleep?.id);
  });
});
