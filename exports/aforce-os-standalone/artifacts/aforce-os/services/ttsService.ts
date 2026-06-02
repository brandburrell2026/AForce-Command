/**
 * Locale-aware text-to-speech wrapper around expo-speech.
 *
 * The voice template engine produces a localized string; this layer
 * just dispatches it to the platform speaker with the right BCP-47
 * locale so iOS/Android pick a native-sounding voice.
 *
 * On web, `expo-speech` falls back to the Web Speech API automatically;
 * we set the same `language` field so the browser picks a matching
 * voice when one is installed.
 */

import * as Speech from 'expo-speech';
import { getVoiceLocale, type SupportedLanguage } from './i18nService';

export interface SpeakOptions {
  language?: SupportedLanguage;
  /** 0.5–2.0; defaults to 1.0 (natural) */
  rate?: number;
  /** 0.5–2.0; defaults to 1.0 (natural) */
  pitch?: number;
  onDone?: () => void;
  onError?: (err: unknown) => void;
}

let lastSpoken: { text: string; at: number } | null = null;

/**
 * Speak `text` in the user's selected language. Calls are de-duplicated
 * over a 500ms window so a re-render doesn't double-trigger the speaker.
 */
export async function speak(text: string, opts: SpeakOptions = {}): Promise<void> {
  if (!text || !text.trim()) return;
  const now = Date.now();
  if (lastSpoken && lastSpoken.text === text && now - lastSpoken.at < 500) return;
  lastSpoken = { text, at: now };
  try {
    const locale = getVoiceLocale(opts.language);
    Speech.speak(text, {
      language: locale,
      rate: opts.rate ?? 1.0,
      pitch: opts.pitch ?? 1.0,
      onDone: opts.onDone,
      onError: opts.onError,
    });
  } catch (err) {
    opts.onError?.(err);
  }
}

export async function stop(): Promise<void> {
  try {
    await Speech.stop();
  } catch {
    // Speaker may not have been speaking — safe to ignore.
  }
}

export async function isSpeaking(): Promise<boolean> {
  try {
    return await Speech.isSpeakingAsync();
  } catch {
    return false;
  }
}
