// @vitest-environment happy-dom
/**
 * URINE INTERACTION FEEDBACK — the screen must SHOW what it is doing.
 *
 * Build-68 device QA: every functional hop worked (presses fired, selection
 * changed, writes persisted) while the member saw nothing — the selected state
 * was a 1px border-color swap, Confirm was always enabled, and success was
 * silent. Result: eight identical confirm sets in six minutes and an
 * accidental overwrite of the member's own earlier answer.
 *
 * Locked here:
 *   1. The selected tile is visually distinct (tint + check), not border-only.
 *   2. One physical Confirm = one update set; re-entry is refused in flight.
 *   3. The RECORDED acknowledgment appears only AFTER durable success.
 *   4. A failed save alerts and never shows the acknowledgment.
 *   5. Confirm is disabled until the member makes/changes something.
 */
import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { View as RNView } from 'react-native';

vi.mock('@/components/Icon', () => ({
  Icon: ({ name }: { name: string }) => React.createElement('span', { 'data-icon': name }),
}));
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
vi.mock('expo-linear-gradient', () => ({ LinearGradient: RNView }));
vi.mock('react-native-svg', () => {
  const stub = (name: string) => {
    const C = React.forwardRef((props: Record<string, unknown>, ref: React.Ref<unknown>) =>
      React.createElement('svg-stub', { 'data-stub': name, ref }, props.children as React.ReactNode),
    );
    C.displayName = name;
    return C;
  };
  return {
    __esModule: true,
    default: stub('Svg'),
    Svg: stub('Svg'),
    Circle: stub('Circle'),
    G: stub('G'),
    Path: stub('Path'),
    Defs: stub('Defs'),
    Stop: stub('Stop'),
    Rect: stub('Rect'),
    Line: stub('Line'),
    Polyline: stub('Polyline'),
    LinearGradient: stub('LinearGradient'),
  };
});
vi.mock('react-native-reanimated', () => {
  function useSharedValue(initial: unknown) {
    const ref = React.useRef({ value: initial });
    return ref.current;
  }
  function useAnimatedStyle(fn: () => Record<string, unknown>) {
    try {
      return fn();
    } catch {
      return {};
    }
  }
  return {
    __esModule: true,
    default: { View: RNView, createAnimatedComponent: (C: unknown) => C },
    useSharedValue,
    useAnimatedStyle,
    useReducedMotion: () => true,
    withTiming: vi.fn((v: unknown) => v),
    withDelay: vi.fn((_d: number, anim: unknown) => anim),
    withRepeat: vi.fn((anim: unknown) => anim),
    withSequence: vi.fn((...anims: unknown[]) => anims[0]),
    cancelAnimation: vi.fn(),
    Easing: {
      in: (e: unknown) => e,
      out: (e: unknown) => e,
      inOut: (e: unknown) => e,
      ease: 'ease',
      linear: 'linear',
      bezier: () => 'bezier',
    },
  };
});
vi.mock('expo-haptics', () => ({
  selectionAsync: vi.fn(() => Promise.resolve()),
  impactAsync: vi.fn(() => Promise.resolve()),
  notificationAsync: vi.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

const updateSymptoms = vi.fn(async () => {});
const updateEnergyState = vi.fn(async () => {});
const updateUrineSignal = vi.fn(async (_signal: number) => {});
const confirmStatus = vi.fn(async () => {});

const userState = {
  urineSignal: 3,
  symptoms: [] as string[],
  energyState: 'steady',
};
const engineOutput = {
  score: 50,
  performanceState: { level: 'BALANCED' },
  command: { action: 'Drink 12 oz' },
};

vi.mock('@/store/useAppStore', () => ({
  useAppStore: () => ({
    state: { userState, engineOutput },
    updateSymptoms,
    updateUrineSignal,
    updateEnergyState,
    confirmStatus,
  }),
  useFeatureFlags: () => ({ elite_motion_enabled: false }),
}));
vi.mock('@/data/mockData', () => ({ SYMPTOM_CATALOG: [], ENERGY_STATE_OPTIONS: [] }));

import { UrineCheckScreenV2 } from '../UrineCheckScreenV2';

let host: HTMLElement;
let root: Root;

function mount() {
  root = createRoot(host);
  flushSync(() => root.render(React.createElement(UrineCheckScreenV2, { onBack: () => {} })));
}
function unmount() {
  flushSync(() => root.unmount());
}
function byTestId(id: string): HTMLElement {
  const el = host.querySelector(`[data-testid="${id}"]`);
  if (!el) throw new Error(`no element with testID "${id}"`);
  return el as HTMLElement;
}
function maybeByTestId(id: string): HTMLElement | null {
  return host.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
}
function click(el: HTMLElement) {
  flushSync(() => el.dispatchEvent(new MouseEvent('click', { bubbles: true })));
}

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  userState.urineSignal = 3;
  userState.symptoms = [];
  vi.clearAllMocks();
});
afterEach(() => {
  try {
    unmount();
  } catch {
    /* already unmounted */
  }
  host.remove();
});

describe('1. selected tile is visually distinct', () => {
  it('the selected tile carries tint + check; unselected tiles carry neither', async () => {
    mount();
    // Seed resolves signal 3 -> yellow, so yellow starts selected.
    await vi.waitFor(() => expect(maybeByTestId('urine-color-yellow-check')).not.toBeNull());

    click(byTestId('urine-color-dark_yellow'));
    // Check marker moves with the selection…
    expect(maybeByTestId('urine-color-dark_yellow-check')).not.toBeNull();
    expect(maybeByTestId('urine-color-yellow-check')).toBeNull();
    // …and the tile surface itself changes, not only a border: the active tile's
    // inline style must differ from an unselected sibling's (background tint).
    const active = byTestId('urine-color-dark_yellow').getAttribute('style') ?? '';
    const inactive = byTestId('urine-color-clear').getAttribute('style') ?? '';
    expect(active).not.toBe(inactive);
    expect(active).toMatch(/background-color/);
  });
});

describe('2. one Confirm = one update set', () => {
  it('re-entry while in flight is refused — rapid double press sends one set', async () => {
    // Hold the first set open so the second press arrives mid-flight.
    let release!: () => void;
    updateSymptoms.mockImplementationOnce(
      () => new Promise<void>((resolve) => (release = resolve)),
    );
    mount();
    click(byTestId('urine-color-dark_yellow'));
    // BOTH presses inside one batch: state has not re-rendered between them, so
    // the button's loading/disabled props cannot help — only the synchronous
    // ref can refuse the second press. This is the two-taps-in-one-frame case
    // the ref exists for; the slower double-tap is covered by loading state.
    const confirm = byTestId('urine-confirm');
    flushSync(() => {
      confirm.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      confirm.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    release();
    await vi.waitFor(() => expect(confirmStatus).toHaveBeenCalledTimes(1));
    expect(updateUrineSignal).toHaveBeenCalledTimes(1);
    expect(updateSymptoms).toHaveBeenCalledTimes(1);
    expect(updateEnergyState).toHaveBeenCalledTimes(1);
  });
});

describe('3/5. Confirm reflects member state', () => {
  it('disabled until the member makes/changes something this visit', async () => {
    mount();
    // Seeded selection alone must NOT enable Confirm — the member did nothing.
    const btn = byTestId('urine-confirm');
    click(btn);
    await new Promise((r) => setTimeout(r, 10));
    expect(confirmStatus).not.toHaveBeenCalled();
    expect(updateUrineSignal).not.toHaveBeenCalled();

    // A tile press arms it.
    click(byTestId('urine-color-dark_yellow'));
    click(byTestId('urine-confirm'));
    await vi.waitFor(() => expect(confirmStatus).toHaveBeenCalledTimes(1));
  });
});

describe('3. success acknowledgment appears only after durable success', () => {
  it('RECORDED is absent before resolution and present after', async () => {
    let release!: () => void;
    confirmStatus.mockImplementationOnce(
      () => new Promise<void>((resolve) => (release = resolve)),
    );
    mount();
    click(byTestId('urine-color-dark_yellow'));
    click(byTestId('urine-confirm'));
    // confirmStatus runs only after Promise.all resolves — wait for the held
    // promise to exist, then assert the acknowledgment is still absent while
    // the LAST write of the set is unresolved.
    await vi.waitFor(() => expect(confirmStatus).toHaveBeenCalled());
    expect(host.textContent).not.toMatch(/Recorded/i);
    release();
    await vi.waitFor(() => expect(host.textContent).toMatch(/Recorded/i));
  });

  it('a tap during the acknowledgment cannot fire an empty repeat set', async () => {
    mount();
    click(byTestId('urine-color-dark_yellow'));
    click(byTestId('urine-confirm'));
    await vi.waitFor(() => expect(confirmStatus).toHaveBeenCalledTimes(1));
    // Acknowledgment showing, dirty reset — a tap must do nothing.
    click(byTestId('urine-confirm'));
    await new Promise((r) => setTimeout(r, 10));
    expect(confirmStatus).toHaveBeenCalledTimes(1);
  });
});

describe('4. failed save alerts and never claims success', () => {
  it('shows the truthful failure alert, no RECORDED state, and stays armed for retry', async () => {
    const alertSpy = vi.spyOn(
      (await import('react-native')).Alert,
      'alert',
    );
    updateSymptoms.mockImplementationOnce(async () => {
      throw new Error('POST /signals → 500');
    });
    mount();
    click(byTestId('urine-color-dark_yellow'));
    click(byTestId('urine-confirm'));
    await vi.waitFor(() => expect(alertSpy).toHaveBeenCalled());
    expect(host.textContent).not.toMatch(/Recorded/i);
    // dirty is preserved on failure so the member can simply retry.
    click(byTestId('urine-confirm'));
    await vi.waitFor(() => expect(updateSymptoms).toHaveBeenCalledTimes(2));
    alertSpy.mockRestore();
  });
});
