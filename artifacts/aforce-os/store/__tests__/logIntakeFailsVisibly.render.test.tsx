// @vitest-environment happy-dom
/**
 * logIntake — A LOST WRITE MUST NOT LOOK LIKE A SAVED ONE (Build 61, write leg).
 *
 * Build 60's `logIntake` catch did two things: `console.warn` (invisible to a
 * member) and `dispatch({ type: 'CYCLE_FAILURE' })`, which only clears
 * `isCompletingCycle`. So a 401 / 5xx / timeout produced EXACTLY what success
 * produces from the member's seat — the spinner stops and nothing else happens
 * — while the intake was discarded. `offline_intake_outbox_enabled` is false in
 * production, so there is no durable queue behind that catch: the write is
 * genuinely gone, and it is the member's tap to make again.
 *
 * That matters most on the primary control in the product: HomeScreenV2's
 * command card logs with `silent: true` (see its `onPrimary`), so "silent" here
 * means "no celebration", NOT "background" — the failure has to be spoken for
 * that call as much as any other.
 *
 * The sibling `confirmCommand` has raised a visible `Alert.alert` since Wave-3
 * PR10 (`services/__tests__/honestDegradedModes.test.ts` locks it). This file
 * proves `logIntake` now does the same at RUNTIME rather than in source text:
 * the real `useStoreActions` hook is mounted, the API call is made to reject,
 * and the alert is observed. `_renderCountHarness`'s convention applies —
 * `AppProvider` itself is not mounted; the hook under test is driven directly.
 */
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const alertSpy = vi.fn();
vi.mock('react-native', () => ({
  Alert: { alert: (...args: unknown[]) => alertSpy(...args) },
  Platform: { OS: 'ios', select: (o: Record<string, unknown>) => o['ios'] ?? o['default'] },
}));

const postIntakeLog = vi.fn();
vi.mock('@/services/realApi', () => ({
  postIntakeLog: (...args: unknown[]) => postIntakeLog(...args),
  prepareIntake: vi.fn(),
  sendPreparedIntake: vi.fn(),
  isOfflineError: () => false,
  fetchHome: vi.fn(),
  postSignalsUpdate: vi.fn(),
  postUrineSignalUpdate: vi.fn(),
  postEnergyStateUpdate: vi.fn(),
  postCheckin: vi.fn(),
  postClutchFlag: vi.fn(),
  postConfirmCommand: vi.fn(),
  postLanguage: vi.fn(),
  postSocialActivate: vi.fn(),
  postSocialCruise: vi.fn(),
  postSocialShield: vi.fn(),
  postSocialContext: vi.fn(),
  postSocialDrink: vi.fn(),
  postSocialHydrate: vi.fn(),
  postSocialDeactivate: vi.fn(),
}));

// i18n is the copy source, not the subject: resolve keys to their defaultValue
// exactly as the real i18next does for a key the bundles don't carry yet, which
// is what `confirmCommand` has always relied on.
vi.mock('@/services/i18nService', () => ({
  default: {
    t: (key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? key,
  },
  setLanguage: vi.fn(),
}));

vi.mock('@/services/scopedStorage', () => ({
  scopedStorage: { getItem: vi.fn(), setItem: vi.fn(() => Promise.resolve()), removeItem: vi.fn() },
}));
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() },
}));

// Best-effort side channels the cycle fires; none of them decide the catch.
vi.mock('@/analytics/event_dispatcher', () => ({ emit: vi.fn(() => Promise.resolve()) }));
vi.mock('@/analytics/activation_anchor', () => ({ markFirstCommandCompleted: vi.fn() }));
vi.mock('@/services/performanceMemoryCapture', () => ({ recordCaffeineSignal: vi.fn() }));
vi.mock('@/services/commandLedger', () => ({ appendCommandEvents: vi.fn() }));
vi.mock('@/services/intakeOutbox', () => ({ enqueueIntake: vi.fn() }));
vi.mock('@/services/voice/commandVoiceBus', () => ({
  commandSpeak: vi.fn(),
  markCycleExecuted: vi.fn(),
}));

import { useStoreActions } from '../app/actions';
import { makeState } from './_fixtures';
import type { Action } from '../appStoreTypes';
import type { ScoreEngineOutput, UserState } from '@/types';

let host: HTMLElement;
let root: Root;
let dispatched: Action[];
/** The live `logIntake` from the mounted hook. */
let logIntake: (fluidType: 'aforce_stick' | 'water', opts?: Record<string, unknown>) => Promise<void>;

function Harness() {
  const state = makeState();
  const userStateRef = React.useRef<UserState>(state.userState);
  const actions = useStoreActions({
    state,
    dispatch: (a: Action) => { dispatched.push(a); },
    applyServerUserState: () => {},
    adaptEngineOutput: (e: ScoreEngineOutput) => e,
    userStateRef,
    voiceCoachEnabledRef: React.useRef(false),
    voiceScopeRef: React.useRef('all' as never),
    voiceIntensityRef: React.useRef('standard' as never),
    selectedVoiceIdRef: React.useRef<string | null>(null),
    markRefreshStale: () => {},
    eliteVoiceCoachRef: React.useRef(false),
  });
  logIntake = actions.logIntake as typeof logIntake;
  return React.createElement('div');
}

beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  alertSpy.mockReset();
  postIntakeLog.mockReset();
  dispatched = [];
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root.render(React.createElement(Harness));
  });
});

afterEach(async () => {
  await act(async () => { root.unmount(); });
  host.remove();
});

describe('logIntake — a discarded intake is announced, not swallowed', () => {
  it('raises a visible alert when the write is rejected by the server', async () => {
    postIntakeLog.mockRejectedValue(new Error('POST /intake/log → 401'));
    await act(async () => { await logIntake('aforce_stick'); });

    expect(alertSpy).toHaveBeenCalledTimes(1);
    const [title, body] = alertSpy.mock.calls[0] as [string, string];
    expect(title).toBeTruthy();
    expect(body).toBeTruthy();
    // The member has to be told the write did not land — not merely that
    // "something happened".
    expect(`${title} ${body}`.toLowerCase()).toMatch(/not saved|didn't reach|did not reach/);
  });

  it('still clears the cycle so the CTAs never soft-lock', async () => {
    postIntakeLog.mockRejectedValue(new Error('timeout'));
    await act(async () => { await logIntake('aforce_stick'); });

    // The Wave-3 fix (CYCLE_FAILURE, not DISMISS_SUCCESS) has to survive the
    // added alert: DISMISS_SUCCESS leaves `isCompletingCycle` set and disables
    // every home CTA permanently.
    expect(dispatched.map((a) => a.type)).toContain('CYCLE_FAILURE');
    expect(dispatched.map((a) => a.type)).not.toContain('CYCLE_SUCCESS');
  });

  it('announces the failure for the HOME command card too, whose log is silent', async () => {
    // `silent` suppresses the celebration (success card / reward voice), never
    // the failure. HomeScreenV2's primary control passes it, so treating
    // `silent` as "stay quiet on error" would re-hide the exact P0 this fixes.
    postIntakeLog.mockRejectedValue(new Error('POST /intake/log → 500'));
    await act(async () => { await logIntake('water', { silent: true, ozOverride: 12 }); });

    expect(alertSpy).toHaveBeenCalledTimes(1);
  });

  it('says nothing when the write SUCCEEDS', async () => {
    postIntakeLog.mockResolvedValue({
      log: {
        id: 'log-1',
        fluidType: 'aforce_stick',
        ozAmount: 16,
        loggedAt: new Date(),
        scoreBefore: 60,
        scoreAfter: 72,
      },
      newUserState: makeState().userState,
      engineOutput: makeState().engineOutput,
    });
    await act(async () => { await logIntake('aforce_stick'); });

    expect(alertSpy).not.toHaveBeenCalled();
    expect(dispatched.map((a) => a.type)).toContain('CYCLE_SUCCESS');
  });
});
