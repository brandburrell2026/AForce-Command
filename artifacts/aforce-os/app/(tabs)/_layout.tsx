/**
 * AForce OS Tab Layout — 6 tabs:
 *   Home     = Hydration Control Center
 *   Check    = Performance Signals
 *   Protocol = AForce Protocol
 *   Timeline = Chronological hydration/recovery feed (route file: journal.tsx)
 *   Social   = Circles / Territory
 *   Profile  = Profile & Settings
 *
 * Store is NOT a bottom-tab destination. It lives at `/store` (root
 * Stack route) and is reached only from contextual surfaces:
 * HydroScan results, Recovery recommendations, product prompts, Home
 * recommendations, and Protocol suggestions. The app is a performance
 * OS, not an e-commerce shell.
 */

import React from 'react';
import { BlurView } from 'expo-blur';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { Redirect, Tabs } from 'expo-router';
import { useAuth } from '@clerk/expo';
import { Icon as NativeTabIcon, Label, NativeTabs } from 'expo-router/unstable-native-tabs';
import { SymbolView } from 'expo-symbols';
import * as Haptics from 'expo-haptics';
import { Icon } from '../../components/Icon';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Colors } from '@/theme/colors';
import { DEMO_MODE } from '@/services/demoMode';
import { TAB_BAR_HEIGHT } from '@/constants/layout';
import { useTranslation } from 'react-i18next';

function NativeTabLayout() {
  const { t } = useTranslation();
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <NativeTabIcon sf={{ default: 'bolt.circle', selected: 'bolt.circle.fill' }} />
        <Label>{t('tabs.home')}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="scan">
        <NativeTabIcon sf={{ default: 'viewfinder.circle', selected: 'viewfinder.circle.fill' }} />
        <Label>{t('tabs.scan')}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="protocol">
        <NativeTabIcon sf={{ default: 'list.bullet.circle', selected: 'list.bullet.circle.fill' }} />
        <Label>{t('tabs.protocol')}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="journal">
        <NativeTabIcon sf={{ default: 'clock.arrow.circlepath', selected: 'clock.arrow.circlepath' }} />
        <Label>{t('tabs.journal')}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="social">
        <NativeTabIcon sf={{ default: 'wineglass', selected: 'wineglass.fill' }} />
        <Label>{t('tabs.social')}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <NativeTabIcon sf={{ default: 'person.circle', selected: 'person.circle.fill' }} />
        <Label>{t('tabs.profile')}</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

/**
 * Custom tab button — a Pressable with all selection / focus / hover
 * chrome stripped. Renders identically across all 6 tabs in every
 * state (active / inactive / pressed / focused). The only visual
 * change between active and inactive is the icon + label tint, which
 * is handled by `tabBarActiveTintColor`.
 *
 * We bypass the default tab button entirely because navigation-internal
 * defaults sometimes render a focus background (e.g. iOS systemBlue,
 * RN-Web :focus-visible outline) that cannot be reliably suppressed via
 * `tabBarItemStyle` alone.
 */
function PlainTabButton(props: Record<string, unknown>) {
  const { children, onPress, accessibilityState, accessibilityLabel, testID } =
    props as {
      children?: React.ReactNode;
      onPress?: () => void;
      accessibilityState?: Record<string, unknown>;
      accessibilityLabel?: string;
      testID?: string;
    };
  // Chunk #7c: light haptic tick on tab switch (native only; no-op on
  // web). Mirrors WHOOP's tactile feedback on bottom-bar selection.
  const handlePress = React.useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync().catch(() => {});
    }
    onPress?.();
  }, [onPress]);

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityState={accessibilityState as never}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      android_ripple={null}
      style={({ pressed }) => [
        plainTabButtonStyles.base,
        pressed && plainTabButtonStyles.pressed,
      ]}
    >
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
});

function ClassicTabLayout() {
  const { t } = useTranslation();
  const isIOS = Platform.OS === 'ios';
  const isWeb = Platform.OS === 'web';

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
        // this guarantees every tab — Home, Check, Protocol, Journal,
        // Store, Profile — looks identical in every state. The only
        // active-state cue is the lime tint on the icon and label.
        tabBarActiveBackgroundColor: 'transparent',
        tabBarButton: (btnProps) =>
          <PlainTabButton {...(btnProps as unknown as Record<string, unknown>)} />,
        tabBarItemStyle: {
          backgroundColor: 'transparent',
          borderWidth: 0,
          borderColor: 'transparent',
          ...(WEB_NO_OUTLINE as object),
        },
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: isIOS ? 'transparent' : Colors.tabBar.background,
          borderTopWidth: 1,
          borderTopColor: Colors.border.subtle,
          elevation: 0,
          height: isWeb ? TAB_BAR_HEIGHT : undefined,
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView intensity={95} tint="dark" style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: Colors.tabBar.background }]} />
          ),
        tabBarLabelStyle: {
          fontFamily: 'Inter_600SemiBold',
          fontSize: 10,
          letterSpacing: 0.5,
          marginBottom: isWeb ? 10 : 4,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.home'),
          tabBarIcon: ({ color, size }) =>
            isIOS ? <SymbolView name="bolt.circle" tintColor={color} size={size} />
                  : <Icon name="zap" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: t('tabs.scan'),
          tabBarIcon: ({ color, size }) =>
            isIOS ? <SymbolView name="viewfinder.circle" tintColor={color} size={size} />
                  : <Icon name="maximize" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="protocol"
        options={{
          title: t('tabs.protocol'),
          tabBarIcon: ({ color, size }) =>
            isIOS ? <SymbolView name="list.bullet.circle" tintColor={color} size={size} />
                  : <Icon name="list" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="journal"
        options={{
          title: t('tabs.journal'),
          tabBarIcon: ({ color, size }) =>
            isIOS ? <SymbolView name="clock.arrow.circlepath" tintColor={color} size={size} />
                  : <Icon name="clock" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="social"
        options={{
          title: t('tabs.social'),
          tabBarIcon: ({ color, size }) =>
            isIOS ? <SymbolView name="wineglass" tintColor={color} size={size} />
                  : <Icon name="users" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarIcon: ({ color, size }) =>
            isIOS ? <SymbolView name="person.circle" tintColor={color} size={size} />
                  : <Icon name="user" size={22} color={color} />,
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
  if (isLiquidGlassAvailable()) return <NativeTabLayout />;
  return <ClassicTabLayout />;
}
