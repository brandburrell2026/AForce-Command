/**
 * Home — tab-bar clearance, proved as geometry (founder amendment §2).
 *
 * WHAT THIS FILE IS. The founder asked for regression coverage at a short
 * device (iPhone SE class), a standard iPhone, a large iPhone, and under
 * Dynamic Type, proving the CTA stays fully tappable and visually clear of the
 * persistent navigation. `HomeScreenV2` is a store + router + Clerk-connected
 * container this suite never mounts (see `homeScreenV2Wiring.test.ts`'s header
 * for the convention), and this repo has no width/height-sensitive render
 * harness to extend — so the coverage is split the way this directory already
 * splits it: the DECISION is unit-tested here against real device geometry, and
 * the screen's use of it is locked in `homeTabBarClearance.test.ts`.
 *
 * THE MODEL. A ScrollView's reachable geometry is fully determined by four
 * numbers, all of which are known here:
 *
 *   scrollHeight   = contentHeight + paddingBottom
 *   maxScrollOffset= max(0, scrollHeight - viewportHeight)
 *   lastPixelY     = contentHeight - maxScrollOffset   (screen coords, scrolled to the end)
 *   tabBarTop      = viewportHeight - tabBarHeight
 *
 * The clearance the member actually sees is `tabBarTop - lastPixelY`. Nothing
 * about Home's internals enters that, which is exactly why this is testable
 * without mounting Home: if the LAST pixel of the scroll clears the bar, every
 * element above it — including the LOG WATER button — clears it too. Bounding
 * the worst case is a stronger claim than measuring one button.
 *
 * The device numbers below are real: react-navigation's `getTabBarHeight`
 * returns `TABBAR_HEIGHT_UIKIT (49) + insets.bottom`, so the published height is
 * 49 on a home-button device and 83 on a notched one.
 */
import { describe, it, expect } from 'vitest';
import {
  resolveHomeScrollBottomPadding,
  HOME_BOTTOM_BREATHING_ROOM,
} from '../homeSafeArea';

interface Device {
  name: string;
  /** Portrait viewport height in pt (the scene, which is `absoluteFill` under the bar). */
  viewportHeight: number;
  /** Bottom safe-area inset in pt. */
  bottomInset: number;
}

/** react-navigation's own constant — the bar's height before the safe-area inset. */
const TABBAR_HEIGHT_UIKIT = 49;

const DEVICES: Device[] = [
  // Short device — the founder's measured case. No home indicator, so the bar
  // is the bare 49 and the viewport is the smallest the product supports.
  { name: 'iPhone SE (3rd gen) — 375x667, no home indicator', viewportHeight: 667, bottomInset: 0 },
  // Standard iPhone.
  { name: 'iPhone 15 — 393x852, home indicator', viewportHeight: 852, bottomInset: 34 },
  // Large iPhone.
  { name: 'iPhone 15 Pro Max — 430x932, home indicator', viewportHeight: 932, bottomInset: 34 },
];

/** The height react-navigation publishes through `BottomTabBarHeightContext`. */
function publishedTabBarHeight(device: Device): number {
  return TABBAR_HEIGHT_UIKIT + device.bottomInset;
}

/**
 * Gap in pt between the last pixel of Home (scrolled to the end) and the top
 * edge of the tab bar. Negative means content is trapped underneath the bar.
 */
function clearance(opts: {
  device: Device;
  contentHeight: number;
  paddingBottom: number;
}): number {
  const { device, contentHeight, paddingBottom } = opts;
  const maxScrollOffset = Math.max(0, contentHeight + paddingBottom - device.viewportHeight);
  const lastPixelY = contentHeight - maxScrollOffset;
  const tabBarTop = device.viewportHeight - publishedTabBarHeight(device);
  return tabBarTop - lastPixelY;
}

/**
 * Home content heights to sweep, in pt, EXCLUDING the bottom padding.
 *
 * 681 is the founder's measured figure — where the LOG WATER button's bottom
 * edge sat on a 667pt SE — so the sweep starts below Home's real content height
 * and runs well past it. The tall end stands in for Dynamic Type: the largest
 * accessibility text sizes roughly double the height of a text-heavy column,
 * and Home caps its display numerals at `AF_MAX_DISPLAY_FONT_SCALE` while its
 * labels scale freely. Short heights are included on purpose — a screen that
 * does not fill the viewport must not be "fixed" into overlapping the bar.
 */
const CONTENT_HEIGHTS = [200, 400, 600, 681, 700, 900, 1100, 1400, 1800, 2400];

describe('resolveHomeScrollBottomPadding — derived, never device-specific', () => {
  it('is the published tab-bar height plus one token of breathing room', () => {
    for (const device of DEVICES) {
      const published = publishedTabBarHeight(device);
      expect(resolveHomeScrollBottomPadding(published)).toBe(
        published + HOME_BOTTOM_BREATHING_ROOM,
      );
    }
  });

  it('treats "no tab bar above me" as a real zero, not a guess', () => {
    // Home mounted outside the tab navigator (render harness, deep-linked
    // preview): the context is undefined. There is genuinely no bar to clear,
    // so the screen keeps exactly the bottom spacer it has always had.
    expect(resolveHomeScrollBottomPadding(undefined)).toBe(HOME_BOTTOM_BREATHING_ROOM);
    expect(resolveHomeScrollBottomPadding(null)).toBe(HOME_BOTTOM_BREATHING_ROOM);
    expect(resolveHomeScrollBottomPadding(0)).toBe(HOME_BOTTOM_BREATHING_ROOM);
  });

  it('never returns less than the breathing room, whatever the navigator reports', () => {
    // Defensive, not hypothetical: a negative or non-finite height would
    // otherwise subtract padding and pull content INTO the bar.
    for (const bogus of [-1, -200, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(resolveHomeScrollBottomPadding(bogus)).toBeGreaterThanOrEqual(
        HOME_BOTTOM_BREATHING_ROOM,
      );
    }
  });

  it('is monotonic in the published height — a taller bar always buys more padding', () => {
    let previous = resolveHomeScrollBottomPadding(0);
    for (const height of [49, 60, 83, 96, 120]) {
      const next = resolveHomeScrollBottomPadding(height);
      expect(next).toBeGreaterThan(previous);
      previous = next;
    }
  });
});

describe('the CTA clears the persistent navigation on every device class', () => {
  for (const device of DEVICES) {
    describe(device.name, () => {
      const published = publishedTabBarHeight(device);
      const paddingBottom = resolveHomeScrollBottomPadding(published);

      it.each(CONTENT_HEIGHTS)(
        'content %ipt tall: the last pixel of Home sits clear of the tab bar',
        (contentHeight) => {
          const gap = clearance({ device, contentHeight, paddingBottom });
          // Fully clear — not merely "not overlapping". The founder's bar is
          // "visually clear of persistent navigation", so the breathing token
          // is the floor, not zero.
          expect(gap).toBeGreaterThanOrEqual(HOME_BOTTOM_BREATHING_ROOM);
        },
      );

      it('the CTA specifically (measured bottom edge 681pt) is reachable and untouched by the bar', () => {
        // The founder's measurement: on a 667pt SE the LOG WATER button's
        // bottom edge is at 681pt in content coordinates, with the signals
        // section below it. Take the worst case for the button — the smallest
        // plausible content height that still contains it.
        const ctaBottom = 681;
        const contentHeight = ctaBottom; // button is the last thing in the scroll
        const maxScrollOffset = Math.max(
          0,
          contentHeight + paddingBottom - device.viewportHeight,
        );
        const ctaBottomOnScreen = ctaBottom - maxScrollOffset;
        const tabBarTop = device.viewportHeight - published;
        expect(ctaBottomOnScreen).toBeLessThanOrEqual(tabBarTop - HOME_BOTTOM_BREATHING_ROOM);
        // …and it is on screen at all, i.e. not scrolled off the top.
        expect(ctaBottomOnScreen).toBeGreaterThan(0);
      });
    });
  }

  it('the clearance is IDENTICAL across devices — the device terms cancel out', () => {
    // This is the property that makes the fix device-blind-proof rather than
    // luckily-tuned: gap == paddingBottom - tabBarHeight == breathing room,
    // for every device and every content height that fills the viewport.
    const gaps = DEVICES.map((device) =>
      clearance({
        device,
        contentHeight: 1400,
        paddingBottom: resolveHomeScrollBottomPadding(publishedTabBarHeight(device)),
      }),
    );
    expect(new Set(gaps).size).toBe(1);
    expect(gaps[0]).toBe(HOME_BOTTOM_BREATHING_ROOM);
  });
});

describe('regression: the constants this replaced actually failed', () => {
  // Guarding the guard. If these did NOT fail, the assertions above would be
  // proving nothing about the defect that was shipped.
  const OLD_FLAT_PADDING = 40; //  Spacing[10] — the non-V3 path
  const OLD_V3_PADDING = 128; //   Spacing[24] + Spacing[8] — the V3 path

  it.each(DEVICES)(
    'the old flat 40 left the tail of Home UNDER the bar on $name',
    (device) => {
      const gap = clearance({ device, contentHeight: 1400, paddingBottom: OLD_FLAT_PADDING });
      expect(gap).toBeLessThan(0);
      // Exactly the founder's arithmetic: 40 - 49 = -9 on an SE, 40 - 83 = -43
      // on a notched device.
      expect(gap).toBe(OLD_FLAT_PADDING - publishedTabBarHeight(device));
    },
  );

  it('the old hard-coded 128 did not overlap, but meant a different thing on every device', () => {
    const gaps = DEVICES.map((device) =>
      clearance({ device, contentHeight: 1400, paddingBottom: OLD_V3_PADDING }),
    );
    // 79pt of air on an SE, 45pt on a notched device — one constant, two
    // different layouts. That is the "device-blind" defect, distinct from the
    // overlap defect above, and it is why the fix derives instead of tuning.
    expect(new Set(gaps).size).toBeGreaterThan(1);
  });

  it('mutation-verify: a padding that ignores the published height fails the invariant', () => {
    // The exact regression this file exists to catch — someone replacing the
    // derivation with "a number that looked right on my phone".
    const deviceBlind = () => HOME_BOTTOM_BREATHING_ROOM + TABBAR_HEIGHT_UIKIT; // tuned on an SE
    const notchedDevice = DEVICES[1];
    const gap = clearance({
      device: notchedDevice,
      contentHeight: 1400,
      paddingBottom: deviceBlind(),
    });
    expect(gap).toBeLessThan(HOME_BOTTOM_BREATHING_ROOM);
  });
});
