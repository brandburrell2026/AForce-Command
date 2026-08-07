// @vitest-environment happy-dom
/**
 * PerformanceSections — NON-SHIPPING render harness (VS 3.0 P2 Journal slice A).
 *
 * Ported off legacy Colors.* + raw hex/rgba onto af.*. Pins that the section
 * tiles (label/value/hint) and the Win Moments list still render. Icon is
 * stubbed so the strip mounts headless.
 */
import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../../Icon', () => ({ Icon: () => null }));

import PerformanceSections from '../PerformanceSections';

const SECTIONS = [
  { key: 'recovery', label: 'Recovery', value: '78', hint: '+2 today' },
  { key: 'heat', label: 'Heat', value: 'Low', hint: 'mild' },
] as never;

const WINS = [
  { id: 'w1', icon: 'award', text: '7-day ritual streak' },
  { id: 'w2', icon: 'zap', text: 'Best recovery this month' },
] as never;

let host: HTMLElement;
let root: Root;

function render(winMoments: unknown = WINS) {
  root = createRoot(host);
  flushSync(() =>
    root.render(React.createElement(PerformanceSections, { sections: SECTIONS, winMoments: winMoments as never })),
  );
}

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
});
afterEach(() => {
  flushSync(() => root.unmount());
  host.remove();
});

describe('PerformanceSections — VS 3.0 P2 token migration', () => {
  it('renders the section tiles (label uppercased, value, hint)', () => {
    render();
    const t = host.textContent ?? '';
    expect(t).toContain('RECOVERY'); // label is uppercased in-render
    expect(t).toContain('78');
    expect(t).toContain('+2 today');
    expect(t).toContain('HEAT');
  });

  it('renders the Win Moments list when moments are present, and omits it when empty', () => {
    render();
    expect(host.textContent ?? '').toContain('WIN MOMENTS');
    expect(host.textContent ?? '').toContain('7-day ritual streak');
    render([]);
    expect(host.textContent ?? '').not.toContain('WIN MOMENTS');
  });
});
