/**
 * i18nService — lazy locale loading (RC-1 Wave-3 P1 perf fix, audit P1-4).
 *
 * Proves the two properties the fix promises:
 *   1. only `en` (+ the device locale, if a non-English real one) is
 *      registered with i18next eagerly — every other real locale AND
 *      every hidden Rule #16 placeholder is absent until requested;
 *   2. `setLanguage()` to any of those un-registered locales still works —
 *      it dynamically `import()`s the locale JSON, registers it via
 *      `i18n.addResourceBundle`, and switches — for both a real locale
 *      (es) and a hidden placeholder (ar), proving the 5 placeholders
 *      "stay reachable the same way when their flags flip" carries no
 *      behavior loss, just deferred cost.
 *
 * `expo-localization` is mocked to pin the device locale to English, so
 * the eager path only ever registers `en` — this also sidesteps a
 * pre-existing, unrelated gap: real `expo-localization` transitively pulls
 * in `expo-modules-core`, which throws `__DEV__ is not defined` under this
 * repo's node-environment vitest run (same root cause already documented
 * for the 13 pre-existing `Cause A` failures in
 * `governance/TEST-BASELINE.md` — a parser/environment gap, not a defect
 * in this service).
 *
 * The two locale JSONs this suite switches to are mocked with tiny probe
 * keys ("MOCK: prove the dynamic import path really executed") rather than
 * asserting against the real (large, translated) JSON content — this is
 * the "mock the dynamic import" verification the fix's test plan calls
 * for: it proves `ensureLanguageLoaded` actually reaches for
 * `import('../locales/es.json')` / `import('../locales/ar.json')` at
 * switch-time, not that some other locale happened to already be present.
 *
 * These tests run against the REAL, SHARED i18next singleton this module
 * exports (as the app does) — each `it` intentionally builds on the
 * previous one's state (module-eval self-init → switch to es → switch to
 * ar → switch back), matching how a real user's session actually
 * progresses through language switches, rather than resetting modules
 * between cases.
 */
import { describe, it, expect, vi } from 'vitest';

// Pin the device locale to English so the eager path only ever registers
// `en` — deterministic regardless of the machine this suite runs on, and
// avoids ever loading the real (expo-modules-core-dependent) module.
vi.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en' }],
}));

// Intercept the exact two locale JSONs this suite switches to. Resolved by
// physical path, not by literal specifier string, so this correctly
// intercepts `i18nService.ts`'s own `import('../locales/es.json')` /
// `import('../locales/ar.json')` calls even though this test file's
// relative path to the same files differs (`../../locales/*.json`).
vi.mock('../../locales/es.json', () => ({
  default: { probe: 'MOCK-ES: dynamic import path executed' },
}));
vi.mock('../../locales/ar.json', () => ({
  default: { probe: 'MOCK-AR: dynamic import path executed' },
}));

import i18n, { setLanguage } from '../i18nService';

describe('i18nService — lazy locale loading (RC-1 Wave-3 P1)', () => {
  it('boots with ONLY `en` registered — the device locale (English) needs nothing extra', () => {
    // `initI18n()` already self-invoked at module-eval time (see the
    // source's self-init note), using the mocked `expo-localization` above.
    expect(i18n.hasResourceBundle('en', 'translation')).toBe(true);
    expect(i18n.hasResourceBundle('es', 'translation')).toBe(false);
    expect(i18n.hasResourceBundle('fr', 'translation')).toBe(false);
    expect(i18n.hasResourceBundle('ar', 'translation')).toBe(false);
  });

  it('setLanguage to a real, non-eager locale (es) dynamically loads + registers it, then switches', async () => {
    await setLanguage('es');
    expect(i18n.language).toBe('es');
    expect(i18n.hasResourceBundle('es', 'translation')).toBe(true);
    // Reading the mocked probe key proves i18next resolved it from the
    // module our mock intercepted — i.e. the dynamic import genuinely ran.
    expect(i18n.t('probe')).toBe('MOCK-ES: dynamic import path executed');
  });

  it('setLanguage to a hidden Rule #16 placeholder (ar) still works — reachable once its flag flips', async () => {
    await setLanguage('ar');
    expect(i18n.language).toBe('ar');
    expect(i18n.hasResourceBundle('ar', 'translation')).toBe(true);
    expect(i18n.t('probe')).toBe('MOCK-AR: dynamic import path executed');
  });

  it('switching back to an already-loaded locale does not error and lands on the right language', async () => {
    await setLanguage('es');
    expect(i18n.language).toBe('es');
    expect(i18n.t('probe')).toBe('MOCK-ES: dynamic import path executed');

    await setLanguage('en');
    expect(i18n.language).toBe('en');

    // Round-trip back to a locale loaded earlier in this suite — must not
    // throw, and must resolve instantly from the already-registered bundle.
    await setLanguage('ar');
    expect(i18n.language).toBe('ar');
    expect(i18n.t('probe')).toBe('MOCK-AR: dynamic import path executed');
  });
});
