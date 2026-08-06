// @vitest-environment happy-dom
/**
 * ScreenErrorBoundary — P1a render harness (crash isolation).
 *
 * Renders under happy-dom (react-native → react-native-web). Two transitive
 * chains don't load in this env (the repo's documented expo/__DEV__ limitation),
 * and neither is under test, so both are stubbed:
 *   - `@/components/ErrorFallback` — ErrorBoundary imports it for its default
 *     fallback (→ `expo` reloadAppAsync, safe-area, AFModal). ScreenErrorBoundary
 *     supplies its OWN fallback, so the default is irrelevant here.
 *   - `@/components/ui/AFButton` — the real button pulls AFMotionPressable →
 *     expo-haptics/reanimated. Stubbed to a plain <button> so we can click it.
 */
import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/components/ErrorFallback', () => ({ ErrorFallback: () => null }));
vi.mock('@/components/ui/AFButton', () => ({
  AFPrimaryButton: ({ label, onPress }: { label: string; onPress: () => void }) =>
    React.createElement('button', { type: 'button', 'aria-label': label, onClick: onPress }, label),
}));

import { ScreenErrorBoundary } from '../ScreenErrorBoundary';

let container: HTMLElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  flushSync(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

// A child that throws until `crash.value` is flipped, so "Reload tab"
// (resetError) can re-render a healthy child on the next attempt.
const crash = { value: true };
function MaybeThrow() {
  if (crash.value) throw new Error('boom');
  return React.createElement('div', null, 'healthy tab content');
}

describe('ScreenErrorBoundary (P1a crash isolation)', () => {
  it('shows the recoverable in-tab fallback when a child throws', () => {
    crash.value = true;
    const err = vi.spyOn(console, 'error').mockImplementation(() => {}); // silence React's error log
    flushSync(() =>
      root.render(React.createElement(ScreenErrorBoundary, null, React.createElement(MaybeThrow))),
    );
    expect(container.textContent).toContain('This tab hit a snag.');
    expect(container.querySelector('[aria-label="Reload tab"]')).not.toBeNull();
    err.mockRestore();
  });

  it('"Reload tab" clears the error and re-renders healthy content', () => {
    crash.value = true;
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    flushSync(() =>
      root.render(React.createElement(ScreenErrorBoundary, null, React.createElement(MaybeThrow))),
    );
    crash.value = false; // next render succeeds
    const btn = container.querySelector('[aria-label="Reload tab"]') as HTMLElement;
    flushSync(() => btn.click());
    expect(container.textContent).toContain('healthy tab content');
    expect(container.textContent).not.toContain('This tab hit a snag.');
    err.mockRestore();
  });
});
