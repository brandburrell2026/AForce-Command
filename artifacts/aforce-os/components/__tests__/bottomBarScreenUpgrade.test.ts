/**
 * The bottom bar matches Screen Upgrade v1.1 §1 (Nov 5, 2026).
 *
 * Source and pure-function laws. They pin the rules the spec states; they do
 * not prove how the bar looks on a phone, which needs a device.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { Colors } from '../../theme/colors';
import { af } from '../../theme/afTokens';
import {
  isOrbHidden,
  requestOrbHidden,
  resetOrbVisibility,
  ORB_HIDDEN_PREPARATION_SCREENS,
} from '../../services/orbVisibility';

const root = resolve(__dirname, '..', '..');
const layout = readFileSync(resolve(root, 'app', '(tabs)', '_layout.tsx'), 'utf8');
const prep = readFileSync(resolve(root, 'components/oneBreath/MomentPreparationScreen.tsx'), 'utf8');
/** The classic layout is the one that ships; native tabs are flagged off. */
const classic = layout.slice(layout.indexOf('function ClassicTabLayout()'));
const orb = layout.slice(layout.indexOf('function OneBreathTabIcon()'), layout.indexOf('function ClassicTabLayout()'));

describe('colours', () => {
  it('inactive is muted, active is warm white, the indicator is Signal Red', () => {
    expect(Colors.tabBar.inactive.toUpperCase()).toBe('#AEAAA3');
    expect(Colors.tabBar.active.toUpperCase()).toBe('#F7F4EF');
    expect(Colors.tabBar.indicator.toUpperCase()).toBe('#E51E2A');
  });

  it('icons and labels take the active tint, so they are never red', () => {
    expect(classic).toContain('tabBarActiveTintColor: Colors.tabBar.active');
    expect(classic).toContain('tabBarInactiveTintColor: Colors.tabBar.inactive');
    expect(Colors.tabBar.active).not.toBe(af.red);
    expect(Colors.tabBar.active).not.toBe(af.redText);
  });
});

describe('order and icons', () => {
  it('Home · Hydration · One Breath · Moments · Circles, in that order', () => {
    const order = ['name="index"', 'name="journal"', 'name="one-breath-tab"', 'name="moments-tab"', 'name="competition"'].map((n) => classic.indexOf(n));
    expect(order.every((i) => i > -1)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  // Founder instruction 2026-11-18: the bar must match the approved prototype.
  // Its four icons are the prototype's own drawings, the same on both platforms.
  // Founder direction 2026-11-22 (Brandon): no water icon on the Hydration tab.
  // Its label stands alone; the other three keep the prototype's drawings.
  it('uses the prototype icons for Home, Moments and Circles, and no water icon for Hydration', () => {
    for (const name of ['home', 'moments', 'circles']) {
      expect(classic).toContain(`<TabGlyph name="${name}" color={color} />`);
    }
    expect(classic).not.toContain('name="hydration"');
    expect(layout).not.toMatch(/drop\.circle|droplet/);
    const glyphSrc = require('node:fs').readFileSync(
      require('node:path').join(__dirname, '..', 'navigation', 'TabGlyph.tsx'),
      'utf8',
    ) as string;
    expect(glyphSrc).not.toContain("name === 'hydration'");
    expect(layout).not.toMatch(/bolt\.circle|name="zap"/);
    expect(layout).not.toMatch(/trophy/i);
  });

  it('draws them as the prototype does: 18pt, 1.4pt stroke', () => {
    const glyph = require('node:fs').readFileSync(
      require('node:path').join(__dirname, '..', 'navigation', 'TabGlyph.tsx'),
      'utf8',
    ) as string;
    expect(glyph).toContain('TAB_GLYPH_SIZE = 18');
    expect(glyph).toContain('const STROKE = 1.4;');
    expect(glyph).toContain('M3 5h12M3 9h9M3 13h6');
  });
});

describe('labels', () => {
  it('Inter 11pt, sentence case', () => {
    expect(layout).toContain('export const TAB_LABEL_FONT_SIZE = 11;');
    expect(classic).toContain('fontFamily: Typography.fonts.medium');
    expect(classic).not.toContain("textTransform: 'uppercase'");
    expect(classic).not.toContain('Typography.roles.mono');
  });
});

describe('the One Breath orb', () => {
  it('is 46pt, raised 22pt, with a 5pt black ring, as in the prototype', () => {
    expect(layout).toContain('export const ONE_BREATH_ORB_SIZE = 46;');
    expect(layout).toContain('export const ONE_BREATH_ORB_RAISE = 22;');
    expect(layout).toContain('export const ONE_BREATH_ORB_RING = 5;');
    expect(layout).toContain('top: -(ONE_BREATH_ORB_RAISE + ONE_BREATH_ORB_RING)');
    expect(layout).toContain('backgroundColor: Colors.tabBar.background,');
  });

  it('is always red: there is no idle or grey state', () => {
    expect(layout).not.toContain('oneBreathOrbIdle');
    expect(orb).not.toContain('focused');
    expect(orb).toContain('afOrb.oneBreath');
  });

  it('carries the warm-white mark component, not a typed string', () => {
    expect(orb).toContain('<AFMark size={ONE_BREATH_TAB_MARK_SIZE} color={af.textPrimary} decorative />');
  });

  it('is labelled "Breath", as in the prototype, and announced as "One Breath"', () => {
    const screen = classic.slice(classic.indexOf('name="one-breath-tab"'), classic.indexOf('name="moments-tab"'));
    expect(screen).toContain("title: 'Breath'");
    expect(screen).not.toContain('tabBarShowLabel: false');
    expect(screen).toContain("tabBarAccessibilityLabel: 'One Breath'");
  });

  it('breathes on Home only, six seconds, and never with Reduce Motion', () => {
    expect(layout).toContain('export const ONE_BREATH_ORB_BREATH_MS = 6000;');
    expect(orb).toContain("const onHome = pathname === '/';");
    expect(orb).toContain('const breathe = onHome && !reducedMotion && !hidden;');
    expect(orb).toMatch(/if \(!breathe\) \{\s*scale\.stopAnimation\(\);\s*scale\.setValue\(1\);/);
  });

  it('is tap only: no hold or long-press handler is attached to it', () => {
    const screen = classic.slice(classic.indexOf('name="one-breath-tab"'), classic.indexOf('name="moments-tab"'));
    expect(screen).not.toMatch(/tabLongPress|onLongPress|onPressIn/);
    expect(orb).not.toMatch(/onLongPress|onPressIn|voice|startListening/);
  });
});

describe('the orb is hidden on Seal and Quiet', () => {
  beforeEach(() => resetOrbVisibility());

  it('those are exactly the states that hide it', () => {
    expect([...ORB_HIDDEN_PREPARATION_SCREENS].sort()).toEqual(['quiet', 'seal']);
  });

  it('the preparation screen asks for it', () => {
    expect(prep).toContain('useHideOrbWhile(ORB_HIDDEN_PREPARATION_SCREENS.includes(screen));');
  });

  it('the orb renders nothing while hidden', () => {
    expect(orb).toContain('const requestedHidden = useOrbHidden();');
    expect(orb).toContain('const hidden = orbHiddenOn(pathname, requestedHidden);');
    expect(orb).toContain('if (hidden) return null;');
  });

  it('a request hides it and withdrawing shows it again', () => {
    expect(isOrbHidden()).toBe(false);
    const release = requestOrbHidden();
    expect(isOrbHidden()).toBe(true);
    release();
    expect(isOrbHidden()).toBe(false);
  });

  it('two requests need two withdrawals, and withdrawing twice counts once', () => {
    const a = requestOrbHidden();
    const b = requestOrbHidden();
    a();
    a();
    expect(isOrbHidden()).toBe(true);
    b();
    expect(isOrbHidden()).toBe(false);
  });
});

describe('long-press Hydration opens HydroScan', () => {
  it('the Hydration tab listens for a long press and routes to scan', () => {
    const screen = classic.slice(classic.indexOf('name="journal"'), classic.indexOf('name="protocol"'));
    expect(screen).toContain("listeners={{ tabLongPress: () => router.push('/scan') }}");
  });

  it('the tab button forwards long presses', () => {
    expect(layout).toContain('onLongPress={onLongPress as (() => void) | undefined}');
  });
});

describe('what this change leaves alone', () => {
  it('tab-change haptics stay off (an earlier founder rule; the spec asks for a tick)', () => {
    expect(layout).not.toMatch(/hapticSelection|hapticImpact|Haptics\./);
  });
});

describe('the orb never disappears from the other tabs (build 168 device report)', () => {
  const layout = require('node:fs').readFileSync(
    require('node:path').join(__dirname, '..', '..', 'app', '(tabs)', '_layout.tsx'),
    'utf8',
  ) as string;
  // The rule, restated so it runs without loading the navigator.
  const orbHiddenOn = (pathname: string, requested: boolean) => requested && pathname.startsWith('/one-breath');

  it('the layout hides the orb only on One Breath routes', () => {
    expect(layout).toContain("return requested && pathname.startsWith('/one-breath');");
  });
  it('a hide request left behind on Seal or Quiet does not hide the orb elsewhere', () => {
    for (const path of ['/', '/journal', '/moments-tab', '/competition', '/profile']) {
      expect(orbHiddenOn(path, true)).toBe(false);
    }
    expect(orbHiddenOn('/one-breath-tab', true)).toBe(true);
    expect(orbHiddenOn('/one-breath', true)).toBe(true);
    expect(orbHiddenOn('/one-breath-tab', false)).toBe(false);
  });
  it('the label under the orb is the prototype\'s "Breath", not the route name', () => {
    expect(layout).toContain("title: 'Breath'");
    expect(layout).not.toContain("title: 'One Breath'");
  });
});
