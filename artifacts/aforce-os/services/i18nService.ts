/**
 * AForce OS i18n bootstrap.
 *
 * Initializes i18next with our 6 MVP locales, picks an initial language
 * from device locale (via expo-localization) when the user hasn't chosen
 * one, and exposes helpers for runtime language switching.
 *
 * Server-persisted language (from `userState.language`) wins over the
 * device locale once it's loaded — the I18nProvider in `app/_layout.tsx`
 * handles that handoff.
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';

import en from '../locales/en.json';
import es from '../locales/es.json';
import fr from '../locales/fr.json';
import de from '../locales/de.json';
import pt from '../locales/pt.json';
import it from '../locales/it.json';

export const SUPPORTED_LANGUAGES = ['en', 'es', 'fr', 'de', 'pt', 'it'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  pt: 'Português',
  it: 'Italiano',
};

// BCP-47 locale codes for Speech APIs (TTS/STT). Defaults to the
// most common country variant per language; user can be added to a
// more specific code later from a profile settings sub-screen.
export const VOICE_LOCALES: Record<SupportedLanguage, string> = {
  en: 'en-US',
  es: 'es-ES',
  fr: 'fr-FR',
  de: 'de-DE',
  pt: 'pt-BR',
  it: 'it-IT',
};

const RESOURCES = {
  en: { translation: en },
  es: { translation: es },
  fr: { translation: fr },
  de: { translation: de },
  pt: { translation: pt },
  it: { translation: it },
} as const;

export function detectDeviceLanguage(): SupportedLanguage {
  try {
    const locales = Localization.getLocales();
    for (const loc of locales) {
      const code = (loc.languageCode ?? 'en').toLowerCase();
      if ((SUPPORTED_LANGUAGES as readonly string[]).includes(code)) {
        return code as SupportedLanguage;
      }
    }
  } catch {
    // expo-localization is unavailable in some test/web contexts —
    // English fallback keeps the app booting.
  }
  return 'en';
}

let initialized = false;
export function initI18n(initial?: SupportedLanguage): typeof i18n {
  if (initialized) return i18n;
  initialized = true;
  i18n
    .use(initReactI18next)
    .init({
      resources: RESOURCES,
      lng: initial ?? detectDeviceLanguage(),
      fallbackLng: 'en',
      interpolation: { escapeValue: false },
      returnNull: false,
      // Keys we'll add later won't crash the app; they fall through to
      // the English bundle and, if absent there too, render the key
      // itself — visible enough that we'll notice and add it.
      saveMissing: false,
    });
  return i18n;
}

export async function setLanguage(lang: SupportedLanguage): Promise<void> {
  if (!initialized) initI18n(lang);
  if (i18n.language !== lang) {
    await i18n.changeLanguage(lang);
  }
}

export function getCurrentLanguage(): SupportedLanguage {
  const lng = (i18n.language ?? 'en').slice(0, 2).toLowerCase();
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(lng)
    ? (lng as SupportedLanguage)
    : 'en';
}

export function getVoiceLocale(lang: SupportedLanguage = getCurrentLanguage()): string {
  return VOICE_LOCALES[lang] ?? 'en-US';
}

export default i18n;
