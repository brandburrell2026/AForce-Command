// @vitest-environment happy-dom
import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';

const state = vi.hoisted(() => ({
  owner: 'account_A' as string | null, enabled: true,
  values: new Map<string, string>(), failWrites: false, pushes: [] as string[],
}));
vi.mock('../travel/TravelFlightStatus', () => ({ TravelFlightStatus: () => <div>Flight status panel</div> }));
vi.mock('@clerk/expo', () => ({ useAuth: () => ({ userId: state.owner, isSignedIn: !!state.owner, isLoaded: true }) }));
vi.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => <div data-redirect={href} />,
  useRouter: () => ({ push: (href: string) => state.pushes.push(href), replace: vi.fn(), back: vi.fn(), canGoBack: () => true }),
}));
vi.mock('@/store/useAppStore', () => ({ useFeatureFlags: () => ({ travel_mode_enabled: state.enabled, moments_enabled: true }) }));
vi.mock('@/components/ui/AFScreen', () => ({ AFScreen: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('@/services/travel/storage', async () => {
  const { createJourneyRepository } = await import('@/services/travel/journey');
  return { journeyRepository: createJourneyRepository({
    getItem: async key => state.values.get(key) ?? null,
    setItem: async (key, value) => { if (state.failWrites) throw new Error('keychain locked'); state.values.set(key, value); },
    removeItem: async key => { state.values.delete(key); },
  }) };
});
vi.mock('@/services/travel/runtime', async () => {
  const { journeyRepository } = await import('@/services/travel/storage');
  const snapshot = { owner: 'account_A', state: 'off' as const, fireAt: null };
  return { travelRuntime: {
    captureOwner: (owner: string) => () => state.owner === owner,
    subscribe: () => () => {}, snapshot: () => snapshot,
    choose: async () => {},
    changeJourney: (owner: string, action: { kind: string; input: never }) => action.kind === 'save' ? journeyRepository.save(owner, action.input)
      : action.kind === 'finish' ? journeyRepository.finish(owner) : journeyRepository.remove(owner),
    clear: async (owner: string) => { await journeyRepository.remove(owner); return { journey: true, preferences: true, reminders: true }; },
  } };
});
import TravelRoute from '../../app/travel';
import { TravelHomeCard } from '../travel/TravelHomeCard';

let host: HTMLDivElement;
let root: Root;
let client: QueryClient;
async function waitUI(assertion: () => void) {
  let last: unknown;
  for (let attempt = 0; attempt < 50; attempt++) {
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });
    try { assertion(); return; } catch (error) { last = error; }
  }
  throw last;
}
async function render() {
  await act(async () => { root.render(<QueryClientProvider client={client}><TravelRoute /><TravelHomeCard /></QueryClientProvider>); });
  await waitUI(() => expect(host.textContent).not.toContain('Loading your journey'));
}
function button(label: string) {
  const result = Array.from(host.querySelectorAll('[role="button"],button')).find(el => el.textContent === label);
  if (!result) throw new Error(`Missing button: ${label}`);
  return result as HTMLElement;
}
async function click(label: string) {
  await act(async () => { button(label).click(); });
}
async function fill() {
  for (const [key, value] of Object.entries({ flightNumber: 'AA123', origin: 'JFK', destination: 'LAX', departureDate: '2026-11-01', departureTime: '14:30', utcOffset: '-05:00' })) {
    const input = host.querySelector(`[data-testid="travel-input-${key}"]`) as HTMLInputElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }
}

beforeEach(() => {
  vi.stubGlobal('__DEV__', true);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  state.owner = 'account_A'; state.enabled = true; state.values.clear(); state.failWrites = false; state.pushes.length = 0;
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); client.clear(); host.remove(); vi.unstubAllGlobals(); });

describe('internal Travel journey', () => {
  it('saves, reopens, finishes and removes a flight, with truthful provenance', async () => {
    await render(); await fill(); await click('Save flight');
    await waitUI(() => expect(host.textContent).toContain('Your journey'));
    expect(host.textContent).toContain('JFK → LAX');
    expect(host.textContent).toContain('UTC-05:00');
    expect(host.textContent).toContain('Manually entered itinerary');
    expect(host.querySelector('[data-testid="travel-home-card"]')).not.toBeNull();
    await click('Open hydration'); await click('Open Moments');
    expect(state.pushes).toEqual(['/(tabs)/journal', '/moments']);
    // Reopen from durable storage rather than the query cache.
    await act(async () => { client.removeQueries({ queryKey: ['travel-journey-v1'] }); });
    await render();
    await waitUI(() => expect(host.textContent).toContain('JFK → LAX'));
    await click('Finish journey');
    await waitUI(() => expect(host.textContent).toContain('Journey finished'));
    const homeCard = host.querySelector('[data-testid="travel-home-card"]') as HTMLElement;
    expect(homeCard).not.toBeNull();
    expect(homeCard.textContent).toContain('Journey finished · open to add another flight');
    await act(async () => { homeCard.click(); });
    expect(state.pushes.at(-1)).toBe('/travel');
    // The completed trip remains reopenable after the query cache is discarded.
    await act(async () => { client.removeQueries({ queryKey: ['travel-journey-v1'] }); });
    await render();
    await waitUI(() => expect(host.textContent).toContain('Journey finished'));
    expect(host.querySelector('[data-testid="travel-home-card"]')).not.toBeNull();
    await click('Add another flight');
    expect(host.textContent).toContain('Save flight');
    await click('Cancel');
    await click('Remove journey'); await click('Confirm removal');
    await waitUI(() => expect(host.textContent).toContain('Save flight'));
    expect(state.values.size).toBe(0);
  });
  it('clears another account’s journey and form state immediately on switching', async () => {
    await render(); await fill(); await click('Save flight');
    await waitUI(() => expect(host.textContent).toContain('JFK → LAX'));
    state.owner = 'account_B'; await render();
    expect(host.textContent).not.toContain('JFK → LAX');
    expect((host.querySelector('[data-testid="travel-input-flightNumber"]') as HTMLInputElement).value).toBe('');
    expect(host.textContent).toContain('Save flight');
    state.owner = 'account_A'; await render();
    expect(host.textContent).toContain('JFK → LAX');
  });
  it('shows invalid-date and persistence errors without claiming a saved trip', async () => {
    await render(); await click('Save flight');
    await waitUI(() => expect(host.textContent).toContain('Enter a flight number'));
    await fill(); state.failWrites = true; await click('Save flight');
    await waitUI(() => expect(host.textContent).toContain('We couldn’t save this change'));
    expect(state.values.size).toBe(0);
    expect(host.textContent).not.toContain('Finish journey');
  });
  it('clears the saved trip and account-owned status cache only after confirmation', async () => {
    await render(); await fill(); await click('Save flight');
    await waitUI(() => expect(host.textContent).toContain('JFK → LAX'));
    client.setQueryDefaults(['travel-flight-status-v1'], { gcTime: Infinity });
    client.setQueryData(['travel-flight-status-v1', 'account_A', 'fixture'], { gate: 'A1' });
    client.setQueryData(['travel-flight-status-v1', 'account_B', 'fixture'], { gate: 'B1' });
    await click('Clear travel data from this device');
    expect(state.values.size).toBe(1);
    await click('Confirm clear travel data');
    await waitUI(() => expect(host.textContent).toContain('Save flight'));
    expect(state.values.size).toBe(0);
    expect(client.getQueryData(['travel-flight-status-v1', 'account_A', 'fixture'])).toBeUndefined();
    expect(client.getQueryData(['travel-flight-status-v1', 'account_B', 'fixture'])).toEqual({ gate: 'B1' });
  });
  it('blocks the route and Home card for a public build even with the flag set', async () => {
    vi.stubGlobal('__DEV__', false);
    const previous = process.env.EXPO_PUBLIC_INTERNAL_TESTFLIGHT;
    process.env.EXPO_PUBLIC_INTERNAL_TESTFLIGHT = 'false';
    try {
      await render();
      expect(host.querySelector('[data-redirect="/"]')).not.toBeNull();
      expect(host.textContent).toBe('');
      expect(state.values.size).toBe(0);
    } finally {
      if (previous === undefined) delete process.env.EXPO_PUBLIC_INTERNAL_TESTFLIGHT;
      else process.env.EXPO_PUBLIC_INTERNAL_TESTFLIGHT = previous;
    }
  });
  it('redirects signed-out users and performs no storage writes', async () => {
    state.owner = null; await render();
    expect(host.querySelector('[data-redirect="/(auth)/sign-in"]')).not.toBeNull();
    expect(state.values.size).toBe(0);
  });
});
