// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { ImportFlightConfirmation } from '../travel/ImportFlightConfirmation';

let host: HTMLDivElement, root: Root;
const onReview = vi.fn(), onCancel = vi.fn();
const confirmation = 'Flight AA123\nFrom: JFK\nTo: LAX\nDeparture: December 3, 2026 at 9 AM\nPassenger: Synthetic Person\nConfirmation: TEST99';
const el = (label: string) => host.querySelector(`[aria-label="${label}"]`) as HTMLElement;
const type = (value: string) => act(() => {
  const input = el('Flight confirmation text');
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!;
  setter.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true }));
});
const render = (busy = false) => act(() => root.render(<ImportFlightConfirmation onReview={onReview} onCancel={onCancel} busy={busy} />));
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); vi.clearAllMocks();
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

describe('confirmation import review boundary', () => {
  it('does nothing on paste; hands off only extracted fields on Review and clears the raw text', () => {
    render(); type(confirmation);
    expect(onReview).not.toHaveBeenCalled();
    act(() => el('Review imported flights').click());
    expect(onReview).toHaveBeenCalledTimes(1);
    expect(onReview.mock.calls[0]![0].legs[0]).toMatchObject({ flightNumber: 'AA123', date: '2026-12-03', time: '09:00' });
    expect(JSON.stringify(onReview.mock.calls)).not.toContain('Synthetic Person');
    expect(JSON.stringify(onReview.mock.calls)).not.toContain('TEST99');
    expect((el('Flight confirmation text') as HTMLTextAreaElement).value).toBe('');
  });
  it('keeps unsupported text editable, explains the problem and never hands it off as a trip', () => {
    render(); type('Confirmation number: AA123');
    act(() => el('Review imported flights').click());
    expect(host.textContent).toContain('No clear flight number');
    expect(onReview).not.toHaveBeenCalled();
    expect((el('Flight confirmation text') as HTMLTextAreaElement).value).toBe('Confirmation number: AA123');
  });
  it('cancels and clears pasted text, and prevents review while a save is busy', () => {
    render(); type(confirmation); render(true);
    act(() => el('Review imported flights').click()); expect(onReview).not.toHaveBeenCalled();
    render(); act(() => el('Cancel confirmation import').click());
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect((el('Flight confirmation text') as HTMLTextAreaElement).value).toBe('');
  });
});
