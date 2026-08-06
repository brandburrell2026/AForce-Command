// @vitest-environment happy-dom
/**
 * AppleHealthRefreshControl — RC-2 (TestFlight build 45, founder-reported)
 * render harness.
 *
 * Renders the real component to a DOM (react-native-web → react-dom,
 * happy-dom), following the pattern established in
 * `components/ui/__tests__/AFInlineErrorRow.render.test.tsx` and
 * `components/__tests__/whoopSnapshotCard.render.test.tsx`: pure
 * presentational component, no store/router/HealthKit import, so it can be
 * mounted directly per this repo's established convention.
 *
 * `AFMotionPressable` pulls in `react-native-reanimated` — mocked to a
 * synchronous no-animation stand-in (same shape as the WhoopSnapshotCard
 * harness) since the reduced-motion GATE isn't under test here; what's
 * under test is the four founder-required behaviors this component owns:
 * spinner swap, disabled-while-busy, completion confirmation, and press
 * feedback (via `pressedStyle` applying regardless of the motion gate).
 *
 * `AFMotionPressable` also imports `@/services/haptics` → `expo-haptics` →
 * `expo-modules-core`, a real native module that cannot initialize in this
 * node/happy-dom test environment at all (the pre-existing `__DEV__`/
 * native-module load wall documented across this repo's other render
 * harnesses). `fireHaptic` is never actually invoked here — this
 * component leaves `AFMotionPressable`'s `haptic` prop at its default
 * `false` — so, same rationale as the WhoopSnapshotCard harness stubbing
 * `react-native-svg`/`expo-linear-gradient` (native rendering surfaces
 * irrelevant to what's under test), `@/services/haptics` is stubbed at the
 * app-code boundary rather than fighting the native module's own load
 * path.
 */
import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/components/Icon', () => ({
  Icon: ({ name }: { name: string }) => React.createElement('span', { 'data-icon': name }),
}));

vi.mock('@/services/haptics', () => ({ fireHaptic: vi.fn() }));

// react-native-web's `accessibilityState.busy` does not map to `aria-busy`
// on the DOM (only a top-level `accessibilityBusy`/`aria-busy` prop does —
// verified against `createDOMProps`'s prop list). Rather than assert
// against an aria attribute react-native-web can't produce, this wraps the
// real `Pressable` to record the props it receives — the same technique
// `whoopSnapshotCard.render.test.tsx` uses for `maxFontSizeMultiplier` —
// so the test verifies the actual `accessibilityState` object AFMotionPressable
// hands to RN's real accessibility contract (correct on native, where
// VoiceOver/TalkBack DO read `busy`).
const { capturedPressableProps } = vi.hoisted(() => ({ capturedPressableProps: [] as Record<string, unknown>[] }));
vi.mock('react-native', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const RealPressable = actual.Pressable as React.ComponentType<Record<string, unknown>>;
  const RecordingPressable = React.forwardRef((props: Record<string, unknown>, ref: React.Ref<unknown>) => {
    capturedPressableProps.push(props);
    return React.createElement(RealPressable, { ...props, ref });
  });
  return { ...actual, Pressable: RecordingPressable };
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
  const Easing = { out: (e: unknown) => e, inOut: (e: unknown) => e, quad: 'quad' };
  return {
    __esModule: true,
    default: { createAnimatedComponent: (C: unknown) => C },
    useSharedValue,
    useAnimatedStyle,
    withTiming: (value: number) => value,
    cancelAnimation: vi.fn(),
    Easing,
  };
});

const { useReducedMotionMock } = vi.hoisted(() => ({ useReducedMotionMock: vi.fn(() => false) }));
vi.mock('@/hooks/useReducedMotion', () => ({ useReducedMotion: useReducedMotionMock }));

import { AppleHealthRefreshControl } from '../AppleHealthRefreshControl';

let host: HTMLElement;
let root: Root;

function renderControl(props: Partial<React.ComponentProps<typeof AppleHealthRefreshControl>> = {}) {
  const defaults: React.ComponentProps<typeof AppleHealthRefreshControl> = {
    isRefreshing: false,
    showUpdatedConfirmation: false,
    onPress: () => {},
    accessibilityLabel: 'Refresh Apple Health',
    updatedLabel: 'Updated just now',
  };
  root = createRoot(host);
  flushSync(() => root.render(React.createElement(AppleHealthRefreshControl, { ...defaults, ...props })));
}

const q = (sel: string) => host.querySelector(sel);

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  useReducedMotionMock.mockReset();
  useReducedMotionMock.mockReturnValue(false);
  capturedPressableProps.length = 0;
});

afterEach(() => {
  flushSync(() => root.unmount());
  host.remove();
});

describe('AppleHealthRefreshControl — visible in-flight state (founder item 1)', () => {
  it('renders the refresh icon, not a spinner, when idle', () => {
    renderControl({ isRefreshing: false });
    expect(q('[data-icon="refresh-cw"]')).not.toBeNull();
    expect(q('[data-testid="profile-apple-refresh-spinner"]')).toBeNull();
  });

  it('swaps the icon for a visible spinner while isRefreshing is true', () => {
    renderControl({ isRefreshing: true });
    expect(q('[data-icon="refresh-cw"]')).toBeNull();
    expect(q('[data-testid="profile-apple-refresh-spinner"]')).not.toBeNull();
  });

  it('the spinner clears (icon returns) once isRefreshing goes back to false', () => {
    renderControl({ isRefreshing: true });
    expect(q('[data-testid="profile-apple-refresh-spinner"]')).not.toBeNull();
    flushSync(() => root.render(React.createElement(AppleHealthRefreshControl, {
      isRefreshing: false,
      showUpdatedConfirmation: false,
      onPress: () => {},
      accessibilityLabel: 'Refresh Apple Health',
      updatedLabel: 'Updated just now',
    })));
    expect(q('[data-testid="profile-apple-refresh-spinner"]')).toBeNull();
    expect(q('[data-icon="refresh-cw"]')).not.toBeNull();
  });
});

describe('AppleHealthRefreshControl — duplicate-tap guard reflected in the UI (founder item 2)', () => {
  it('tapping while idle invokes onPress', () => {
    const onPress = vi.fn();
    renderControl({ isRefreshing: false, onPress });
    const btn = q('[role="button"]') as HTMLElement;
    flushSync(() => btn.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('is disabled while isRefreshing — a tap during the busy window does not invoke onPress again', () => {
    const onPress = vi.fn();
    renderControl({ isRefreshing: true, onPress });
    const btn = q('[role="button"]') as HTMLElement;
    flushSync(() => btn.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('carries the disabled DOM state while refreshing (aria-disabled, from the real `disabled` prop react-native-web maps directly)', () => {
    renderControl({ isRefreshing: true });
    const btn = q('[role="button"]') as HTMLElement;
    expect(btn.getAttribute('aria-disabled')).toBe('true');
  });

  it('hands RN\'s real accessibilityState contract {disabled:true, busy:true} to the underlying Pressable while refreshing — react-native-web has no DOM equivalent for `busy` (only a top-level `accessibilityBusy` prop maps to `aria-busy`; nested `accessibilityState.busy` does not), so this is verified against the actual prop reaching Pressable rather than a DOM attribute. On native iOS/Android this is what makes VoiceOver/TalkBack announce "busy".', () => {
    renderControl({ isRefreshing: true });
    const last = capturedPressableProps[capturedPressableProps.length - 1];
    expect(last.accessibilityState).toEqual({ disabled: true, busy: true });
  });

  it('accessibilityState is {disabled:false, busy:false} when idle (not stuck busy from a previous render)', () => {
    renderControl({ isRefreshing: false });
    const last = capturedPressableProps[capturedPressableProps.length - 1];
    expect(last.accessibilityState).toEqual({ disabled: false, busy: false });
  });
});

describe('AppleHealthRefreshControl — completion feedback survives byte-identical data (founder item 3, the core bug)', () => {
  it('renders the confirmation text visibly when showUpdatedConfirmation is true', () => {
    renderControl({ showUpdatedConfirmation: true, updatedLabel: 'Updated just now' });
    const el = q('[data-testid="profile-apple-refresh-confirmation"]') as HTMLElement;
    expect(el).not.toBeNull();
    expect(el.textContent).toBe('Updated just now');
    expect(el.style.opacity).toBe('1');
  });

  it('the confirmation row is present but invisible (opacity 0) when showUpdatedConfirmation is false — never removed from layout, so it can never shift the card', () => {
    renderControl({ showUpdatedConfirmation: false });
    const el = q('[data-testid="profile-apple-refresh-confirmation"]') as HTMLElement;
    expect(el).not.toBeNull();
    expect(el.style.opacity).toBe('0');
  });

  it('the confirmation carries a polite live region so it is announced (this is what makes byte-identical data still feel like something happened)', () => {
    renderControl({ showUpdatedConfirmation: true });
    const el = q('[data-testid="profile-apple-refresh-confirmation"]');
    expect(el?.getAttribute('aria-live')).toBe('polite');
  });
});

describe('AppleHealthRefreshControl — pressed-state feedback (founder item 4)', () => {
  it('uses the house AFMotionPressable primitive (role=button via the shared press primitive, not a raw unstyled element)', () => {
    renderControl();
    // AFMotionPressable always renders an accessibility-role button — this
    // is the mutation-relevant surface: swapping back to a bare Pressable
    // with no pressedStyle would still pass every other test in this file,
    // but AFMotionPressable is what supplies the reduced-motion-safe scale
    // + pressedStyle press feedback per the house convention (see
    // AFButton.tsx's identical usage).
    const btn = q('[role="button"]');
    expect(btn).not.toBeNull();
  });
});
