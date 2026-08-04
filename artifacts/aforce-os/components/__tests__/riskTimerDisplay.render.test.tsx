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
 *
 * RC-1 verdict-pass follow-up (Wave-1 r2, item 3): `accessibilityLiveRegion`
 * is Android-only, so the countdown was silent on iOS VoiceOver. The
 * `platformState`/`announceForAccessibility` mocks below let this suite
 * drive `Platform.OS` and spy on `AccessibilityInfo.announceForAccessibility`
 * to prove the new iOS announcements fire on urgency-band transitions only
 * — never once per second — and that Android's existing live region is
 * untouched.
 */
import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { capturedTextProps, announceForAccessibility, platformState } = vi.hoisted(() => ({
  capturedTextProps: [] as Record<string, unknown>[],
  announceForAccessibility: vi.fn(),
  platformState: { OS: 'ios' as 'ios' | 'android' | 'web' },
}));
vi.mock('react-native', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const RealText = actual.Text as React.ComponentType<Record<string, unknown>>;
  const RecordingText = React.forwardRef((props: Record<string, unknown>, ref: React.Ref<unknown>) => {
    capturedTextProps.push(props);
    return React.createElement(RealText, { ...props, ref });
  });
  const actualPlatform = actual.Platform as Record<string, unknown>;
  const actualAccessibilityInfo = actual.AccessibilityInfo as Record<string, unknown>;
  return {
    ...actual,
    Text: RecordingText,
    Platform: {
      ...actualPlatform,
      get OS() {
        return platformState.OS;
      },
    },
    AccessibilityInfo: { ...actualAccessibilityInfo, announceForAccessibility },
  };
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

/** Re-renders into the SAME root/instance (unlike `renderTimer`, which
 * mounts fresh each call) — required to exercise the transition-detection
 * refs inside the component across prop updates. */
function rerenderTimer(props: React.ComponentProps<typeof RiskTimerDisplay>) {
  flushSync(() => root.render(React.createElement(RiskTimerDisplay, props)));
}

const q = (sel: string) => host.querySelector(sel);

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  capturedTextProps.length = 0;
  announceForAccessibility.mockClear();
  platformState.OS = 'ios';
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

describe('RiskTimerDisplay — iOS announceForAccessibility on urgency transitions (RC-1 Wave-1 r2, item 3)', () => {
  it('does not announce on first mount (VoiceOver already reads the composed label on focus)', () => {
    platformState.OS = 'ios';
    renderTimer({ timerSeconds: 725, performanceState: performanceState({ level: 'BALANCED' }) });
    expect(announceForAccessibility).not.toHaveBeenCalled();
  });

  it('does not announce on a per-second tick that stays within the same urgency band', () => {
    platformState.OS = 'ios';
    renderTimer({ timerSeconds: 300, performanceState: performanceState({ level: 'BALANCED' }) });
    announceForAccessibility.mockClear();
    // Simulate several countdown ticks — level unchanged, isUrgent unchanged.
    rerenderTimer({ timerSeconds: 299, performanceState: performanceState({ level: 'BALANCED' }) });
    rerenderTimer({ timerSeconds: 298, performanceState: performanceState({ level: 'BALANCED' }) });
    rerenderTimer({ timerSeconds: 297, performanceState: performanceState({ level: 'BALANCED' }) });
    expect(announceForAccessibility).not.toHaveBeenCalled();
  });

  it('announces exactly once when crossing into the isUrgent boundary (RECOVERING, < 5 minutes)', () => {
    platformState.OS = 'ios';
    // 5:01 remaining under RECOVERING — not yet urgent (minutes === 5, not < 5).
    renderTimer({ timerSeconds: 301, performanceState: performanceState({ level: 'RECOVERING' }) });
    announceForAccessibility.mockClear();
    // Crosses under 5 minutes — isUrgent flips false -> true.
    rerenderTimer({ timerSeconds: 299, performanceState: performanceState({ level: 'RECOVERING' }) });
    expect(announceForAccessibility).toHaveBeenCalledTimes(1);
    expect(announceForAccessibility).toHaveBeenCalledWith('TIME REMAINING. 04:59. URGENT.');
    // Continued ticking within the still-urgent band does not re-announce.
    rerenderTimer({ timerSeconds: 298, performanceState: performanceState({ level: 'RECOVERING' }) });
    rerenderTimer({ timerSeconds: 297, performanceState: performanceState({ level: 'RECOVERING' }) });
    expect(announceForAccessibility).toHaveBeenCalledTimes(1);
  });

  it('announces on a level-band crossing (BALANCED -> DEPLETED)', () => {
    platformState.OS = 'ios';
    renderTimer({ timerSeconds: 600, performanceState: performanceState({ level: 'BALANCED' }) });
    announceForAccessibility.mockClear();
    rerenderTimer({ timerSeconds: 0, performanceState: performanceState({ level: 'DEPLETED' }) });
    expect(announceForAccessibility).toHaveBeenCalledTimes(1);
    expect(announceForAccessibility).toHaveBeenCalledWith('CRITICAL — ACT NOW. 00:00. URGENT.');
  });

  it('never calls announceForAccessibility on Android — the existing live region owns that platform', () => {
    platformState.OS = 'android';
    renderTimer({ timerSeconds: 600, performanceState: performanceState({ level: 'BALANCED' }) });
    rerenderTimer({ timerSeconds: 0, performanceState: performanceState({ level: 'DEPLETED' }) });
    expect(announceForAccessibility).not.toHaveBeenCalled();
    // Android still gets its existing live region + composed label.
    const el = q('[data-testid="risk-timer-display"]');
    expect(el?.getAttribute('aria-live')).toBe('polite');
    expect(el?.getAttribute('aria-label')).toBe('CRITICAL — ACT NOW. 00:00. URGENT.');
  });
});
