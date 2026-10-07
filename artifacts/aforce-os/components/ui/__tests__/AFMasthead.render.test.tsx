// @vitest-environment happy-dom
/**
 * AFMasthead — the Black Issue screen head (docs/black-issue-restyle-plan.md,
 * founder decision D5). Locks the accessibility shape, not the pixels:
 *   - the STATEMENT is the screen's header; the wordmark is decorative and
 *     never announced;
 *   - the back control is a real button with the caller's label;
 *   - furniture (breadcrumb / meta) renders uppercase but is AUTHORED in
 *     sentence case, so the i18n strings stay readable;
 *   - nothing renders for an absent value (no placeholder meta, no empty
 *     header) — the masthead never invents a value.
 */
import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../../Icon', () => ({
  Icon: ({ name }: { name: string }) => React.createElement('span', { 'data-icon': name }),
}));

import { AFMasthead, AF_WORDMARK } from '../AFMasthead';

let host: HTMLElement;
let root: Root;

function render(props: React.ComponentProps<typeof AFMasthead>) {
  root = createRoot(host);
  flushSync(() => root.render(React.createElement(AFMasthead, props)));
}

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
});

afterEach(() => {
  flushSync(() => root.unmount());
  host.remove();
});

describe('AFMasthead — accessibility shape', () => {
  it('the statement is the only header; the wordmark is decorative', () => {
    render({ breadcrumb: 'Home / Hydrostate', title: 'Recovering.', meta: 'New York · 72°F' });
    const headers = host.querySelectorAll('[role="heading"]');
    expect(headers).toHaveLength(1);
    expect(headers[0].textContent).toBe('Recovering.');
    const wordmark = Array.from(host.querySelectorAll('*')).find((el) => el.textContent === AF_WORDMARK && el.children.length === 0);
    expect(wordmark).toBeDefined();
    expect(wordmark?.getAttribute('aria-hidden')).toBe('true');
  });

  it('furniture renders uppercase from sentence-case input', () => {
    render({ breadcrumb: 'Cruise mode / Sea day', meta: 'Cozumel · 1:12 PM' });
    expect(host.textContent).toContain('CRUISE MODE / SEA DAY');
    expect(host.textContent).toContain('COZUMEL · 1:12 PM');
    expect(host.textContent).not.toContain('Cruise mode');
  });

  it('the back control is a labelled button', () => {
    const onBack = vi.fn();
    render({ breadcrumb: 'Sweat intelligence / Calculator', onBack, backLabel: 'Go back', testID: 'mast' });
    const btn = host.querySelector('[data-testid="mast-back"]') as HTMLElement | null;
    expect(btn).not.toBeNull();
    expect(btn?.getAttribute('role')).toBe('button');
    expect(btn?.getAttribute('aria-label')).toBe('Go back');
    btn?.click();
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('absent values render nothing — no placeholder meta, no empty header', () => {
    render({ title: 'Devices.' });
    expect(host.querySelectorAll('[role="heading"]')).toHaveLength(1);
    expect(host.querySelector('[data-icon]')).toBeNull();
    expect(host.textContent).toBe(`${AF_WORDMARK}Devices.`);
  });

  it('wordmark={false} drops the wordmark row entirely', () => {
    render({ wordmark: false, title: 'Scan.' });
    expect(host.textContent).toBe('Scan.');
  });
});
