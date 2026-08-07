// @vitest-environment happy-dom
/**
 * KPISummary — NON-SHIPPING render harness (VS 3.0 P2 Journal slice A).
 *
 * Finished the partial af.* migration: trend colors → af.green/af.amber
 * (byte-identical to Colors.states.PEAK/RECOVERING.primary), Colors.text.* →
 * af.*, Inter_* → afType. Pins that all three KPI cards render label + value +
 * signed trend. Icon is stubbed so the row mounts headless.
 */
import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@/components/Icon', () => ({ Icon: () => null }));

import KPISummary from '../KPISummary';

const KPIS = [
  { label: 'AVG SCORE', value: '82', accent: '#1FA35A', delta: 4, deltaSuffix: '' },
  { label: 'STREAK', value: '5d', accent: '#00E5C8', delta: -1, deltaSuffix: 'd' },
  { label: 'RITUALS', value: '18', accent: '#C1281B', delta: null },
] as const;

let host: HTMLElement;
let root: Root;

function render() {
  root = createRoot(host);
  flushSync(() => root.render(React.createElement(KPISummary, { kpis: KPIS as never })));
}

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
});
afterEach(() => {
  flushSync(() => root.unmount());
  host.remove();
});

describe('KPISummary — VS 3.0 P2 token migration', () => {
  it('renders all three KPI labels, values, and signed trends', () => {
    render();
    const t = host.textContent ?? '';
    expect(t).toContain('AVG SCORE');
    expect(t).toContain('82');
    expect(t).toContain('+4'); // positive trend gets a leading +
    expect(t).toContain('STREAK');
    expect(t).toContain('-1d'); // negative trend keeps its sign + suffix
    expect(t).toContain('RITUALS');
    expect(t).toContain('18');
  });
});
