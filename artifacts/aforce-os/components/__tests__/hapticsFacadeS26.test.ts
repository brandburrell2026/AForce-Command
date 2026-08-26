/**
 * S2-6 — one door to the haptics engine.
 *
 * Before: 89 production files imported `expo-haptics` directly (127 call
 * sites), so no preference or platform rule could ever apply uniformly —
 * and `fireMoment`'s claim to respect a reduce-haptics preference was
 * aspirational (no such preference exists anywhere yet).
 *
 * Now: `services/haptics.ts` is the single boundary. Its `gate()` is the
 * one place a member/system haptics preference plugs in when the founder
 * commissions one; every texture is preserved via the three primitives.
 * Test files may still mock 'expo-haptics' — the façade calls it, so the
 * mocks stay effective.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const PKG = resolve(__dirname, '..', '..');
const ALLOW = new Set(['services/haptics.ts', 'services/hapticService.ts']);

describe('S2-6 — haptics boundary', () => {
  it('no production module outside the façade touches expo-haptics', () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(resolve(PKG, dir))) {
        const rel = join(dir, name);
        const full = resolve(PKG, rel);
        if (statSync(full).isDirectory()) {
          if (name === 'node_modules' || name === '__tests__') continue;
          walk(rel);
          continue;
        }
        if (!/\.tsx?$/.test(name) || name.includes('.test.')) continue;
        if (ALLOW.has(rel)) continue;
        if (readFileSync(full, 'utf8').includes('expo-haptics')) offenders.push(rel);
      }
    };
    for (const root of ['components', 'app', 'screens', 'services', 'hooks', 'store']) walk(root);
    expect(offenders).toEqual([]);
  });

  it('the façade exposes the gated primitives and a single gate', () => {
    const src = readFileSync(resolve(PKG, 'services/haptics.ts'), 'utf8');
    for (const fn of ['hapticSelection', 'hapticImpact', 'hapticNotify', 'fireMoment']) {
      expect(src).toContain(`export function ${fn}`);
    }
    expect((src.match(/function gate\(\)/g) ?? []).length).toBe(1);
    // Honesty: the gate documents that no preference exists yet, rather
    // than claiming to respect one.
    expect(src).toContain('no reduce-haptics preference EXISTS yet');
  });
});
