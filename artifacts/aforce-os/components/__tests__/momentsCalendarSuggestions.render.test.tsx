// @vitest-environment happy-dom
/**
 * Moments calendar page — suggestions from the chosen calendars, "Prepare for
 * this", the changed-event notice on a sealed plan, and the honest empty,
 * not-connected, no-access and error states.
 */
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Moment } from '@/types/moments';

const h = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(async () => {}),
  flags: { moments_enabled: true, moments_calendar_enabled: true },
  surfaced: [] as Moment[],
  status: 'ready' as string,
  snapshot: null as null | { events: unknown[]; window: { startIso: string; endIso: string } },
  nowIso: '',
}));
vi.mock('expo-router', () => ({
  useRouter: () => ({ push: h.push, back: vi.fn(), replace: vi.fn(), canGoBack: () => true }),
  Redirect: () => null,
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
vi.mock('@/components/Icon', () => ({ Icon: () => null }));
vi.mock('@/components/world/WorldPhoto', () => ({ WorldPhotoHero: () => null }));
vi.mock('@/components/world/worldPhotoSources', () => ({ worldPhoto: () => 0 }));
vi.mock('@/components/ui', () => ({
  AFScreen: ({ children, testID }: { children: React.ReactNode; testID?: string }) => (
    <div data-testid={testID}>{children}</div>
  ),
}));
vi.mock('@/store/useAppStore', () => ({ useFeatureFlags: () => h.flags }));
vi.mock('@/services/demoMode', () => ({ DEMO_MODE: false, CAPTURE_MODE: false }));
vi.mock('@/components/moments/useMomentsData', () => ({
  useMomentsData: () => ({ hydrated: true, nowIso: h.nowIso, surfaced: h.surfaced }),
}));
vi.mock('@/services/calendarMoments', () => ({
  refreshCalendarMoments: (...a: unknown[]) => h.refresh(...(a as [])),
  useCalendarReadStatus: () => h.status,
  useCalendarSnapshot: () => h.snapshot,
}));

import { MomentsCalendarScreen } from '../moments/cinematic/MomentsCalendarScreen';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let host: HTMLDivElement;
const NOW = new Date(2026, 10, 21, 12);
const at = (hours: number) => new Date(NOW.getTime() + hours * 3_600_000).toISOString();
const cal = (id: string, title: string, hours: number, over: Partial<Moment> = {}): Moment => ({
  id,
  source: 'calendar',
  title,
  type: 'work',
  importance: 'high',
  startAtIso: at(hours),
  calendarEventId: `evt-${id}`,
  createdAtIso: at(-1),
  ...over,
});
const mount = async () => act(async () => root.render(<MomentsCalendarScreen />));
const byId = (id: string) => host.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;

beforeEach(() => {
  h.push.mockReset();
  h.refresh.mockClear();
  h.flags = { moments_enabled: true, moments_calendar_enabled: true };
  h.status = 'ready';
  h.snapshot = null;
  h.surfaced = [];
  h.nowIso = NOW.toISOString();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe('suggestions and Prepare for this', () => {
  it('shows each eligible event with its title, date and time, and a Prepare for this button', async () => {
    h.surfaced = [cal('cal-a@1', 'Investor call', 3)];
    await mount();
    const card = byId('moments-calendar-suggestion-cal-a@1')!;
    expect(card.textContent).toContain('Investor call');
    expect(card.textContent).toContain('Saturday, November 21');
    expect(card.textContent).toContain('Prepare for this');
  });

  it('Prepare for this opens One Breath for that Moment with proposal=1', async () => {
    h.surfaced = [cal('cal-a@1', 'Investor call', 3)];
    await mount();
    await act(async () => byId('moments-calendar-prepare-cal-a@1')!.click());
    expect(h.push).toHaveBeenCalledWith({ pathname: '/one-breath', params: { momentId: 'cal-a@1', proposal: '1' } });
  });

  it('leaves masked, untitled and prepared events out, and lists a calendar event once (not also as a row)', async () => {
    h.surfaced = [
      cal('m', '', 3, { masked: true }),
      cal('p', 'Board meeting', 4, { preparedAtIso: at(-1) }),
      cal('ok', 'Team lift', 5, { type: 'training' }),
    ];
    await mount();
    expect(byId('moments-calendar-suggestion-m')).toBeNull();
    expect(byId('moments-calendar-suggestion-p')).toBeNull();
    expect(byId('moments-calendar-suggestion-ok')).not.toBeNull();
    expect(byId('moments-calendar-row-ok')).toBeNull();
  });

  it('opens and pull-refreshes through the same refresh, forced past the throttle', async () => {
    await mount();
    expect(h.refresh).toHaveBeenCalledWith(true);
  });

  it('shows nothing about phone calendars when the flag is off', async () => {
    h.flags.moments_calendar_enabled = false;
    h.surfaced = [cal('cal-a@1', 'Investor call', 3)];
    await mount();
    expect(byId('moments-calendar-suggestions')).toBeNull();
    expect(byId('moments-calendar-connect')).toBeNull();
    expect(h.refresh).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Your AFORCE Moments · not your calendar app');
  });

  it('names the connection entry Connect calendars', async () => {
    await mount();
    expect(byId('moments-calendar-connect')!.textContent).toContain('Connect calendars');
  });
});

describe('honest states', () => {
  it.each([
    ['idle', 'moments-calendar-suggestions-loading'],
    ['not_connected', 'moments-calendar-suggestions-not-connected'],
    ['no_access', 'moments-calendar-suggestions-no-access'],
    ['read_failed', 'moments-calendar-suggestions-error'],
    ['ready', 'moments-calendar-suggestions-empty'],
  ])('%s', async (status, testId) => {
    h.status = status;
    await mount();
    expect(byId(testId)).not.toBeNull();
  });

  it('Try again re-reads, forced', async () => {
    h.status = 'read_failed';
    await mount();
    h.refresh.mockClear();
    await act(async () => byId('moments-calendar-retry')!.click());
    expect(h.refresh).toHaveBeenCalledWith(true);
  });
});

describe('a sealed plan whose calendar event changed', () => {
  const sealed = (): Moment => ({
    id: 'plan-1',
    source: 'manual',
    title: 'Investor call',
    type: 'work',
    importance: 'high',
    startAtIso: at(3),
    createdAtIso: at(-20),
    calendarSource: { eventId: 'evt-1', startAtIso: at(3) },
    preparation: { sealedAtIso: at(-10) } as Moment['preparation'],
  });
  const window = { startIso: at(-6), endIso: at(48) };

  it('says "Calendar event changed", keeps the plan, and lets the member open it', async () => {
    h.surfaced = [sealed()];
    h.snapshot = {
      events: [{ id: 'evt-1', title: 'Investor call', startAtIso: at(5), calendarId: 'c' }],
      window,
    };
    await mount();
    const note = byId('moments-calendar-changed-plan-1')!;
    expect(note.textContent).toContain('Calendar event changed');
    expect(note.textContent).toContain('Your plan has not changed');
    await act(async () => byId('moments-calendar-row-plan-1')!.click());
    expect(h.push).toHaveBeenCalledWith('/moment/plan-1');
  });

  it('says nothing when the event is unchanged or the calendar was not read', async () => {
    h.surfaced = [sealed()];
    h.snapshot = {
      events: [{ id: 'evt-1', title: 'Investor call', startAtIso: at(3), calendarId: 'c' }],
      window,
    };
    await mount();
    expect(byId('moments-calendar-changed-plan-1')).toBeNull();
    h.snapshot = null;
    await mount();
    expect(byId('moments-calendar-changed-plan-1')).toBeNull();
  });
});
