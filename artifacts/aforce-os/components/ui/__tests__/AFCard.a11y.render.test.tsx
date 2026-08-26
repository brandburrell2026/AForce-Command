// @vitest-environment happy-dom
/**
 * AFCard — the composed-label contract (Wave-5 Part 19).
 *
 * A React Native `View` is not an accessibility element on iOS unless
 * `accessible` is set. AFCard's non-pressable branch accepted an
 * `accessibilityLabel` and rendered it onto a bare View, so every caller that
 * carefully composed a sentence — "Monday, Balanced, 76, 84 ounces, 68% in
 * band, 3 checks" — had that sentence silently discarded, and VoiceOver read
 * the children as separate fragments instead.
 *
 * The fix is in the shared primitive rather than in each caller, so this file
 * is the regression lock for all of them.
 *
 * Rendered through react-native-web (the repo-wide vitest alias), which maps
 * RN accessibility props onto ARIA — `accessible` becomes a real element
 * boundary, `accessibilityLabel` becomes aria-label.
 */
import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { AFCard } from '../AFCard';

let host: HTMLElement;
let root: Root;

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  flushSync(() => root.unmount());
  host.remove();
});

function render(node: React.ReactElement): void {
  flushSync(() => root.render(node));
}

describe('AFCard — a labelled card is one accessibility element', () => {
  it('exposes the composed label to assistive tech', () => {
    render(
      <AFCard accessibilityLabel="Monday, Balanced, 76, 84 ounces" testID="day-card">
        <span>Mon</span>
        <span>76</span>
      </AFCard>,
    );
    const el = host.querySelector('[aria-label]');
    expect(el).not.toBeNull();
    expect(el?.getAttribute('aria-label')).toBe('Monday, Balanced, 76, 84 ounces');
  });

  it('groups the card so its children are not read as loose fragments', () => {
    render(
      <AFCard accessibilityLabel="Tuesday, Peak, 91">
        <span>Tue</span>
        <span>91</span>
      </AFCard>,
    );
    // react-native-web renders `accessible` as a focusable/role-bearing
    // boundary; either signal proves the card is an element, not a passthrough.
    const el = host.querySelector('[aria-label]') as HTMLElement | null;
    expect(el).not.toBeNull();
    const grouped =
      el!.getAttribute('role') !== null || el!.getAttribute('tabindex') !== null;
    expect(grouped, 'a labelled AFCard must form its own accessibility element').toBe(true);
  });
});

describe('AFCard — an unlabelled card stays transparent', () => {
  it('does not flatten its children when no label was given', () => {
    // Forcing `accessible` on every card would collapse rich content into a
    // single unnamed node and LOSE information — worse than the bug.
    render(
      <AFCard testID="plain">
        <span>free-standing content</span>
      </AFCard>,
    );
    expect(host.querySelector('[aria-label]')).toBeNull();
  });

  it('treats an empty-string label as no label', () => {
    render(
      <AFCard accessibilityLabel="">
        <span>content</span>
      </AFCard>,
    );
    expect(host.querySelector('[aria-label]')).toBeNull();
  });
});

describe('AFCard — the pressable branch keeps its button semantics', () => {
  it('is a button with its label, not a summary', () => {
    render(
      <AFCard accessibilityLabel="Log 12 ounces" onPress={() => {}}>
        <span>Log</span>
      </AFCard>,
    );
    const el = host.querySelector('[aria-label]');
    expect(el?.getAttribute('aria-label')).toBe('Log 12 ounces');
    expect(el?.getAttribute('role')).toBe('button');
  });
});
