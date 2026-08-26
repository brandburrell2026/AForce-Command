/**
 * `fireMoment` — the four named haptic moments (Wave-5 motion + haptics pass).
 *
 * The founder's rule is "do not vibrate frequently". Before this pass the app
 * fired `expo-haptics` inline from ~60 sites with no shared vocabulary: every
 * tab switch buzzed, every scan buzzed, and the two moments that most deserved
 * one — completing the command on Home, a Protocol step advancing — were
 * silent. `fireMoment` is the single entry point that says which product events
 * are allowed to reach the member's hand.
 *
 * Behavioral, not source-text: each case asserts the exact `expo-haptics` call
 * that reaches the OS. Platform is mocked per-load using the
 * `vi.doMock('react-native', () => ({ Platform: { OS } }))` shape already used
 * by `services/__tests__/appleHealth.internalTestflightGate.test.ts`, because
 * the web no-op is part of the contract.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

type PlatformOS = 'ios' | 'android' | 'web';

const spies = {
  selectionAsync: vi.fn(() => Promise.resolve()),
  impactAsync: vi.fn(() => Promise.resolve()),
  notificationAsync: vi.fn(() => Promise.resolve()),
};

async function loadHaptics(platformOS: PlatformOS) {
  vi.resetModules();
  spies.selectionAsync.mockClear();
  spies.impactAsync.mockClear();
  spies.notificationAsync.mockClear();
  vi.doMock('react-native', () => ({ Platform: { OS: platformOS } }));
  vi.doMock('expo-haptics', () => ({
    ...spies,
    ImpactFeedbackStyle: { Light: 'Light', Medium: 'Medium', Heavy: 'Heavy' },
    NotificationFeedbackType: { Success: 'Success', Warning: 'Warning', Error: 'Error' },
  }));
  return import('../haptics');
}

afterEach(() => {
  vi.doUnmock('react-native');
  vi.doUnmock('expo-haptics');
  vi.resetModules();
});

describe('fireMoment — hydration log acknowledgment', () => {
  it('fires a Success notification when an intake is accepted', async () => {
    const { fireMoment } = await loadHaptics('ios');
    fireMoment('hydration_logged');
    expect(spies.notificationAsync).toHaveBeenCalledTimes(1);
    expect(spies.notificationAsync).toHaveBeenCalledWith('Success');
  });
});

describe('fireMoment — command completion', () => {
  it('acknowledges the one command exactly like an accepted intake', async () => {
    const { fireMoment } = await loadHaptics('ios');
    fireMoment('command_completed');
    expect(spies.notificationAsync).toHaveBeenCalledWith('Success');
    // Completion is never a selection tick — it is the heaviest of the three.
    expect(spies.selectionAsync).not.toHaveBeenCalled();
  });
});

describe('fireMoment — Ritual progression', () => {
  it('is a light selection tick, not a completion notification', async () => {
    const { fireMoment } = await loadHaptics('ios');
    fireMoment('ritual_progressed');
    expect(spies.selectionAsync).toHaveBeenCalledTimes(1);
    expect(spies.notificationAsync).not.toHaveBeenCalled();
    expect(spies.impactAsync).not.toHaveBeenCalled();
  });
});

describe('fireMoment — meaningful state transition', () => {
  it('is the one moment that feels different (Warning, not Success)', async () => {
    const { fireMoment } = await loadHaptics('ios');
    fireMoment('state_transition');
    expect(spies.notificationAsync).toHaveBeenCalledTimes(1);
    expect(spies.notificationAsync).toHaveBeenCalledWith('Warning');
  });
});

describe('fireMoment — platform + failure contract', () => {
  it('is a no-op on web (no haptics engine) for every moment', async () => {
    const { fireMoment } = await loadHaptics('web');
    fireMoment('hydration_logged');
    fireMoment('command_completed');
    fireMoment('ritual_progressed');
    fireMoment('state_transition');
    expect(spies.selectionAsync).not.toHaveBeenCalled();
    expect(spies.impactAsync).not.toHaveBeenCalled();
    expect(spies.notificationAsync).not.toHaveBeenCalled();
  });

  it('fires on Android as well as iOS', async () => {
    const { fireMoment } = await loadHaptics('android');
    fireMoment('ritual_progressed');
    expect(spies.selectionAsync).toHaveBeenCalledTimes(1);
  });

  it('never throws a haptics failure into the interaction that triggered it', async () => {
    const { fireMoment } = await loadHaptics('ios');
    spies.notificationAsync.mockImplementationOnce(() => {
      throw new Error('haptics engine unavailable');
    });
    expect(() => fireMoment('hydration_logged')).not.toThrow();
  });

  it('fires exactly one haptic per call — never a burst', async () => {
    const { fireMoment } = await loadHaptics('ios');
    fireMoment('command_completed');
    const total =
      spies.selectionAsync.mock.calls.length +
      spies.impactAsync.mock.calls.length +
      spies.notificationAsync.mock.calls.length;
    expect(total).toBe(1);
  });
});
