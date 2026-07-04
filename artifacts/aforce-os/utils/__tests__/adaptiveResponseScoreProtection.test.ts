import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

/**
 * Score-Protection structural invariant for the Section 59 Adaptive Response
 * Engine. It is strictly OBSERVATIONAL: it must never import the store or an
 * engine, never dispatch, never call a score-mutating helper, and never read a
 * command_confirmation's `delta` (which would couple response learning to score
 * movement). This fails the moment someone adds a forbidden dependency.
 */

const here = dirname(fileURLToPath(import.meta.url));
const aforceRoot = resolve(here, '..', '..');

const PURE_CORE = [
  'utils/intelligence/adaptiveResponseEngine.ts',
  'utils/intelligence/responseLanguage.ts',
  'types/adaptiveResponse.ts',
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

describe('Section 59 — Adaptive Response Engine Score-Protection invariant', () => {
  it('imports neither the store, react-native, nor any engine/reducer', () => {
    for (const rel of PURE_CORE) {
      for (const p of importPaths(read(rel))) {
        expect(p, `${rel} imports forbidden module "${p}"`).not.toMatch(
          /react-native|(^|\/)store(\/|$)|engine|reducer/i,
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

  it('never reads a confirmation delta (response learning is decoupled from score)', () => {
    const engine = read('utils/intelligence/adaptiveResponseEngine.ts');
    expect(engine, 'engine must not read .delta').not.toMatch(/\.delta\b/);
  });
});
