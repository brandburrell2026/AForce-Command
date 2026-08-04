// @vitest-environment happy-dom
/**
 * AFListRow — NON-SHIPPING render harness (Squad-F HIGH #5a, A-6).
 *
 * Renders the real `AFListRow` to a DOM (react-native-web → react-dom,
 * happy-dom), following the pattern established in
 * components/health/__tests__/connectedHealthView.render.test.tsx (Icon
 * mocked — native vector fonts/SVG are irrelevant to structure/a11y here).
 *
 * Two defects under test:
 *  - A-6: `composedLabel` (title + subtitle + value) was computed but never
 *    used — both the Pressable and the Switch announced only `title`,
 *    silently dropping the subtitle/value a screen reader needs.
 *  - HIGH #5a: `numberOfLines={1} adjustsFontSizeToFit` on the title shrank
 *    it to fit one line, which at large Dynamic Type settings illegibly
 *    compresses or truncates it.
 *
 * `numberOfLines` IS forwarded by react-native-web (it becomes a
 * `-webkit-line-clamp` style), so its absence is asserted via computed style.
 * `adjustsFontSizeToFit` has no react-native-web equivalent and is dropped
 * before reaching the DOM (confirmed against react-native-web's Text
 * `forwardPropsList` allowlist) — its absence is asserted by wrapping the
 * real `Text` to record props BEFORE that allowlist runs, the same technique
 * used in components/__tests__/whoopSnapshotCard.render.test.tsx for
 * `maxFontSizeMultiplier`.
 */
import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../../Icon', () => ({
  Icon: ({ name }: { name: string }) => React.createElement('span', { 'data-icon': name }),
}));

// Records every prop object passed to <Text> BEFORE react-native-web's
// allowlist silently drops RN-only props like `adjustsFontSizeToFit`.
const { capturedTextProps } = vi.hoisted(() => ({ capturedTextProps: [] as Record<string, unknown>[] }));
vi.mock('react-native', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const RealText = actual.Text as React.ComponentType<Record<string, unknown>>;
  const RecordingText = React.forwardRef((props: Record<string, unknown>, ref: React.Ref<unknown>) => {
    capturedTextProps.push(props);
    return React.createElement(RealText, { ...props, ref });
  });
  return { ...actual, Text: RecordingText };
});

import { AFListRow } from '../AFListRow';

let host: HTMLElement;
let root: Root;

function renderRow(props: React.ComponentProps<typeof AFListRow>) {
  root = createRoot(host);
  flushSync(() => root.render(React.createElement(AFListRow, props)));
}

const q = (sel: string) => host.querySelector(sel);

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  capturedTextProps.length = 0;
});

afterEach(() => {
  flushSync(() => root.unmount());
  host.remove();
});

describe('AFListRow — composed accessible label (A-6)', () => {
  it('a Pressable row announces title + subtitle + value together, not title alone', () => {
    renderRow({
      title: 'Weight',
      subtitle: 'Used for hydration targets',
      value: '180 lbs',
      onPress: () => {},
      testID: 'row-weight',
    });
    const el = q('[data-testid="row-weight"]');
    expect(el?.getAttribute('role')).toBe('button');
    expect(el?.getAttribute('aria-label')).toBe('Weight, Used for hydration targets, 180 lbs');
  });

  it('a toggle row announces the same composed label on the Switch, not just the title', () => {
    renderRow({
      title: 'Heat Mode',
      subtitle: 'Aggressive cadence under heat stress',
      toggle: { value: true, onValueChange: () => {} },
      testID: 'row-heat',
    });
    const el = q('[role="switch"]');
    expect(el).not.toBeNull();
    expect(el?.getAttribute('aria-label')).toBe('Heat Mode, Aggressive cadence under heat stress');
  });

  it('a title-only row (no subtitle/value) still announces correctly (label degrades to just the title)', () => {
    renderRow({ title: 'Terms of Service', onPress: () => {}, testID: 'row-terms' });
    const el = q('[data-testid="row-terms"]');
    expect(el?.getAttribute('aria-label')).toBe('Terms of Service');
  });
});

describe('AFListRow — title Dynamic Type (Squad-F HIGH #5a)', () => {
  it('the title Text never receives numberOfLines (no forced single-line clamp)', () => {
    renderRow({ title: 'A long title that used to be forced onto a single shrinking line', onPress: () => {} });
    const titleProps = capturedTextProps.find((p) => p.children === 'A long title that used to be forced onto a single shrinking line');
    expect(titleProps).toBeDefined();
    expect(titleProps?.numberOfLines).toBeUndefined();
  });

  it('the title Text never receives adjustsFontSizeToFit', () => {
    renderRow({ title: 'Weight', onPress: () => {} });
    const titleProps = capturedTextProps.find((p) => p.children === 'Weight');
    expect(titleProps).toBeDefined();
    expect(titleProps?.adjustsFontSizeToFit).toBeUndefined();
  });

  it('the subtitle Text (unaffected by this fix) still clamps to 2 lines, unchanged', () => {
    renderRow({ title: 'Weight', subtitle: 'Used for hydration targets', onPress: () => {} });
    const subtitleProps = capturedTextProps.find((p) => p.children === 'Used for hydration targets');
    expect(subtitleProps?.numberOfLines).toBe(2);
  });
});
