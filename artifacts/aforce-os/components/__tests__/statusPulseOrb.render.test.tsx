// @vitest-environment happy-dom
/**
 * StatusPulseOrb — primary CTA accessibility (RC-1 audit, P0 a11y).
 *
 * The orb's tap target was a bare `<Pressable>` around a raw score number —
 * a screen reader announced only the digit, with no role and no indication
 * that tapping opens anything. This mounts the REAL `StatusPulseOrb` to a DOM
 * (react-native-web → react-dom, happy-dom) with a real i18next instance
 * loaded from the real `locales/en.json`, following the harness pattern in
 * `components/__tests__/whoopSnapshotCard.render.test.tsx`: targeted mocks
 * for `react-native-reanimated` (StatusPulseOrb + the nested `AnimatedScore`
 * both drive a large surface of shared values / tweens irrelevant to the
 * accessibility tree) so the component mounts without a real animation
 * runtime, while everything else renders for real.
 */
import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import i18nCore from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { View as RNView } from 'react-native';

vi.mock('react-native-reanimated', () => {
  function useSharedValue(initial: unknown) {
    const ref = React.useRef({ value: initial });
    return ref.current;
  }
  function useAnimatedStyle(fn: () => Record<string, unknown>) {
    try {
      return fn();
    } catch {
      return {};
    }
  }
  const Easing = {
    out: (e: unknown) => e,
    in: (e: unknown) => e,
    inOut: (e: unknown) => e,
    cubic: 'cubic',
    quad: 'quad',
    sin: 'sin',
    ease: 'ease',
  };
  const AnimatedNamespace = {
    View: RNView,
    createAnimatedComponent: (Component: unknown) => Component,
  };
  return {
    __esModule: true,
    default: AnimatedNamespace,
    useSharedValue,
    useAnimatedStyle,
    withTiming: vi.fn((v: unknown) => v),
    withRepeat: vi.fn((anim: unknown) => anim),
    withSequence: vi.fn((...anims: unknown[]) => anims[0]),
    withDelay: vi.fn((_ms: number, anim: unknown) => anim),
    interpolate: vi.fn(() => 0),
    cancelAnimation: vi.fn(),
    useAnimatedReaction: vi.fn(),
    runOnJS: (fn: (...args: unknown[]) => unknown) => fn,
    Easing,
  };
});

const { useReducedMotionMock } = vi.hoisted(() => ({ useReducedMotionMock: vi.fn(() => false) }));
vi.mock('@/hooks/useReducedMotion', () => ({ useReducedMotion: useReducedMotionMock }));

import { StatusPulseOrb } from '../StatusPulseOrb';
import type { PulseConfig } from '@/types';

const EN_LOCALE = JSON.parse(readFileSync(join(__dirname, '..', '..', 'locales', 'en.json'), 'utf8'));

const testI18n = i18nCore.createInstance();
testI18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  resources: { en: { translation: EN_LOCALE } },
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

function pulseConfig(overrides: Partial<PulseConfig> = {}): PulseConfig {
  return {
    pulseState: 'PEAK',
    pulseIntensity: 0.5,
    pulseSpeed: 0.5,
    glowStrength: 0.5,
    waveBehavior: 'sharp_outward',
    colorMode: 'lime',
    deltaMode: 'steady',
    animations: { burstOnIntake: true, flareOnPeak: true, collapseOnDepletion: false },
    ...overrides,
  };
}

let host: HTMLElement;
let root: Root;

function renderOrb(props: Partial<React.ComponentProps<typeof StatusPulseOrb>> = {}) {
  root = createRoot(host);
  const merged: React.ComponentProps<typeof StatusPulseOrb> = {
    pulseConfig: pulseConfig(),
    score: 82,
    ...props,
  };
  flushSync(() =>
    root.render(
      React.createElement(I18nextProvider, { i18n: testI18n }, React.createElement(StatusPulseOrb, merged)),
    ),
  );
}

const q = (sel: string) => host.querySelector(sel);

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

describe('StatusPulseOrb — primary CTA accessibility (RC-1 P0 a11y)', () => {
  it('the tap target has an explicit button role', () => {
    renderOrb({ score: 82, pulseConfig: pulseConfig({ colorMode: 'lime' }) });
    const btn = q('[role="button"]');
    expect(btn).not.toBeNull();
  });

  it('composes score + band into the accessible label (PEAK/lime)', () => {
    renderOrb({ score: 82, pulseConfig: pulseConfig({ colorMode: 'lime' }) });
    const btn = q('[role="button"]');
    expect(btn?.getAttribute('aria-label')).toBe('82 Peak. Tap for breakdown');
  });

  it('composes score + band into the accessible label (DEPLETED/red)', () => {
    renderOrb({ score: 14, pulseConfig: pulseConfig({ colorMode: 'red', waveBehavior: 'collapsing' }) });
    const btn = q('[role="button"]');
    expect(btn?.getAttribute('aria-label')).toBe('14 Depleted. Tap for breakdown');
  });

  it('rounds a fractional score in the composed label', () => {
    renderOrb({ score: 81.6, pulseConfig: pulseConfig({ colorMode: 'teal', waveBehavior: 'steady_outward' }) });
    const btn = q('[role="button"]');
    expect(btn?.getAttribute('aria-label')).toBe('82 Balanced. Tap for breakdown');
  });

  it('label never announces just a bare number', () => {
    renderOrb({ score: 55, pulseConfig: pulseConfig({ colorMode: 'amber', waveBehavior: 'uneven_outward' }) });
    const btn = q('[role="button"]');
    const label = btn?.getAttribute('aria-label') ?? '';
    expect(label).not.toBe('55');
    expect(label.length).toBeGreaterThan(2);
  });
});
