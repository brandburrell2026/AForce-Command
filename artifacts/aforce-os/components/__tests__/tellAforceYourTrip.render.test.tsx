// @vitest-environment happy-dom
/**
 * "Tell AFORCE your trip": one sentence, one card, one tap. Typing works
 * everywhere, voice where the phone has it, and nothing is saved without
 * Confirm.
 */
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

type Info = { final: boolean; confidence?: number };
const h = vi.hoisted(() => ({
  available: true,
  listening: false,
  busy: false,
  error: '',
  start: vi.fn(async () => {}),
  stop: vi.fn(),
  emit: (_text: string, _info: Info) => {},
}));
vi.mock('@/components/Icon', () => ({ Icon: () => null }));
vi.mock('@/hooks/useOneBreathVoice', () => ({
  useOneBreathVoice: (cb: (text: string, info: Info) => void) => {
    h.emit = cb;
    return { available: h.available, listening: h.listening, busy: h.busy, error: h.error, start: h.start, stop: h.stop, cancel: vi.fn() };
  },
}));

import { TellAforceYourTrip, TRIP_NOTHING_HEARD, TRIP_NOT_UNDERSTOOD, TRIP_PRIVACY } from '../travel/TellAforceYourTrip';
import { confirmLabel, legFormValues, legTitle, TRIP_CARD_SOURCE, tripCardLegs } from '@/utils/travel/tripCard';
import { tripTurn } from '@/utils/travel/tripTurn';

let host: HTMLDivElement;
let root: Root;
const onConfirm = vi.fn();
const onEditDetails = vi.fn();
const onCancel = vi.fn();
const NOW = () => new Date(2026, 10, 19, 10, 0);
const render = () => act(() => root.render(<TellAforceYourTrip onConfirm={onConfirm} onEditDetails={onEditDetails} onCancel={onCancel} now={NOW} />));
const el = (label: string) => host.querySelector(`[aria-label="${label}"]`) as HTMLElement | null;
const type = (label: string, value: string) => {
  const input = el(label) as HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  act(() => { setter.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); });
};
const send = (value: string, label = 'Your trip') => { type(label, value); act(() => el('Send')!.click()); };
const speak = (text: string, final: boolean) => act(() => h.emit(text, { final }));
const disabled = (node: HTMLElement | null) => node?.getAttribute('aria-disabled') === 'true' || (node as HTMLButtonElement | null)?.disabled === true;

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  Object.assign(h, { available: true, listening: false, busy: false, error: '' });
  for (const f of [h.start, h.stop, onConfirm, onEditDetails, onCancel]) f.mockClear();
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

describe('one sentence, one card, one tap', () => {
  it('a typed sentence becomes the card, and Confirm hands over the whole trip once', () => {
    render();
    expect(el('trip-card')).toBeNull();
    send('Delta 123 from JFK to Los Angeles tomorrow at 9:05 AM');
    const text = host.textContent ?? '';
    for (const part of ['JFK → LAX · Nov 20', 'DL123', 'Fri, Nov 20', '9:05 AM', TRIP_CARD_SOURCE]) expect(text).toContain(part);
    expect(host.querySelector('[data-testid="trip-question"]')).toBeNull();
    expect(onConfirm).not.toHaveBeenCalled();
    act(() => el('Confirm trip')!.click());
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm.mock.calls[0]![0].legs).toEqual([{ flightNumber: 'DL123', origin: 'JFK', destination: 'LAX', date: '2026-11-20', time: '09:05' }]);
  });

  it('a spoken sentence does the same; interim words fill the box and nothing else', () => {
    render();
    speak('Delta 123 from JFK', false);
    expect((el('Your trip') as HTMLInputElement).value).toBe('Delta 123 from JFK');
    expect(host.querySelector('[data-testid="trip-card"]')).toBeNull();
    speak('Delta 123 from JFK to Los Angeles tomorrow at 9:05 AM', true);
    expect(host.textContent).toContain('JFK → LAX · Nov 20');
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('typing works when the phone has no voice: no microphone, same result', () => {
    h.available = false;
    render();
    expect(el('Speak')).toBeNull();
    expect((el('Your trip') as HTMLInputElement).placeholder).toBe('Type your trip');
    send('Delta 123 from JFK to Los Angeles tomorrow at 9:05 AM');
    expect(disabled(el('Confirm trip'))).toBe(false);
  });
});

describe('asks only for what is missing', () => {
  it('Confirm stays off until the trip is whole; a choice button answers the question', () => {
    render();
    send('united 5 from houston to boston tomorrow at 9 am');
    expect(host.textContent).toContain('Which Houston airport?');
    expect(host.textContent).toContain('Needs you');
    expect(disabled(el('Confirm trip'))).toBe(true);
    act(() => el('Confirm trip')!.click());
    expect(onConfirm).not.toHaveBeenCalled();
    act(() => el('IAH')!.click());
    expect(host.textContent).not.toContain('Which Houston airport?');
    expect(host.textContent).toContain('IAH → BOS');
    expect(disabled(el('Confirm trip'))).toBe(false);
  });

  it('a typed answer and a typed correction both land on the same card', () => {
    render();
    send('flying delta from JFK to LAX tomorrow');
    expect(host.textContent).toContain('What time does it leave?');
    send('9:05 am', 'Answer or correct your trip');
    expect(host.textContent).toContain('What’s the DL flight number?');
    send('123', 'Answer or correct your trip');
    send('No, Saturday', 'Answer or correct your trip');
    expect(host.textContent).toContain('Sat, Nov 21');
    act(() => el('Confirm trip')!.click());
    expect(onConfirm.mock.calls[0]![0].legs[0]).toEqual({ origin: 'JFK', destination: 'LAX', date: '2026-11-21', time: '09:05', flightNumber: 'DL123' });
  });

  it('says so when it did not catch anything, and keeps the card as it was', () => {
    render();
    send('what a lovely day');
    expect(host.textContent).toContain(TRIP_NOTHING_HEARD);
    send('Delta 123 from JFK to Los Angeles tomorrow at 9:05 AM');
    send('hmm let me think', 'Answer or correct your trip');
    expect(host.textContent).toContain(TRIP_NOT_UNDERSTOOD);
    expect(host.textContent).toContain('DL123');
  });

  it('a way back is shown as its own leg and Confirm says it saves two trips', () => {
    render();
    send('United 88 from Newark to San Francisco December 3 at 8 am returning December 7 at 5 pm on United 99');
    expect(host.textContent).toContain('WAY OUT');
    expect(host.textContent).toContain('WAY BACK');
    expect(el('Confirm 2 trips')).toBeTruthy();
  });
});

describe('the member stays in control', () => {
  it('Edit details hands over what was said; Start over clears it; Not now leaves', () => {
    render();
    act(() => el('Edit details')!.click());
    expect(onEditDetails).toHaveBeenLastCalledWith(null);
    send('flying delta from JFK to LAX tomorrow');
    act(() => el('Edit details')!.click());
    expect(onEditDetails.mock.calls.at(-1)![0].legs[0]).toEqual({ origin: 'JFK', destination: 'LAX', date: '2026-11-20' });
    act(() => el('Start over')!.click());
    expect(host.querySelector('[data-testid="trip-card"]')).toBeNull();
    act(() => el('Not now')!.click());
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('always says nothing is saved until Confirm', () => {
    render();
    expect(host.textContent).toContain(TRIP_PRIVACY);
  });
});

describe('the card and what it saves', () => {
  const NOWD = NOW();
  const draft = (words: string) => tripTurn(null, words, NOWD).draft;

  it('a missing field is shown as missing, never filled', () => {
    const [leg] = tripCardLegs(draft('flying to miami'));
    expect(leg!.rows).toEqual([
      { label: 'Flight', value: null }, { label: 'From', value: null }, { label: 'To', value: 'MIA' }, { label: 'Day', value: null }, { label: 'Leaves', value: null },
    ]);
    expect(leg!.complete).toBe(false);
  });

  it('an arrival time without its day is shown with a note and is not carried into the form', () => {
    const d = draft('delta 5 from jfk to lax tomorrow at 11 pm landing at 2 am');
    const [leg] = tripCardLegs(d);
    expect(leg!.rows.at(-1)).toEqual({ label: 'Arrives', value: '2:00 AM' });
    expect(leg!.note).toContain('won’t be saved');
    expect(legFormValues(d.legs[0]!)).toMatchObject({ arrivalDate: '', arrivalTime: '' });
  });

  it('an arrival time with its day is carried', () => {
    const d = draft('delta 5 from jfk to lax tomorrow at 11 pm landing november 21 at 2 am');
    expect(legFormValues(d.legs[0]!)).toMatchObject({ arrivalDate: '2026-11-21', arrivalTime: '02:00' });
  });

  it('each way gets its own name', () => {
    const d = draft('United 88 from Newark to San Francisco December 3 at 8 am returning December 7 at 5 pm on United 99');
    expect(d.legs.map(legTitle)).toEqual(['EWR → SFO · Dec 3', 'SFO → EWR · Dec 7']);
    expect(confirmLabel(d)).toBe('Confirm 2 trips');
  });
});

describe('containment', () => {
  const ROOT = join(__dirname, '..', '..');
  const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, '');
  const COMPONENT = strip(readFileSync(join(ROOT, 'components/travel/TellAforceYourTrip.tsx'), 'utf8'));
  const SCREEN = readFileSync(join(ROOT, 'components/travel/TravelIntelligenceScreen.tsx'), 'utf8');

  it('the component cannot save: no storage, network, model or travel store', () => {
    expect(COMPONENT).toContain("from '@/hooks/useOneBreathVoice'");
    for (const banned of ['expo-speech-recognition', 'fetch(', 'openai', 'anthropic', 'AsyncStorage', 'SecureStore', 'useTravelIntelligence', 'travel.save', 'statusColor', 'scoringEngine']) {
      expect(COMPONENT, banned).not.toContain(banned);
    }
  });

  it('on the screen, a draft is saved only from the card\'s Confirm, through the same schema as the form', () => {
    expect(SCREEN.match(/saveDraft\(/g)).toHaveLength(1);
    expect(SCREEN).toContain('onConfirm={(draft) =>');
    expect(SCREEN).toContain('await travel.save(travelTripsSchema.parse([...doc.trips, ...trips]));');
    expect(SCREEN).toContain('legs: [legFromForm({ ...blank(), ...legFormValues(leg) })]');
  });

  it('a new trip opens on Tell AFORCE your trip; the form is the fallback and still edits saved trips', () => {
    expect(SCREEN).toContain('{editing === "new" && !manual ? (');
    expect(SCREEN).toContain('(setManual(true), setEditing(trip.id))');
    expect(SCREEN).toContain('"Confirm itinerary"');
  });
});
