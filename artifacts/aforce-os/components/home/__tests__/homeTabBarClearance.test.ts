/**
 * HomeScreenV2 — the bottom padding is DERIVED, and no device constant is left
 * behind (founder amendment §2).
 *
 * THE DEFECT THIS LOCKS OUT. Home applied no device-derived bottom inset:
 * `AFScreen` defaults `edges={['top']}`, this screen sets no
 * `contentInsetAdjustmentBehavior`, and `app/(tabs)/_layout.tsx` makes the tab
 * bar `position: 'absolute'` — so react-navigation renders scenes at
 * `absoluteFill` and only PUBLISHES the bar's height via
 * `BottomTabBarHeightContext`, injecting no padding. Home compensated with a
 * hard-coded 128 on the V3 path and a flat 40 otherwise, against a real bar of
 * `49 + insets.bottom`.
 *
 * SOURCE-TEXT GUARD, per this directory's documented convention: `HomeScreenV2`
 * is a store + router + Clerk-connected container the suite never mounts (see
 * `homeScreenV2Wiring.test.ts`'s header for the full rationale). The GEOMETRY —
 * that the derived padding clears the bar on a short, standard and large iPhone,
 * at every content height including Dynamic-Type-inflated ones — is proved in
 * `homeSafeArea.test.ts`. This file covers the half that lives at the call site:
 * that the screen reads the published height at all, reads it through the
 * CONTEXT rather than the throwing hook, feeds it to the tested resolver, and
 * carries no device-specific constant anywhere.
 *
 * Every describe block carries a mutation-verify test, because a source-text
 * assertion that cannot fail on a mutated source is decoration.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SOURCE = readFileSync(join(__dirname, '..', 'HomeScreenV2.tsx'), 'utf8');
/** Comments describe the constants that were REMOVED; CODE is what runs. */
const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, '');

describe('amendment §2 — Home reads the height the navigator publishes', () => {
  it('imports the bottom-tab-bar height CONTEXT', () => {
    expect(CODE).toContain(
      "import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';",
    );
  });

  it('reads it with React.useContext, defaulting to a real zero', () => {
    expect(CODE).toMatch(
      /const tabBarHeight = React\.useContext\(BottomTabBarHeightContext\) \?\? 0;/,
    );
  });

  it('does NOT use useBottomTabBarHeight() — that hook throws off-navigator', () => {
    // `useBottomTabBarHeight` throws "Couldn't find the bottom tab bar height"
    // when the context is undefined. Home has to stay mountable in isolation
    // for its render harnesses, so the context read is not a style preference.
    expect(CODE).not.toContain('useBottomTabBarHeight');
  });

  it('adds no store slice to get it — the render-count guarantees are untouched', () => {
    // Pinned bidirectionally by `homeScreenV2RenderCount.render.test.tsx`; this
    // is the local statement of the same rule for the code added here.
    const read = CODE.slice(
      CODE.indexOf('const tabBarHeight ='),
      CODE.indexOf('const scrollBottomPadding ='),
    );
    expect(read.length).toBeGreaterThan(20); // guard the slice
    expect(read).not.toMatch(/use[A-Za-z]*Slice/);
    expect(read).not.toContain('useSafeAreaInsets');
  });

  it('mutation-verify: swapping the context for the throwing hook is detectable', () => {
    const mutated = CODE.replace(
      'React.useContext(BottomTabBarHeightContext) ?? 0',
      'useBottomTabBarHeight()',
    );
    expect(mutated).toContain('useBottomTabBarHeight');
    expect(mutated).not.toMatch(/React\.useContext\(BottomTabBarHeightContext\)/);
  });
});

describe('amendment §2 — the padding is derived from that height', () => {
  it('hands the published height to the tested resolver', () => {
    expect(CODE).toContain("import { resolveHomeScrollBottomPadding } from './homeSafeArea';");
    expect(CODE).toMatch(
      /const scrollBottomPadding = resolveHomeScrollBottomPadding\(tabBarHeight\);/,
    );
  });

  it('and that derived value is what the scroll content is actually padded with', () => {
    // The failure this catches: deriving the number correctly and then not
    // wiring it up — a fix that computes and discards.
    expect(CODE).toMatch(
      /<AFScreen scroll contentContainerStyle=\{\{ paddingBottom: scrollBottomPadding \}\}>/,
    );
  });

  it('one rule for BOTH signal layouts — the V3 branch no longer forks the padding', () => {
    expect(CODE).not.toContain('scrollContentV3');
    expect(CODE).not.toContain('styles.scrollContent');
  });

  it('mutation-verify: a derived value that never reaches the ScrollView is detectable', () => {
    const mutated = CODE.replace(
      'contentContainerStyle={{ paddingBottom: scrollBottomPadding }}',
      'contentContainerStyle={styles.scrollContent}',
    );
    expect(mutated).not.toMatch(/paddingBottom: scrollBottomPadding/);
  });
});

describe('amendment §2 — no device-specific constant survives on Home', () => {
  it('the hard-coded 128 is gone', () => {
    // `Spacing[24] + Spacing[8]` — 96 + 32 — was 79pt of clearance on an SE and
    // 45pt on an iPhone 15: one constant, two different layouts.
    expect(CODE).not.toMatch(/Spacing\[24\]\s*\+\s*Spacing\[8\]/);
    expect(CODE).not.toContain('Spacing[24]');
  });

  it('no bare pixel bottom-padding literal is left in the stylesheet', () => {
    const stylesheet = CODE.slice(CODE.indexOf('const styles = StyleSheet.create('));
    expect(stylesheet.length).toBeGreaterThan(100); // guard the slice
    expect(stylesheet).not.toMatch(/paddingBottom:\s*\d/);
  });

  it('Home never re-implements the bar height or the safe-area inset itself', () => {
    // The other way to "fix" this wrong: measuring the device on Home.
    expect(CODE).not.toContain('useSafeAreaInsets');
    expect(CODE).not.toContain('TAB_BAR_HEIGHT');
    expect(CODE).not.toContain('WEB_BOTTOM_PADDING');
    // Scoped to the screen-measuring APIs — `resolveArcDimensions` is the
    // unrelated (and legitimate) arc-sizing resolver, not a device read.
    expect(CODE).not.toContain('Dimensions.get');
    expect(CODE).not.toContain('useWindowDimensions');
  });

  it('and does not reach for AFScreen `edges` instead — that shell is shared by 12+ surfaces', () => {
    // HOME-ONLY rule: adding `edges={['bottom']}` here would be harmless, but
    // changing AFScreen's default would move every non-tab screen in the app.
    // Recording the boundary so a future "simplification" has to argue with it.
    expect(CODE).not.toMatch(/<AFScreen[^>]*edges=/);
  });

  it('mutation-verify: a reintroduced device constant is detectable', () => {
    const mutated = CODE.replace(
      'contentContainerStyle={{ paddingBottom: scrollBottomPadding }}',
      'contentContainerStyle={{ paddingBottom: Spacing[24] + Spacing[8] }}',
    );
    expect(mutated).toMatch(/Spacing\[24\]\s*\+\s*Spacing\[8\]/);
  });
});
