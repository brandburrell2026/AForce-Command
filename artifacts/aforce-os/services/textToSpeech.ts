/**
 * Text-to-Speech adapter.
 *
 * Web   : window.speechSynthesis
 * Native: expo-speech (iOS / Android)
 *
 * Voice style is calm/confident/direct. Rate + pitch come from the
 * AForce Voice Engine's active TTS profile (mode-aware), so playback nudges
 * subtly with the user's performance state without ever sounding excited.
 */

import { Platform } from 'react-native';
import * as Speech from 'expo-speech';
import { getActiveTtsConfig } from './ttsConfigService';
import { getVoiceLocale } from './i18nService';

export function speak(text: string): void {
  if (!text) return;
  const cfg = getActiveTtsConfig();
  // Pull the BCP-47 voice locale at speak time (NOT at module load) so
  // a language switch is reflected immediately on the very next call,
  // without needing to reset the TTS layer or restart the app.
  const locale = getVoiceLocale();

  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return;
    const synth = (window as unknown as { speechSynthesis?: SpeechSynthesis }).speechSynthesis;
    if (!synth || typeof SpeechSynthesisUtterance === 'undefined') return;
    try {
      synth.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = cfg.speech_rate;
      utter.pitch = cfg.pitch;
      utter.volume = cfg.volume;
      utter.lang = locale;
      synth.speak(utter);
    } catch {
      // ignore — TTS is optional
    }
    return;
  }

  // Native (iOS / Android) via expo-speech.
  try {
    Speech.stop();
    Speech.speak(text, {
      language: locale,
      rate: cfg.speech_rate,
      pitch: cfg.pitch,
      volume: cfg.volume,
    });
  } catch {
    // ignore — TTS is optional
  }
}

export function stopSpeaking(): void {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return;
    const synth = (window as unknown as { speechSynthesis?: SpeechSynthesis }).speechSynthesis;
    try { synth?.cancel(); } catch { /* ignore */ }
    return;
  }
  try { Speech.stop(); } catch { /* ignore */ }
}
