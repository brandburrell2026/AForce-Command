// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../locales/en.json';
const state = vi.hoisted(() => ({ scope: { status: 'AUTHENTICATED', userId: 'A' } as any, grants: vi.fn(), activity: vi.fn(), save: vi.fn(), revoke: vi.fn(), appState: 'active', listeners: new Set<(state: string) => void>() }));
vi.mock('@/services/userScope', () => ({ getScopeState: () => state.scope }));
vi.mock('@/services/circleSharingService', () => ({ createCircleSharingClient: () => state }));
vi.mock('@/services/circleMembershipService', () => ({ CircleMembershipError: class extends Error { constructor(public code: string) { super(code); } } }));
vi.mock('@/theme', () => ({ af: { textPrimary: '#ffffff', textSecondary: '#aaaaaa', surface: '#141420', border: '#888888', redText: '#ff7777' } }));
vi.mock('react-native', async original => ({ ...await original<Record<string, unknown>>(), AppState: { get currentState() { return state.appState; }, addEventListener: (_event: string, listener: (state: string) => void) => { state.listeners.add(listener); return { remove: () => state.listeners.delete(listener) }; } } }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string, values: Record<string, unknown> = {}) => {
 const text = (en.community.sharing as Record<string, string>)[key.split('.').pop()!] ?? key;
 return text.replace(/{{(\w+)}}/g, (_match, name: string) => String(values[name] ?? ''));
} }) }));
import { CircleSharingPanel } from '../CircleSharingPanel';
import { CircleMembershipError } from '@/services/circleMembershipService';
const member = { userId: 'friend', name: 'Alex', initials: 'A', group: 'friends' as const, status: 'active' as const, joinedAt: '2026-10-01' };
const grant = (fields: ('score'|'state')[] = [], version = 0) => ({ memberUserId: 'friend', fields, version, acknowledgementVersion: fields.length ? 'circle-sharing-v1' : null });
let root: Root; let host: HTMLDivElement;
async function mount() { await act(async () => root.render(<CircleSharingPanel scope={state.scope} members={[member]} />)); }
async function click(text: string) { const button = Array.from(host.querySelectorAll('[role="button"]')).find(el => el.textContent === text) as HTMLElement; expect(button).toBeTruthy(); await act(async () => button.click()); }
async function toggle(field: string) { const checkbox = host.querySelector(`[role="checkbox"][aria-label="${field} for Alex"]`) as HTMLElement; expect(checkbox).toBeTruthy(); await act(async () => checkbox.click()); }
async function confirmScore() { await toggle('Recorded app score'); await click('Review sharing with Alex'); await click('Confirm sharing settings for Alex'); }
beforeEach(() => {
  vi.clearAllMocks(); state.scope = { status: 'AUTHENTICATED', userId: 'A' }; state.appState = 'active';
  state.grants.mockResolvedValue({ grants: [] }); state.activity.mockResolvedValue({ activity: [] });
  state.save.mockResolvedValue({ grant: grant(['score'], 1) }); state.revoke.mockResolvedValue({ grant: grant([], 2) });
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); });
describe('Circle sharing consent and recorded activity', () => {
  it('starts off and requires explicit recipient-and-field confirmation before a write', async () => {
    await mount();
    expect(Array.from(host.querySelectorAll('[role="checkbox"]')).every(el => el.getAttribute('aria-checked') === 'false')).toBe(true);
    await toggle('Recorded app score');
    expect(state.save).not.toHaveBeenCalled();
    await click('Review sharing with Alex');
    expect(host.textContent).toContain('New recordings will remain visible');
    expect(host.textContent).toContain('Allow Alex');
    expect(state.save).not.toHaveBeenCalled();
    await click('Confirm sharing settings for Alex');
    expect(state.save).toHaveBeenCalledWith('friend', ['score'], 0);
    expect(host.textContent).toContain('Sharing settings for Alex were saved by the server.');
  });
  it('never reports saved consent on failure', async () => {
    state.save.mockRejectedValueOnce(new Error('offline'));
    await mount(); await confirmScore();
    expect(host.textContent).toContain(en.community.sharing.error);
    expect(host.textContent).toContain('Nothing is shared with Alex.');
    expect(host.textContent).not.toContain('were saved by the server');
  });
  it('refreshes a stale version and clears the pending confirmation', async () => {
    await mount();
    state.save.mockRejectedValueOnce(new CircleMembershipError('sharing_version_conflict'));
    state.grants.mockResolvedValue({ grants: [grant(['state'], 3)] });
    await confirmScore();
    expect(host.textContent).toContain(en.community.sharing.conflict);
    expect(host.textContent).toContain('Currently shared with Alex: Recorded app state.');
    expect(host.textContent).not.toContain('Confirm sharing settings for Alex');
    expect(host.textContent).not.toContain('were saved by the server');
  });
  it('waits for server acknowledgement before displaying revocation', async () => {
    state.grants.mockResolvedValue({ grants: [grant(['score'], 1)] });
    let resolve!: (value: unknown) => void;
    state.revoke.mockReturnValue(new Promise(done => { resolve = done; }));
    await mount(); await click('Revoke sharing with Alex'); await click('Confirm sharing settings for Alex');
    expect(state.revoke).toHaveBeenCalledWith('friend', 1);
    expect(host.textContent).toContain('Currently shared with Alex: Recorded app score.');
    await act(async () => resolve({ grant: grant([], 2) }));
    expect(host.textContent).toContain('Nothing is shared with Alex.');
  });
  it('shows only returned recorded fields, and clears them when backgrounded', async () => {
    state.activity.mockResolvedValue({ activity: [{ userId: 'friend', name: 'Alex', score: 77, recordedAt: new Date().toISOString(), source: 'recorded_app_data' }] });
    await mount();
    expect(host.textContent).toContain('Recorded app score: 77');
    expect(host.textContent).not.toContain('Recorded app state:');
    await act(async () => { state.appState = 'background'; state.listeners.forEach(fn => fn('background')); });
    expect(host.textContent).not.toContain('Recorded app score: 77');
    state.activity.mockResolvedValue({ activity: [] });
    await act(async () => { state.appState = 'active'; state.listeners.forEach(fn => fn('active')); });
    expect(host.textContent).toContain(en.community.sharing.activity_empty);
  });
  it('discards activity that resolves after the account changes', async () => {
    let resolve!: (value: unknown) => void;
    state.activity.mockReturnValueOnce(new Promise(done => { resolve = done; }));
    await mount(); state.scope = { status: 'AUTHENTICATED', userId: 'B' };
    await act(async () => resolve({ activity: [{ userId: 'friend', name: 'Private Alex', score: 99 }] }));
    expect(host.textContent).not.toContain('Private Alex');
  });
  it('keeps authoritative revocation available when activity is disabled on the server', async () => {
    state.grants.mockResolvedValue({ grants: [grant(['score'], 1)] });
    state.activity.mockRejectedValue(new CircleMembershipError('circle_sharing_unavailable'));
    await mount();
    expect(host.textContent).toContain(en.community.sharing.activity_unavailable);
    await click('Revoke sharing with Alex'); await click('Confirm sharing settings for Alex');
    expect(state.revoke).toHaveBeenCalledWith('friend', 1);
    expect(host.textContent).toContain('Nothing is shared with Alex.');
  });
  it('offers only existing-grant revocation when the local sharing pilot is off', async () => {
    state.grants.mockResolvedValue({ grants: [grant(['state'], 1)] });
    await act(async () => root.render(<CircleSharingPanel scope={state.scope} members={[member]} enabled={false} />));
    expect(state.activity).not.toHaveBeenCalled();
    expect(host.querySelector('[role="checkbox"]')).toBeNull();
    expect(host.textContent).not.toContain(en.community.sharing.activity);
    await click('Revoke sharing with Alex'); await click('Confirm sharing settings for Alex');
    expect(state.revoke).toHaveBeenCalledWith('friend', 1);
    expect(state.save).not.toHaveBeenCalled();
  });
  it('does not display old, empty, or unrecorded activity', async () => {
    state.activity.mockResolvedValue({ activity: [
      { userId: 'old', name: 'Old Record', score: 99, source: 'recorded_app_data', recordedAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString() },
      { userId: 'empty', name: 'Empty Record', source: 'recorded_app_data', recordedAt: new Date().toISOString() },
    ] });
    await mount(); expect(host.textContent).not.toContain('Old Record'); expect(host.textContent).not.toContain('Empty Record');
  });
  it('does not restore grants from a save that resolves while backgrounded', async () => {
    let resolve!: (value: unknown) => void;
    state.save.mockReturnValue(new Promise(done => { resolve = done; }));
    await mount(); await confirmScore();
    await act(async () => { state.appState = 'background'; state.listeners.forEach(fn => fn('background')); });
    await act(async () => resolve({ grant: grant(['score'], 1) }));
    expect(host.textContent).not.toContain('Currently shared with Alex');
    expect(host.textContent).not.toContain('were saved by the server');
  });

});
