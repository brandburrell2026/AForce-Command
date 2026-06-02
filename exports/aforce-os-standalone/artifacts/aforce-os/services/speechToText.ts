/**
 * Speech-to-Text adapter.
 *
 * - On web with the Web Speech API available, uses native browser recognition.
 * - Otherwise (native, or web without permission), falls back to a deterministic
 *   mock that picks a phrase from the rotating sample set so the voice flow is
 *   demoable without microphone access. Real STT can be plugged in later by
 *   replacing `startNativeRecognition`.
 */

import { Platform } from 'react-native';

export interface STTResult {
  transcript: string;
  source: 'web-speech' | 'mock';
}

export interface STTHandle {
  stop: () => Promise<STTResult>;
  cancel: () => void;
}

/** Demo phrases cycled through when STT is unavailable. */
const MOCK_PHRASES = [
  'I just drank water',
  'How am I doing?',
  'What should I do next?',
  'I feel dizzy',
  'Log a stick',
  'Compare options',
  'Start recovery',
  "What's my score?",
];
let mockIndex = 0;

function nextMockPhrase(): string {
  const phrase = MOCK_PHRASES[mockIndex % MOCK_PHRASES.length];
  mockIndex += 1;
  return phrase;
}

/** True when the browser exposes a usable SpeechRecognition. */
function hasWebSpeech(): boolean {
  if (Platform.OS !== 'web') return false;
  if (typeof window === 'undefined') return false;
  const w = window as unknown as {
    SpeechRecognition?: unknown;
    webkitSpeechRecognition?: unknown;
  };
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
}

interface MinimalRecognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((ev: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

function createRecognition(): MinimalRecognition | null {
  if (!hasWebSpeech()) return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => MinimalRecognition;
    webkitSpeechRecognition?: new () => MinimalRecognition;
  };
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!Ctor) return null;
  try {
    const rec = new Ctor();
    rec.lang = 'en-US';
    rec.interimResults = false;
    rec.continuous = false;
    return rec;
  } catch {
    return null;
  }
}

/** Start an STT session. Returns a handle; call `stop()` to get the result. */
export function startSpeechRecognition(): STTHandle {
  const rec = createRecognition();

  if (!rec) {
    // Mock path — resolve with a rotating sample phrase after stop().
    let cancelled = false;
    return {
      async stop(): Promise<STTResult> {
        if (cancelled) return { transcript: '', source: 'mock' };
        // Tiny delay so the UI processing state is visible.
        await new Promise((r) => setTimeout(r, 280));
        return { transcript: nextMockPhrase(), source: 'mock' };
      },
      cancel() { cancelled = true; },
    };
  }

  let resolved = false;
  let resolveFn: ((r: STTResult) => void) | null = null;
  let lastTranscript = '';

  const promise = new Promise<STTResult>((resolve) => {
    resolveFn = resolve;
  });

  rec.onresult = (ev) => {
    const last = ev.results[ev.results.length - 1];
    if (last && last[0]) lastTranscript = String(last[0].transcript || '').trim();
  };
  rec.onerror = () => {
    if (!resolved && resolveFn) {
      resolved = true;
      resolveFn({ transcript: lastTranscript || nextMockPhrase(), source: lastTranscript ? 'web-speech' : 'mock' });
    }
  };
  rec.onend = () => {
    if (!resolved && resolveFn) {
      resolved = true;
      resolveFn({ transcript: lastTranscript || nextMockPhrase(), source: lastTranscript ? 'web-speech' : 'mock' });
    }
  };

  try { rec.start(); } catch { /* already started — ignore */ }

  return {
    async stop(): Promise<STTResult> {
      try { rec.stop(); } catch { /* ignore */ }
      return promise;
    },
    cancel() {
      try { rec.abort(); } catch { /* ignore */ }
      if (!resolved && resolveFn) {
        resolved = true;
        resolveFn({ transcript: '', source: 'web-speech' });
      }
    },
  };
}
