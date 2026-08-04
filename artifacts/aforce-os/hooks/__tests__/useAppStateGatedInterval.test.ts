// @vitest-environment happy-dom
/**
 * useAppStateGatedInterval — AppState-gating regression coverage (RC-1
 * Wave-3 P1, audit P0-2).
 *
 * Proves the three properties the fix promises for the store's three
 * long-lived timers (1s countdown, 30s /state poll, 15min weather):
 *   1. the callback fires on the normal cadence while foregrounded — same
 *      as the plain `setInterval` this hook replaces;
 *   2. ZERO callback invocations while backgrounded;
 *   3. an immediate "resume-fire" the instant the app returns to the
 *      foreground (not a wait for the next full interval), then the
 *      normal cadence resumes.
 * Also covers cleanup (unmount stops the interval and removes the
 * listener) and that the interval always calls the LATEST callback
 * closure, matching the ref-mirroring pattern this repo's other
 * long-lived-timer code already relies on (`store/useAppStore.tsx`'s
 * `userStateRef`).
 *
 * Mounts via `react-dom/client`'s `createRoot` + `flushSync` directly
 * (NOT `@testing-library/react`'s `render`/`renderHook`) — the same
 * pattern `components/__tests__/riskTimerDisplay.render.test.tsx` uses.
 * `@testing-library/react` resolves its own `react` copy from the
 * workspace root's node_modules, which is a physically separate install
 * from the one `artifacts/aforce-os` resolves (confirmed empirically:
 * pnpm's `.pnpm/react@19.1.0` vs a directly-installed root copy) — two
 * React instances means two dispatcher singletons, i.e. every hook call
 * throws "Cannot read properties of null (reading 'useRef')". Mounting
 * with `react-dom/client` imported directly from within `aforce-os`
 * sidesteps that entirely, matching the codebase's own precedent.
 *
 * `react-native`'s `AppState` is mocked directly (a controllable
 * `currentState` + `addEventListener`) so the test can deterministically
 * drive active → background → active, mirroring the `vi.mock('react-native',
 * ...)` style also used by that same precedent file. Unlike that mock,
 * this one does NOT spread the real `react-native-web` module: this
 * hook's only dependency is `AppState`, so a minimal mock keeps the test
 * fully isolated from the native/expo service graph that currently fails
 * to load under this repo's node-environment vitest run for unrelated
 * reasons (a pre-existing `__DEV__ is not defined` gap in
 * `expo-modules-core`).
 */
import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

type AppStateValue = 'active' | 'background' | 'inactive';

const { appStateMock, listeners } = vi.hoisted(() => ({
  appStateMock: { current: 'active' as AppStateValue },
  listeners: [] as Array<(status: AppStateValue) => void>,
}));

vi.mock('react-native', () => ({
  AppState: {
    get currentState() {
      return appStateMock.current;
    },
    addEventListener: (_event: 'change', handler: (status: AppStateValue) => void) => {
      listeners.push(handler);
      return {
        remove: () => {
          const i = listeners.indexOf(handler);
          if (i >= 0) listeners.splice(i, 1);
        },
      };
    },
  },
}));

import { useAppStateGatedInterval } from '../useAppStateGatedInterval';

function emitAppState(next: AppStateValue) {
  appStateMock.current = next;
  // Snapshot before iterating — a `remove()` call inside a handler (e.g. on
  // unmount, triggered indirectly) must not skip a still-registered sibling.
  [...listeners].forEach((fn) => fn(next));
}

function Harness({ callback, intervalMs }: { callback: () => void; intervalMs: number }) {
  useAppStateGatedInterval(callback, intervalMs);
  return null;
}

let host: HTMLElement;
let root: Root;
let unmounted: boolean;

function mount(props: React.ComponentProps<typeof Harness>) {
  root = createRoot(host);
  unmounted = false;
  flushSync(() => root.render(React.createElement(Harness, props)));
}

function rerenderWith(props: React.ComponentProps<typeof Harness>) {
  flushSync(() => root.render(React.createElement(Harness, props)));
}

function unmount() {
  flushSync(() => root.unmount());
  unmounted = true;
}

beforeEach(() => {
  vi.useFakeTimers();
  appStateMock.current = 'active';
  listeners.length = 0;
  host = document.createElement('div');
  document.body.appendChild(host);
});

afterEach(() => {
  if (!unmounted) unmount();
  host.remove();
  vi.useRealTimers();
});

describe('useAppStateGatedInterval', () => {
  it('fires on the normal cadence while foregrounded (same as a plain setInterval)', () => {
    const cb = vi.fn();
    mount({ callback: cb, intervalMs: 1000 });
    expect(cb).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(cb).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(2000);
    expect(cb).toHaveBeenCalledTimes(3);
  });

  it('produces ZERO callback invocations while backgrounded', () => {
    const cb = vi.fn();
    mount({ callback: cb, intervalMs: 1000 });
    vi.advanceTimersByTime(1000);
    expect(cb).toHaveBeenCalledTimes(1);

    emitAppState('background');
    cb.mockClear();
    // 10x the interval — well past several would-be ticks.
    vi.advanceTimersByTime(10_000);
    expect(cb).toHaveBeenCalledTimes(0);
  });

  it('fires immediately on foreground return, then resumes the normal cadence', () => {
    const cb = vi.fn();
    mount({ callback: cb, intervalMs: 1000 });

    emitAppState('background');
    cb.mockClear();
    vi.advanceTimersByTime(5000);
    expect(cb).toHaveBeenCalledTimes(0);

    // Resume-fire happens synchronously in the AppState change handler —
    // no timer advance needed to observe it.
    emitAppState('active');
    expect(cb).toHaveBeenCalledTimes(1);

    // Normal cadence resumes from here.
    vi.advanceTimersByTime(1000);
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it('treats a non-"active" transition (e.g. "inactive") the same as backgrounded', () => {
    const cb = vi.fn();
    mount({ callback: cb, intervalMs: 1000 });
    emitAppState('inactive');
    cb.mockClear();
    vi.advanceTimersByTime(5000);
    expect(cb).toHaveBeenCalledTimes(0);
  });

  it('stops the interval and removes the AppState listener on unmount', () => {
    const cb = vi.fn();
    mount({ callback: cb, intervalMs: 1000 });
    vi.advanceTimersByTime(1000);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(listeners.length).toBe(1);

    unmount();
    cb.mockClear();
    vi.advanceTimersByTime(5000);
    expect(cb).toHaveBeenCalledTimes(0);
    expect(listeners.length).toBe(0);
  });

  it('always invokes the LATEST callback reference, not a stale mount-time closure', () => {
    const calls: number[] = [];
    mount({ callback: () => calls.push(1), intervalMs: 1000 });
    rerenderWith({ callback: () => calls.push(2), intervalMs: 1000 });

    vi.advanceTimersByTime(1000);
    // Only ONE interval instance exists (deps=[intervalMs] never changed),
    // but its tick calls the ref-mirrored SECOND render's closure, not the
    // first's — same guarantee `userStateRef` gives the store's real timers.
    expect(calls).toEqual([2]);
  });
});
