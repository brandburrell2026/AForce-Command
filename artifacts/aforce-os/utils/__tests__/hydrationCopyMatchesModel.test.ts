/**
 * The app must not tell a member something the approved model does not do.
 *
 * RA-N6: Smart Capture showed "{pct}% hydration credit" from the catalog's old
 * coefficient although, under `hydrostate-v2.0` (decision C1), only plain
 * water counts. RA-N8: the fixed 96 oz target was shown as the member's goal.
 *
 * These are source and pure-function laws: no renderer, no device.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import { smartCaptureCorrectionMetaKey } from '../hydration/smartCaptureCopy';
import { DRINK_CATEGORIES } from '../../data/drinkCatalog';
import { countsAsWater } from '../hydration/drinkRoute';
import { DAILY_TARGET_IS_PERSONAL, HYDROSTATE_MODEL_VERSION } from '../../config/hydroStateModel';
import en from '../../locales/en.json';

const ROOT = path.resolve(__dirname, '..', '..');
const read = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const COUNTED = 'hydroScan2.smartCapture.correction_meta_counted';
const RECORDED = 'hydroScan2.smartCapture.correction_meta_recorded';

describe('Smart Capture says what the model does (RA-N6)', () => {
  it('this file pins the approved model; revisit it when the model changes', () => {
    expect(HYDROSTATE_MODEL_VERSION).toBe('hydrostate-v2.0');
  });

  it('plain water is the only category that reads as counted', () => {
    for (const id of Object.keys(DRINK_CATEGORIES)) {
      const key = smartCaptureCorrectionMetaKey(id);
      expect(key, id).toBe(countsAsWater(id) ? COUNTED : RECORDED);
    }
    expect(smartCaptureCorrectionMetaKey('water')).toBe(COUNTED);
    expect(smartCaptureCorrectionMetaKey('bottled_water')).toBe(COUNTED);
    for (const id of ['coffee', 'tea', 'soda', 'juice', 'sports_drink', 'electrolyte', 'energy_drink', 'smoothie', 'custom']) {
      expect(smartCaptureCorrectionMetaKey(id), id).toBe(RECORDED);
    }
  });

  it('sparkling water reads as saved, exactly as it is logged', () => {
    expect(smartCaptureCorrectionMetaKey('water', 'Sparkling water')).toBe(RECORDED);
    expect(smartCaptureCorrectionMetaKey('bottled_water', 'San Pellegrino mineral')).toBe(RECORDED);
  });

  it('the two lines exist and neither promises a credit or a percentage', () => {
    const sc = (en as { hydroScan2: { smartCapture: Record<string, string> } }).hydroScan2.smartCapture;
    expect(sc['correction_meta_counted']).toContain('{{oz}}');
    expect(sc['correction_meta_recorded']).toContain('saved to your log');
    for (const line of [sc['correction_meta_counted'], sc['correction_meta_recorded']]) {
      expect(line).not.toMatch(/credit|%|\{\{pct\}\}/i);
    }
    expect(sc['correction_meta']).toBeUndefined();
  });

  it('no locale still carries a "hydration credit" string', () => {
    const dir = path.join(ROOT, 'locales');
    const offenders = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .filter((f) => /hydration credit/i.test(fs.readFileSync(path.join(dir, f), 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('the screen no longer turns the catalog coefficient into a percentage', () => {
    const src = read('components/SmartCaptureModal.tsx');
    expect(src).not.toMatch(/hydrationCoefficient[^\n]*\*\s*100/);
    expect(src).not.toContain("'hydroScan2.smartCapture.correction_meta'");
    expect(src).toContain('smartCaptureCorrectionMetaKey(');
  });
});

describe('the fixed daily target is labelled a starting point (RA-N8)', () => {
  it('the target is not personal today', () => {
    expect(DAILY_TARGET_IS_PERSONAL).toBe(false);
  });

  it('the Hydration tab shows the starting-point line whenever the target is not personal', () => {
    const src = read('components/hydration/HydrationScreenV2.tsx');
    expect(src).toMatch(/DAILY_TARGET_IS_PERSONAL \? null : \(/);
    expect(src).toContain("t('hydration.v2.target_starting_point'");
  });

  it('the line says it is the same for everyone and not a recommendation', () => {
    const line = (en as { hydration: { v2: Record<string, string> } }).hydration.v2['target_starting_point'];
    expect(line).toContain('{{target}}');
    expect(line).toMatch(/starting point/i);
    expect(line).toMatch(/same for every member/i);
    expect(line).toMatch(/not a personal recommendation/i);
  });

  it('Protocol does not call the fixed number a goal', () => {
    const src = read('app/(tabs)/protocol.tsx');
    expect(src).toContain("DAILY_TARGET_IS_PERSONAL ? 'Hydration goal' : 'Starting point'");
  });
});

describe('the drink catalog no longer claims its coefficients score anything', () => {
  it('the header marks them historical', () => {
    const src = read('data/drinkCatalog.ts');
    expect(src).toContain('HISTORICAL, not used by the score');
    expect(src).not.toContain('Score impact = enteredOz');
  });
});
