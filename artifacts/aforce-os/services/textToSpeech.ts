/**
 * Text-to-Speech adapter.
 *
 * Web: uses window.speechSynthesis when present.
 * Native: NO-OP today. expo-speech is intentionally NOT imported because
 *   Metro statically resolves dynamic-import specifiers, which would error
 *   when the package isn't installed. To enable native TTS, install
 *   expo-speech and call its `speak` directly here.
 *
 * Voice style is calm/confident/direct: we slow the rate slightly and avoid
 * pitch variation so AForce never sounds like an excited assistant.
 */

import { Platform } from 'react-native';

export function speak(text: string): void {
  if (!text) return;
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;

  const synth = (window as unknown as { speechSynthesis?: SpeechSynthesis }).speechSynthesis;
  if (!synth || typeof SpeechSynthesisUtterance === 'undefined') return;
  try {
    synth.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1.02;
    utter.pitch = 0.95;
    utter.volume = 1.0;
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
