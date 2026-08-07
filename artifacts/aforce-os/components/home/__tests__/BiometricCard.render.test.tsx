// @vitest-environment happy-dom
/**
 * BiometricCard — NON-SHIPPING render harness (VS 3.0 P2 migration).
 *
 * Shared chrome for the three Biometric Intelligence cards (Sweat Loss /
 * Performance Forecast / Recovery Load), ported off legacy Colors.* /
 * hardcoded Inter_* strings / raw rgba(255,255,255,·) text onto the af.*
 * system. This harness pins the scaffold's contract: eyebrow, hero metric +
 * label, optional subline, the 3-cell footer, and the low-confidence EST
 * badge. Icon is stubbed to avoid the suite's documented expo-modules-core
 * `__DEV__` load failure.
 */
import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../../Icon', () => ({ Icon: () => null }));

import { BiometricCard } from '../BiometricCard';

const BASE = {
  eyebrow: 'SWEAT LOSS',
  accent: '#1FA35A',
  icon: 'droplet' as const,
  heroValue: '82 oz',
  heroLabel: 'lost today',
  metrics: [
    { label: 'RATE', value: '1.1 L/h' },
    { label: 'REPLACED', value: '60%' },
    { label: 'DEFICIT', value: '32 oz' },
  ],
};

let host: HTMLElement;
let root: Root;

function render(props: Partial<React.ComponentProps<typeof BiometricCard>> = {}) {
  root = createRoot(host);
  flushSync(() => root.render(React.createElement(BiometricCard, { ...BASE, ...props })));
}
const text = () => host.textContent ?? '';

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
});
afterEach(() => {
  flushSync(() => root.unmount());
  host.remove();
});

describe('BiometricCard — VS 3.0 P2 token migration', () => {
  it('renders the eyebrow, hero metric + label, subline, and every footer cell', () => {
    render({ subline: 'Forecast: replace 20 oz in the next hour.' });
    const t = text();
    expect(t).toContain('SWEAT LOSS');
    expect(t).toContain('82 oz');
    expect(t).toContain('lost today');
    expect(t).toContain('Forecast: replace 20 oz in the next hour.');
    expect(t).toContain('RATE');
    expect(t).toContain('1.1 L/h');
    expect(t).toContain('DEFICIT');
    expect(t).toContain('32 oz');
  });

  it('low confidence surfaces the EST badge; high confidence does not', () => {
    render({ confidence: 'low' });
    expect(text()).toContain('EST');
    render({ confidence: 'high' });
    expect(text()).not.toContain('EST');
  });

  it('omits the footer when no metrics are supplied', () => {
    render({ metrics: [] });
    const t = text();
    expect(t).toContain('82 oz');
    expect(t).not.toContain('RATE');
  });
});
