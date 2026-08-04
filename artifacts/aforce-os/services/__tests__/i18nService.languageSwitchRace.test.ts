/**
 * i18nService — setLanguage race condition (RC-1 fix-forward, PR #544 code
 * review, should-fix 5).
 *
 * `ensureLanguageLoaded`'s original check-then-act ("if not loaded, await
 * the dynamic import, then register") had no way to know a NEWER
 * `setLanguage` call had superseded it. Two locales resolve at different
 * speeds — an already-loaded one (near-instant) vs. one still needing a
 * dynamic `import()` — so calling `setLanguage('fr')` immediately followed
 * by `setLanguage('en')` could, depending on which import settled first,
 * leave i18next on French even though English was requested last. Fixed
 * with an in-flight load cache (dedupes concurrent loads of the SAME
 * language) + a monotonically-increasing request token (each `setLanguage`
 * call bails out, without touching i18next's active language, the moment a
 * newer call has superseded it).
 *
 * This test reproduces the WORST-CASE ordering for the bug: the FIRST
 * requested language's (`fr`) dynamic import is deliberately resolved
 * AFTER the SECOND requested language's (`de`) — via controllable deferred
 * promises standing in for the two `import('../locales/*.json')` calls —
 * and asserts the session still settles on `de`, the last-requested
 * language, per the fix's contract.
 *
 * Mocks `expo-localization` (pins device locale to English, so the eager
 * boot path only ever registers `en`) and `fr.json` / `de.json` (neither is
 * the eager-loaded device locale, so both genuinely exercise the dynamic
 * `import()` / `ensureLanguageLoaded` path), matching the pattern in
 * `i18nService.lazyLocales.test.ts`.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en' }],
}));

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

const frDeferred = createDeferred<{ default: Record<string, unknown> }>();
const deDeferred = createDeferred<{ default: Record<string, unknown> }>();

// Each locale JSON's dynamic import resolves only when this test explicitly
// calls its `resolve()` — giving full, deterministic control over which
// request "wins the race" in real time, independent of request order.
vi.mock('../../locales/fr.json', () => frDeferred.promise);
vi.mock('../../locales/de.json', () => deDeferred.promise);

import i18n, { setLanguage } from '../i18nService';

describe('i18nService — setLanguage race (RC-1 fix-forward, should-fix 5)', () => {
  it('settles on the LAST requested language even when its import resolves AFTER an earlier, now-stale request', async () => {
    const staleCall = setLanguage('fr'); // requested FIRST — stale once superseded
    const latestCall = setLanguage('de'); // requested SECOND — the one that should win

    // Worst-case interleaving: resolve the LATEST request's import first,
    // then the STALE request's import last.
    deDeferred.resolve({ default: { probe: 'MOCK-DE: dynamic import path executed' } });
    await Promise.resolve();
    await Promise.resolve();
    frDeferred.resolve({ default: { probe: 'MOCK-FR: dynamic import path executed' } });

    await Promise.all([staleCall, latestCall]);

    expect(i18n.language).toBe('de');
    expect(i18n.t('probe')).toBe('MOCK-DE: dynamic import path executed');
  });
});
