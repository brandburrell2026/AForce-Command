/**
 * S2-13 wave 1 — proven orphans stay dead; the palette stays single.
 *
 * The census: of the audit's "5,374 LOC of dead legacy", only TWO files
 * were true orphans — everything else is a route-imported flag-OFF
 * fallback (a deliberate rollback path whose retirement is a founder
 * ruling, catalogued in the S2-13 PR — including HomeScreenLegacy, whose
 * LAZY dynamic import the first census missed and whose deletion was
 * caught by tsc + the lazy-wiring lock and reverted). Deleted here:
 * LogIntakeRow (211 LOC, the S2-1 strand-proof orphan, referenced only
 * in comments) and recoveryCoachTokens (9/11 a value-for-value
 * af.* duplicate; the two deliberately-deeper focused-mode surfaces
 * survive as named constants in the coach screen).
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const PKG = resolve(__dirname, '..', '..');

describe('S2-13 — the orphans stay deleted', () => {
  for (const rel of [
    'components/LogIntakeRow.tsx',
    'theme/recoveryCoachTokens.ts',
  ]) {
    it(`${rel} does not exist`, () => {
      expect(existsSync(resolve(PKG, rel))).toBe(false);
    });
  }
});

describe('S2-13 — one palette', () => {
  it('the coach screen draws from af.* plus its two documented focused-mode surfaces', () => {
    const src = readFileSync(
      resolve(PKG, 'components/recoveryCoach/RecoveryCoachScreen.tsx'),
      'utf8',
    );
    const code = src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, '');
    expect(code).not.toContain('RecoveryCoachTokens');
    expect(src).toContain("import { af } from '@/theme'");
    expect(src).toContain("COACH_SURFACE = '#0D0E10'");
    expect(src).toContain("COACH_SURFACE_RAISED = '#141518'");
  });
});
