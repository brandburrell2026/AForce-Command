/**
 * HydroScan · a barcode not in the list is finished by taps, and nothing is
 * logged before "Log it" (spec drinks 5, D3, D6).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DRINK_CATEGORIES } from '../../data/drinkCatalog';
import { drinkRoute } from '../../utils/hydration/drinkRoute';

const AOS = join(__dirname, '..', '..');
const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|\s)\/\/[^\n]*/g, '$1');
const flow = strip(readFileSync(join(AOS, 'components', 'scan', 'hydroscan', 'HydroScanUnknown.tsx'), 'utf8'));
const screen = strip(readFileSync(join(AOS, 'components', 'editorial', 'scan', 'EditorialScanScreen.tsx'), 'utf8'));
const kinds = [...flow.matchAll(/categoryId: "([a-z_]+)", label: "([^"]+)"/g)].map((m) => ({ categoryId: m[1]!, label: m[2]! }));

describe('HydroScan · unknown product', () => {
  it('offers the wording page\'s five kinds, each a real category in the app\'s catalog', () => {
    expect(kinds.map((k) => k.label)).toEqual(['Water', 'Electrolyte drink', 'Sports drink', 'Coffee', 'Energy drink']);
    for (const k of kinds) expect(DRINK_CATEGORIES, k.categoryId).toHaveProperty(k.categoryId);
  });

  it('only Water goes down the scored rail; the rest cannot move HydroState', () => {
    for (const k of kinds) {
      expect(drinkRoute({ categoryId: k.categoryId, name: k.label, enteredOz: 12 }).kind, k.label).toBe(k.categoryId === 'water' ? 'water' : 'recorded');
    }
  });

  it('uses the reviewed wording and says nothing is logged until the member logs it', () => {
    expect(flow).toContain('I don’t know this product yet.');
    expect(flow).toContain('I won’t guess what it is. Pick what kind of drink it is, or type it.');
    expect(flow).toContain('Nothing is logged.');
    expect(flow).toContain('How much?');
    expect(flow).toMatch(/label="Log it"/);
    expect(flow).toMatch(/label="Type it"/);
  });

  it('the flow itself writes nothing and shows no score of the member', () => {
    expect(flow).not.toMatch(/logIntake|postRecordedDrink|undoIntake|fetch\(/);
    expect(flow).not.toMatch(/HydroState \d|ResultCard|score/i);
  });

  it('picking a kind or an amount never logs: only "Log it" reaches the write', () => {
    expect(screen).toMatch(/onPick=\{\(k\) => setUnknown\(/);
    expect(screen).toMatch(/onAmount=\{\(oz\) => setUnknown\(/);
    expect(screen).toMatch(/onLog=\{\(\) => void onLogUnknown\(\)\}/);
    const handler = /const onLogUnknown = [\s\S]*?\n  };/.exec(screen)?.[0] ?? '';
    expect(handler).toMatch(/confirmInFlightRef\.current = true/);
    expect(handler).toMatch(/await onConfirmDrink\(/);
  });

  it('Undo is offered only for a log the existing undo can take back', () => {
    expect(screen).toMatch(/onUndo=\{loggedCycleId != null && \/\^intake-\\d\+\$\/\.test\(loggedCycleId\) \? \(\) => void onUndoLog\(\) : undefined\}/);
  });
});
