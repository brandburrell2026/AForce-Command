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
// `platformState`/`announceForAccessibility` follow the exact pattern
// established in `components/__tests__/riskTimerDisplay.render.test.tsx`
// for driving `Platform.OS` and spying on
// `AccessibilityInfo.announceForAccessibility` — build 47's iOS-announcement
// follow-up (founder item 1) mirrors that component's fix, so its test
// harness is mirrored too.
const { capturedPressableProps, capturedTextProps, announceForAccessibility, platformState } = vi.hoisted(() => ({
  capturedPressableProps: [] as Record<string, unknown>[],
  // `accessibilityElementsHidden` (build 47 follow-up, founder item 1) has
  // no react-native-web DOM mapping at all (same class of gap as
  // `accessibilityState.busy` above — verified against
  // `createDOMProps`'s prop list) — so, same technique, this records what
  // actually reaches the real `Text` primitive rather than asserting a
  // DOM attribute react-native-web can't produce.
  capturedTextProps: [] as Record<string, unknown>[],
  announceForAccessibility: vi.fn(),
  platformState: { OS: 'ios' as 'ios' | 'android' | 'web' },
}));
vi.mock('react-native', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const RealPressable = actual.Pressable as React.ComponentType<Record<string, unknown>>;
  const RecordingPressable = React.forwardRef((props: Record<string, unknown>, ref: React.Ref<unknown>) => {
    capturedPressableProps.push(props);
    return React.createElement(RealPressable, { ...props, ref });
  });
  const RealText = actual.Text as React.ComponentType<Record<string, unknown>>;
  const RecordingText = React.forwardRef((props: Record<string, unknown>, ref: React.Ref<unknown>) => {
    capturedTextProps.push(props);
    return React.createElement(RealText, { ...props, ref });
  });
  const actualPlatform = actual.Platform as Record<string, unknown>;
  const actualAccessibilityInfo = actual.AccessibilityInfo as Record<string, unknown>;
  return {
    ...actual,
    Pressable: RecordingPressable,
    Text: RecordingText,
    Platform: {
      ...actualPlatform,
      get OS() {
        return platformState.OS;
      },
    },
    AccessibilityInfo: { ...actualAccessibilityInfo, announceForAccessibility },
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

/** Re-renders into the SAME root/instance (unlike `renderControl`, which
 * mounts fresh each call) — required to exercise the mount-vs-transition
 * ref inside the component across prop updates. Mirrors
 * `riskTimerDisplay.render.test.tsx`'s `rerenderTimer`. */
function rerenderControl(props: Partial<React.ComponentProps<typeof AppleHealthRefreshControl>> = {}) {
  const defaults: React.ComponentProps<typeof AppleHealthRefreshControl> = {
    isRefreshing: false,
    showUpdatedConfirmation: false,
    onPress: () => {},
    accessibilityLabel: 'Refresh Apple Health',
    updatedLabel: 'Updated just now',
  };
  flushSync(() => root.render(React.createElement(AppleHealthRefreshControl, { ...defaults, ...props })));
}

const q = (sel: string) => host.querySelector(sel);

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  useReducedMotionMock.mockReset();
  useReducedMotionMock.mockReturnValue(false);
  capturedPressableProps.length = 0;
  capturedTextProps.length = 0;
  announceForAccessibility.mockClear();
  platformState.OS = 'ios';
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

  // Build 47 follow-up (founder item 1, same accessibility-defect class as
  // the iOS announcement below): `importantForAccessibility` is Android-only
  // (react-native-web has no DOM mapping for it at all), so it was already
  // paired with `accessibilityElementsHidden` — the way
  // `components/WhoopSnapshotCard.tsx` does at all four of its sites — so
  // the invisible confirmation row is declaratively hidden from VoiceOver
  // via a prop react-native-web (and iOS) actually honors.
  it('hands accessibilityElementsHidden=true to the underlying Text when NOT showing the confirmation, declaratively hiding it from VoiceOver', () => {
    renderControl({ showUpdatedConfirmation: false });
    const last = capturedTextProps[capturedTextProps.length - 1];
    expect(last.accessibilityElementsHidden).toBe(true);
  });

  it('hands accessibilityElementsHidden=false to the underlying Text while showing the confirmation (not hidden)', () => {
    renderControl({ showUpdatedConfirmation: true });
    const last = capturedTextProps[capturedTextProps.length - 1];
    expect(last.accessibilityElementsHidden).toBe(false);
  });
});

/**
 * iOS VoiceOver announcement (RC-2 build 47 follow-up, founder item 1).
 *
 * `accessibilityLiveRegion="polite"` (asserted above) is Android-only per
 * RN's own docs — VoiceOver never reads it, so the completion confirmation
 * this whole fix exists for was silent on iOS the entire time. Mirrors
 * `RiskTimerDisplay.tsx`'s ~:44-79 pattern (and its test file's
 * `platformState`/`announceForAccessibility` harness) exactly: announce
 * only on the false→true transition, never on first mount.
 */
describe('AppleHealthRefreshControl — iOS VoiceOver announcement on completion (RC-2 build 47 follow-up, founder item 1)', () => {
  it('does NOT announce on first mount, even if showUpdatedConfirmation starts true (VoiceOver already reads focused content on mount)', () => {
    renderControl({ showUpdatedConfirmation: true, updatedLabel: 'Checked just now' });
    expect(announceForAccessibility).not.toHaveBeenCalled();
  });

  it('announces the updated label on the false→true transition', () => {
    renderControl({ showUpdatedConfirmation: false, updatedLabel: 'Checked just now' });
    expect(announceForAccessibility).not.toHaveBeenCalled();
    rerenderControl({ showUpdatedConfirmation: true, updatedLabel: 'Checked just now' });
    expect(announceForAccessibility).toHaveBeenCalledTimes(1);
    expect(announceForAccessibility).toHaveBeenCalledWith('Checked just now');
  });

  it('does not re-announce on a render that keeps showUpdatedConfirmation true (no re-trigger without a false→true edge)', () => {
    renderControl({ showUpdatedConfirmation: false, updatedLabel: 'Checked just now' });
    rerenderControl({ showUpdatedConfirmation: true, updatedLabel: 'Checked just now' });
    expect(announceForAccessibility).toHaveBeenCalledTimes(1);
    announceForAccessibility.mockClear();
    rerenderControl({ showUpdatedConfirmation: true, updatedLabel: 'Checked just now' });
    expect(announceForAccessibility).not.toHaveBeenCalled();
  });

  it('never calls announceForAccessibility on Android — the existing live region owns that platform', () => {
    platformState.OS = 'android';
    renderControl({ showUpdatedConfirmation: false, updatedLabel: 'Checked just now' });
    rerenderControl({ showUpdatedConfirmation: true, updatedLabel: 'Checked just now' });
    expect(announceForAccessibility).not.toHaveBeenCalled();
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

/**
 * Elite-motion gating (RC-2 build 47 follow-up, founder items 3 & 5).
 *
 * Before build 47 this component hardcoded `motionEnabled` to a bare truthy
 * value on `AFMotionPressable` — the app's only live elite press-scale
 * outside the `elite_motion_enabled` kill switch. These tests genuinely
 * BIND the reduced-motion gate rather than trusting it by inspection: they
 * press the real `AFMotionPressable` (via the captured `onPressIn`/
 * `onPressOut` handlers the file's `react-native` mock already records —
 * same technique the "duplicate-tap guard" describe block above uses for
 * `accessibilityState`) and read the actual DOM outcome —
 * `style.transform` for the elite scale, `getComputedStyle(...).opacity`
 * for the ordinary `pressedStyle` feedback (react-native-web resolves
 * `pressedStyle`'s static `{ opacity: 0.6 }` to an atomic CSS class rather
 * than an inline style, so an inline-style-only assertion would miss it).
 *
 * Approach for `useReducedMotion`: this harness already mocks the hook via
 * `vi.hoisted`-captured `useReducedMotionMock`, a `vi.fn()` whose return
 * value is reset to `false` in `beforeEach` — i.e. it is stubbed, not
 * hardwired, so each test below injects its own return value with
 * `useReducedMotionMock.mockReturnValue(...)` rather than needing to
 * "un-mock" the module. This is the minimal change that makes the gate
 * genuinely bind per test.
 */
describe('AppleHealthRefreshControl — elite-motion gating (founder items 3 & 5)', () => {
  function press(el: HTMLElement) {
    const props = capturedPressableProps[capturedPressableProps.length - 1];
    flushSync(() => (props.onPressIn as () => void)());
    return el;
  }
  function release() {
    const props = capturedPressableProps[capturedPressableProps.length - 1];
    flushSync(() => (props.onPressOut as () => void)());
  }

  it('control: motionEnabled=true with reduced-motion OFF DOES run the elite press-scale — proves this harness can actually detect the animation', () => {
    useReducedMotionMock.mockReturnValue(false);
    renderControl({ motionEnabled: true });
    const btn = q('[role="button"]') as HTMLElement;
    expect(btn.style.transform).toBe('scale(1)');
    press(btn);
    expect(btn.style.transform).toBe('scale(0.97)');
    release();
    expect(btn.style.transform).toBe('scale(1)');
  });

  it('(a) reduced-motion ON: no elite scale animation on press, even with motionEnabled=true — ordinary pressed feedback (opacity) still applies', () => {
    useReducedMotionMock.mockReturnValue(true);
    renderControl({ motionEnabled: true });
    const btn = q('[role="button"]') as HTMLElement;
    expect(btn.style.transform).toBe('scale(1)');
    press(btn);
    // The elite scale never engages under reduced motion...
    expect(btn.style.transform).toBe('scale(1)');
    // ...but AFMotionPressable's `pressed ? pressedStyle : null` is NOT
    // gated by the motion flag, so ordinary pressed feedback must survive.
    expect(getComputedStyle(btn).opacity).toBe('0.6');
    release();
    expect(getComputedStyle(btn).opacity).not.toBe('0.6');
  });

  it('(b) elite_motion_enabled false (motionEnabled prop false): no elite scale animation on press, even with reduced-motion OFF — ordinary pressed feedback (opacity) still applies', () => {
    useReducedMotionMock.mockReturnValue(false);
    renderControl({ motionEnabled: false });
    const btn = q('[role="button"]') as HTMLElement;
    expect(btn.style.transform).toBe('scale(1)');
    press(btn);
    expect(btn.style.transform).toBe('scale(1)');
    expect(getComputedStyle(btn).opacity).toBe('0.6');
    release();
    expect(getComputedStyle(btn).opacity).not.toBe('0.6');
  });

  it('defaults motionEnabled to false when the prop is omitted (caller must opt in explicitly)', () => {
    useReducedMotionMock.mockReturnValue(false);
    renderControl();
    const btn = q('[role="button"]') as HTMLElement;
    press(btn);
    expect(btn.style.transform).toBe('scale(1)');
  });
});
