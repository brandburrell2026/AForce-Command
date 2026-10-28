// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import type { ReminderSnapshot } from '@/services/travel/reminders';
const mock = vi.hoisted(() => ({
  snapshot: { owner: 'A', state: 'off', fireAt: null } as ReminderSnapshot,
  listeners: new Set<() => void>(), choose: vi.fn(), clear: vi.fn(),
}));
vi.mock('react-native', async original => {
  const actual = await original<typeof import('react-native')>();
  return { ...actual, Platform: { ...actual.Platform, OS: 'ios' } };
});
vi.mock('@/services/travel/runtime', () => ({ travelRuntime: {
  snapshot: () => mock.snapshot, subscribe: (listener: () => void) => { mock.listeners.add(listener); return () => { mock.listeners.delete(listener); }; }, choose: mock.choose,
} }));
import { TravelReminderCard } from '../travel/TravelReminderCard';
let host: HTMLDivElement, root: Root;
async function render(owner = 'A') { await act(async () => { root.render(<TravelReminderCard key={owner} owner={owner} onClear={mock.clear} />); }); }
async function click(label: string) {
  const button = Array.from(host.querySelectorAll('[role="button"]')).find(el => el.textContent === label) as HTMLElement;
  if (!button) throw new Error(`Missing ${label}`);
  await act(async () => { button.click(); });
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); vi.clearAllMocks(); mock.listeners.clear();
  mock.snapshot = { owner: 'A', state: 'off', fireAt: null }; mock.choose.mockResolvedValue(undefined);
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

describe('travel reminder and device-data controls', () => {
  it('defaults off and requests a change only after a user action', async () => {
    await render(); expect(host.textContent).toContain('reminders are off'); expect(mock.choose).not.toHaveBeenCalled();
    await click('Enable AForce reminder'); expect(mock.choose).toHaveBeenCalledWith('A', 'aforce');
    await click('Use reminders from another app'); expect(mock.choose).toHaveBeenLastCalledWith('A', 'external');
    expect(host.textContent).toContain('does not change settings in TravelGate');
  });
  it('shows permission/quiet-hour failures without claiming a scheduled reminder', async () => {
    mock.snapshot = { owner: 'A', state: 'permission_required', fireAt: null }; await render();
    expect(host.textContent).toContain('Notification permission is needed'); expect(host.textContent).not.toContain('One AForce preparation reminder is scheduled');
    await act(async () => { mock.snapshot = { owner: 'A', state: 'quiet_hours', fireAt: null }; mock.listeners.forEach(fn => fn()); });
    expect(host.textContent).toContain('No reminder scheduled');
  });
  it('does not expose another account’s reminder schedule and delegates clear to confirmation', async () => {
    mock.snapshot = { owner: 'A', state: 'scheduled', fireAt: '2026-11-01T17:30:00Z' }; await render('B');
    expect(host.textContent).not.toContain('Scheduled for'); expect(host.textContent).toContain('Checking reminder settings');
    await click('Clear travel data from this device'); expect(mock.clear).toHaveBeenCalledOnce();
    expect(mock.choose).not.toHaveBeenCalled();
  });
  it('makes a failed setting update visible', async () => {
    mock.choose.mockRejectedValue(new Error('native failure')); await render(); await click('Turn off AForce reminders');
    expect(host.textContent).toContain('We couldn’t change the reminder setting');
  });
});
