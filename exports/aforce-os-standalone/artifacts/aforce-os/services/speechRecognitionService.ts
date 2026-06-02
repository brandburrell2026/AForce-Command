/**
 * Speech-recognition (STT) abstraction.
 *
 * V1 status: NOT YET IMPLEMENTED on Expo — the platform doesn't ship a
 * first-party STT module that works in Expo Go, so we expose a stable
 * `isSupported()` check + localized command vocabulary now and the UI
 * falls back to text input when STT is unavailable.
 *
 * When we move to a dev build (expo-dev-client) we'll plug in
 * `@react-native-voice/voice` or `expo-speech-recognition` here and
 * flip `isSupported()` — every callsite already routes through this
 * service, so no UI change is needed.
 */

import { SUPPORTED_LANGUAGES, getCurrentLanguage, type SupportedLanguage } from './i18nService';

/** Narrow any active language to the visible 6 that have voice
 *  vocabulary; hidden languages fall back to English for command
 *  matching since their templates don't exist yet. */
function narrowToVoiceLang(): SupportedLanguage {
  const cur = getCurrentLanguage();
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(cur)
    ? (cur as SupportedLanguage)
    : 'en';
}

export type VoiceCommand =
  | 'log_water'
  | 'log_aforce'
  | 'check_hydration'
  | 'what_should_i_do';

/** Localized command phrases the future STT layer should listen for. */
export const VOICE_VOCABULARY: Record<SupportedLanguage, Record<VoiceCommand, readonly string[]>> = {
  en: {
    log_water: ['log water', 'add water', 'water'],
    log_aforce: ['log aforce', 'add aforce', 'aforce'],
    check_hydration: ['check hydration', 'check', 'how am i'],
    what_should_i_do: ['what should i do', 'help', 'next step'],
  },
  es: {
    log_water: ['registrar agua', 'agregar agua', 'agua'],
    log_aforce: ['registrar aforce', 'agregar aforce', 'aforce'],
    check_hydration: ['revisar hidratación', 'revisar', 'cómo estoy'],
    what_should_i_do: ['qué debo hacer', 'ayuda', 'siguiente paso'],
  },
  fr: {
    log_water: ['ajouter eau', 'enregistrer eau', 'eau'],
    log_aforce: ['ajouter aforce', 'enregistrer aforce', 'aforce'],
    check_hydration: ['vérifier hydratation', 'vérifier', 'comment je vais'],
    what_should_i_do: ['que dois-je faire', 'aide', 'prochaine étape'],
  },
  de: {
    log_water: ['wasser eintragen', 'wasser hinzufügen', 'wasser'],
    log_aforce: ['aforce eintragen', 'aforce hinzufügen', 'aforce'],
    check_hydration: ['hydration prüfen', 'prüfen', 'wie geht es mir'],
    what_should_i_do: ['was soll ich tun', 'hilfe', 'nächster schritt'],
  },
  pt: {
    log_water: ['registrar água', 'adicionar água', 'água'],
    log_aforce: ['registrar aforce', 'adicionar aforce', 'aforce'],
    check_hydration: ['verificar hidratação', 'verificar', 'como estou'],
    what_should_i_do: ['o que devo fazer', 'ajuda', 'próximo passo'],
  },
  it: {
    log_water: ['registra acqua', 'aggiungi acqua', 'acqua'],
    log_aforce: ['registra aforce', 'aggiungi aforce', 'aforce'],
    check_hydration: ['verifica idratazione', 'verifica', 'come sto'],
    what_should_i_do: ['cosa devo fare', 'aiuto', 'prossimo passo'],
  },
};

/** Stable feature flag — flip when an STT engine is wired up. */
export function isSupported(): boolean {
  return false;
}

/**
 * Attempts to start STT capture. Always rejects in V1 so callers fall
 * back to text input cleanly.
 */
export async function startListening(): Promise<never> {
  throw new Error('speech_recognition_unavailable');
}

export async function stopListening(): Promise<void> {
  // No-op until a real engine is wired in.
}

/**
 * Match free text (typed or, eventually, transcribed) against the
 * localized vocabulary for the current language. Returns the canonical
 * command id or null. Falls back to English vocabulary if the user's
 * language has no match — handy for code-switchers.
 */
export function matchCommand(text: string, lang: SupportedLanguage = narrowToVoiceLang()): VoiceCommand | null {
  const needle = text.toLowerCase().trim();
  if (!needle) return null;
  const buckets: Array<Record<VoiceCommand, readonly string[]>> = [
    VOICE_VOCABULARY[lang],
    VOICE_VOCABULARY.en,
  ];
  for (const bucket of buckets) {
    for (const cmd of Object.keys(bucket) as VoiceCommand[]) {
      for (const phrase of bucket[cmd]) {
        if (needle === phrase || needle.includes(phrase)) return cmd;
      }
    }
  }
  return null;
}
