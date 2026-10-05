// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import en from '../../../locales/en.json';
const state = vi.hoisted(() => ({
  scope: { status: 'AUTHENTICATED', userId: 'A' } as object,
  listeners: new Set<() => void>(),
  list: vi.fn(),
  invitations: vi.fn(),
  invite: vi.fn(),
  accept: vi.fn(),
  remove: vi.fn(),
  revoke: vi.fn(),
}));
vi.mock('@/services/userScope', () => ({
  getScopeState: () => state.scope,
  subscribeScopeState: (fn: () => void) => {
    state.listeners.add(fn);
    return () => state.listeners.delete(fn);
  },
}));
vi.mock('@/services/circleMembershipService', () => ({
  createCircleMembershipClient: () => state,
  CircleMembershipError: class extends Error {},
}));
vi.mock('@/theme', () => ({
  af: {
    textPrimary: '#ffffff',
    textSecondary: '#aaaaaa',
    surface: '#141420',
    border: '#888888',
    redText: '#ff7777',
  },
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      (en.community.members as Record<string, string>)[key.split('.').pop()!] ??
      key,
  }),
}));
import { CircleMembersPanel } from '../CircleMembersPanel';
let host: HTMLDivElement;
let root: Root;
async function mount() {
  await act(async () => {
    root.render(<CircleMembersPanel />);
  });
}
async function click(label: string) {
  const button = Array.from(host.querySelectorAll('[role="button"]')).find(
    (el) => el.textContent === label,
  ) as HTMLElement;
  expect(button).toBeTruthy();
  await act(async () => button.click());
}
async function input(label: string, value: string) {
  const field = host.querySelector(
    `[aria-label="${label}"]`,
  ) as HTMLInputElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )!.set!.call(field, value);
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  state.scope = { status: 'AUTHENTICATED', userId: 'A' };
  state.list.mockResolvedValue({ users: [] });
  state.invitations.mockResolvedValue({ invitations: [] });
  state.invite.mockResolvedValue({
    invitation: { id: 'invite1' },
    code: 'secret-code',
  });
  state.accept.mockResolvedValue({ user: {} });
  state.remove.mockResolvedValue({ removed: 'friend' });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
describe('Circle membership panel', () => {
  it('shows loading, then honest empty state, and refreshes remotely accepted members', async () => {
    let resolve!: (data: unknown) => void;
    state.list.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    await mount();
    expect(host.textContent).toContain(en.community.members.loading);
    expect(host.textContent).not.toContain(en.community.members.empty);
    await act(async () => resolve({ users: [] }));
    expect(host.textContent).toContain(en.community.members.empty);
    state.list.mockResolvedValue({
      users: [{ userId: 'friend', name: 'Real Friend' }],
    });
    await click(en.community.members.retry);
    expect(host.textContent).toContain('Real Friend');
  });
  it('shows request failure without inventing an empty Circle and retries', async () => {
    state.list.mockRejectedValueOnce(new Error('offline'));
    await mount();
    expect(host.textContent).toContain(en.community.members.error);
    expect(host.textContent).not.toContain(en.community.members.empty);
    await click(en.community.members.retry);
    expect(host.textContent).toContain(en.community.members.empty);
  });
  it('requires explicit name and only displays an invite after server success', async () => {
    await mount();
    state.invitations.mockResolvedValue({
      invitations: [
        { id: 'invite1', status: 'pending', expiresAt: '2026-10-12' },
      ],
    });
    await input(en.community.members.name, 'Alice');
    await click(en.community.members.create);
    expect(state.invite).toHaveBeenCalledWith('Alice');
    expect(host.textContent).toContain('secret-code');
  });
  it('clears member names and late responses immediately on account switch', async () => {
    state.list.mockResolvedValueOnce({
      users: [{ userId: 'friend', name: 'Private A Friend' }],
    });
    await mount();
    expect(host.textContent).toContain('Private A Friend');
    let resolve!: (data: unknown) => void;
    state.list.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    await act(async () => {
      state.scope = { status: 'AUTHENTICATED', userId: 'B' };
      state.listeners.forEach((fn) => fn());
    });
    expect(host.textContent).not.toContain('Private A Friend');
    await act(async () => {
      state.scope = { status: 'ANONYMOUS' };
      state.listeners.forEach((fn) => fn());
    });
    await act(async () =>
      resolve({ users: [{ userId: 'B', name: 'Late B Friend' }] }),
    );
    expect(host.textContent).not.toContain('Late B Friend');
    expect(host.textContent).toContain(en.community.members.sign_in);
  });
  it('asks for confirmation and waits for the server before removing', async () => {
    state.list.mockResolvedValue({
      users: [{ userId: 'friend', name: 'Real Friend' }],
    });
    await mount();
    await click(en.community.members.remove);
    expect(state.remove).not.toHaveBeenCalled();
    state.list.mockResolvedValue({ users: [] });
    await click(en.community.members.confirm_remove);
    expect(state.remove).toHaveBeenCalledWith('friend');
    expect(host.textContent).not.toContain('Real Friend');
  });
  it('accepts pasted codes and reports a saved mutation even if refresh fails', async () => {
    await mount();
    await input(en.community.members.name, 'Alice');
    await input(en.community.members.paste, 'friend-code');
    state.list.mockRejectedValueOnce(new Error('offline'));
    await click(en.community.members.accept);
    expect(state.accept).toHaveBeenCalledWith('friend-code', 'Alice');
    expect(host.textContent).toContain(en.community.members.saved);
    expect(host.textContent).toContain(en.community.members.refresh_error);
    expect(host.textContent).not.toContain(en.community.members.empty);
  });
  it('removes a one-time code after the invitation is accepted remotely', async () => {
    await mount();
    state.invitations.mockResolvedValue({
      invitations: [
        { id: 'invite1', status: 'pending', expiresAt: '2026-10-12' },
      ],
    });
    await input(en.community.members.name, 'Alice');
    await click(en.community.members.create);
    expect(host.textContent).toContain('secret-code');
    state.invitations.mockResolvedValue({
      invitations: [
        { id: 'invite1', status: 'accepted', expiresAt: '2026-10-12' },
      ],
    });
    await click(en.community.members.retry);
    expect(host.textContent).not.toContain('secret-code');
    expect(host.textContent).not.toContain(en.community.members.saved);
  });
  it('ignores a superseded StrictMode load failure after the latest load succeeds', async () => {
    let reject!: (error: Error) => void;
    state.list.mockReturnValueOnce(
      new Promise((_resolve, fail) => {
        reject = fail;
      }),
    );
    state.list.mockResolvedValue({
      users: [{ userId: 'friend', name: 'Latest Friend' }],
    });
    await act(async () => {
      root.render(
        <React.StrictMode>
          <CircleMembersPanel />
        </React.StrictMode>,
      );
    });
    await act(async () => reject(new Error('stale failure')));
    expect(host.textContent).toContain('Latest Friend');
    expect(host.textContent).not.toContain(en.community.members.error);
  });
  it('labels muted connections neutrally and keeps removal available', async () => {
    state.list.mockResolvedValue({
      users: [
        { userId: 'muted-friend', name: 'Quiet Friend', status: 'muted' },
      ],
    });
    await mount();
    expect(host.textContent).toContain('Quiet Friend');
    expect(host.textContent).toContain(en.community.members.muted);
    await click(en.community.members.remove);
    state.list.mockResolvedValue({ users: [] });
    await click(en.community.members.confirm_remove);
    expect(state.remove).toHaveBeenCalledWith('muted-friend');
    expect(host.textContent).not.toContain('Quiet Friend');
  });
});
