// @vitest-environment happy-dom
/**
 * AFModal — NON-SHIPPING render harness (RC-1 Wave-5, a11y-breadth item 2).
 *
 * Defect under test: 16 hand-rolled `<Modal>` call sites hard-coded
 * `animationType` with no reduced-motion gate, and none marked their content
 * as an accessibility-modal region. Mutation-verified per the
 * RecoveryCapacityCard pattern (components/__tests__/recoveryCapacityCard.render.test.tsx):
 * the shared `useReducedMotion` hook is mocked and its return value is
 * flipped between tests to prove AFModal actually reacts to the live
 * signal, rather than merely importing the hook.
 *
 * RN's `<Modal>` (aliased to react-native-web's implementation under this
 * harness — see vitest.config.ts) portals its content into a dedicated
 * `<div>` appended directly to `document.body`, NOT into the React root's
 * own container. Assertions below therefore query `document.body`, not the
 * mount host.
 */
import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Text } from 'react-native';

const { useReducedMotionMock } = vi.hoisted(() => ({
  useReducedMotionMock: vi.fn(() => false),
}));
vi.mock('@/hooks/useReducedMotion', () => ({ useReducedMotion: useReducedMotionMock }));

import { AFModal } from '../AFModal';

let host: HTMLElement;
let root: Root;

function renderModal(props: Partial<React.ComponentProps<typeof AFModal>> = {}) {
  root = createRoot(host);
  flushSync(() =>
    root.render(
      React.createElement(
        AFModal,
        { visible: true, onRequestClose: () => {}, ...props },
        React.createElement(Text, null, 'modal body'),
      ),
    ),
  );
}

/**
 * react-native-web's ModalAnimation only attaches CSS animation classes
 * (`r-animationDuration-*` / `r-animationKeyframes-*`) to the modal's root
 * div when the *effective* animationType is 'slide' or 'fade' — 'none'
 * renders the same container with no animation classes at all (see
 * react-native-web/src/exports/Modal/ModalAnimation.js `getAnimationStyle`).
 * That CSS-class presence is the only DOM-observable signal of the actual
 * (post-reduced-motion-gate) animationType RN's <Modal> received, since
 * `animationType` itself is not reflected as a DOM attribute. The animation
 * state only appears after ModalAnimation's mount effect flips
 * `isRendering`, which — unlike the synchronous `flushSync` render above —
 * runs as a passive effect, hence the tick wait before asserting.
 */
function isAnimated(): boolean {
  return document.body.querySelector('[class*="r-animationDuration-"]') !== null;
}

function tick(ms = 10): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  useReducedMotionMock.mockReset();
  useReducedMotionMock.mockReturnValue(false);
});

afterEach(() => {
  flushSync(() => root.unmount());
  host.remove();
});

describe('AFModal — reduced-motion gate + modal-region marking (RC-1 Wave-5)', () => {
  it('reduced motion OFF: a "fade" animationType passes through unchanged (renders visibly, actually animated)', async () => {
    useReducedMotionMock.mockReturnValue(false);
    renderModal({ animationType: 'fade' });
    await tick();
    expect(document.body.textContent).toContain('modal body');
    // Proves the gate is a no-op when reduced motion is OFF: the underlying
    // <Modal> really receives 'fade', not silently 'none'.
    expect(isAnimated()).toBe(true);
  });

  it('no animationType prop, reduced motion OFF: default pins to "none", matching RN\'s own default (mutation-verified)', async () => {
    useReducedMotionMock.mockReturnValue(false);
    renderModal();
    await tick();
    expect(document.body.textContent).toContain('modal body');
    // The default-parameter value itself is the thing under test here — a
    // mutant that changes `animationType = 'none'` to any other default
    // (e.g. 'fade') would still pass every other test in this file, since
    // they all pass an explicit animationType. Reduced motion is OFF, so a
    // regression to a 'fade' default would make this render animated.
    expect(isAnimated()).toBe(false);
  });

  it('reduced motion ON: a "fade" animationType collapses to "none" — content still renders, transition is gone (mutation-verified)', async () => {
    useReducedMotionMock.mockReturnValue(true);
    renderModal({ animationType: 'fade' });
    await tick();
    expect(document.body.textContent).toContain('modal body');
    expect(useReducedMotionMock).toHaveBeenCalled();
    // The actual assertion the gate exists for: the underlying <Modal> must
    // receive animationType 'none', not 'fade', once reduce-motion is on.
    // A mutant that deletes the `reduceMotion && animationType === 'fade'`
    // check (or short-circuits it to always pass 'fade' through) would still
    // pass the textContent check above but fail this one.
    expect(isAnimated()).toBe(false);
  });

  it('the reduced-motion signal is re-read per render, not cached at import time (mutation-verified)', () => {
    // First render with the hook OFF.
    useReducedMotionMock.mockReturnValue(false);
    renderModal({ animationType: 'fade' });
    const firstCallCount = useReducedMotionMock.mock.calls.length;
    expect(firstCallCount).toBeGreaterThan(0);

    // Flip the SAME mocked hook to ON and re-render the SAME component
    // instance — proves AFModal reads the hook live on every render rather
    // than snapshotting it once.
    useReducedMotionMock.mockReturnValue(true);
    flushSync(() =>
      root.render(
        React.createElement(
          AFModal,
          { visible: true, animationType: 'fade', onRequestClose: () => {} },
          React.createElement(Text, null, 'modal body'),
        ),
      ),
    );
    expect(useReducedMotionMock.mock.calls.length).toBeGreaterThan(firstCallCount);
  });

  it('reduced motion ON: a "slide" animationType is left as authored (position carries meaning)', async () => {
    useReducedMotionMock.mockReturnValue(true);
    renderModal({ animationType: 'slide' });
    await tick();
    expect(document.body.textContent).toContain('modal body');
    // The gate is scoped to 'fade' only — 'slide' must still reach RN's
    // <Modal> as 'slide' (animated), even with reduced motion on. A mutant
    // that widened the gate's condition to `reduceMotion` alone (dropping
    // the `animationType === 'fade'` scoping) would fail this.
    expect(isAnimated()).toBe(true);
  });

  it('the ported content carries aria-modal (accessibility-modal region)', () => {
    renderModal();
    const modalRegion = document.querySelector('[aria-modal="true"]');
    expect(modalRegion).not.toBeNull();
  });

  it('accessibilityViewIsModal can be disabled explicitly without breaking render', () => {
    renderModal({ accessibilityViewIsModal: false });
    expect(document.body.textContent).toContain('modal body');
  });

  it('renders no content when visible=false', () => {
    renderModal({ visible: false });
    expect(document.body.textContent).not.toContain('modal body');
  });
});
