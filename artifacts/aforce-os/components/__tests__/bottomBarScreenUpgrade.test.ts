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

  it('Home is a house, not a lightning bolt', () => {
    expect(layout).not.toMatch(/bolt\.circle|name="zap"/);
    expect(classic).toContain("focused ? 'house.fill' : 'house'");
    expect(classic).toContain('<Icon name="home"');
  });

  it('Circles is two people, never a trophy', () => {
    expect(classic).toContain("focused ? 'person.2.fill' : 'person.2'");
    expect(layout).not.toMatch(/trophy/i);
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
  it('is 64pt and raised 12pt', () => {
    expect(layout).toContain('export const ONE_BREATH_ORB_SIZE = 64;');
    expect(layout).toContain('export const ONE_BREATH_ORB_RAISE = 12;');
    expect(layout).toContain('top: -ONE_BREATH_ORB_RAISE');
  });

  it('is always red: there is no idle or grey state', () => {
    expect(layout).not.toContain('oneBreathOrbIdle');
    expect(orb).not.toContain('focused');
    expect(orb).toContain('afOrb.oneBreath');
  });

  it('carries the warm-white mark component, not a typed string', () => {
    expect(orb).toContain('<AFMark size={ONE_BREATH_TAB_MARK_SIZE} color={af.textPrimary} decorative />');
  });

  it('has no text label and is announced as "One Breath"', () => {
    const screen = classic.slice(classic.indexOf('name="one-breath-tab"'), classic.indexOf('name="moments-tab"'));
    expect(screen).toContain('tabBarShowLabel: false');
    expect(screen).toContain("tabBarAccessibilityLabel: 'One Breath'");
  });

  it('breathes on Home only, six seconds, and never with Reduce Motion', () => {
    expect(layout).toContain('export const ONE_BREATH_ORB_BREATH_MS = 6000;');
    expect(orb).toContain("const onHome = usePathname() === '/';");
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
    expect(orb).toContain('const hidden = useOrbHidden();');
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
