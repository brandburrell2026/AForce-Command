/**
 * scoreProtectionBoundary — structural enforcement of the Score-Protection
 * FINAL BUILD LOCK ("Scores only change from completed behavior").
 *
 * The advisory/intelligence layers (Execution Readiness, Command Confidence,
 * Data Confidence, the command-event ledger adapters, Location Intelligence,
 * the Impact engine) are deliberately one-way: they READ behaviour and MEASURE
 * it, but must never feed back into the score NUMBER. The cheapest, most durable
 * way to keep that true through the score-integration work is to forbid the
 * score-number module from importing any of them at all — a violation then
 * fails CI instead of silently inflating a user's score.
 *
 * Scope note: this guards the score-NUMBER path (`utils/scoring/breakdown.ts`).
 * `utils/scoring/copy.ts` legitimately reads Command Confidence to WORD the
 * coaching command; copy never changes the score, so it is intentionally not
 * covered here.
 *
 * RN-free: reads source text off disk; imports nothing from the app.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url)); // utils/__tests__
const PKG = join(HERE, '..', '..'); // artifacts/aforce-os

function importSpecifiers(relPath: string): string[] {
  const src = readFileSync(join(PKG, relPath), 'utf8');
  return [...src.matchAll(/(?:from|import)\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
}

/** Substrings that identify an advisory / intelligence / confidence module. */
const ADVISORY_MARKERS = [
  'executionReadiness',
  'commandConfidence',
  'dataConfidence',
  'commandEventAdapters',
  'commandEvents',
  '/intelligence/',
  '/confidence/',
  'locationIntelligence',
  'impactEngine',
];

describe('Score-Protection module boundary', () => {
  it('the score-number path imports NO advisory/intelligence module', () => {
    const imports = importSpecifiers('utils/scoring/breakdown.ts');
    for (const spec of imports) {
      for (const marker of ADVISORY_MARKERS) {
        expect(
          spec.includes(marker),
          `breakdown.ts (score number) must not import an advisory module: "${spec}"`,
        ).toBe(false);
      }
    }
  });

  it('scoringEngine.ts does not directly import the ledger/readiness layers', () => {
    const imports = importSpecifiers('utils/scoringEngine.ts');
    for (const spec of imports) {
      for (const marker of ['executionReadiness', 'commandEventAdapters', 'commandEvents', '/intelligence/']) {
        expect(
          spec.includes(marker),
          `scoringEngine.ts must not import the ledger/readiness layer: "${spec}"`,
        ).toBe(false);
      }
    }
  });
});
