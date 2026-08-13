// @vitest-environment happy-dom
/**
 * AFProgressRing — the "a ring always has a text alternative" contract
 * (Wave-5 Phase-1 accessibility pass).
 *
 * The defect this locks: the ring declared `accessibilityRole="progressbar"`
 * and an `accessibilityValue` on a bare `View`, then UNCONDITIONALLY hid its
 * centered children. A View is not an accessibility element on iOS unless
 * `accessible` is set — the same fact that had silently discarded AFCard's
 * composed labels — so the role and value were never exposed there, and the
 * `{pct}%` Text the caller had placed in the middle, the only remaining text
 * alternative, was explicitly removed from the tree. The Hydration screen's
 * intake ring was therefore unreachable: a visualisation with no equivalent.
 *
 * The contract is deliberately two-sided, because either half alone would
 * regress the other:
 *   - NAMED   → one progressbar element carrying the name; children hidden,
 *               since they only repeat visually what the name already says.
 *   - UNNAMED → children stay readable. A caller who forgot the label gets a
 *               percentage, never silence.
 *
 * WHAT THIS HARNESS CAN AND CANNOT SEE. Rendered through react-native-web (the
 * repo-wide vitest alias), which maps `accessibilityLabel` to aria-label — so
 * the NAME half of the contract is proven here, at render, in both directions.
 * This RNW build does NOT map `accessibilityValue` or
 * `accessibilityElementsHidden` / `importantForAccessibility` to ARIA at all,
 * so the HIDING half is unobservable in a DOM and is asserted where it is
 * observable — as a source fact in
 * `components/__tests__/a11yContrastAndTargets.test.ts`. Asserting it here
 * would only lock in react-native-web's behaviour, not the app's.
 */
import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// react-native-svg is a native rendering surface that does not parse in node —
// stubbed exactly as in journalChart / whoopSnapshotCard. The stroke geometry
// is not what is under test here; the accessibility tree around it is.
vi.mock('react-native-svg', () => {
  const stub = (name: string) => {
    const C = React.forwardRef((props: Record<string, unknown>, ref: React.Ref<unknown>) =>
      React.createElement('svg-stub', { ...props, 'data-stub': name, ref }, props.children as React.ReactNode),
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
  };
});

import { AFProgressRing } from '../AFProgressRing';

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

describe('AFProgressRing — a named ring announces itself', () => {
  it('exposes the caller-supplied name to assistive tech', () => {
    render(
      <AFProgressRing progress={0.62} accessibilityLabel="Today's intake, 62% of your target">
        <span data-center-reading>62%</span>
      </AFProgressRing>,
    );
    const el = host.querySelector('[aria-label]');
    expect(el).not.toBeNull();
    expect(el?.getAttribute('aria-label')).toBe("Today's intake, 62% of your target");
  });

  it('names the progressbar itself, not some inner node', () => {
    // The role and the name have to land on the SAME element, or a screen
    // reader announces an unnamed bar next to a stray label.
    render(
      <AFProgressRing progress={0.62} accessibilityLabel="Today's intake">
        <span data-center-reading>62%</span>
      </AFProgressRing>,
    );
    const el = host.querySelector('[aria-label]') as HTMLElement | null;
    expect(el?.getAttribute('role')).toBe('progressbar');
  });
});

describe('AFProgressRing — an unnamed ring keeps its centered reading', () => {
  it('renders the centered percentage rather than dropping it', () => {
    // THE regression that shipped: no label AND hidden children = a ring that
    // says nothing at all. Whatever else changes here, the reading must exist.
    render(
      <AFProgressRing progress={0.38}>
        <span data-center-reading>38%</span>
      </AFProgressRing>,
    );
    expect(host.querySelector('[data-center-reading]')?.textContent).toBe('38%');
  });

  it('claims no name it was not given', () => {
    render(
      <AFProgressRing progress={0.38}>
        <span data-center-reading>38%</span>
      </AFProgressRing>,
    );
    expect(host.querySelector('[aria-label]')).toBeNull();
  });

  it('treats an empty-string label as no label', () => {
    // Mirrors AFCard's rule, so the two primitives cannot disagree about what
    // "labelled" means.
    render(
      <AFProgressRing progress={0.38} accessibilityLabel="">
        <span data-center-reading>38%</span>
      </AFProgressRing>,
    );
    expect(host.querySelector('[aria-label]')).toBeNull();
    expect(host.querySelector('[data-center-reading]')?.textContent).toBe('38%');
  });
});
