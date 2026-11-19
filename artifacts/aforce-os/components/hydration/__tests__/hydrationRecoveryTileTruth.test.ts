/**
 * Hydration "Recovery" row truth lock.
 *
 * History: the row once rendered `titleCase(engine.performanceState.level)`
 * in a status badge — the band the engine already owns, restated as if it
 * were a recovery reading. Founder rulings (2026-08-13; Correction 6,
 * build-61 device QA) replaced it with an honest em dash.
 *
 * Screen Upgrade v1.1 (App Spec v1.8.2, Appendix G) goes one step further:
 * 'Electrolytes "0 servings" and Recovery "—": hide a row until it has data.'
 * So the row is now not drawn at all. The original lock still holds: the band
 * may never come back as a "Recovery" reading.
 *
 * Source-scan idiom (store+router containers are never mounted directly —
 * house convention).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { hydrationStatRows, HYDRATION_HAS_RECOVERY_READING } from '../hydrationStatRows';

const SRC = readFileSync(join(__dirname, '..', 'HydrationScreenV2.tsx'), 'utf8');

describe('Hydration card — rows are hidden until they have data', () => {
  it('Electrolytes is hidden at zero servings and shown from one', () => {
    expect(hydrationStatRows({ aforceUnitsToday: 0 }).electrolytes).toBe(false);
    expect(hydrationStatRows({ aforceUnitsToday: 1 }).electrolytes).toBe(true);
    expect(hydrationStatRows({ aforceUnitsToday: 3 }).electrolytes).toBe(true);
  });

  it('a bad count never shows the row', () => {
    expect(hydrationStatRows({ aforceUnitsToday: Number.NaN }).electrolytes).toBe(false);
    expect(hydrationStatRows({ aforceUnitsToday: -1 }).electrolytes).toBe(false);
  });

  it('Recovery has no reading, so it is hidden', () => {
    expect(HYDRATION_HAS_RECOVERY_READING).toBe(false);
    expect(hydrationStatRows({ aforceUnitsToday: 2 }).recovery).toBe(false);
  });

  it('the screen draws Electrolytes only through the rule, and no Recovery row', () => {
    expect(SRC).toMatch(/statRows\.electrolytes\s*\?/);
    expect(SRC).not.toContain("hydration.v2.recovery_label");
    expect(SRC).not.toContain('EM_DASH');
  });

  it("today's intake and the starting-point caption are still shown", () => {
    expect(SRC).toContain('amount={hero.amount}');
    expect(SRC).toContain("hydration.v2.target_starting_point");
  });
});

describe('Hydration "Recovery" — never a second verdict', () => {
  it('the band word can no longer be restated as a "Recovery" reading', () => {
    expect(SRC).not.toMatch(/AFStatusBadge/);
    expect(SRC).not.toMatch(/titleCase\(engine\.performanceState\.level\)/);
  });
});
