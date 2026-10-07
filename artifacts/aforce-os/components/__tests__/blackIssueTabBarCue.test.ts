/**
 * Black Issue tab bar — selection is never colour alone (PR 1 review B2).
 *
 * The active tint (#E4564A) and inactive grey (#8D897F) are near-identical in
 * luminance, so WCAG 1.4.1 requires a second cue. This lock pins the two
 * colour-independent cues in app/(tabs)/_layout.tsx: the 2pt mark above the
 * selected item (every platform) and the filled SF Symbol on iOS. It also
 * pins the S2-14b tracking yield on the mono labels.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Colors } from '../../theme/colors';
import { contrast } from '../../theme/__tests__/_wcagContrast';

const src = readFileSync(resolve(__dirname, '..', '..', 'app', '(tabs)', '_layout.tsx'), 'utf8');

describe('tab selection carries a non-colour cue', () => {
  it('the tints alone are not distinguishable (why the cue exists)', () => {
    expect(contrast(Colors.tabBar.active, Colors.tabBar.inactive)).toBeLessThan(3);
  });

  it('the selected item draws the 2pt mark, hidden from the reader', () => {
    // React Navigation 7 passes `aria-selected`, not `accessibilityState`, to
    // a custom tabBarButton (node_modules/@react-navigation/bottom-tabs/src/
    // views/BottomTabItem.tsx) — the cue must read THAT prop (#1088 review B1)
    // and forward the selected state so the reader announces it.
    expect(src).toMatch(/'aria-selected': ariaSelected/);
    expect(src).toMatch(/const selected = Boolean\(\s*ariaSelected \?\?/);
    expect(src).toContain('aria-selected={selected}');
    expect(src).toMatch(/accessibilityState=\{\{[^}]*selected\s*\}\}/);
    expect(src).toContain('testID="tab-selected-mark"');
    expect(src).toMatch(/selectedMark:\s*\{[\s\S]*?height:\s*2[\s\S]*?backgroundColor:\s*Colors\.tabBar\.active/);
  });

  it('every iOS symbol swaps to its filled variant when focused', () => {
    const icons = src.match(/tabBarIcon: \(\{ color, size, focused \}\)/g) ?? [];
    const filled = src.match(/focused \? '[a-z.]+\.fill' : '[a-z.]+'/g) ?? [];
    expect(icons.length).toBeGreaterThanOrEqual(5);
    expect(filled.length).toBe(icons.length);
  });

  it('mono label tracking yields at accessibility sizes (S2-14b)', () => {
    expect(src).toContain('afEyebrowAt(fontScale).letterSpacing');
    expect(src).toMatch(/letterSpacing:\s*labelTracking/);
  });
});
