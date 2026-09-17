/**
 * Internal TestFlight Skin Intelligence suite — route and safety lock.
 *
 * The approved Figma screens are the primary internal experience. The older,
 * more detailed tools remain reachable behind their editorial landing pages.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const APP = resolve(__dirname, '..', '..');
const SUITE = resolve(APP, 'components', 'skinIntelligence', 'SkinIntelligenceEditorialSuite.tsx');
const source = readFileSync(SUITE, 'utf8');
const homeRoute = readFileSync(resolve(APP, 'app', '(tabs)', 'index.tsx'), 'utf8');

describe('internal Skin Intelligence editorial suite', () => {
  it('makes the Figma Skin Home the internal TestFlight home', () => {
    expect(homeRoute).toContain("EXPO_PUBLIC_INTERNAL_TESTFLIGHT");
    expect(homeRoute).toContain('<SkinIntelligenceHomeScreen />');
  });

  it.each([
    ['/skinia', 'skinia.tsx'],
    ['/sweat', 'sweat.tsx'],
    ['/cruise', 'cruise.tsx'],
    ['/guardian', 'guardian.tsx'],
    ['/clutch', 'clutch.tsx'],
    ['/sweat-calculator', 'sweat-calculator.tsx'],
    ['/cruise-console', 'cruise-console.tsx'],
    ['/guardian-console', 'guardian-console.tsx'],
    ['/clutch-console', 'clutch-console.tsx'],
    ['/weekly-report', 'weekly-report.tsx'],
  ])('%s resolves to a real route', (href, file) => {
    expect(source).toContain(`href="${href}"`);
    expect(existsSync(resolve(APP, 'app', file))).toBe(true);
  });

  it('identifies all seven approved Figma experiences', () => {
    for (const folio of [
      '01 / SKIN HOME',
      '02',
      '03 / SWEAT',
      '04 / CRUISE',
      '05 / GUARDIAN',
      '06 / CLUTCH',
      '07',
    ]) {
      expect(source).toContain(folio);
    }
  });

  it('opens each Figma landing page before its detailed legacy tool', () => {
    expect(source).toMatch(/SuiteLink index="03"[^\n]+href="\/sweat"/);
    expect(source).toMatch(/SuiteLink index="04"[^\n]+href="\/cruise"/);
    expect(source).toMatch(/SuiteLink index="05"[^\n]+href="\/guardian"/);
    expect(source).toMatch(/SuiteLink index="06"[^\n]+href="\/clutch"/);
  });

  it('keeps Skin Intelligence observational and explicitly non-diagnostic', () => {
    expect(source).toContain('VISUAL OBSERVATIONS ONLY');
    expect(source).toContain('NOT A DIAGNOSIS');
    expect(source).not.toMatch(/skin age|acne severity|rosacea|cancer|condition detected/i);
  });

  it('does not invent a visual result before a scan', () => {
    expect(source).toContain('NO SCAN YET');
    expect(source).toContain('No visual observation has been recorded today.');
  });
});
