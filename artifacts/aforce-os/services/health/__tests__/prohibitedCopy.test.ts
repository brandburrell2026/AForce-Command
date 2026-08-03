/**
 * Compliance regression lock (Score-Protection, D5).
 *
 * The WHOOP card previously claimed "FEEDING AFORCE HYDRATION SCORE · LIVE" —
 * the exact opposite of the Score-Protection contract (types/index.ts:
 * biometrics feed Readiness only, never the Score; governance/
 * AFORCE_OS_HEALTH_SOURCE_MATRIX.md). The copy is now
 * "INFORMING AFORCE READINESS · LIVE". This test scans EVERY locale file so
 * the prohibited claim can never return in any language.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const LOCALES_DIR = join(__dirname, '..', '..', '..', 'locales');

const PROHIBITED = [
  /FEEDING\s+AFORCE\s+HYDRATION\s+SCORE/i,
  /FEEDS?\s+(THE\s+)?HYDRATION\s+SCORE/i,
];

describe('prohibited Hydration-Score claim never returns', () => {
  const files = readdirSync(LOCALES_DIR).filter((f) => f.endsWith('.json'));

  it('locale files exist to scan', () => {
    expect(files.length).toBeGreaterThanOrEqual(11);
  });

  for (const file of files) {
    it(`${file} contains no prohibited Hydration-Score claim`, () => {
      const text = readFileSync(join(LOCALES_DIR, file), 'utf8');
      for (const pattern of PROHIBITED) {
        expect(text).not.toMatch(pattern);
      }
    });
  }

  it('en.json carries the approved replacement copy', () => {
    const en = JSON.parse(readFileSync(join(LOCALES_DIR, 'en.json'), 'utf8'));
    expect(en.settings.whoop.footer_live).toBe('INFORMING AFORCE READINESS · LIVE');
  });
});
