// @vitest-environment happy-dom
/**
 * AFInlineErrorRow — NON-SHIPPING render harness.
 *
 * Pure presentational component (no i18n inside it — message/retryLabel are
 * pre-resolved strings, same convention as `AFErrorState`), so this harness
 * renders it directly with react-dom (no i18next instance needed).
 */
import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/components/Icon', () => ({
  Icon: ({ name }: { name: string }) => React.createElement('span', { 'data-icon': name }),
}));

import { AFInlineErrorRow } from '../AFInlineErrorRow';

let host: HTMLElement;
let root: Root;

function renderRow(props: React.ComponentProps<typeof AFInlineErrorRow>) {
  root = createRoot(host);
  flushSync(() => root.render(React.createElement(AFInlineErrorRow, props)));
}

const q = (sel: string) => host.querySelector(sel);

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
});

afterEach(() => {
  flushSync(() => root.unmount());
  host.remove();
});

describe('AFInlineErrorRow', () => {
  it('renders the message and an accessible alert role carrying that message', () => {
    renderRow({ message: 'Could not start checkout.', onRetry: () => {}, retryLabel: 'Retry' });
    const el = q('[data-testid="err-row"]') ?? q('[role="alert"]');
    expect(el?.getAttribute('role')).toBe('alert');
    expect(el?.getAttribute('aria-label')).toBe('Could not start checkout.');
    expect(host.textContent).toContain('Could not start checkout.');
  });

  it('renders a retry button with the caller-supplied label', () => {
    renderRow({ message: 'Failed.', onRetry: () => {}, retryLabel: 'Try again' });
    const btn = q('[role="button"]');
    expect(btn).not.toBeNull();
    expect(btn?.getAttribute('aria-label')).toBe('Try again');
  });

  it('invokes onRetry exactly once per tap, and never on mount', () => {
    const onRetry = vi.fn();
    renderRow({ message: 'Failed.', onRetry, retryLabel: 'Retry' });
    expect(onRetry).not.toHaveBeenCalled();
    const btn = q('[role="button"]') as HTMLElement;
    flushSync(() => btn.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('forwards testID onto the row container', () => {
    renderRow({ message: 'Failed.', onRetry: () => {}, retryLabel: 'Retry', testID: 'cart-checkout-error' });
    expect(q('[data-testid="cart-checkout-error"]')).not.toBeNull();
  });
});
