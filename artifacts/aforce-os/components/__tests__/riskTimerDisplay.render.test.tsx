// @vitest-environment happy-dom
/**
 * RiskTimerDisplay — accessible grouping + live region + Dynamic Type clamp
 * on a safety-adjacent countdown (RC-1 audit, P0 a11y).
 *
 * Previously had zero accessibility props: a screen reader read the label,
 * the digits, and the "URGENT" badge as three disconnected fragments, and a
 * live countdown updating every second was never announced. This mounts the
 * REAL `RiskTimerDisplay` to a DOM (react-native-web → react-dom, happy-dom)
 * with no mocks needed — the component has no native-only rendering surfaces
 * (no reanimated, no svg) — following the same recording-`Text` technique as
 * `components/__tests__/whoopSnapshotCard.render.test.tsx`'s Dynamic Type
 * clamp assertion (Squad-F HIGH #5b) to verify `maxFontSizeMultiplier`
 * reaches the countdown numeral, which react-native-web drops silently on
 * the DOM.
 *
 * The timer logic and copy strings themselves are untouched by this fix —
 * only wiring already-computed values into the accessibility tree — so this
 * suite asserts grouping/labeling, not urgency-threshold math.
 */
import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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

import { RiskTimerDisplay } from '../RiskTimerDisplay';
import type { PerformanceState } from '@/types';

function performanceState(overrides: Partial<PerformanceState> = {}): PerformanceState {
  return {
    level: 'BALANCED',
    score: 70,
    color: '#1E5BFF',
    glowColor: '#1E5BFF',
    urgency: 'moderate',
    pulseSpeed: 'medium',
    animationStyle: 'pulse',
    ...overrides,
  };
}

let host: HTMLElement;
let root: Root;

function renderTimer(props: React.ComponentProps<typeof RiskTimerDisplay>) {
  root = createRoot(host);
  flushSync(() => root.render(React.createElement(RiskTimerDisplay, props)));
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

describe('RiskTimerDisplay — accessible grouping + live region (RC-1 P0 a11y)', () => {
  it('is one accessible element carrying a composed label, with a polite live region', () => {
    renderTimer({ timerSeconds: 725, performanceState: performanceState({ level: 'BALANCED' }) });
    const el = q('[data-testid="risk-timer-display"]');
    expect(el).not.toBeNull();
    expect(el?.getAttribute('aria-label')).toBe('ACT WITHIN. 12:05.');
    expect(el?.getAttribute('aria-live')).toBe('polite');
  });

  it('appends URGENT to the composed label exactly when the visible badge is shown', () => {
    renderTimer({ timerSeconds: 240, performanceState: performanceState({ level: 'RECOVERING' }) });
    const el = q('[data-testid="risk-timer-display"]');
    expect(el?.getAttribute('aria-label')).toBe('TIME REMAINING. 04:00. URGENT.');
    expect(host.textContent).toContain('URGENT');
  });

  it('DEPLETED is always urgent regardless of the remaining time', () => {
    renderTimer({ timerSeconds: 3600, performanceState: performanceState({ level: 'DEPLETED' }) });
    const el = q('[data-testid="risk-timer-display"]');
    expect(el?.getAttribute('aria-label')).toBe('CRITICAL — ACT NOW. 60:00. URGENT.');
  });

  it('does not alter the visible timer text or labels', () => {
    renderTimer({ timerSeconds: 65, performanceState: performanceState({ level: 'PEAK' }) });
    expect(host.textContent).toContain('NEXT CHECK');
    expect(host.textContent).toContain('01:05');
  });

  it('clamps the countdown numeral to the shared display font-scale ceiling', () => {
    renderTimer({ timerSeconds: 65, performanceState: performanceState({ level: 'PEAK' }) });
    const AF_MAX_DISPLAY_FONT_SCALE = 1.35;
    const numeral = capturedTextProps.find((p) => p.children === '01:05');
    expect(numeral).toBeDefined();
    expect(numeral?.maxFontSizeMultiplier).toBe(AF_MAX_DISPLAY_FONT_SCALE);
  });
});
