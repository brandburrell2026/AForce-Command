// @vitest-environment happy-dom
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
vi.mock('@/hooks/useOneBreathVoice', () => ({
  useOneBreathVoice: (cb: (text: string, info: Info) => void) => {
    h.emit = cb;
    return { available: h.available, listening: h.listening, busy: h.busy, error: h.error, start: h.start, stop: h.stop, cancel: vi.fn() };
  },
}));

import { SayYourTrip, travelVoiceError } from '../travel/SayYourTrip';

let host: HTMLDivElement;
let root: Root;
const onFields = vi.fn();
const NOW = () => new Date(2026, 10, 19, 10, 0);
const render = () => act(() => root.render(<SayYourTrip legNumber={1} onFields={onFields} now={NOW} />));
const say = (text: string, final: boolean) => act(() => h.emit(text, { final }));

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  Object.assign(h, { available: true, listening: false, busy: false, error: '' });
  h.start.mockClear(); h.stop.mockClear(); onFields.mockClear();
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); });

describe('SayYourTrip', () => {
  it('renders nothing where on-device speech is unavailable — typing is untouched', () => {
    h.available = false;
    render();
    expect(host.textContent).toBe('');
  });

  it('offers the control with an example and says where the words stay', () => {
    render();
    expect(host.textContent).toContain('Say your trip');
    expect(host.textContent).toContain('Delta 123 from JFK to Los Angeles');
    expect(host.textContent).toContain('Heard on this phone only. No audio is kept');
  });

  it('tapping starts listening; tapping while listening stops', () => {
    render();
    const button = host.querySelector('[data-testid="say-your-trip-button"]') as HTMLElement;
    act(() => button.click());
    expect(h.start).toHaveBeenCalledTimes(1);
    h.listening = true;
    render();
    act(() => (host.querySelector('[data-testid="say-your-trip-button"]') as HTMLElement).click());
    expect(h.stop).toHaveBeenCalledTimes(1);
    expect(h.start).toHaveBeenCalledTimes(1);
  });

  it('interim words are shown but fill nothing', () => {
    render();
    say('delta 123 from', false);
    expect(host.textContent).toContain('delta 123 from');
    expect(onFields).not.toHaveBeenCalled();
  });

  it('the finished sentence fills the fields it states, once', () => {
    render();
    say('Delta 123 from JFK to Los Angeles on December 2 at 9:05 AM', true);
    expect(onFields).toHaveBeenCalledTimes(1);
    expect(onFields).toHaveBeenCalledWith({ flightNumber: 'DL123', origin: 'JFK', destination: 'LAX', date: '2026-12-02', time: '09:05' });
    expect(host.textContent).toContain('Filled in: flight number, departure airport, arrival airport, departure date, departure time. Check each one before saving.');
  });

  it('a city with several airports is not guessed, and the member is told', () => {
    render();
    say('from new york to miami tomorrow', true);
    expect(onFields).toHaveBeenCalledWith({ destination: 'MIA', date: '2026-11-20' });
    expect(host.textContent).toContain('New York has JFK, LGA, EWR. Type the one you mean.');
  });

  it('words with no trip in them change nothing in the form', () => {
    render();
    say('I have a big meeting next week', true);
    expect(onFields).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Nothing was filled in.');
  });

  it('capture errors are worded for Travel', () => {
    expect(travelVoiceError('Microphone access is off. You can type your moment instead.'))
      .toBe('Microphone access is off. You can type the details instead.');
  });
});

describe('SayYourTrip — containment', () => {
  const ROOT = join(__dirname, '..', '..');
  const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, '');
  const COMPONENT = strip(readFileSync(join(ROOT, 'components/travel/SayYourTrip.tsx'), 'utf8'));
  const PARSER = strip(readFileSync(join(ROOT, 'utils/travel/spokenTrip.ts'), 'utf8'));
  const SCREEN = readFileSync(join(ROOT, 'components/travel/TravelIntelligenceScreen.tsx'), 'utf8');
  const HOOK = readFileSync(join(ROOT, 'hooks/useOneBreathVoice.native.ts'), 'utf8');

  it('reuses the existing on-device capture and adds no voice, audio or network path', () => {
    expect(COMPONENT).toContain("from '@/hooks/useOneBreathVoice'");
    for (const banned of ['expo-speech-recognition', 'expo-av', 'expo-audio', 'fetch(', 'elevenlabs', 'anthropic', 'openai', 'AsyncStorage', 'scopedStorage']) {
      expect(COMPONENT.toLowerCase(), banned).not.toContain(banned.toLowerCase());
      expect(PARSER.toLowerCase(), banned).not.toContain(banned.toLowerCase());
    }
    // The capture it reuses is on-device and keeps no recording.
    expect(HOOK).toContain('requiresOnDeviceRecognition: true');
    expect(HOOK).toContain('recordingOptions: { persist: false }');
  });

  it('only fills the form: it cannot save a trip', () => {
    const mount = SCREEN.slice(SCREEN.indexOf('<SayYourTrip'), SCREEN.indexOf('/>', SCREEN.indexOf('<SayYourTrip')));
    expect(mount).toContain('setForms(');
    expect(mount).not.toMatch(/save|mutate|runtime|create/i);
    expect(mount).toContain('i === all.length - 1 ? { ...item, ...spoken } : item');
  });
});
