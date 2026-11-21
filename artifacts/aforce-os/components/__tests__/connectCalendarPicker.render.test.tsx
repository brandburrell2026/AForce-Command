// @vitest-environment happy-dom
/**
 * Connect calendars — account labels so work and personal are
 * distinguishable, the plain statements, missing-calendar help, and Look again.
 */
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../locales/en.json';

const h = vi.hoisted(() => ({
  calendars: [] as Array<{ id: string; title: string; sourceName: string; sourceType?: string }>,
  list: vi.fn(),
}));
const lookup = (path: string): string =>
  path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], en) as string;

vi.mock('expo-router', () => ({ useRouter: () => ({ back: vi.fn() }) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => lookup(k) }) }));
vi.mock('@/components/Icon', () => ({ Icon: () => null }));
vi.mock('@/components/ui', () => {
  const Btn = ({ label, onPress, testID }: { label: string; onPress: () => void; testID?: string }) => (
    <button data-testid={testID} onClick={onPress}>{label}</button>
  );
  const Box = ({ children, testID }: { children?: React.ReactNode; testID?: string }) => (
    <div data-testid={testID}>{children}</div>
  );
  return {
    AFScreen: Box,
    AFTopBar: () => null,
    AFCard: Box,
    AFSectionLabel: () => null,
    AFPrimaryButton: Btn,
    AFTextButton: Btn,
  };
});
vi.mock('@/services/demoMode', () => ({ DEMO_MODE: false, CAPTURE_MODE: false }));
vi.mock('@/services/calendarMoments', () => ({ refreshCalendarMoments: vi.fn() }));
vi.mock('@/services/calendarBridge', () => ({
  getCalendarPermission: async () => 'granted',
  requestCalendarPermission: async () => 'granted',
  listDeviceCalendars: (...a: unknown[]) => h.list(...a),
  getCalendarPrefs: async () => ({ connected: true, selectedCalendarIds: [], categories: ['work'] }),
  setCalendarPrefs: async () => {},
  disconnectCalendar: async () => {},
  DEFAULT_CALENDAR_PREFS: { connected: false, selectedCalendarIds: [], categories: ['work'] },
}));

import { ConnectCalendarScreen } from '../moments/ConnectCalendarScreen';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let host: HTMLDivElement;
const byId = (id: string) => host.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const mount = async () => act(async () => root.render(<ConnectCalendarScreen />));

beforeEach(() => {
  h.calendars = [
    { id: '1', title: 'Calendar', sourceName: 'me@work.example', sourceType: 'com.google' },
    { id: '2', title: 'Calendar', sourceName: 'me@home.example', sourceType: 'com.google' },
    { id: '3', title: 'Holidays', sourceName: 'Subscribed', sourceType: 'subscribed' },
    { id: '4', title: 'Mystery', sourceName: 'Other', sourceType: 'com.unknown.thing' },
  ];
  h.list.mockReset();
  h.list.mockImplementation(async () => h.calendars);
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe('calendar picker', () => {
  it('labels each account so two calendars with the same name are told apart', async () => {
    await mount();
    expect(byId('calendar-source-me@work.example')!.textContent).toBe('me@work.example · Google account');
    expect(byId('calendar-source-me@home.example')!.textContent).toBe('me@home.example · Google account');
    expect(byId('calendar-source-Subscribed')!.textContent).toBe('Subscribed · Subscribed calendar');
  });

  it('shows the account name alone when the phone gives no recognised kind (never guesses a provider)', async () => {
    await mount();
    expect(byId('calendar-source-Other')!.textContent).toBe('Other');
  });

  it('states plainly that only the chosen calendars are read', async () => {
    await mount();
    expect(byId('calendar-reads-only-selected')!.textContent).toBe(en.moments.calendar.reads_only_selected);
    expect(en.moments.calendar.reads_only_selected).toMatch(/only from the calendars you turn on/);
  });

  it('explains the iPhone full-access prompt in the words the member will see', () => {
    expect(en.moments.calendar.ios_full_access).toMatch(/no read-only/);
    expect(en.moments.calendar.ios_full_access).toMatch(/full access/);
    expect(en.moments.calendar.ios_full_access).toMatch(/only reads/);
  });

  it('offers setup help for a missing calendar and re-lists on Look again', async () => {
    await mount();
    expect(byId('calendar-missing-help')!.textContent).toContain('Missing a calendar?');
    h.calendars = [...h.calendars, { id: '5', title: 'New', sourceName: 'new@x.example', sourceType: 'com.google' }];
    await act(async () => byId('calendar-look-again')!.click());
    expect(h.list).toHaveBeenCalledTimes(2);
    expect(byId('calendar-source-new@x.example')).not.toBeNull();
  });

  it('says so when the phone lists no calendars at all', async () => {
    h.calendars = [];
    await mount();
    expect(byId('calendar-none-found')).not.toBeNull();
    expect(byId('calendar-look-again')).not.toBeNull();
  });
});
