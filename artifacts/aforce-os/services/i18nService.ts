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
import { I18nManager } from 'react-native';

import en from '../locales/en.json';
import es from '../locales/es.json';
import fr from '../locales/fr.json';
import de from '../locales/de.json';
import pt from '../locales/pt.json';
import it from '../locales/it.json';
import ar from '../locales/ar.json';
import zh from '../locales/zh.json';
import ja from '../locales/ja.json';
import ko from '../locales/ko.json';
import hi from '../locales/hi.json';

export const SUPPORTED_LANGUAGES = ['en', 'es', 'fr', 'de', 'pt', 'it'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/**
 * Spec v18 — Rule #16 hidden languages.
 *
 * Resources are loaded so i18next can resolve keys when the
 * corresponding `spec_language_*` flag is on, but they are NOT
 * surfaced in `LanguageSelector`. To expose one, flip its
 * `spec_language_xx` flag AND add it to the selector's option list
 * in a future release.
 *
 * JSON files are verbatim copies of `en.json` (placeholder) so
 * lookups resolve to the English string instead of returning the
 * raw key. Translators can edit each file in place; the file paths
 * are stable.
 */
export const HIDDEN_LANGUAGES = ['ar', 'zh', 'ja', 'ko', 'hi'] as const;
export type HiddenLanguage = (typeof HIDDEN_LANGUAGES)[number];

/** Any language i18n can resolve — visible + hidden. */
export type AnyLanguage = SupportedLanguage | HiddenLanguage;

export const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  pt: 'Português',
  it: 'Italiano',
};

/** Native-script labels for hidden languages — used only when a
 *  future release surfaces them in the selector. */
export const HIDDEN_LANGUAGE_LABELS: Record<HiddenLanguage, string> = {
  ar: 'العربية',
  zh: '中文',
  ja: '日本語',
  ko: '한국어',
  hi: 'हिन्दी',
};

// BCP-47 locale codes for Speech APIs (TTS/STT). Defaults to the
// most common country variant per language; user can be added to a
// more specific code later from a profile settings sub-screen.
export const VOICE_LOCALES: Record<AnyLanguage, string> = {
  en: 'en-US',
  es: 'es-ES',
  fr: 'fr-FR',
  de: 'de-DE',
  pt: 'pt-BR',
  it: 'it-IT',
  ar: 'ar-SA',
  zh: 'zh-CN',
  ja: 'ja-JP',
  ko: 'ko-KR',
  hi: 'hi-IN',
};

const RESOURCES = {
  en: { translation: en },
  es: { translation: es },
  fr: { translation: fr },
  de: { translation: de },
  pt: { translation: pt },
  it: { translation: it },
  ar: { translation: ar },
  zh: { translation: zh },
  ja: { translation: ja },
  ko: { translation: ko },
  hi: { translation: hi },
} as const;

/** Locales that render right-to-left. */
const RTL_LANGUAGES: ReadonlySet<AnyLanguage> = new Set(['ar']);

export function isRTLLanguage(lang: AnyLanguage): boolean {
  return RTL_LANGUAGES.has(lang);
}

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
export function initI18n(initial?: AnyLanguage): typeof i18n {
  if (initialized) return i18n;
  initialized = true;
  // Allow RTL globally so a later `forceRTL(true)` (when Arabic is
  // selected) actually mirrors the layout. `allowRTL` alone does not
  // change direction; it just unlocks the capability.
  try { I18nManager.allowRTL(true); } catch { /* no-op on web */ }
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

export async function setLanguage(lang: AnyLanguage): Promise<void> {
  if (!initialized) initI18n(lang);
  if (i18n.language !== lang) {
    await i18n.changeLanguage(lang);
  }
  // Mirror layout direction for RTL locales. `forceRTL` takes effect
  // on the next app launch in production (React Native limitation);
  // current-session text wrapping still benefits from the i18n change.
  // The caller should prompt for reload when switching to/from an RTL
  // language — currently only Arabic (`ar`).
  try {
    const shouldBeRTL = isRTLLanguage(lang);
    if (I18nManager.isRTL !== shouldBeRTL) {
      I18nManager.forceRTL(shouldBeRTL);
    }
  } catch {
    /* no-op on web */
  }
}

export function getCurrentLanguage(): AnyLanguage {
  const lng = (i18n.language ?? 'en').slice(0, 2).toLowerCase();
  const all: readonly string[] = [...SUPPORTED_LANGUAGES, ...HIDDEN_LANGUAGES];
  return all.includes(lng) ? (lng as AnyLanguage) : 'en';
}

export function getVoiceLocale(lang: AnyLanguage = getCurrentLanguage()): string {
  return VOICE_LOCALES[lang] ?? 'en-US';
}

// Self-initialize on module import. Several modules (notably
// `utils/scoringEngine.ts`) call `i18n.t()` synchronously during their
// module-evaluation phase — before `app/_layout.tsx` has a chance to
// invoke `initI18n()`. Without this side effect, those early calls
// would return the raw key (e.g. `coach.peak_action`) until the
// provider mounts. Calling here is idempotent (the `initialized`
// guard inside `initI18n` makes the later explicit call a no-op).
initI18n();

export default i18n;
