import { describe, it, expect } from 'vitest';
import {
  ACTIVATION_COPY,
  ACTIVATION_STAGES,
  UNLOCKED_SURFACES,
  isSignalUnlocked,
  isStageReached,
  isSurfaceUnlocked,
  nextStage,
  type ActivationState,
} from '../activationFlow';

describe('activationFlow — spec constants', () => {
  it('declares the six stages in spec order', () => {
    expect(ACTIVATION_STAGES).toEqual([
      'buy',
      'activate',
      'install',
      'first_command',
      'return',
      'subscribe',
    ]);
  });

  it('lists the four Signal-Unlocked surfaces in spec order', () => {
    expect(UNLOCKED_SURFACES).toEqual(['timeline', 'journal', 'protocol', 'hydroscan']);
  });

  it('exposes every spec copy string verbatim', () => {
    expect(ACTIVATION_COPY.headline).toBe('YOUR RECOVERY SYSTEM IS READY');
    expect(ACTIVATION_COPY.activateButton).toBe('ACTIVATE NOW');
    expect(ACTIVATION_COPY.activated).toBe('Recovery Activated');
    expect(ACTIVATION_COPY.firstCommand).toBe('Drink 12 oz water.');
    expect(ACTIVATION_COPY.completion).toBe('Water Cycle Complete');
    expect(ACTIVATION_COPY.unlocked).toBe('Signal Unlocked');
  });
});

describe('nextStage', () => {
  it('advances through every stage in order', () => {
    expect(nextStage('buy')).toBe('activate');
    expect(nextStage('activate')).toBe('install');
    expect(nextStage('install')).toBe('first_command');
    expect(nextStage('first_command')).toBe('return');
    expect(nextStage('return')).toBe('subscribe');
  });

  it('returns null at the final stage', () => {
    expect(nextStage('subscribe')).toBeNull();
  });
});

describe('isStageReached', () => {
  const at = (stage: ActivationState['stage']): ActivationState => ({
    stage,
    firstCommandCompletedAt: null,
  });

  it('is true at the same stage', () => {
    expect(isStageReached(at('install'), 'install')).toBe(true);
  });

  it('is true past the target', () => {
    expect(isStageReached(at('return'), 'install')).toBe(true);
  });

  it('is false before the target', () => {
    expect(isStageReached(at('buy'), 'install')).toBe(false);
  });
});

describe('isSignalUnlocked', () => {
  it('is false before First Command and with no completion timestamp', () => {
    expect(
      isSignalUnlocked({ stage: 'install', firstCommandCompletedAt: null }),
    ).toBe(false);
    expect(
      isSignalUnlocked({ stage: 'first_command', firstCommandCompletedAt: null }),
    ).toBe(false);
  });

  it('is true once firstCommandCompletedAt is set', () => {
    expect(
      isSignalUnlocked({
        stage: 'first_command',
        firstCommandCompletedAt: '2026-01-01T00:00:00.000Z',
      }),
    ).toBe(true);
  });

  it('is true once the stage advances past first_command', () => {
    expect(
      isSignalUnlocked({ stage: 'return', firstCommandCompletedAt: null }),
    ).toBe(true);
    expect(
      isSignalUnlocked({ stage: 'subscribe', firstCommandCompletedAt: null }),
    ).toBe(true);
  });
});

describe('isSurfaceUnlocked', () => {
  it('mirrors Signal Unlocked across all four spec surfaces', () => {
    const locked: ActivationState = { stage: 'install', firstCommandCompletedAt: null };
    const unlocked: ActivationState = {
      stage: 'return',
      firstCommandCompletedAt: '2026-01-01T00:00:00.000Z',
    };
    for (const s of UNLOCKED_SURFACES) {
      expect(isSurfaceUnlocked(locked, s)).toBe(false);
      expect(isSurfaceUnlocked(unlocked, s)).toBe(true);
    }
  });
});
