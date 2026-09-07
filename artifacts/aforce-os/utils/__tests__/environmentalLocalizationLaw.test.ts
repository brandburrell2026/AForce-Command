/**
 * ENVIRONMENTAL LOCALIZATION LAWS — translation must not soften a truth.
 *
 * Localizing is where an honesty guarantee quietly dies. The English copy was
 * shaped over several founder reviews to say exactly what the evidence
 * supports; a translator (or a future edit) can collapse two distinct reasons
 * into one comfortable phrase, or give INSUFFICIENT a line that reads like
 * CLEAR, and every earlier repair is undone in ten languages at once.
 *
 * These laws run over the locale FILES, so they hold for every language
 * without needing to render the screen in each.
 */
import { describe, it, expect } from 'vitest';

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

type Json = Record<string, unknown>;
const LOCALES: Record<string, Json> = {
  en: en as Json, ar: ar as Json, de: de as Json, es: es as Json, fr: fr as Json,
  hi: hi as Json, it: itLocale as Json, ja: ja as Json, ko: ko as Json,
  pt: pt as Json, zh: zh as Json,
};
const NON_EN = Object.entries(LOCALES).filter(([k]) => k !== 'en');

const envOf = (l: Json) => l['environment'] as Json;

function flatten(o: unknown, p = ''): Record<string, string> {
  const out: Record<string, string> = {};
  if (o && typeof o === 'object') {
    for (const [k, v] of Object.entries(o as Json)) {
      const kp = p ? `${p}.${k}` : k;
      if (v && typeof v === 'object') Object.assign(out, flatten(v, kp));
      else out[kp] = String(v);
    }
  }
  return out;
}

const EN_FLAT = flatten(envOf(LOCALES['en']!));

// ── 1 · every locale is complete ────────────────────────────────────────────

describe('LAW 1 — the namespace exists and is complete everywhere', () => {
  it('all eleven locales carry an environment namespace', () => {
    for (const [code, l] of Object.entries(LOCALES)) {
      expect(envOf(l), code).toBeTruthy();
    }
  });

  it('every locale has EVERY English key — no silent gaps', () => {
    // A missing key falls back to the raw key path on screen ("environment.
    // line.heat"), which is worse than untranslated English.
    const enKeys = Object.keys(EN_FLAT).sort();
    for (const [code, l] of NON_EN) {
      expect(Object.keys(flatten(envOf(l))).sort(), code).toEqual(enKeys);
    }
  });

  it('no value is empty in any locale', () => {
    for (const [code, l] of Object.entries(LOCALES)) {
      for (const [k, v] of Object.entries(flatten(envOf(l)))) {
        expect(v.trim(), `${code}.${k}`).not.toBe('');
      }
    }
  });

  it('and every locale is genuinely TRANSLATED, not English placeholders', () => {
    // The repo already carries families that are English placeholders in all
    // ten non-English files. This namespace must not join them: it ships as a
    // release gate, so a copy of the English string is a failure, not a stub.
    for (const [code, l] of NON_EN) {
      const f = flatten(envOf(l));
      const identical = Object.keys(EN_FLAT).filter((k) => f[k] === EN_FLAT[k]);
      // Two universal exemptions and one genuine cognate. Listed explicitly
      // and per-locale so the allowance can never quietly cover a real
      // untranslated string:
      //   aforce     — a brand name; never translated in any language
      //   signal.uv  — the UV Index is "UV" internationally in Latin scripts
      //   fr signal.air — "air" IS the French word for air, not a placeholder
      const UNIVERSAL = new Set(['aforce', 'signal.uv']);
      const COGNATES: Record<string, readonly string[]> = { fr: ['signal.air'] };
      const allowed = new Set([...UNIVERSAL, ...(COGNATES[code] ?? [])]);
      expect(identical.filter((k) => !allowed.has(k)), code).toEqual([]);
    }
  });
});

// ── 2 · the five states stay five ───────────────────────────────────────────

describe('LAW 2 — INSUFFICIENT can never read as CLEAR, in any language', () => {
  it('every state word is distinct within its locale', () => {
    for (const [code, l] of Object.entries(LOCALES)) {
      const st = flatten((envOf(l)['state'] as Json));
      expect(new Set(Object.values(st)).size, code).toBe(5);
    }
  });

  it('every LINE is distinct within its locale', () => {
    // If the insufficient line ever equalled the clear line in some locale,
    // "we cannot see" would render as "conditions are fine" for those members.
    for (const [code, l] of Object.entries(LOCALES)) {
      const lines = flatten((envOf(l)['line'] as Json));
      expect(new Set(Object.values(lines)).size, code).toBe(5);
      expect(lines['insufficient'], code).not.toBe(lines['clear']);
    }
  });

  it('the unresolved headline is never the CLEAR state word', () => {
    for (const [code, l] of Object.entries(LOCALES)) {
      const e = envOf(l);
      const st = e['state'] as Json;
      expect(String(e['unresolved_headline']), code).not.toBe(String(st['clear']));
    }
  });
});

// ── 3 · unavailable reasons stay distinguishable ────────────────────────────

describe('LAW 3 — a refusal never reads as an outage', () => {
  it('all seven unavailable reasons are distinct within each locale', () => {
    // The whole point of the Lane 2 repair was that permission_denied,
    // never_requested, provider_unavailable and not_supported are four
    // different truths. Collapsing any two in translation undoes it.
    for (const [code, l] of Object.entries(LOCALES)) {
      const u = flatten((envOf(l)['unavailable'] as Json));
      expect(Object.keys(u).length, code).toBe(7);
      expect(new Set(Object.values(u)).size, code).toBe(7);
    }
  });

  it('permission language is never used for a provider failure', () => {
    for (const [code, l] of Object.entries(LOCALES)) {
      const u = flatten((envOf(l)['unavailable'] as Json));
      expect(u['permission_denied'], code).not.toBe(u['provider_unavailable']);
      expect(u['permission_denied'], code).not.toBe(u['never_requested']);
      expect(u['not_supported'], code).not.toBe(u['provider_unavailable']);
    }
  });
});

// ── 4 · no fabrication survives translation ─────────────────────────────────

describe('LAW 4 — translation cannot introduce what the evidence lacks', () => {
  it('NO locale contains a temperature unit or degree symbol', () => {
    // Heat is numberless by ruling. A translator writing "31°C" or "feels
    // like" would resurrect the exact defect this program repaired four times.
    for (const [code, l] of Object.entries(LOCALES)) {
      for (const [k, v] of Object.entries(flatten(envOf(l)))) {
        expect(v, `${code}.${k}`).not.toMatch(/[°℃℉]/);
        expect(v, `${code}.${k}`).not.toMatch(/\d+\s*(C|F)\b/);
      }
    }
  });

  it('NO locale leaks a published band identifier', () => {
    // Word-bounded: a bare /EPA/ matches inside "PREPARE".
    for (const [code, l] of Object.entries(LOCALES)) {
      for (const [k, v] of Object.entries(flatten(envOf(l)))) {
        expect(v, `${code}.${k}`).not.toMatch(/\b(NWS|WHO|EPA|AQI)\b/);
      }
    }
  });

  it('NO locale contains a freshness claim the read cannot support', () => {
    // The read carries no timestamp; "updated 5 minutes ago" is unrenderable
    // and must not appear as static copy either.
    for (const [code, l] of Object.entries(LOCALES)) {
      for (const [k, v] of Object.entries(flatten(envOf(l)))) {
        expect(v, `${code}.${k}`).not.toMatch(/\b\d+\s*(min|minutes|hours|hrs)\b/i);
      }
    }
  });

  it('NO locale turns an environmental line into a personal command', () => {
    // Environmental describes the world. Dose and imperative hydration
    // language belong to RecoveryCommand alone, in every language.
    for (const [code, l] of Object.entries(LOCALES)) {
      const lines = flatten((envOf(l)['line'] as Json));
      for (const [k, v] of Object.entries(lines)) {
        expect(v, `${code}.line.${k}`).not.toMatch(/\b(oz|ml|litre|liter)\b/i);
        expect(v, `${code}.line.${k}`).not.toMatch(/\d/);
      }
    }
  });

  it('the brand name is never translated', () => {
    for (const [code, l] of Object.entries(LOCALES)) {
      expect(String(envOf(l)['aforce']), code).toBe('AFORCE');
    }
  });
});

// ── 5 · the concern ladders stay ordered ────────────────────────────────────

describe('LAW 5 — each signal keeps four distinct concern words', () => {
  it.each(['heat', 'air', 'uv'] as const)('%s has four distinct words per locale', (signal) => {
    for (const [code, l] of Object.entries(LOCALES)) {
      const w = flatten(((envOf(l)['word'] as Json)[signal] as Json));
      expect(Object.keys(w).sort(), `${code}.${signal}`)
        .toEqual(['benign', 'notable', 'severe', 'significant']);
      // Four rungs must remain four: collapsing "high" into "severe" would
      // make PREPARE and CAUTION indistinguishable in that language.
      expect(new Set(Object.values(w)).size, `${code}.${signal}`).toBe(4);
    }
  });
});
