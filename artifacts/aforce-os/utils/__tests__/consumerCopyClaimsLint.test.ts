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

/** Consumer-intelligence namespaces (generated/templated copy surfaces). */
const NAMESPACES = [
  'evidence',
  'coach',
  'coachIntelligence',
  'moments',
  'livingPerformance',
  'adaptiveResponse',
  'hydroScan',
  'hydroScan2',
  'scan',
  'protocol',
] as const;

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
    const enKeys = [...walk(en)].filter(([p]) =>
      NAMESPACES.some((ns) => p === ns || p.startsWith(`${ns}.`)),
    );
    expect(enKeys.length).toBeGreaterThan(50);
  });

  for (const file of readdirSync(LOCALES_DIR).filter((f) => f.endsWith('.json'))) {
    it(`${file}: no block-severity claim in any consumer-intelligence string`, () => {
      const json = JSON.parse(readFileSync(join(LOCALES_DIR, file), 'utf8'));
      const violations: string[] = [];
      for (const [path, value] of walk(json)) {
        if (!NAMESPACES.some((ns) => path === ns || path.startsWith(`${ns}.`))) continue;
        if (/(^|\.)disclaimer$/.test(path)) continue; // negated regulatory copy
        const hit = findBlockedConcept(value);
        if (hit) violations.push(`${path} → "${hit}"`);
      }
      expect(violations).toEqual([]);
    });
  }
});
