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

// RC-1 Wave-3 P1 perf fix (audit P1-4): `en` is the only locale statically
// (eagerly) imported here. `utils/scoringEngine.ts` calls `i18n.t()`
// synchronously at ITS OWN module-eval time (see the self-init note near the
// bottom of this file), so English must always be resolvable with zero async
// work. Every other locale — the 5 other real ones (es/fr/de/pt/it) and the
// 5 hidden Rule #16 placeholders (ar/zh/ja/ko/hi) — is loaded on demand by
// `requireRealSecondaryLocale` / `ensureLanguageLoaded` below instead of
// being imported here.
import en from '../locales/en.json';

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

// Computed once, reused both to decide the eager secondary import below AND
// as `initI18n`'s default `lng` — so "what we loaded eagerly" and "what we
// booted into" can never disagree.
const DEVICE_LANGUAGE: SupportedLanguage = detectDeviceLanguage();

const REAL_SECONDARY_LOCALES = ['es', 'fr', 'de', 'pt', 'it'] as const;
type RealSecondaryLocale = (typeof REAL_SECONDARY_LOCALES)[number];

function isRealSecondaryLocale(lang: string): lang is RealSecondaryLocale {
  return (REAL_SECONDARY_LOCALES as readonly string[]).includes(lang);
}

// Synchronous — `require()`, not `import()` — because this must be ready
// before `initI18n()`'s first (synchronous) `.init()` call. A `switch` over
// literal strings (rather than a computed `require(`../locales/${lang}.json`)`)
// so Metro's static analyzer can see every possible module at bundle time;
// only the ONE branch that actually matches the device locale ever executes.
function requireRealSecondaryLocale(lang: RealSecondaryLocale): Record<string, unknown> {
  switch (lang) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    case 'es': return require('../locales/es.json');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    case 'fr': return require('../locales/fr.json');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    case 'de': return require('../locales/de.json');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    case 'pt': return require('../locales/pt.json');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    case 'it': return require('../locales/it.json');
  }
}

// If the device's own locale is one of the 5 non-English real locales, load
// it synchronously alongside `en` so a non-English device still boots
// pre-translated on the very first frame (no flash of English → device
// language while a dynamic import resolves). Otherwise nothing extra loads.
const EAGER_SECONDARY: { lang: RealSecondaryLocale; resource: Record<string, unknown> } | null =
  isRealSecondaryLocale(DEVICE_LANGUAGE)
    ? { lang: DEVICE_LANGUAGE, resource: requireRealSecondaryLocale(DEVICE_LANGUAGE) }
    : null;

const INITIAL_RESOURCES: Record<string, { translation: Record<string, unknown> }> = {
  en: { translation: en },
};
if (EAGER_SECONDARY) {
  INITIAL_RESOURCES[EAGER_SECONDARY.lang] = { translation: EAGER_SECONDARY.resource };
}

// Every language i18next already has a resource bundle for — seeded with
// whatever `INITIAL_RESOURCES` above actually loaded — so
// `ensureLanguageLoaded` never re-fetches/re-registers one it already has.
const loadedLanguages = new Set<AnyLanguage>([
  'en',
  ...(EAGER_SECONDARY ? [EAGER_SECONDARY.lang] : []),
]);

// Dynamic `import()` (Metro defers this module's parse/eval cost until the
// call actually happens) for every locale NOT already loaded above —
// the 4 remaining real locales plus all 5 hidden Rule #16 placeholders.
// Same literal-switch shape as `requireRealSecondaryLocale` for the same
// Metro-static-analysis reason.
function importLocale(lang: AnyLanguage) {
  switch (lang) {
    case 'en': return Promise.resolve({ default: en });
    case 'es': return import('../locales/es.json');
    case 'fr': return import('../locales/fr.json');
    case 'de': return import('../locales/de.json');
    case 'pt': return import('../locales/pt.json');
    case 'it': return import('../locales/it.json');
    case 'ar': return import('../locales/ar.json');
    case 'zh': return import('../locales/zh.json');
    case 'ja': return import('../locales/ja.json');
    case 'ko': return import('../locales/ko.json');
    case 'hi': return import('../locales/hi.json');
  }
}

// In-flight load cache (RC-1 fix-forward, should-fix 5): dedupes concurrent
// `ensureLanguageLoaded` calls for the SAME language — e.g. two components
// independently triggering a switch to French at once share one dynamic
// `import()` + one `addResourceBundle` call instead of racing two.
const inFlightLoads = new Map<AnyLanguage, Promise<void>>();

// Registers a locale's resource bundle with i18next on first use. No-op if
// already loaded (covers `en` and a matched `EAGER_SECONDARY` immediately;
// covers everything else after its first `setLanguage()` call). This is the
// ONLY place a locale other than `en`/the device match gets its JSON parsed
// and evaluated — deferred to the moment the user actually switches to it,
// including the 5 hidden placeholders once a future release exposes them.
async function ensureLanguageLoaded(lang: AnyLanguage): Promise<void> {
  if (loadedLanguages.has(lang)) return;
  const existing = inFlightLoads.get(lang);
  if (existing) return existing;
  const load = (async () => {
    const mod = await importLocale(lang);
    i18n.addResourceBundle(lang, 'translation', mod.default, true, true);
    loadedLanguages.add(lang);
  })();
  inFlightLoads.set(lang, load);
  try {
    await load;
  } finally {
    inFlightLoads.delete(lang);
  }
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
      resources: INITIAL_RESOURCES,
      lng: initial ?? DEVICE_LANGUAGE,
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

// Request token (RC-1 fix-forward, should-fix 5): bumped on every
// `setLanguage` call. Without this, rapid switching (e.g. fr → en) could
// settle on whichever call's `ensureLanguageLoaded` / `changeLanguage`
// happened to resolve LAST — not whichever was requested last. `fr` (not
// yet loaded) needs a real dynamic import; `en` (already loaded) resolves
// near-instantly — so a `setLanguage('fr')` immediately followed by
// `setLanguage('en')` could finish in fr → en REQUEST order but en → fr
// RESOLUTION order, leaving the user on French after asking for English.
// Each call snapshots its own token and bails out (without touching
// i18next's active language) the moment a newer call has superseded it.
let languageRequestToken = 0;

export async function setLanguage(lang: AnyLanguage): Promise<void> {
  const myToken = ++languageRequestToken;
  if (!initialized) initI18n(lang);
  // Make sure the resource bundle exists BEFORE switching i18next's active
  // language, so lookups resolve immediately instead of flashing raw keys /
  // the English fallback while the dynamic import is still in flight.
  await ensureLanguageLoaded(lang);
  // Superseded by a later `setLanguage` call while this one's import was in
  // flight — do not switch the active language out from under it.
  if (myToken !== languageRequestToken) return;
  if (i18n.language !== lang) {
    await i18n.changeLanguage(lang);
  }
  // Re-check after the (also async) changeLanguage call, for the same reason.
  if (myToken !== languageRequestToken) return;
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
