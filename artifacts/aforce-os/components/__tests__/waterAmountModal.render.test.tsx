// @vitest-environment happy-dom
/**
 * WaterAmountModal — BEHAVIOURAL coverage of the water-logging surface
 * (build-61 CORRECTION 2, after build 60 failed physical-device QA).
 *
 * WHY THIS FILE EXISTS NOW. This component has always been correct and has
 * never had a test, because it was unreachable: its only mount was
 * `components/LogIntakeRow.tsx`, which nothing in the app imports. Build 61
 * re-mounts it on `HomeScreenV2` as the surface behind LOG WATER — the single
 * most important control in the product — so its behaviour stops being
 * academic and becomes the thing standing between a mis-tap and a durable,
 * wrong intake event.
 *
 * The founder's acceptance list for that control is what is asserted here:
 * normal logging, cancel, back-out, double tap, repeated submit, and — the
 * one that matters most — that merely OPENING the picker writes nothing.
 * `onConfirm` is the ONLY channel by which this surface can cause a write, so
 * a spy on it is a faithful proxy for "did an intake happen?".
 *
 * The connected `HomeScreenV2` container itself stays source-guard-tested per
 * this repo's documented convention (see `homeScreenV2Wiring.test.ts`'s header
 * and `components/health/__tests__/connectedHealthContainer.render.test.tsx`);
 * its call-site wiring is locked in `homeLogWaterSurface.test.ts`.
 */
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * This harness drives with `act`, not the `flushSync` the sibling render tests
 * use, because the behaviour under test lives in a PASSIVE EFFECT: the picker
 * resets to its default via `useEffect(..., [visible])`. `flushSync` does not
 * run the update that effect schedules, so a reset assertion written that way
 * reads the pre-reset DOM and reports a failure the real app does not have.
 * `act` requires this flag; without it React only warns and still does not
 * flush, which is the silent version of the same trap.
 */
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Native vector glyphs carry no behaviour under test; same stub the sibling
// render harnesses use (ringStatusCard.render.test.tsx).
vi.mock('../Icon', () => ({ Icon: ({ name }: { name: string }) => React.createElement('span', { 'data-icon': name }) }));
vi.mock('expo-haptics', () => ({
  selectionAsync: vi.fn(() => Promise.resolve()),
  impactAsync: vi.fn(() => Promise.resolve()),
  notificationAsync: vi.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Medium: 'medium' },
  NotificationFeedbackType: { Success: 'success' },
}));
// AFModal reads reduce-motion through Reanimated's subscription, which has no
// native module in this environment. The gate is covered by AFModal's own
// suite; here it only decides an animation name.
vi.mock('@/hooks/useReducedMotion', () => ({ useReducedMotion: () => false }));

import { WaterAmountModal } from '../WaterAmountModal';

let host: HTMLElement;
let root: Root;

const ACCENT = '#1E5BFF';

function render(props: {
  visible?: boolean;
  onCancel?: () => void;
  onConfirm?: (oz: number) => void;
}) {
  root = createRoot(host);
  act(() => {
    root.render(
      React.createElement(WaterAmountModal, {
        visible: props.visible ?? true,
        accentColor: ACCENT,
        onCancel: props.onCancel ?? (() => {}),
        onConfirm: props.onConfirm ?? (() => {}),
      }),
    );
  });
}

/** Re-render the SAME root with new props — the mount is preserved, exactly as a screen toggling `visible` does. */
function rerender(props: {
  visible: boolean;
  onCancel: () => void;
  onConfirm: (oz: number) => void;
}) {
  act(() => {
    root.render(React.createElement(WaterAmountModal, { accentColor: ACCENT, ...props }));
  });
}

/**
 * Queries run against `document.body`, not `host`: this is a real `<Modal>`,
 * and react-native-web portals modal content out of the mount node — searching
 * `host` finds an empty subtree and every assertion passes vacuously.
 */
const text = () => document.body.textContent ?? '';

/** react-native-web renders Pressable as a DOM node carrying the a11y label. */
function byLabel(label: string): HTMLElement {
  const el = document.body.querySelector<HTMLElement>(`[aria-label="${label}"]`);
  if (!el) throw new Error(`no element labelled "${label}" — rendered: ${text()}`);
  return el;
}

function press(el: HTMLElement) {
  act(() => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
}

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe('WaterAmountModal — opening the logger writes NOTHING', () => {
  it('renders the picker with no confirm callback fired', () => {
    const onConfirm = vi.fn();
    render({ onConfirm });
    // The surface is up…
    expect(text()).toContain('LOG WATER');
    expect(text()).toContain('ounces');
    // …and nothing has been logged by the act of opening it.
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('opens on the shipped 16 oz default — a starting point, not a submission', () => {
    const onConfirm = vi.fn();
    render({ onConfirm });
    expect(byLabel('Log 16 ounces of water')).toBeTruthy();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('adjusting the amount still writes nothing until confirm', () => {
    const onConfirm = vi.fn();
    render({ onConfirm });
    press(byLabel('24 ounces'));
    press(byLabel('Increase ounces'));
    press(byLabel('Decrease ounces'));
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

describe('WaterAmountModal — normal logging', () => {
  it('confirms EXACTLY ONCE with the amount the member chose', () => {
    const onConfirm = vi.fn();
    render({ onConfirm });
    press(byLabel('24 ounces'));
    press(byLabel('Log 24 ounces of water'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith(24);
  });

  it('the stepper amount is what gets confirmed, not the preset it started from', () => {
    const onConfirm = vi.fn();
    render({ onConfirm });
    press(byLabel('Increase ounces')); // 16 → 18
    press(byLabel('Increase ounces')); // 18 → 20
    press(byLabel('Log 20 ounces of water'));
    expect(onConfirm).toHaveBeenCalledWith(20);
  });

  it('clamps below the floor so an impossible amount can never be submitted', () => {
    const onConfirm = vi.fn();
    render({ onConfirm });
    press(byLabel('8 ounces'));
    for (let i = 0; i < 6; i++) press(byLabel('Decrease ounces')); // would reach -4
    press(byLabel('Log 4 ounces of water'));
    expect(onConfirm).toHaveBeenCalledWith(4);
  });

  it('clamps above the ceiling', () => {
    const onConfirm = vi.fn();
    render({ onConfirm });
    press(byLabel('32 ounces'));
    for (let i = 0; i < 20; i++) press(byLabel('Increase ounces')); // would reach 72
    press(byLabel('Log 64 ounces of water'));
    expect(onConfirm).toHaveBeenCalledWith(64);
  });
});

describe('WaterAmountModal — cancel and back-out write nothing', () => {
  it('the X control cancels without confirming', () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render({ onCancel, onConfirm });
    press(byLabel('Cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('a chosen-but-uncommitted amount is discarded on cancel', () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render({ onCancel, onConfirm });
    press(byLabel('32 ounces'));
    press(byLabel('Cancel'));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('re-opening resets to the default — a cancelled amount cannot leak into the next log', () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render({ visible: true, onCancel, onConfirm });
    press(byLabel('32 ounces'));
    press(byLabel('Cancel'));
    // The screen closes the surface, then the member opens it again.
    rerender({ visible: false, onCancel, onConfirm });
    rerender({ visible: true, onCancel, onConfirm });
    press(byLabel('Log 16 ounces of water'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith(16);
  });
});

describe('WaterAmountModal — repeated submit', () => {
  it('every press of the confirm control reports the SAME amount (the surface never mutates it)', () => {
    // The picker itself is deliberately not the de-duplicator — it is a dumb
    // surface, and swallowing the second press here would hide the problem
    // rather than fix it. What it must guarantee is that a repeated press can
    // never report a DIFFERENT amount than the one on screen; the call site
    // (HomeScreenV2's `confirmInFlightRef`, locked in
    // `components/home/__tests__/homeLogWaterSurface.test.ts`) is what stops
    // the second press from becoming a second durable intake event.
    const onConfirm = vi.fn();
    render({ onConfirm });
    press(byLabel('20 ounces'));
    press(byLabel('Log 20 ounces of water'));
    press(byLabel('Log 20 ounces of water'));
    press(byLabel('Log 20 ounces of water'));
    expect(onConfirm).toHaveBeenCalledTimes(3);
    expect(onConfirm.mock.calls.every(([oz]) => oz === 20)).toBe(true);
  });
});
