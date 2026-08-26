/**
 * Wave-2 PR5 — static claims lint over bundled consumer intelligence copy.
 *
 * The runtime seams (speak(), voice templates, scan coach, command
 * overlays, Smart Capture, /voice/tts) fail closed at emit time; this
 * lint is the build-time lock for the copy that ships in the bundle —
 * every string in the consumer-intelligence namespaces of every locale
 * file must be free of §42 block-severity concepts, so a future key
 * addition cannot smuggle a claim past the runtime seams' fallbacks.
 *
 * Exemption: `*.disclaimer` keys. Regulatory disclaimers legitimately
 * NAME the banned concepts under negation ("not intended to diagnose,
 * treat, or cure") — approved legal copy a word-scan cannot parse.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { findBlockedConcept } from '../intelligence/languageGate/runtimeClaimScan';

const LOCALES_DIR = resolve(__dirname, '../../locales');

/**
 * S1-1 (Stage-1 claims emergency): the lint now scans EVERY locale
 * namespace by default — the Stage-0 audit proved the old include-list
 * let block-severity concepts ship in unscanned namespaces
 * (subscription.v2.guardian_hint carried "injury risk", a
 * registry-defined block concept, on the public pricing screen).
 * Exemptions are explicit and reviewable:
 *   - 'legal'  — counsel-owned regulatory copy; word-scans cannot parse
 *     negated legal phrasing.
 * Individual `*.disclaimer` keys stay exempt for the same reason.
 */
const EXEMPT_NAMESPACES = ['legal'] as const;

function* walk(obj: unknown, path = ''): Generator<[string, string]> {
  if (typeof obj === 'string') {
    yield [path, obj];
    return;
  }
  if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      yield* walk(v, path ? `${path}.${k}` : k);
    }
  }
}

describe('consumer intelligence copy — §42 block-severity lint (all locales)', () => {
  const localeFiles = readdirSync(LOCALES_DIR).filter((f) => f.endsWith('.json'));

  it('scans a real corpus (locales exist, namespaces populated)', () => {
    expect(localeFiles.length).toBeGreaterThan(0);
    const en = JSON.parse(readFileSync(join(LOCALES_DIR, 'en.json'), 'utf8'));
    const enKeys = [...walk(en)].filter(
      ([p]) => !EXEMPT_NAMESPACES.some((ns) => p === ns || p.startsWith(`${ns}.`)),
    );
    expect(enKeys.length).toBeGreaterThan(50);
  });

  for (const file of readdirSync(LOCALES_DIR).filter((f) => f.endsWith('.json'))) {
    it(`${file}: no block-severity claim in any consumer-intelligence string`, () => {
      const json = JSON.parse(readFileSync(join(LOCALES_DIR, file), 'utf8'));
      const violations: string[] = [];
      for (const [path, value] of walk(json)) {
        if (EXEMPT_NAMESPACES.some((ns) => path === ns || path.startsWith(`${ns}.`))) continue;
        if (/(^|\.)disclaimer$/.test(path)) continue; // negated regulatory copy
        // Deletion disclosures must truthfully say "permanently" (privacy
        // accuracy requirement) — reviewed exemption, S1-1.
        if (/\.delete_body$/.test(path)) continue;
        const hit = findBlockedConcept(value);
        if (hit) violations.push(`${path} → "${hit}"`);
      }
      expect(violations).toEqual([]);
    });
  }
});

/**
 * S1-1: hardcoded consumer copy scan. The Stage-0 audit found
 * claim-bearing strings living OUTSIDE the locale files (SKU blurbs,
 * comparison verdicts, recovery-protocol copy, science screen), where
 * the locale lint could never see them. This scan extracts string
 * literals from the known claim-bearing source modules and applies the
 * same §42 block-severity word-scan. It is a ratchet: add new
 * consumer-copy modules here when they are created.
 */
const HARDCODED_COPY_SOURCES = [
  '../../data/pricing.ts',
  '../../data/flavors.ts',
  '../../data/products.ts',
  '../../services/comparisonEngine.ts',
  '../../services/recoveryProtocolService.ts',
  '../../services/sweatRateEngine.ts',
  '../../services/hydrationStatus.ts',
  '../../services/protocolDerivation.ts',
  '../../services/urineHydrationCheck.ts',
  '../../services/cruiseModeService.ts',
  '../../services/heatRiskEngine.ts',
  '../../services/heatProtocolService.ts',
  '../../services/voice/commandVoice.ts',
  '../../components/science/ScienceScreenV2.tsx',
] as const;

/** Pull single/double/backtick string literals ≥ 12 chars (consumer copy, not identifiers). */
function extractStringLiterals(source: string): string[] {
  const out: string[] = [];
  const re = /(['"`])((?:\\.|(?!\1)[^\\\n]){12,}?)\1/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) out.push(m[2]!);
  return out;
}

describe('hardcoded consumer copy — §42 block-severity lint', () => {
  for (const rel of HARDCODED_COPY_SOURCES) {
    it(`${rel.replace('../../', '')}: no block-severity claim in any string literal`, () => {
      const source = readFileSync(resolve(__dirname, rel), 'utf8');
      const violations: string[] = [];
      for (const rawLit of extractStringLiterals(source)) {
        if (!/\s/.test(rawLit)) continue; // identifiers/keys, not consumer copy
        // Negated regulatory disclaimers legitimately NAME banned concepts
        // ("not a medical …", "not intended to diagnose") — same reviewed
        // exemption as the locale scan's `*.disclaimer` keys.
        if (/\bnot (a|an|intended to)\b/i.test(rawLit)) continue;
        const lit = rawLit.replace(/\$\{[^}]*\}/g, ' '); // code interpolations
        const hit = findBlockedConcept(lit);
        if (hit) violations.push(`"${lit.slice(0, 60)}" → "${hit}"`);
      }
      expect(violations).toEqual([]);
    });
  }
});
