// @vitest-environment happy-dom
/**
 * THE ACQUISITION FLAG IS A KILL SWITCH, and this proves it by running the
 * hook rather than by reading it.
 *
 * The founder requirement is exact: "flag OFF means no new location-
 * intelligence acquisition." A flag that merely hides a result while the fetch
 * still runs is not a kill switch — it is a display filter that still spends
 * the member's battery and still touches their location grant.
 *
 * Also proven here: the tick is FOREGROUND-GATED, so backgrounding cannot
 * create uncontrolled polling, and the hook never reaches for location itself
 * (the producer owns permission, and only ever checks it).
 *
 * Mounted via `react-dom/client` + `flushSync` directly, NOT
 * `@testing-library/react` — see the note in `useAppStateGatedInterval.test.ts`:
 * the workspace root resolves a physically separate React copy, so two
 * dispatcher singletons make every hook call throw. This mirrors the
 * codebase's own precedent.
 */
import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { getLocationSnapshot, appStateMock, listeners } = vi.hoisted(() => {
  const l: Array<(s: string) => void> = [];
  return {
    getLocationSnapshot: vi.fn(async () => ({ source: 'live' })),
    listeners: l,
    appStateMock: {
      currentState: 'active' as string,
      addEventListener: (_e: string, cb: (s: string) => void) => {
        l.push(cb);
        return { remove: () => { const i = l.indexOf(cb); if (i >= 0) l.splice(i, 1); } };
      },
    },
  };
});

vi.mock('react-native', () => ({ AppState: appStateMock }));
vi.mock('@/services/locationIntelligenceService', () => ({ getLocationSnapshot }));

import { useEnvironmentalAcquisition, ENVIRONMENTAL_REFRESH_MS } from '../useEnvironmentalAcquisition';

let container: HTMLDivElement;
let root: Root;

function mount(enabled: boolean) {
  const Probe = () => { useEnvironmentalAcquisition(enabled); return null; };
  flushSync(() => root.render(React.createElement(Probe)));
}

beforeEach(() => {
  vi.useFakeTimers();
  getLocationSnapshot.mockClear();
  listeners.length = 0;
  appStateMock.currentState = 'active';
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  flushSync(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

describe('LAW 1 — the flag is a kill switch, not a display filter', () => {
  it('flag OFF: no acquisition at mount', () => {
    mount(false);
    expect(getLocationSnapshot).not.toHaveBeenCalled();
  });

  it('flag OFF: no acquisition when the interval fires', () => {
    mount(false);
    vi.advanceTimersByTime(ENVIRONMENTAL_REFRESH_MS * 3);
    expect(getLocationSnapshot).not.toHaveBeenCalled();
  });

  it('flag OFF: no acquisition on a foreground return', () => {
    mount(false);
    appStateMock.currentState = 'background';
    listeners.forEach((cb) => cb('background'));
    appStateMock.currentState = 'active';
    listeners.forEach((cb) => cb('active'));
    expect(getLocationSnapshot).not.toHaveBeenCalled();
  });

  it('flag ON: acquires once at mount', () => {
    mount(true);
    expect(getLocationSnapshot).toHaveBeenCalledTimes(1);
  });
});

describe('LAW 2 — the cadence is bounded and foreground-only', () => {
  it('acquires again after a full interval, not sooner', () => {
    mount(true);
    expect(getLocationSnapshot).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(ENVIRONMENTAL_REFRESH_MS - 1_000);
    expect(getLocationSnapshot).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(2_000);
    expect(getLocationSnapshot).toHaveBeenCalledTimes(2);
  });

  it('BACKGROUNDED: no acquisition, however long it stays there', () => {
    // The uncontrolled-polling guarantee. Time passing in the background must
    // buy the member nothing but battery they keep.
    mount(true);
    getLocationSnapshot.mockClear();
    appStateMock.currentState = 'background';
    listeners.forEach((cb) => cb('background'));
    vi.advanceTimersByTime(ENVIRONMENTAL_REFRESH_MS * 5);
    expect(getLocationSnapshot).not.toHaveBeenCalled();
  });

  it('and unmounting stops it', () => {
    mount(true);
    getLocationSnapshot.mockClear();
    flushSync(() => root.unmount());
    vi.advanceTimersByTime(ENVIRONMENTAL_REFRESH_MS * 3);
    expect(getLocationSnapshot).not.toHaveBeenCalled();
    // Re-establish a root so afterEach's unmount is safe.
    root = createRoot(container);
  });
});

describe('LAW 3 — the hook owns cadence, never permission', () => {
  it('runs a full acquisition cycle with ONLY the producer mocked', () => {
    // EXECUTABLE, not a source scan. `expo-location` is deliberately NOT
    // mocked anywhere in this file and is unavailable in this environment. If
    // the hook reached for it — the bug that would let a timer raise an OS
    // prompt — this module could not load and these cycles could not run.
    // Permission belongs to the producer, which only ever checks.
    mount(true);
    vi.advanceTimersByTime(ENVIRONMENTAL_REFRESH_MS * 2);
    expect(getLocationSnapshot).toHaveBeenCalledTimes(3);
  });

  it('a producer rejection is absorbed, not thrown into the provider tree', () => {
    // Acquisition is best-effort: the evidence layer already represents "we
    // could not see" honestly, so a failure must never crash the store
    // provider that owns this hook.
    getLocationSnapshot.mockRejectedValueOnce(new Error('offline'));
    expect(() => mount(true)).not.toThrow();
  });
});
