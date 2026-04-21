/**
 * Text-to-Speech adapter.
 *
 * Web: uses window.speechSynthesis when present.
 * Native: NO-OP today. expo-speech is intentionally NOT imported because
 *   Metro statically resolves dynamic-import specifiers, which would error
 *   when the package isn't installed. To enable native TTS, install
 *   expo-speech and call its `speak` directly here.
 *
 * Voice style is calm/confident/direct: rate + pitch come from the
 * AForce Voice Engine's active TTS profile (mode-aware), so playback nudges
 * subtly with the user's performance state without ever sounding excited.
 */

import { Platform } from 'react-native';
import { getActiveTtsConfig } from './ttsConfigService';

export function speak(text: string): void {
  if (!text) return;
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;

  const synth = (window as unknown as { speechSynthesis?: SpeechSynthesis }).speechSynthesis;
  if (!synth || typeof SpeechSynthesisUtterance === 'undefined') return;
  try {
    synth.cancel();
    const cfg = getActiveTtsConfig();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = cfg.speech_rate;
    utter.pitch = cfg.pitch;
    utter.volume = cfg.volume;
    utter.lang = 'en-US';
    synth.speak(utter);
  } catch {
    // ignore — TTS is optional
  }
}

export function stopSpeaking(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  const synth = (window as unknown as { speechSynthesis?: SpeechSynthesis }).speechSynthesis;
  try { synth?.cancel(); } catch { /* ignore */ }
}
