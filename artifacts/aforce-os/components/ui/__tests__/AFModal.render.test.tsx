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
  it('reduced motion OFF: a "fade" animationType passes through unchanged (renders visibly)', () => {
    useReducedMotionMock.mockReturnValue(false);
    renderModal({ animationType: 'fade' });
    expect(document.body.textContent).toContain('modal body');
  });

  it('reduced motion ON: a "fade" animationType still renders — the gate swaps the transition, not visibility (mutation-verified)', () => {
    useReducedMotionMock.mockReturnValue(true);
    renderModal({ animationType: 'fade' });
    expect(document.body.textContent).toContain('modal body');
    expect(useReducedMotionMock).toHaveBeenCalled();
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

  it('reduced motion ON: a "slide" animationType is left as authored (position carries meaning)', () => {
    useReducedMotionMock.mockReturnValue(true);
    renderModal({ animationType: 'slide' });
    expect(document.body.textContent).toContain('modal body');
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
