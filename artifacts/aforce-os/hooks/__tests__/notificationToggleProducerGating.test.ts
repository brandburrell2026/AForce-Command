// @vitest-environment happy-dom
/**
 * Notification toggles vs. their real producers (Wave-4 notification audit).
 *
 * The audit found `recheckReminders` and `scoreDecayAlerts` were persisted,
 * rendered as switches, and read by nobody: `useRiskTimerVoice` and
 * `useScoreBandVoice` are the ONLY producers behind those two rows, and both
 * gated purely on `voiceCoachEnabled` + `voiceScope`. Turning the switch off
 * silenced nothing — the screen promised a control the app did not honour.
 *
 * These tests hold the wiring behaviourally (does the producer actually go
 * quiet?), not by reading source text, because the failure mode was a gate
 * that existed on the screen but not in the code path.
 *
 * Mounts via `react-dom/client`'s `createRoot` + `flushSync` directly rather
 * than `@testing-library/react` — same reason, and same precedent, as
 * `useAppStateGatedInterval.test.ts`: RTL resolves its own React copy from the
 * workspace root, and two React instances means two dispatcher singletons.
 *
 * The store is mocked (these hooks read five unrelated slices; the provider
 * tree is not what is under test) but the voice bus is REAL — the assertion is
 * on `commandVoiceBus`'s injected speaker, i.e. whether a sound would actually
 * have left the app.
 */
import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import type { NotificationSettings, PerformanceLevel } from '../../types';
import type { VoiceIntensity, VoiceScope } from '../../services/voice/commandVoice';

/** Only the three fields the two hooks read off `useEngineSlice()`. */
interface EngineStub {
  score: number;
  riskTimer: { minutes: number };
  performanceState: { level: PerformanceLevel };
}

interface StoreStub {
  voiceCoachEnabled: boolean;
  voiceIntensity: VoiceIntensity;
  voiceScope: VoiceScope;
  selectedVoiceId: string;
  notificationSettings: NotificationSettings;
}

const { store, engine } = vi.hoisted(() => ({
  store: { current: null as unknown },
  engine: { current: null as unknown },
}));

vi.mock('../../store/useAppStore', () => ({
  useAppStore: () => store.current,
  useFeatureFlags: () => ({ elite_voice_coach_enabled: false }),
}));

vi.mock('../../store/slices', () => ({
  useEngineSlice: () => engine.current,
}));

import { _resetForTests, _setSpeakerForTests } from '../../services/voice/commandVoiceBus';
import { useRiskTimerVoice } from '../useRiskTimerVoice';
import { useScoreBandVoice } from '../useScoreBandVoice';

const ALL_NOTIFICATIONS_ON: NotificationSettings = {
  recheckReminders: true,
  scoreDecayAlerts: true,
  morningKickoff: true,
  circleActivity: true,
  challengeDeadlines: true,
  lowInventoryAlert: true,
  momentPrep: true,
};

function setStore(notificationSettings: NotificationSettings): void {
  store.current = {
    voiceCoachEnabled: true,
    voiceIntensity: 'standard',
    voiceScope: 'all',
    selectedVoiceId: 'rock',
    notificationSettings,
  } satisfies StoreStub;
}

function setEngine(next: EngineStub): void {
  engine.current = next;
}

function engineAt({ score = 82, minutes = 45 }: { score?: number; minutes?: number }): EngineStub {
  return { score, riskTimer: { minutes }, performanceState: { level: 'BALANCED' } };
}

// Declared at module scope, NOT per call: a fresh function identity on every
// render is a different component type to React, which would remount the tree
// and silently reset each hook's threshold/band ref — the exact state these
// tests exist to exercise across renders.
function RiskTimerHarness() {
  useRiskTimerVoice();
  return null;
}

function ScoreBandHarness() {
  useScoreBandVoice();
  return null;
}

let host: HTMLElement;
let root: Root;
let unmounted: boolean;
let speaker: ReturnType<typeof vi.fn>;

function mount(Harness: React.ComponentType): void {
  root = createRoot(host);
  unmounted = false;
  flushSync(() => root.render(React.createElement(Harness)));
}

/** Re-render the mounted harness so the effect re-reads the mutated engine. */
function rerender(Harness: React.ComponentType): void {
  flushSync(() => root.render(React.createElement(Harness)));
}

beforeEach(() => {
  _resetForTests();
  speaker = vi.fn();
  _setSpeakerForTests(speaker);
  setStore(ALL_NOTIFICATIONS_ON);
  host = document.createElement('div');
  document.body.appendChild(host);
});

afterEach(() => {
  if (!unmounted) {
    flushSync(() => root.unmount());
    unmounted = true;
  }
  host.remove();
  _resetForTests();
});

describe('useRiskTimerVoice — recheckReminders gate', () => {
  it('speaks at the 16-minute threshold when recheckReminders is ON', () => {
    setEngine(engineAt({ minutes: 45 }));
    mount(useRiskTimerVoice);

    setEngine(engineAt({ minutes: 16 }));
    rerender(useRiskTimerVoice);

    expect(speaker).toHaveBeenCalledOnce();
  });

  it('stays SILENT at the same threshold when recheckReminders is OFF', () => {
    setStore({ ...ALL_NOTIFICATIONS_ON, recheckReminders: false });
    setEngine(engineAt({ minutes: 45 }));
    mount(useRiskTimerVoice);

    setEngine(engineAt({ minutes: 16 }));
    rerender(useRiskTimerVoice);

    expect(speaker).not.toHaveBeenCalled();
  });

  it('stays silent across the WHOLE 16/8/4/0 ladder when recheckReminders is OFF', () => {
    setStore({ ...ALL_NOTIFICATIONS_ON, recheckReminders: false });
    setEngine(engineAt({ minutes: 45 }));
    mount(useRiskTimerVoice);

    for (const minutes of [16, 8, 4, 0]) {
      setEngine(engineAt({ minutes }));
      rerender(useRiskTimerVoice);
    }

    expect(speaker).not.toHaveBeenCalled();
  });

  it('does not retro-fire a threshold that was crossed while the toggle was OFF', () => {
    setStore({ ...ALL_NOTIFICATIONS_ON, recheckReminders: false });
    setEngine(engineAt({ minutes: 45 }));
    mount(useRiskTimerVoice);

    setEngine(engineAt({ minutes: 16 }));
    rerender(useRiskTimerVoice);

    // Re-enabling mid-cycle must not replay the missed 16 — the threshold
    // state machine advances ahead of the gate for exactly this reason.
    setStore(ALL_NOTIFICATIONS_ON);
    rerender(useRiskTimerVoice);

    expect(speaker).not.toHaveBeenCalled();
  });
});

describe('useScoreBandVoice — scoreDecayAlerts gate', () => {
  it('speaks on a band crossing when scoreDecayAlerts is ON', () => {
    setEngine(engineAt({ score: 88 }));
    mount(useScoreBandVoice);

    setEngine(engineAt({ score: 31 }));
    rerender(useScoreBandVoice);

    expect(speaker).toHaveBeenCalledOnce();
  });

  it('stays SILENT on the same band crossing when scoreDecayAlerts is OFF', () => {
    setStore({ ...ALL_NOTIFICATIONS_ON, scoreDecayAlerts: false });
    setEngine(engineAt({ score: 88 }));
    mount(useScoreBandVoice);

    setEngine(engineAt({ score: 31 }));
    rerender(useScoreBandVoice);

    expect(speaker).not.toHaveBeenCalled();
  });

  it('does not retro-fire a crossing that happened while the toggle was OFF', () => {
    setStore({ ...ALL_NOTIFICATIONS_ON, scoreDecayAlerts: false });
    setEngine(engineAt({ score: 88 }));
    mount(useScoreBandVoice);

    setEngine(engineAt({ score: 31 }));
    rerender(useScoreBandVoice);

    setStore(ALL_NOTIFICATIONS_ON);
    rerender(useScoreBandVoice);

    expect(speaker).not.toHaveBeenCalled();
  });
});
