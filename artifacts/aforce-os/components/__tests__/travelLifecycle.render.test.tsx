// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';

const mock = vi.hoisted(() => ({
  enabled: true, setEnabled: vi.fn(), sync: vi.fn(async () => {}), canOpen: vi.fn(async () => false), push: vi.fn(),
  listener: null as null | (() => void), scope: { status: 'AUTHENTICATED', userId: 'A' } as { status: string; userId?: string },
  taps: null as null | ((hash: string, createdAt: string) => Promise<void>), unsubscribe: vi.fn(),
}));
vi.mock('@/store/useAppStore', () => ({ useFeatureFlags: () => ({ travel_mode_enabled: mock.enabled }) }));
vi.mock('expo-router', () => ({ useRouter: () => ({ push: mock.push }) }));
vi.mock('@/services/userScope', () => ({
  subscribeScopeState: (fn: () => void) => { mock.listener = fn; return () => {}; },
  getScopeState: () => mock.scope,
  scopeResolved: async () => {},
}));
vi.mock('@/services/travel/runtime', () => ({ travelRuntime: { setEnabled: mock.setEnabled, sync: mock.sync, canOpenReminder: mock.canOpen } }));
vi.mock('@/services/travel/reminderNative', () => ({ observeTravelReminderTaps: async (fn: typeof mock.taps) => { mock.taps = fn; return mock.unsubscribe; } }));
import { TravelLifecycleMount } from '../travel/TravelLifecycleMount';
let host: HTMLDivElement, root: Root, client: QueryClient;
async function render() { await act(async () => { root.render(<QueryClientProvider client={client}><TravelLifecycleMount /></QueryClientProvider>); }); }
beforeEach(() => {
  vi.stubGlobal('__DEV__', true); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); vi.clearAllMocks();
  mock.enabled = true; mock.taps = null; mock.scope = { status: 'AUTHENTICATED', userId: 'A' }; mock.canOpen.mockResolvedValue(false);
  client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); client.clear(); host.remove(); vi.unstubAllGlobals(); });

describe('root travel lifecycle', () => {
  it('syncs on boot/identity changes and disables the runtime at unmount', async () => {
    await render(); expect(mock.setEnabled).toHaveBeenLastCalledWith(true); expect(mock.sync).toHaveBeenCalledOnce();
    mock.listener!(); expect(mock.sync).toHaveBeenCalledTimes(2);
    await act(async () => root.render(null)); expect(mock.setEnabled).toHaveBeenLastCalledWith(false);
  });
  it('clears only the departing account’s travel queries on a confirmed switch/sign-out', async () => {
    await render();
    client.setQueryData(['travel-flight-status-v1', 'A'], 'A status'); client.setQueryData(['travel-journey-v1', 'A'], 'A trip');
    client.setQueryData(['travel-journey-v1', 'B'], 'B trip'); client.setQueryData(['other', 'A'], 'other data');
    mock.scope = { status: 'AUTHENTICATED', userId: 'B' };
    await act(async () => { mock.listener!(); });
    await vi.waitFor(() => expect(client.getQueryData(['travel-journey-v1', 'A'])).toBeUndefined());
    expect(client.getQueryData(['travel-flight-status-v1', 'A'])).toBeUndefined(); expect(client.getQueryData(['travel-journey-v1', 'A'])).toBeUndefined();
    expect(client.getQueryData(['travel-journey-v1', 'B'])).toBe('B trip'); expect(client.getQueryData(['other', 'A'])).toBe('other data');
  });
  it('does not erase caches on an unverifiable identity hop', async () => {
    client.setQueryData(['travel-journey-v1', 'A'], 'A trip'); await render();
    mock.scope = { status: 'UNVERIFIABLE' };
    await act(async () => { mock.listener!(); });
    expect(client.getQueryData(['travel-journey-v1', 'A'])).toBe('A trip');
  });
  it('routes taps only after current ownership and active journey verification', async () => {
    await render(); await mock.taps!('wrong-account-hash', 'created'); expect(mock.push).not.toHaveBeenCalled();
    mock.canOpen.mockResolvedValue(true); await mock.taps!('right-account-hash', 'created'); expect(mock.push).toHaveBeenCalledWith('/travel');
  });
  it('clamps a persisted enabled flag in a public build', async () => {
    vi.stubGlobal('__DEV__', false); vi.stubEnv('EXPO_PUBLIC_INTERNAL_TESTFLIGHT', 'false');
    try { await render(); expect(mock.setEnabled).toHaveBeenLastCalledWith(false); expect(mock.taps).toBeNull(); }
    finally { vi.unstubAllEnvs(); }
  });
});
