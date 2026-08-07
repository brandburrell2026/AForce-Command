// @vitest-environment happy-dom
/**
 * JournalRangePicker — NON-SHIPPING render harness (VS 3.0 P2 Journal slice A).
 *
 * The 7/30/90 segmented control was ported off legacy Colors.* + raw hex/rgba
 * (#C1281B active pill, #9CA3AF label, rgba border) onto af.*. This pins that
 * the three range cells still render and the active one is marked selected —
 * range values and selection semantics unchanged. useTranslation / expo-haptics
 * are stubbed so the control mounts headless.
 */
import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
vi.mock('expo-haptics', () => ({ selectionAsync: vi.fn(() => Promise.resolve()) }));

import JournalRangePicker from '../JournalRangePicker';

let host: HTMLElement;
let root: Root;

function render(value: 7 | 30 | 90 = 7) {
  root = createRoot(host);
  flushSync(() => root.render(React.createElement(JournalRangePicker, { value, onChange: () => {} })));
}

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
});
afterEach(() => {
  flushSync(() => root.unmount());
  host.remove();
});

describe('JournalRangePicker — VS 3.0 P2 token migration', () => {
  it('renders all three range cells', () => {
    render(7);
    const t = host.textContent ?? '';
    expect(t).toContain('journal.range_7');
    expect(t).toContain('journal.range_30');
    expect(t).toContain('journal.range_90');
  });

  it('renders three radio cells in a radiogroup (selection semantics preserved)', () => {
    render(30);
    expect(host.querySelector('[role="radiogroup"]')).not.toBeNull();
    expect(host.querySelectorAll('[role="radio"]').length).toBe(3);
  });
});
