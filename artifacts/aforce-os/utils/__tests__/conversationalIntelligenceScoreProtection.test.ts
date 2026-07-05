import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

/**
 * Score-Protection structural invariant for the Section 64 Conversational
 * Intelligence policy. It is strictly OBSERVATIONAL: it must never import the
 * store or a scoring engine, never dispatch, and never mutate score. Fails the
 * moment someone adds a forbidden dependency.
 */

const here = dirname(fileURLToPath(import.meta.url));
const aforceRoot = resolve(here, '..', '..');

const PURE_CORE = [
  'utils/intelligence/conversationalIntelligence.ts',
  'utils/intelligence/conversationalLanguage.ts',
];

function read(rel: string): string {
  return readFileSync(resolve(aforceRoot, rel), 'utf8');
}

function importPaths(src: string): string[] {
  const out: string[] = [];
  const re = /(?:import|export)[^'"]*?from\s+['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) out.push(m[1]);
  return out;
}

describe('Section 64 — Conversational Intelligence Score-Protection invariant', () => {
  it('imports nothing that could couple it to score', () => {
    for (const rel of PURE_CORE) {
      for (const p of importPaths(read(rel))) {
        expect(p, `${rel} imports forbidden module "${p}"`).not.toMatch(
          /react-native|(^|\/)store(\/|$)|scoringEngine|statusColor|reducer/i,
        );
      }
    }
  });

  it('never dispatches or mutates score', () => {
    for (const rel of PURE_CORE) {
      const src = read(rel);
      expect(src, `${rel} must not dispatch()`).not.toMatch(/\bdispatch\s*\(/);
      expect(src, `${rel} must not mutate score`).not.toMatch(
        /setScore|SET_SCORE|awardScore|applyScore|mutateScore|addPoints/i,
      );
    }
  });
});
