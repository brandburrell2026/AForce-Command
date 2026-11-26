// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
const m = vi.hoisted(() => ({ owner: 'A', doc: null as any, save: vi.fn(), nextId: 0 }));
vi.mock('@clerk/expo', () => ({ useAuth: () => ({ userId: m.owner, isLoaded: true }) }));
vi.mock('expo-router', () => ({ useLocalSearchParams: () => ({}), useRouter: () => ({ canGoBack: () => true, back: vi.fn(), replace: vi.fn(), push: vi.fn() }), Redirect: () => null }));
vi.mock('@/store/useAppStore', () => ({ useFeatureFlags: () => ({ travel_mode_enabled: true }) }));
vi.mock('@/featureFlags/flags', () => ({ travelPilotAvailable: () => true }));
vi.mock('expo-crypto', () => ({ randomUUID: () => `test_${++m.nextId}` }));
vi.mock('@/components/ui/AFScreen', () => ({ AFScreen: ({ children }: any) => <div>{children}</div> }));
vi.mock('@/components/world/WorldPhoto', () => ({ WorldPhotoHero: () => null }));
vi.mock('@/components/world/worldPhotoSources', () => ({ worldPhoto: () => null }));
vi.mock('@/hooks/useAFGutter', () => ({ useAFGutter: () => 20 }));
vi.mock('@/hooks/useTravelJourney', () => ({ useTravelJourney: () => ({ query: { data: null } }) }));
vi.mock('@/hooks/useTravelIntelligence', () => ({
  TravelSyncConflict: class extends Error {},
  useTravelIntelligence: () => ({ owner: m.owner, query: { data: m.doc, isError: false }, save: m.save }),
}));
vi.mock('../travel/TravelJourneySection', () => ({ TravelJourneySection: () => null }));
vi.mock('../travel/TravelFlightStatus', () => ({ TravelFlightStatus: ({ flight }: any) => <div data-testid="imported-flight-status">{flight.flightNumber}</div> }));
vi.mock('../travel/SayYourTrip', () => ({ SayYourTrip: () => null }));
vi.mock('../travel/TellAforceYourTrip', () => ({ TellAforceYourTrip: () => <div data-testid="tell-aforce-your-trip" /> }));
vi.mock('@/services/travel/intelligenceReminders', () => ({ enableIntelligenceReminders: vi.fn(), reconcileIntelligenceReminders: vi.fn() }));
vi.mock('@/services/travel/intelligenceNotifications', () => ({ travelDeviceId: vi.fn(), travelPushRegistration: vi.fn() }));
import Route from '../../app/travel-intelligence';
import { emptyTravelDocument } from '@/services/travel/intelligence';

let host: HTMLDivElement, root: Root;
const confirmation = 'Flight AA123\nFrom: JFK\nTo: LAX\nDeparture: December 3, 2026 at 9:05 AM\nArrival: December 3, 2026 at 12:20 PM\nPassenger: Synthetic Person\nConfirmation number: TEST99';
const render = async () => { await act(async () => root.render(<Route />)); };
const button = (label: string) => Array.from(host.querySelectorAll('[role="button"],button')).find(el => el.getAttribute('aria-label') === label || el.textContent === label) as HTMLElement;
const click = async (label: string) => { expect(button(label), label).toBeTruthy(); await act(async () => button(label).click()); };
const type = async (label: string, value: string) => {
  const el = host.querySelector(`[aria-label="${label}"]`) as HTMLInputElement;
  expect(el, label).toBeTruthy();
  const prototype = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  await act(async () => { Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(el, value); el.dispatchEvent(new Event('input', { bubbles: true })); });
};
const review = async (text = confirmation) => { await click('Import a flight confirmation'); await type('Flight confirmation text', text); await click('Review imported flights'); };
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); m.owner = 'A'; m.doc = emptyTravelDocument(); m.nextId = 0;
  m.save.mockReset(); m.save.mockImplementation(async trips => { m.doc = { ...m.doc, trips }; });
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

describe('confirmation → editable review → existing trip owner', () => {
  it('keeps Add a trip on the existing conversation entry; importing is a separate explicit action', async () => {
    await render(); await click('Add a trip');
    expect(host.querySelector('[data-testid="tell-aforce-your-trip"]')).not.toBeNull();
    expect(host.querySelector('[aria-label="Flight confirmation text"]')).toBeNull();
    await click('Import a flight confirmation');
    expect(host.querySelector('[data-testid="tell-aforce-your-trip"]')).toBeNull();
    expect(host.querySelector('[aria-label="Flight confirmation text"]')).not.toBeNull();
    expect(m.save).not.toHaveBeenCalled();
  });
  it('saves nothing before confirmation, preserves edits and airport-local times, and offers a status check', async () => {
    await render(); await review();
    expect(m.save).not.toHaveBeenCalled();
    expect(host.textContent).toContain('From your confirmation');
    expect(host.querySelector('[aria-label="Flight confirmation text"]')).toBeNull();
    await type('Leg 1 Departure time · HH:mm', '10:15');
    await click('Confirm itinerary');
    expect(m.save).toHaveBeenCalledTimes(1);
    const trips = m.save.mock.calls[0]![0];
    expect(trips).toHaveLength(1);
    expect(trips[0].legs[0]).toMatchObject({ flight: { flightNumber: 'AA123', origin: 'JFK', destination: 'LAX', departureDate: '2026-12-03' }, departureAt: '2026-12-03T15:15:00.000Z', originTimeZone: 'America/New_York', destinationTimeZone: 'America/Los_Angeles' });
    expect(JSON.stringify(trips)).not.toMatch(/Synthetic Person|TEST99/);
    expect(host.querySelector('[data-testid="imported-flight-status"]')?.textContent).toBe('AA123');
  });
  it('blocks duplicate active flights and missing dates instead of quietly saving twice or guessing a year', async () => {
    await render(); await review(); await click('Confirm itinerary');
    await review(); await click('Confirm itinerary');
    expect(m.save).toHaveBeenCalledTimes(1);
    expect(host.textContent).toContain('already in an active trip');
    await review(confirmation.replace('December 3, 2026 at 9:05 AM', 'December 3 at 9:05 AM'));
    await click('Confirm itinerary'); expect(m.save).toHaveBeenCalledTimes(1);
  });
  it('does not claim success after storage failure and clears the draft on account switch', async () => {
    await render(); await review();
    m.save.mockRejectedValueOnce(new Error('Storage locked. Try again.'));
    await click('Confirm itinerary');
    expect(host.textContent).toContain('Storage locked');
    expect(host.textContent).not.toContain('Itinerary saved.');
    m.owner = 'B'; m.doc = emptyTravelDocument(); await render();
    expect(host.querySelector('[aria-label="Leg 1 Flight number"]')).toBeNull();
    expect(host.textContent).not.toContain('From your confirmation');
  });
});
