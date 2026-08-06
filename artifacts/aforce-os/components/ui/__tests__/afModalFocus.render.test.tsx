// @vitest-environment happy-dom
/**
 * AFModal VoiceOver focus — P1a.
 *
 * `react-native` is mocked so we can deterministically simulate a native modal
 * "show" (the mock Modal fires `onShow` on mount) and observe that AFModal moves
 * accessibility focus into the modal content AND still calls the caller's own
 * `onShow`. `AccessibilityInfo.setAccessibilityFocus` + `findNodeHandle` are the
 * two seams we assert. `vi.hoisted` keeps the spy referenceable inside the
 * hoisted mock factory.
 */
import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { setAccessibilityFocus } = vi.hoisted(() => ({ setAccessibilityFocus: vi.fn() }));

vi.mock('react-native', async () => {
  const R = await import('react');
  return {
    Modal: ({ onShow, children }: { onShow?: (e: unknown) => void; children?: React.ReactNode }) => {
      R.useEffect(() => {
        onShow?.({ nativeEvent: {} });
      }, []);
      return R.createElement('div', null, children);
    },
    View: R.forwardRef<HTMLDivElement, { children?: React.ReactNode }>((props, ref) =>
      R.createElement('div', { ref }, props.children),
    ),
    StyleSheet: { create: (s: unknown) => s },
    Platform: { OS: 'ios' },
    AccessibilityInfo: { setAccessibilityFocus },
    findNodeHandle: () => 7,
  };
});
vi.mock('@/hooks/useReducedMotion', () => ({ useReducedMotion: () => false }));

import { AFModal } from '../AFModal';

let container: HTMLElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  setAccessibilityFocus.mockClear();
});
afterEach(() => {
  flushSync(() => root.unmount());
  container.remove();
});

describe('AFModal VoiceOver focus (P1a)', () => {
  it('moves accessibility focus into the modal on show, and preserves the caller onShow', () => {
    const callerOnShow = vi.fn();
    flushSync(() =>
      root.render(
        React.createElement(
          AFModal,
          { visible: true, onShow: callerOnShow },
          React.createElement('div', null, 'modal body'),
        ),
      ),
    );
    expect(setAccessibilityFocus).toHaveBeenCalledWith(7);
    expect(callerOnShow).toHaveBeenCalledTimes(1);
  });
});
