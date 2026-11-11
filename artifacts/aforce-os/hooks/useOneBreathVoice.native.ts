import React from 'react';
import { AppState, Platform } from 'react-native';
import { ExpoSpeechRecognitionModule as speech } from 'expo-speech-recognition';
import { captureScope, isScopeCurrent } from '@/services/scopedWriteQueue';
import { getScopeState, subscribeScopeState } from '@/services/userScope';

/** One bounded, on-device capture. No audio file, network fallback, or canonical write. */
export function useOneBreathVoice(onTranscript: (text: string) => void) {
  const [busy, setBusy] = React.useState(false);
  const [listening, setListening] = React.useState(false);
  const [error, setError] = React.useState('');
  const active = React.useRef(false);
  const session = React.useRef(0);
  const started = React.useRef(false);
  const draining = React.useRef(false);
  const mounted = React.useRef(true);
  const token = React.useRef(captureScope());
  const callback = React.useRef(onTranscript); callback.current = onTranscript;
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const available = Platform.OS === 'ios' && speech.isRecognitionAvailable() && speech.supportsOnDeviceRecognition();
  const clearTimer = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; };
  const cancel = React.useCallback(() => {
    session.current += 1; active.current = false; clearTimer();
    if (started.current) { draining.current = true; speech.abort(); }
    if (mounted.current) { setBusy(false); setListening(false); }
  }, []);
  React.useEffect(() => {
    mounted.current = true;
    const valid = () => active.current && mounted.current && isScopeCurrent(token.current) && getScopeState().status === 'AUTHENTICATED';
    const subscriptions = [
      speech.addListener('start', () => { if (valid()) setListening(true); else cancel(); }),
      speech.addListener('result', (event) => { if (valid()) callback.current((event.results[0]?.transcript ?? '').slice(0, 160)); }),
      speech.addListener('error', (event) => {
        if (!valid()) return;
        setError(event.error === 'not-allowed' ? 'Microphone access is off. You can type your moment instead.' : 'Voice capture stopped. Review the words below or type your moment.');
        active.current = false; draining.current = started.current; clearTimer(); setBusy(false); setListening(false);
      }),
      speech.addListener('end', () => { draining.current = false; started.current = false; active.current = false; clearTimer(); if (mounted.current) { setBusy(false); setListening(false); } }),
    ];
    const app = AppState.addEventListener('change', (state) => { if (state !== 'active') cancel(); });
    const unsubscribe = subscribeScopeState(() => { if (!isScopeCurrent(token.current)) cancel(); });
    return () => { mounted.current = false; cancel(); subscriptions.forEach((s) => s.remove()); app.remove(); unsubscribe(); };
  }, [cancel]);
  const start = async () => {
    if (active.current || !available) return;
    if (draining.current) { setError('Voice is finishing. Try again in a moment or type instead.'); return; }
    if (getScopeState().status !== 'AUTHENTICATED') return;
    const attempt = ++session.current;
    token.current = captureScope(); active.current = true; setBusy(true); setError('');
    try {
      const permission = await speech.requestMicrophonePermissionsAsync();
      if (attempt !== session.current || !active.current || !mounted.current || !isScopeCurrent(token.current)) return;
      if (!permission.granted) { cancel(); setError('Microphone access is off. You can type your moment instead.'); return; }
      started.current = true;
      speech.start({ lang: 'en-US', interimResults: true, continuous: false, maxAlternatives: 1, requiresOnDeviceRecognition: true, addsPunctuation: true, recordingOptions: { persist: false } });
      timer.current = setTimeout(() => { speech.stop(); }, 30_000);
    } catch { if (attempt !== session.current) return; started.current = false; cancel(); if (mounted.current) setError('On-device voice is unavailable. Type your moment instead.'); }
  };
  const stop = () => { if (!started.current) { cancel(); return; } if (active.current) { clearTimer(); speech.stop(); setListening(false); } };
  return { available, busy, listening, error, start, stop, cancel };
}
