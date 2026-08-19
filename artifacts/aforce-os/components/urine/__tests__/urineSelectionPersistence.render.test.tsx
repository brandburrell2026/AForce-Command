// @vitest-environment happy-dom
/**
 * The urine check must PERSIST what the member chose.
 *
 * Through Build 65 the screen rendered a verdict from the selected tile and then
 * threw the selection away: `handleConfirm` wrote symptoms, energy and the
 * check-in, but never the signal. `updateUrineSignal` and `POST /aforce/urine`
 * both already existed and were wired through the store — the screen simply had
 * no caller, so choosing a color changed nothing the score could see and the
 * picker was empty again on reload.
 *
 * These tests pin the whole loop the founder asked for:
 *   select → confirm → persisted signal → reload → same result,
 * plus a second, different color correctly replacing the first.
 *
 * The store is mocked because the assertion is about which action the screen
 * calls with which value — mocking the transport would prove the screen talks to
 * itself. `userState` is a mutable module-level object so "reload" can be
 * modelled honestly: a fresh mount reading the state a previous confirm left.
 */
import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { View as RNView } from 'react-native';

// Native-module stubs, matching the convention in the hydration render tests.
// These are pulled in by the `@/components/ui` barrel, not by this screen, and
// several ship untranspiled sources that the test transform cannot parse.
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
    // Reduced motion ON — the shipped static alternative, and what keeps this
    // harness deterministic.
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

import {
  URINE_COLOR_SIGNAL,
  urineColorForSignal,
  type UrineColor,
} from '../../../services/urineHydrationCheck';

const ALL_COLORS: UrineColor[] = ['clear', 'light_yellow', 'yellow', 'dark_yellow'];

const updateSymptoms = vi.fn(async () => {});
const updateEnergyState = vi.fn(async () => {});
const updateUrineSignal = vi.fn(async (signal: number) => {
  // Model the real round trip: the action reaches the server and the store
  // adopts the returned state, which is what a later mount reads back.
  userState.urineSignal = signal;
});
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
  // The `@/components/ui` button family reads this; off = the static press path.
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

/** react-native-web forwards testID to the DOM as data-testid. */
function byTestId(id: string): HTMLElement {
  const el = host.querySelector(`[data-testid="${id}"]`);
  if (!el) throw new Error(`no element with testID "${id}"`);
  return el as HTMLElement;
}

function click(el: HTMLElement) {
  flushSync(() => el.dispatchEvent(new MouseEvent('click', { bubbles: true })));
}

/**
 * The confirm control carries no testID, so it is found by label. Restricted to
 * real <button> elements: react-native-web wraps each pressable in several divs
 * that also carry the label text, and dispatching at a wrapper does not run the
 * press handler.
 */
function confirmButton(): HTMLElement {
  // Stable id — the label is not stable any more: it flips to "Recorded"
  // during the post-success acknowledgment, which is part of the contract.
  const el = host.querySelector('[data-testid="urine-confirm"]');
  if (!el) throw new Error('confirm control not found');
  return el as HTMLElement;
}

/** The verdict text is the member-visible RESULT of the current selection. */
function verdictText(): string {
  return byTestId('urine-check-verdict').textContent ?? '';
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

describe('urine selection persists', () => {
  it('the mapping covers every tile and stays inside the persisted 1-8 scale', () => {
    // The server validates int().min(1).max(8); a tile outside that range would
    // be rejected at the route and the member would see a failed check-in.
    for (const [color, signal] of Object.entries(URINE_COLOR_SIGNAL)) {
      expect(Number.isInteger(signal), `${color} must map to an integer`).toBe(true);
      expect(signal, `${color} below scale`).toBeGreaterThanOrEqual(1);
      expect(signal, `${color} above scale`).toBeLessThanOrEqual(8);
    }
  });

  it('every tile round-trips through the signal and back to itself', () => {
    // Guards the seed path: a saved signal must reselect the tile that produced
    // it, or a reload would silently show the member a different verdict.
    for (const color of ALL_COLORS) {
      expect(urineColorForSignal(URINE_COLOR_SIGNAL[color])).toBe(color);
    }
  });

  it('an out-of-range signal selects nothing rather than a wrong verdict', () => {
    expect(urineColorForSignal(0)).toBeNull();
    expect(urineColorForSignal(9)).toBeNull();
    expect(urineColorForSignal(Number.NaN)).toBeNull();
  });

  it('select color -> confirm writes the persisted signal', async () => {
    mount();
    click(byTestId('urine-color-dark_yellow'));
    click(confirmButton());
    // confirmStatus runs AFTER the awaited Promise.all, so wait on it — it is
    // the last write in the handler and proves the whole sequence completed.
    await vi.waitFor(() => expect(confirmStatus).toHaveBeenCalled());

    expect(updateUrineSignal).toHaveBeenCalledWith(URINE_COLOR_SIGNAL.dark_yellow);
    // The pre-existing writes must not regress — this screen owns all four.
    expect(updateSymptoms).toHaveBeenCalled();
    expect(updateEnergyState).toHaveBeenCalled();
    expect(confirmStatus).toHaveBeenCalled();
  });

  it('reload shows the same result, read from persisted state', async () => {
    mount();
    click(byTestId('urine-color-dark_yellow'));
    const before = verdictText();
    expect(before).not.toBe('');
    click(confirmButton());
    await vi.waitFor(() => expect(confirmStatus).toHaveBeenCalledTimes(1));
    expect(userState.urineSignal).toBe(URINE_COLOR_SIGNAL.dark_yellow);
    unmount();

    // Fresh mount = relaunch. The verdict must come back from the persisted
    // signal, not from local component state that died with the old tree.
    // waitFor because the seed runs in a passive effect, which flushSync does
    // not drain.
    mount();
    await vi.waitFor(() => expect(byTestId('urine-check-result')).toBeTruthy());
    expect(verdictText()).toBe(before);
  });

  it('a second, different color replaces the first', async () => {
    mount();
    click(byTestId('urine-color-dark_yellow'));
    click(confirmButton());
    // Wait for the SET to settle, not merely for the mock's side-effect: the
    // urine write lands mid-set, while the in-flight guard still holds. A
    // second press before settlement is correctly refused (that refusal has
    // its own test), so this flow must only continue once the first confirm
    // has fully completed.
    await vi.waitFor(() => expect(confirmStatus).toHaveBeenCalledTimes(1));
    expect(userState.urineSignal).toBe(URINE_COLOR_SIGNAL.dark_yellow);

    click(byTestId('urine-color-clear'));
    click(confirmButton());
    await vi.waitFor(() => expect(confirmStatus).toHaveBeenCalledTimes(2));
    expect(userState.urineSignal).toBe(URINE_COLOR_SIGNAL.clear);

    expect(updateUrineSignal).toHaveBeenLastCalledWith(URINE_COLOR_SIGNAL.clear);
    expect(userState.urineSignal).not.toBe(URINE_COLOR_SIGNAL.dark_yellow);
  });

  it('confirming with no member interaction cannot overwrite a saved signal', async () => {
    userState.urineSignal = URINE_COLOR_SIGNAL.yellow;
    mount();
    // The protection moved EARLIER in the flow (Build-68 interaction fix):
    // Confirm is disabled until the member makes/changes something this visit,
    // so an untouched screen cannot write anything at all — which subsumes the
    // original guarantee that a seeded signal is never silently overwritten.
    vi.clearAllMocks();
    const seeded = userState.urineSignal;
    click(confirmButton());
    await new Promise((r) => setTimeout(r, 10));
    expect(confirmStatus).not.toHaveBeenCalled();
    expect(updateUrineSignal).not.toHaveBeenCalled();
    expect(userState.urineSignal).toBe(seeded);
  });
});
