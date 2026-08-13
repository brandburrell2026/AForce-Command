/**
 * Truthful error mapping — the founder-required locks.
 *
 * The defect this suite exists for: through Build 63 every failed write raised
 * ONE pair of sentences ("Not saved" / "That didn't reach the server — check
 * your connection and try again") for a 401, a 500, a refused body and a
 * genuine transport gap alike. That copy is what made a single Clerk instance
 * mismatch — 401 on every authenticated write — look like three separate
 * broken features for three builds: everyone who saw it, member and founder,
 * was told to check the network.
 *
 * So the assertions below are deliberately blunt:
 *   1. an HTTP 401 CANNOT render network-failure copy — checked against the
 *      SHIPPED en.json strings, not a fixture, because a fixture would have
 *      passed happily all through Build 60→63;
 *   2. every class carries its own message (no two classes share one);
 *   3. no message in ANY locale leaks a status code, URL, token, payload or
 *      stack — the member cannot act on those;
 *   4. a genuine offline error still reads as offline.
 *
 * Pure: reads the classifier, the locale bundles, and two source files as
 * text. No React Native, no store, no realApi import in the module graph.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  classifyWriteFailure,
  WRITE_FAILURE_COPY,
  WRITE_FAILURE_KINDS,
  type WriteFailureKind,
} from '../app/writeFailure';
import en from '../../locales/en.json';
import ar from '../../locales/ar.json';
import de from '../../locales/de.json';
import es from '../../locales/es.json';
import fr from '../../locales/fr.json';
import hi from '../../locales/hi.json';
import itLocale from '../../locales/it.json'; // "it" would shadow vitest's it()
import ja from '../../locales/ja.json';
import ko from '../../locales/ko.json';
import pt from '../../locales/pt.json';
import zh from '../../locales/zh.json';

const ROOT = resolve(__dirname, '../..');
const read = (rel: string) => readFileSync(resolve(ROOT, rel), 'utf8');

const ALL_LOCALES: Record<string, unknown> = {
  en, ar, de, es, fr, hi, it: itLocale, ja, ko, pt, zh,
};
// The convention `common.offline_banner` already ships with in this block:
// the five Latin-script launch locales carry real translations, the other five
// carry the English source verbatim (see docs/i18n/TRANSLATION-REVIEW.md).
const TRANSLATED = ['de', 'es', 'fr', 'it', 'pt'] as const;
const ENGLISH_PLACEHOLDER = ['ar', 'hi', 'ja', 'ko', 'zh'] as const;

/**
 * Resolves copy the way `store/app/actions.ts` resolves it at runtime:
 * `common.action_failed_{title,body}.<kind>`. Anything this helper can't find
 * is a key the shipped Alert would render as a raw i18n key.
 */
function shipped(locale: string, part: 'title' | 'body', kind: WriteFailureKind): string {
  const table = ALL_LOCALES[locale] as Record<string, Record<string, Record<string, unknown>>>;
  const value = table['common']?.[`action_failed_${part}`]?.[kind];
  expect(typeof value, `${locale}.common.action_failed_${part}.${kind}`).toBe('string');
  return value as string;
}

describe('classifyWriteFailure — the status realApi already encoded', () => {
  const CASES: ReadonlyArray<[unknown, WriteFailureKind, number | null]> = [
    // The exact shape `realApi.postJson` throws.
    [new Error('POST /intake/log → 401'), 'auth', 401],
    [new Error('POST /confirm → 403'), 'forbidden', 403],
    [new Error('POST /intake/log → 408'), 'timeout', 408],
    [new Error('POST /intake/log → 429'), 'rate_limited', 429],
    [new Error('POST /intake/log → 400'), 'invalid', 400],
    [new Error('POST /intake/log → 404'), 'invalid', 404],
    [new Error('POST /intake/log → 409'), 'invalid', 409],
    [new Error('POST /intake/log → 422'), 'invalid', 422],
    [new Error('POST /intake/log → 500'), 'server', 500],
    [new Error('POST /intake/log → 502'), 'server', 502],
    [new Error('POST /intake/log → 503'), 'server', 503],
    // 504 is our gateway giving up, not the member's request being slow.
    [new Error('POST /intake/log → 504'), 'server', 504],
    [new Error('GET /home → 401'), 'auth', 401],
    // No status anywhere: transport gap / abort / token fetch that never
    // returned / a thrown non-Error. All of it is "we never heard back".
    [new Error('Network request failed'), 'offline', null],
    [new TypeError('Failed to fetch'), 'offline', null],
    [new Error('timeout'), 'offline', null],
    [new Error('Aborted'), 'offline', null],
    ['POST /intake/log failed', 'offline', null],
    [undefined, 'offline', null],
    [null, 'offline', null],
    [{ message: 'POST /intake/log → 401' }, 'offline', null],
  ];

  for (const [err, kind, status] of CASES) {
    const label = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    it(`classifies "${label}" as ${kind}`, () => {
      const failure = classifyWriteFailure(err);
      expect(failure.kind).toBe(kind);
      expect(failure.status).toBe(status);
    });
  }

  it('a genuine offline error still reads as offline', () => {
    // The founder-named case: nothing about a transport gap may drift into a
    // server class just because the message mentions a path or a verb.
    for (const err of [
      new Error('Network request failed'),
      new Error('POST /intake/log failed: network down'),
      new Error('getAuthHeaders failed'),
    ]) {
      expect(classifyWriteFailure(err).kind).toBe('offline');
    }
    const offline = classifyWriteFailure(new Error('Network request failed'));
    expect(shipped('en', 'body', offline.kind)).toMatch(/connection/i);
  });

  it('a hostile thrown value cannot crash the failure path', () => {
    // This runs INSIDE a catch whose only job is to make sure the member is
    // told something — a throwing toString must not swallow the alert.
    const hostile = { toString() { throw new Error('boom'); } };
    expect(classifyWriteFailure(hostile).kind).toBe('offline');
  });

  it('is total — every kind it can return has shipped copy', () => {
    for (const kind of WRITE_FAILURE_KINDS) {
      expect(WRITE_FAILURE_COPY[kind].title.length).toBeGreaterThan(0);
      expect(WRITE_FAILURE_COPY[kind].body.length).toBeGreaterThan(0);
    }
    expect(new Set(WRITE_FAILURE_KINDS).size).toBe(WRITE_FAILURE_KINDS.length);
  });
});

describe('the offline test is realApi\'s, not a second opinion', () => {
  // If these two ever disagree, the alert would tell a member "check your
  // connection" about an intake realApi refused to queue (or vice versa) —
  // the exact class of contradiction this whole change exists to remove.
  const realApiSrc = read('services/realApi.ts');
  const classifierSrc = read('store/app/writeFailure.ts');

  const realApiLiteral = /return !\/(.+?)\/\.test\(msg\);/.exec(realApiSrc)?.[1];
  const classifierLiteral = /const STATUS_PATTERN = \/(.+?)\/;/.exec(classifierSrc)?.[1];

  it('both files carry the same status pattern (the classifier only adds a capture)', () => {
    expect(realApiLiteral).toBeTruthy();
    expect(classifierLiteral).toBeTruthy();
    expect(classifierLiteral?.replace('(', '').replace(')', '')).toBe(realApiLiteral);
  });

  it('agrees with isOfflineError on every case above', () => {
    const isOffline = new RegExp(realApiLiteral as string);
    for (const msg of [
      'POST /intake/log → 401',
      'POST /intake/log → 500',
      'POST /intake/log → 429',
      'Network request failed',
      'timeout',
      // 4 digits is not a status — realApi's `\b` refuses it, so must we.
      'POST /intake/log → 4011',
    ]) {
      const realApiSaysOffline = !isOffline.test(msg);
      expect(classifyWriteFailure(new Error(msg)).kind === 'offline').toBe(realApiSaysOffline);
    }
  });
});

describe('a 401 can never render network-failure copy', () => {
  // Asserted against the SHIPPED en.json strings — the Build 60→63 defect was
  // in the shipped copy, so a fixture here would prove nothing.
  const auth = classifyWriteFailure(new Error('POST /intake/log → 401'));

  it('classifies as auth, never offline', () => {
    expect(auth.kind).toBe('auth');
    expect(auth.kind).not.toBe('offline');
  });

  it('the shipped 401 copy says nothing about the connection', () => {
    const text = `${shipped('en', 'title', auth.kind)} ${shipped('en', 'body', auth.kind)}`;
    expect(text).not.toMatch(/connect|connection|network|offline|internet|reach the server|wi-?fi/i);
  });

  it('the shipped 401 copy reads as a sign-in problem with something to do', () => {
    const text = `${shipped('en', 'title', auth.kind)} ${shipped('en', 'body', auth.kind)}`;
    expect(text).toMatch(/sign in/i);
    expect(text).toMatch(/session/i);
  });

  it('the shipped 401 copy is not the offline copy in ANY locale', () => {
    for (const locale of Object.keys(ALL_LOCALES)) {
      expect(shipped(locale, 'title', 'auth'), locale).not.toBe(shipped(locale, 'title', 'offline'));
      expect(shipped(locale, 'body', 'auth'), locale).not.toBe(shipped(locale, 'body', 'offline'));
    }
  });
});

describe('every class maps to distinct copy', () => {
  for (const locale of Object.keys(ALL_LOCALES)) {
    it(`${locale}: no two classes share a title or a body`, () => {
      const titles = WRITE_FAILURE_KINDS.map((k) => shipped(locale, 'title', k));
      const bodies = WRITE_FAILURE_KINDS.map((k) => shipped(locale, 'body', k));
      expect(new Set(titles).size).toBe(WRITE_FAILURE_KINDS.length);
      expect(new Set(bodies).size).toBe(WRITE_FAILURE_KINDS.length);
    });
  }

  it('every message says what happened AND what to do', () => {
    for (const kind of WRITE_FAILURE_KINDS) {
      const body = shipped('en', 'body', kind);
      // "nothing was recorded" is the what-happened half; the imperative is
      // the what-to-do half. A message missing either sends the member away
      // without knowing whether to redo the tap.
      expect(body, kind).toMatch(/nothing was recorded/i);
      expect(body, kind).toMatch(/try again|log it|sign in|contact support/i);
    }
  });
});

describe('no message leaks anything internal', () => {
  const FORBIDDEN: ReadonlyArray<[RegExp, string]> = [
    [/\d/, 'a digit (status codes, ports, ids)'],
    [/https?:\/\//i, 'a URL'],
    [/→/, "realApi's status marker"],
    [/[{}]/, 'a payload / raw interpolation'],
    [/\b(POST|GET|PATCH|DELETE)\b/, 'an HTTP verb'],
    [/token|bearer|jwt|clerk|api[_ -]?key|secret/i, 'a credential word'],
    [/\bat\s+\w+\s*\(|\.[jt]sx?:|\bstack\b/i, 'a stack frame'],
    // Case-sensitive and word-bounded on purpose: a leaked JS value renders
    // lowercase, and `null` unanchored would flag Italian's "nulla".
    [/\b(undefined|null|NaN|\[object Object\])\b/, 'a raw JS value'],
  ];

  for (const locale of Object.keys(ALL_LOCALES)) {
    it(`${locale}: titles and bodies are member-facing only`, () => {
      for (const kind of WRITE_FAILURE_KINDS) {
        for (const part of ['title', 'body'] as const) {
          const text = shipped(locale, part, kind);
          for (const [pattern, what] of FORBIDDEN) {
            expect(pattern.test(text), `${locale}.${part}.${kind} contains ${what}: ${text}`).toBe(false);
          }
        }
      }
    });
  }
});

describe('locale parity for the new block', () => {
  it('en.json is byte-identical to the defaultValue every call site passes', () => {
    // actions.ts falls back to WRITE_FAILURE_COPY when a bundle lacks the key.
    // If the two drift, English readers and everyone else read different
    // sentences about the same failure.
    for (const kind of WRITE_FAILURE_KINDS) {
      expect(shipped('en', 'title', kind)).toBe(WRITE_FAILURE_COPY[kind].title);
      expect(shipped('en', 'body', kind)).toBe(WRITE_FAILURE_COPY[kind].body);
    }
  });

  it('every locale carries every class (no member sees a raw key)', () => {
    for (const locale of Object.keys(ALL_LOCALES)) {
      for (const kind of WRITE_FAILURE_KINDS) {
        expect(shipped(locale, 'title', kind).length, `${locale}.${kind}`).toBeGreaterThan(0);
        expect(shipped(locale, 'body', kind).length, `${locale}.${kind}`).toBeGreaterThan(0);
      }
    }
  });

  for (const locale of TRANSLATED) {
    it(`${locale}.json carries a real translation, not the English source`, () => {
      for (const kind of WRITE_FAILURE_KINDS) {
        expect(shipped(locale, 'title', kind), `${locale}.${kind}`).not.toBe(shipped('en', 'title', kind));
        expect(shipped(locale, 'body', kind), `${locale}.${kind}`).not.toBe(shipped('en', 'body', kind));
      }
    });
  }

  for (const locale of ENGLISH_PLACEHOLDER) {
    it(`${locale}.json matches the current English source verbatim`, () => {
      // Same convention (and same guard shape) as
      // utils/__tests__/nonEnLocaleParity.test.ts: an untranslated locale must
      // carry the CURRENT English text, so rewording en.json without syncing
      // fails here instead of shipping stale copy in five locales.
      for (const kind of WRITE_FAILURE_KINDS) {
        expect(shipped(locale, 'title', kind), `${locale}.${kind}`).toBe(shipped('en', 'title', kind));
        expect(shipped(locale, 'body', kind), `${locale}.${kind}`).toBe(shipped('en', 'body', kind));
      }
    });
  }
});

describe('both write failure sites are wired to the classifier', () => {
  const src = read('store/app/actions.ts');

  it('logIntake and confirmCommand both classify before they alert', () => {
    // Two call sites, one behaviour: the pair that raised identical copy for
    // every cause must now raise identical copy for the SAME cause.
    expect(src.match(/classifyWriteFailure\(err\)/g)?.length).toBe(2);
    expect(src.match(/common\.action_failed_title\.\$\{failure\.kind\}/g)?.length).toBe(2);
    expect(src.match(/common\.action_failed_body\.\$\{failure\.kind\}/g)?.length).toBe(2);
  });

  it('neither site can fall back to a single hard-coded sentence', () => {
    // The Build-63 copy, in either catch, is the regression this locks out.
    expect(src).not.toContain("check your connection and try again.");
    expect(src).not.toMatch(/action_failed_title', \{ defaultValue/);
  });
});
