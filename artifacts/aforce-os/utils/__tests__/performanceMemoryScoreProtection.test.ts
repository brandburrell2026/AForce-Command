import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

/**
 * Score-Protection structural invariant.
 *
 * Performance Memory is strictly OBSERVATIONAL. These tests guard the contract
 * at the source level so a future edit cannot quietly wire memory into scoring:
 * the Performance Memory stack must never dispatch a reducer action, never call
 * a score-mutating helper, and (for the pure core) never even import the store
 * or any engine. This complements the behavioural tests — it fails the moment
 * someone *adds* a forbidden dependency, before any behaviour can change.
 */

const here = dirname(fileURLToPath(import.meta.url)); // artifacts/aforce-os/utils/__tests__
const aforceRoot = resolve(here, '..', '..'); // artifacts/aforce-os

const PURE_CORE = [
  'utils/performanceMemorySignals.ts',
  'utils/performanceMemoryUnified.ts',
];

const FULL_STACK = [
  ...PURE_CORE,
  'services/performanceMemoryCapture.ts',
  'hooks/useUnifiedPerformanceMemory.ts',
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

describe('Performance Memory — Score-Protection structural invariant', () => {
  it('the pure core imports neither the store, react-native, nor any engine', () => {
    for (const rel of PURE_CORE) {
      const paths = importPaths(read(rel));
      for (const p of paths) {
        expect(p, `${rel} imports forbidden module "${p}"`).not.toMatch(
          /react-native|(^|\/)store(\/|$)|engine|reducer/i,
        );
      }
    }
  });

  it('no Performance Memory file dispatches a reducer action', () => {
    for (const rel of FULL_STACK) {
      const src = read(rel);
      expect(src, `${rel} must not call dispatch()`).not.toMatch(/\bdispatch\s*\(/);
    }
  });

  it('no Performance Memory file calls a score-mutating helper', () => {
    for (const rel of FULL_STACK) {
      const src = read(rel);
      expect(src, `${rel} must not mutate score`).not.toMatch(
        /setScore|SET_SCORE|awardScore|applyScore|mutateScore|addPoints|setProviderBiometrics/i,
      );
    }
  });
});
