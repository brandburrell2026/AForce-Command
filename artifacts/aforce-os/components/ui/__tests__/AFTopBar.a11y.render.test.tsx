// @vitest-environment happy-dom
/**
 * AFTopBar — the screen title reflows under Dynamic Type, never shrinks
 * (Wave-5 Phase-1 accessibility pass).
 *
 * Defect under test: the title rendered with
 * `numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}`, so raising
 * the OS text size made the screen's own heading SMALLER — Dynamic Type,
 * inverted, on the one string that tells a member where they are. This is the
 * highest-fanout instance of the defect AFListRow already fixed for its title
 * (see AFListRow.render.test.tsx): AFTopBar heads Protocol, Hydration,
 * Performance Signal, Community, Week in Review, Moments, Moment Detail,
 * Urine Check and Share Preview.
 *
 * The fix is the same one AFListRow made — let the text wrap, and cap the
 * display face with the documented `AF_MAX_DISPLAY_FONT_SCALE` ceiling instead
 * of a shrink-to-fit floor.
 *
 * `adjustsFontSizeToFit` / `maxFontSizeMultiplier` have no react-native-web
 * equivalent and are dropped before reaching the DOM, so — exactly as in
 * AFListRow.render.test.tsx and whoopSnapshotCard.render.test.tsx — the real
 * `Text` is wrapped to record props BEFORE that allowlist runs.
 */
import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../../Icon', () => ({
  Icon: ({ name }: { name: string }) => React.createElement('span', { 'data-icon': name }),
}));

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

import { AFTopBar } from '../AFTopBar';
import { AF_MAX_DISPLAY_FONT_SCALE } from '@/theme';

const TITLE = 'Week in Review';

let host: HTMLElement;
let root: Root;

function renderBar(props: React.ComponentProps<typeof AFTopBar>) {
  root = createRoot(host);
  flushSync(() => root.render(React.createElement(AFTopBar, props)));
}

function titleProps(): Record<string, unknown> | undefined {
  return capturedTextProps.find((p) => p.children === TITLE);
}

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  capturedTextProps.length = 0;
});

afterEach(() => {
  flushSync(() => root.unmount());
  host.remove();
});

describe('AFTopBar — the title obeys Dynamic Type', () => {
  it('never shrinks itself to fit', () => {
    renderBar({ title: TITLE });
    const p = titleProps();
    expect(p).toBeDefined();
    expect(
      p?.adjustsFontSizeToFit,
      'shrink-to-fit defeats Dynamic Type — the title must reflow instead',
    ).toBeUndefined();
    expect(p?.minimumFontScale).toBeUndefined();
  });

  it('is not clamped to a single line', () => {
    renderBar({ title: 'A deliberately long screen title that has to wrap somewhere' });
    const p = capturedTextProps.find(
      (x) => x.children === 'A deliberately long screen title that has to wrap somewhere',
    );
    expect(p).toBeDefined();
    expect(p?.numberOfLines).toBeUndefined();
  });

  it('caps growth with the documented display ceiling rather than a floor', () => {
    // Reflow without a ceiling would let a 26pt display face push the bar over
    // the content at the largest accessibility sizes. AF_MAX_DISPLAY_FONT_SCALE
    // is the token that exists for exactly this (theme/afTokens.ts).
    renderBar({ title: TITLE });
    expect(titleProps()?.maxFontSizeMultiplier).toBe(AF_MAX_DISPLAY_FONT_SCALE);
  });

  it('is still the screen header, so focus order still starts here', () => {
    renderBar({ title: TITLE });
    expect(titleProps()?.accessibilityRole).toBe('header');
  });
});

describe('AFTopBar — the back control that keeps a pushed route escapable', () => {
  it('renders a labelled back button when the screen is not a root tab', () => {
    renderBar({ title: TITLE, onBack: () => {} });
    const el = host.querySelector('[aria-label="Back"]');
    expect(el).not.toBeNull();
    expect(el?.getAttribute('role')).toBe('button');
  });

  it('renders none for a root tab, which has no route to go back to', () => {
    renderBar({ title: TITLE });
    expect(host.querySelector('[aria-label="Back"]')).toBeNull();
  });
});
