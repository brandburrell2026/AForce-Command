/**
 * S2-5 — one rule for clearing the absolute tab bar.
 *
 * The audit found four private answers (Home derived; Hydration 40pt
 * under-pad — content UNDER the bar; Scan bar-blind; Protocol/Circle
 * device-blind constants; Sleep a third correct-but-parallel pattern).
 * `useTabBarClearance` promotes Home's founder-ratified rule; these locks
 * keep every tab surface on it and the old guesses extinct.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const PKG = resolve(__dirname, '..', '..');
const read = (rel: string) => readFileSync(resolve(PKG, rel), 'utf8');

const SCREENS = [
  'components/hydration/HydrationScreenV2.tsx',
  'components/scan/HydrationScanScreenV2.tsx',
  'components/protocol/ProtocolScreenV2.tsx',
  'components/community/CircleScreenV3.tsx',
  'screens/SleepModeScreen.tsx',
];

describe('S2-5 — tab screens derive clearance from the published bar height', () => {
  for (const rel of SCREENS) {
    it(`${rel} uses useTabBarClearance`, () => {
      const src = read(rel);
      expect(src).toContain("from '@/hooks/useTabBarClearance'");
      expect(src).toMatch(/useTabBarClearance\(\)/);
    });
  }

  it('the device-blind guesses are extinct in the migrated screens', () => {
    for (const rel of SCREENS) {
      const src = read(rel);
      expect(src, rel).not.toMatch(/height:\s*40\s*\}/);
      expect(src, rel).not.toMatch(/paddingBottom:\s*Spacing\[24\] \+ Spacing\[8\]/);
      if (rel.includes('Sleep')) expect(src).not.toContain('TAB_BAR_HEIGHT');
    }
  });

  it('the hook is the thin context-read over the proven pure rule', () => {
    const hook = read('hooks/useTabBarClearance.ts');
    expect(hook).toContain('BottomTabBarHeightContext');
    expect(hook).toContain("from '@/components/home/homeSafeArea'");
  });
});
