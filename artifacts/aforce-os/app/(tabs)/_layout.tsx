/**
 * AForce OS Tab Layout — 5 tabs (redesign):
 *   Home        = Readiness + hydration command dashboard (index.tsx)
 *   Hydration   = Chronological hydration / recovery feed
 *                 (route file stays `journal.tsx` so deep links + the
 *                 protected Timeline contract are untouched; only the
 *                 user-facing label + icon changed to "Hydration").
 *   Protocols   = AForce Protocol (internal Moments-first build substitutes Moments; Protocol stays routable)
 *   Community   = Rankings + Challenges + Battles + Teams + Map hub
 *                 (route file stays `competition.tsx`)
 *   Profile     = Profile & Settings
 *
 * Hidden-but-routable surfaces (kept for deep links + contextual entry,
 * removed from the bottom bar via `href: null` / omitted Triggers):
 *   scan (HydroScan — opened from the Home Hydration Status card's
 *     "Scan a drink" button, plus the Internal Preview / Modules screen),
 *   social (Social drinking mode), sleep, social-legacy (dev only).
 *
 * Store is NOT a bottom-tab destination. It lives at `/store` (root
 * Stack route) reached only from contextual surfaces.
 */

import React from 'react';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { Redirect, Tabs, usePathname, useRouter } from 'expo-router';
import { useAuth } from '@clerk/expo';
import { Icon as NativeTabIcon, Label, NativeTabs } from 'expo-router/unstable-native-tabs';
import { SymbolView } from 'expo-symbols';
import { Icon } from '../../components/Icon';
import { Animated, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Colors } from '@/theme/colors';
import { Typography } from '@/theme/typography';
import { af, afOrb } from '@/theme/afTokens';
import { AFMark } from '@/components/ui/AFMark';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useOrbHidden } from '@/services/orbVisibility';
import { TabGlyph } from '@/components/navigation/TabGlyph';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { oneBreathOrbRaise, oneBreathTabHitSlop } from '@/utils/navigation/oneBreathOrbGeometry';
import { DEMO_MODE } from '@/services/demoMode';
import { DEFAULT_FLAGS } from '@/featureFlags/flags';
import { useDevMode } from '@/services/devMode';
import { TAB_BAR_HEIGHT } from '@/constants/layout';
import { useMomentsFirstExperience } from '@/hooks/useMomentsFirstExperience';
import { useTranslation } from 'react-i18next';

function NativeTabLayout() {
  const { t } = useTranslation();
  const devMode = useDevMode();
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <NativeTabIcon sf={{ default: 'house', selected: 'house.fill' }} />
        <Label>{t('tabs.home')}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="journal">
        <NativeTabIcon sf={{ default: 'drop.circle', selected: 'drop.circle.fill' }} />
        <Label>{t('tabs.hydration')}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="one-breath-tab">
        <NativeTabIcon sf={{ default: 'circle', selected: 'circle.fill' }} />
        <Label>One Breath</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="moments-tab">
        <NativeTabIcon sf={{ default: 'calendar', selected: 'calendar' }} />
        <Label>Moments</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="competition">
        <NativeTabIcon sf={{ default: 'person.2', selected: 'person.2.fill' }} />
        <Label>Circles</Label>
      </NativeTabs.Trigger>
      {devMode ? (
        <NativeTabs.Trigger name="social-legacy">
          <NativeTabIcon sf={{ default: 'wineglass.fill', selected: 'wineglass.fill' }} />
          <Label>Legacy</Label>
        </NativeTabs.Trigger>
      ) : null}
    </NativeTabs>
  );
}

/**
 * Custom tab button — a Pressable with all selection / focus / hover
 * chrome stripped. Renders identically across all tabs in every state
 * (active / inactive / pressed / focused). The only visual change
 * between active and inactive is the icon + label tint, handled by
 * `tabBarActiveTintColor` (AForce brand red).
 *
 * We bypass the default tab button entirely because navigation-internal
 * defaults sometimes render a focus background (e.g. iOS systemBlue,
 * RN-Web :focus-visible outline) that cannot be reliably suppressed via
 * `tabBarItemStyle` alone.
 */
function PlainTabButton(props: Record<string, unknown>) {
  const {
    children,
    onPress,
    onLongPress,
    hitSlop,
    accessibilityState,
    accessibilityLabel,
    testID,
    'aria-selected': ariaSelected,
    'aria-label': ariaLabel,
  } = props as {
    children?: React.ReactNode;
    onPress?: () => void;
    onLongPress?: () => void;
    hitSlop?: { top?: number };
    accessibilityState?: Record<string, unknown>;
    accessibilityLabel?: string;
    testID?: string;
    'aria-selected'?: boolean;
    'aria-label'?: string;
  };
  // Wave-5 REMOVAL — no haptic on tab switch.
  //
  // This was the single most frequent vibration in the product: every tab press,
  // all day, for navigation the member can already see happen. The founder's
  // rule is "do not vibrate frequently", and the four moments that are allowed
  // to reach the hand are named in `components/ui/motionLogic.ts` — moving
  // between screens is not one of them. A haptic has to mean something, and one
  // that fires on every press means nothing.

  // Black Issue review B2: the active tint (#E4564A) against the inactive grey
  // (#8D897F) is ~1.05:1 in luminance, so hue cannot be the only selection
  // cue (WCAG 1.4.1). A 2pt red mark above the selected item is the second,
  // colour-independent cue on every platform; iOS also swaps to the filled
  // symbol. React Navigation 7's BottomTabItem hands this button
  // `aria-selected` / `aria-label` (NOT accessibilityState/Label — PR #1088
  // review B1), so both spellings are read and the selected state is forwarded
  // so the reader announces it.
  const selected = Boolean(
    ariaSelected ?? (accessibilityState as { selected?: boolean } | undefined)?.selected,
  );
  const label = ariaLabel ?? accessibilityLabel;

  return (
    <Pressable
      onPress={onPress as (() => void) | undefined}
      onLongPress={onLongPress as (() => void) | undefined}
      hitSlop={hitSlop}
      accessibilityRole="button"
      accessibilityState={{ ...(accessibilityState as object | undefined), selected }}
      accessibilityLabel={label}
      aria-selected={selected}
      aria-label={label}
      testID={testID}
      android_ripple={null}
      style={({ pressed }) => [
        plainTabButtonStyles.base,
        pressed && plainTabButtonStyles.pressed,
      ]}
    >
      {selected ? (
        <View
          style={plainTabButtonStyles.selectedMark}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          testID="tab-selected-mark"
        />
      ) : null}
      {children}
    </Pressable>
  );
}

// RN-Web outline props are not in RN core style types, so we attach
// them as a plain object cast to any. They translate to CSS
// `outline-*` and kill the browser focus ring that otherwise appears
// as a blue box around the currently selected tab on the web preview.
const WEB_NO_OUTLINE = Platform.OS === 'web'
  ? ({
      outlineWidth: 0,
      outlineStyle: 'none',
      outlineColor: 'transparent',
      boxShadow: 'none',
      cursor: 'pointer',
    } as Record<string, unknown>)
  : {};

/** The prototype's bar orb: 46pt, raised 22pt, with a 5pt ring of the bar's own black around it. */
export const ONE_BREATH_ORB_SIZE = 46;
export const ONE_BREATH_ORB_RAISE = 22;
export const ONE_BREATH_ORB_RING = 5;
/** Letter size of the mark inside the orb. */
const ONE_BREATH_TAB_MARK_SIZE = 12;
/** One slow breath, on Home only. */
export const ONE_BREATH_ORB_BREATH_MS = 6000;
const ONE_BREATH_ORB_BREATH_SCALE = 1.04;
/** Screen Upgrade v1.1 §1: labels are Inter 11pt, sentence case. */
export const TAB_LABEL_FONT_SIZE = 11;

const plainTabButtonStyles = StyleSheet.create({
  base: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderColor: 'transparent',
    ...(WEB_NO_OUTLINE as object),
  },
  pressed: {
    opacity: 0.7,
  },
  selectedMark: {
    position: 'absolute',
    top: 0,
    width: 28,
    height: 2,
    borderRadius: 1,
    backgroundColor: Colors.tabBar.indicator,
  },
  // The orb sits in the centre slot, raised above the bar's top edge. It is
  // the only glowing object in the app (Master Brief §2).
  oneBreathSlot: {
    position: 'absolute',
    top: -(ONE_BREATH_ORB_RAISE + ONE_BREATH_ORB_RING),
    width: ONE_BREATH_ORB_SIZE + ONE_BREATH_ORB_RING * 2,
    height: ONE_BREATH_ORB_SIZE + ONE_BREATH_ORB_RING * 2,
    borderRadius: (ONE_BREATH_ORB_SIZE + ONE_BREATH_ORB_RING * 2) / 2,
    // The ring of the bar's own black around the orb (prototype).
    backgroundColor: Colors.tabBar.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  oneBreathOrb: {
    width: ONE_BREATH_ORB_SIZE,
    height: ONE_BREATH_ORB_SIZE,
    borderRadius: ONE_BREATH_ORB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent.primary,
    shadowColor: Colors.accent.primary,
    shadowOpacity: 0.45,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 14,
    elevation: 6,
  },
});

/**
 * The centre One Breath orb (Screen Upgrade v1.1 §1).
 *
 *   - 64pt, raised 12pt above the bar, always Signal Red, never grey.
 *   - The N–И mark inside it is warm white.
 *   - No text label; the tab is announced as "One Breath".
 *   - Breathes on a six-second cycle on Home only, and holds still everywhere
 *     when Reduce Motion is on.
 *   - Not drawn while a screen has asked for it to be hidden (Seal, Quiet).
 *
 * Tap only. Press-and-hold to speak is deliberately not wired here: a hold is
 * how a plan is sealed, and the gesture needs its own safeguards first
 * (docs/AFORCE-OS-Visual-Gap-Report-2026-11-18.md §5).
 */
/** The orb is hidden only on the One Breath screens that asked for it. */
export function orbHiddenOn(pathname: string, requested: boolean): boolean {
  return requested && pathname.startsWith('/one-breath');
}

function OneBreathTabIcon() {
  const requestedHidden = useOrbHidden();
  const pathname = usePathname();
  // One Breath is a tab, so it stays mounted when the member switches tabs.
  // If it was left on Seal or Quiet, its request to hide the orb stayed in
  // force on every tab and the orb disappeared from the whole app (device
  // report, build 168). The orb is only hidden while One Breath is on screen.
  const hidden = orbHiddenOn(pathname, requestedHidden);
  const reducedMotion = useReducedMotion();
  const onHome = pathname === '/';
  const breathe = onHome && !reducedMotion && !hidden;
  const scale = React.useRef(new Animated.Value(1)).current;
  const gradientId = React.useId().replace(/:/g, '');
  // Raised 12pt; a little more on phones with no home indicator so the bottom
  // of the orb is never cut off (see oneBreathOrbGeometry).
  const raise = oneBreathOrbRaise(useSafeAreaInsets().bottom);

  React.useEffect(() => {
    if (!breathe) {
      scale.stopAnimation();
      scale.setValue(1);
      return undefined;
    }
    const half = ONE_BREATH_ORB_BREATH_MS / 2;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: ONE_BREATH_ORB_BREATH_SCALE, duration: half, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: half, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [breathe, scale]);

  if (hidden) return null;
  return (
    <View
      style={[plainTabButtonStyles.oneBreathSlot, { top: -(raise + ONE_BREATH_ORB_RING) }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="tab-one-breath-orb"
    >
      <Animated.View style={[plainTabButtonStyles.oneBreathOrb, { transform: [{ scale }] }]}>
        <Svg width={ONE_BREATH_ORB_SIZE} height={ONE_BREATH_ORB_SIZE} style={StyleSheet.absoluteFill}>
          <Defs>
            <RadialGradient id={gradientId} cx={afOrb.light.cx} cy={afOrb.light.cy} r="98%">
              {afOrb.oneBreath.map((stop, i) => (
                <Stop key={stop} offset={afOrb.stops[i]} stopColor={stop} />
              ))}
            </RadialGradient>
          </Defs>
          <Circle
            cx={ONE_BREATH_ORB_SIZE / 2}
            cy={ONE_BREATH_ORB_SIZE / 2}
            r={ONE_BREATH_ORB_SIZE / 2}
            fill={`url(#${gradientId})`}
          />
        </Svg>
        <AFMark size={ONE_BREATH_TAB_MARK_SIZE} color={af.textPrimary} decorative />
      </Animated.View>
    </View>
  );
}

function ClassicTabLayout() {
  const { t } = useTranslation();
  const devMode = useDevMode();
  const momentsFirst = useMomentsFirstExperience();
  const isIOS = Platform.OS === 'ios';
  const isWeb = Platform.OS === 'web';
  const router = useRouter();
  const bottomInset = useSafeAreaInsets().bottom;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.tabBar.active,
        tabBarInactiveTintColor: Colors.tabBar.inactive,
        // Force the active-tab background to transparent so no system
        // default (e.g. iOS systemBlue selection, RN-Web :focus-visible
        // outline) shows through, and make every tab item transparent /
        // borderless. Combined with the custom `tabBarButton` below,
        // this guarantees every tab looks identical in every state. The
        // only active-state cue is the brand-red tint on icon + label.
        tabBarActiveBackgroundColor: 'transparent',
        tabBarButton: (btnProps) =>
          <PlainTabButton {...(btnProps as unknown as Record<string, unknown>)} />,
        tabBarItemStyle: {
          backgroundColor: 'transparent',
          borderWidth: 0,
          borderColor: 'transparent',
          ...(WEB_NO_OUTLINE as object),
        },
        // A solid AFORCE Black bar with one hairline on top. Labels are Inter
        // 11pt sentence case; the active item is warm white with a 2px red mark.
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: Colors.tabBar.background,
          borderTopWidth: 1,
          borderTopColor: Colors.tabBar.hairline,
          elevation: 0,
          height: isWeb ? TAB_BAR_HEIGHT : undefined,
        },
        tabBarBackground: () => (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: Colors.tabBar.background }]} />
        ),
        // Screen Upgrade v1.1 §1: Inter 11pt, sentence case. Not mono, not caps.
        tabBarLabelStyle: {
          fontFamily: Typography.fonts.medium,
          fontSize: TAB_LABEL_FONT_SIZE,
          marginBottom: isWeb ? 10 : 4,
        },
      }}
    >
      {/* ── Visible tabs (5) ───────────────────────────────────────── */}
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.home'),
          // The prototype's own icon: a ring with a centre dot.
          tabBarIcon: ({ color }) => <TabGlyph name="home" color={color} />,
        }}
      />
      <Tabs.Screen
        name="journal"
        // Screen Upgrade v1.1 §1: long-press Hydration opens HydroScan directly.
        listeners={{ tabLongPress: () => router.push('/scan') }}
        options={{
          title: t('tabs.hydration'),
          tabBarIcon: ({ color }) => <TabGlyph name="hydration" color={color} />,
        }}
      />
      <Tabs.Screen
        name="protocol"
        options={{
          href: null,
          title: t('tabs.protocol'),
          tabBarIcon: ({ color, size, focused }) =>
            isIOS ? <SymbolView name={focused ? 'list.bullet.circle.fill' : 'list.bullet.circle'} tintColor={color} size={size} />
                  : <Icon name="list" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="one-breath-tab"
        options={{
          // The prototype labels the orb "Breath"; a screen reader hears "One Breath".
          title: 'Breath',
          tabBarAccessibilityLabel: 'One Breath',
          tabBarIcon: () => <OneBreathTabIcon />,
          // The raised part of the orb is part of the button's touch area.
          tabBarButton: (btnProps) => (
            <PlainTabButton
              {...(btnProps as unknown as Record<string, unknown>)}
              hitSlop={oneBreathTabHitSlop(bottomInset)}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="moments-tab"
        options={{
          href: '/moments-tab',
          title: 'Moments',
          tabBarIcon: ({ color }) => <TabGlyph name="moments" color={color} />,
        }}
      />
      <Tabs.Screen
        name="competition"
        options={{
          title: 'Circles',
          tabBarIcon: ({ color }) => <TabGlyph name="circles" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          href: null,
          title: t('tabs.profile'),
          tabBarIcon: ({ color, size, focused }) =>
            isIOS ? <SymbolView name={focused ? 'person.circle.fill' : 'person.circle'} tintColor={color} size={size} />
                  : <Icon name="user" size={22} color={color} />,
        }}
      />

      {/* ── Hidden-but-routable surfaces (off the bar via href:null) ── */}
      <Tabs.Screen
        name="scan"
        options={{
          href: null,
          title: t('tabs.scan'),
          tabBarIcon: ({ color, size, focused }) =>
            isIOS ? <SymbolView name={focused ? 'viewfinder.circle.fill' : 'viewfinder.circle'} tintColor={color} size={size} />
                  : <Icon name="maximize" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="social"
        options={{
          href: null,
          title: t('tabs.social'),
          tabBarIcon: ({ color, size, focused }) =>
            isIOS ? <SymbolView name={focused ? 'wineglass.fill' : 'wineglass'} tintColor={color} size={size} />
                  : <Icon name="users" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="social-legacy"
        options={{
          // Hidden from the tab bar unless Developer Mode is on. The
          // route still exists, so `/social-legacy` deep links work
          // either way for QA.
          href: devMode ? '/social-legacy' : null,
          title: 'Legacy',
          tabBarIcon: ({ color, size }) =>
            isIOS ? <SymbolView name="wineglass.fill" tintColor={color} size={size} />
                  : <Icon name="users" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="sleep"
        options={{
          href: null,
          title: t('tabs.sleep'),
          tabBarIcon: ({ color, size, focused }) =>
            isIOS ? <SymbolView name={focused ? 'moon.circle.fill' : 'moon.circle'} tintColor={color} size={size} />
                  : <Icon name="moon" size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}

export default function TabLayout() {
  // Gate the tab group behind a valid Clerk session. Safe: ClerkProvider
  // is always mounted in the root _layout (the app refuses to render
  // without a publishable key).
  const { isLoaded, isSignedIn } = useAuth();
  if (isLoaded && !isSignedIn && !DEMO_MODE) {
    return <Redirect href="/(auth)/sign-in" />;
  }
  // Native Liquid Glass tabs (expo-router/unstable-native-tabs →
  // RNScreens RNSTabBarController) throw a void NSException at startup on
  // iOS 26, crashing Release/TestFlight builds (react-native-screens #3940,
  // RN performVoidMethodInvocation). Disabled via native_tabs_enabled until
  // the upstream fix is confirmed; flip the flag to true to re-enable.
  if (DEFAULT_FLAGS.native_tabs_enabled && isLiquidGlassAvailable()) {
    return <NativeTabLayout />;
  }
  return <ClassicTabLayout />;
}
