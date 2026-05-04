/**
 * AForce OS Tab Layout — 6 tabs:
 *   Home    = Hydration Control Center
 *   Check   = Performance Signals
 *   Protocol= AForce Protocol
 *   Journal = Journal
 *   Store   = AForce Shopping
 *   Profile = Profile & Settings
 */

import React from 'react';
import { BlurView } from 'expo-blur';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { Redirect, Tabs } from 'expo-router';
import { useAuth } from '@clerk/expo';
import { Icon, Label, NativeTabs } from 'expo-router/unstable-native-tabs';
import { SymbolView } from 'expo-symbols';
import { Feather } from '@expo/vector-icons';
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
        <Icon sf={{ default: 'bolt.circle', selected: 'bolt.circle.fill' }} />
        <Label>{t('tabs.home')}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="check">
        <Icon sf={{ default: 'waveform.path.ecg', selected: 'waveform.path.ecg.rectangle.fill' }} />
        <Label>{t('tabs.check')}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="protocol">
        <Icon sf={{ default: 'list.bullet.circle', selected: 'list.bullet.circle.fill' }} />
        <Label>{t('tabs.protocol')}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="journal">
        <Icon sf={{ default: 'book.closed.circle', selected: 'book.closed.circle.fill' }} />
        <Label>{t('tabs.journal')}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="store">
        <Icon sf={{ default: 'bag.circle', selected: 'bag.circle.fill' }} />
        <Label>{t('tabs.store')}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <Icon sf={{ default: 'person.circle', selected: 'person.circle.fill' }} />
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
  return (
    <Pressable
      onPress={onPress}
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
            <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
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
                  : <Feather name="zap" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="check"
        options={{
          title: t('tabs.check'),
          tabBarIcon: ({ color, size }) =>
            isIOS ? <SymbolView name="waveform.path.ecg" tintColor={color} size={size} />
                  : <Feather name="activity" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="protocol"
        options={{
          title: t('tabs.protocol'),
          tabBarIcon: ({ color, size }) =>
            isIOS ? <SymbolView name="list.bullet.circle" tintColor={color} size={size} />
                  : <Feather name="list" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="journal"
        options={{
          title: t('tabs.journal'),
          tabBarIcon: ({ color, size }) =>
            isIOS ? <SymbolView name="book.closed.circle" tintColor={color} size={size} />
                  : <Feather name="book-open" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="store"
        options={{
          title: t('tabs.store'),
          tabBarIcon: ({ color, size }) =>
            isIOS ? <SymbolView name="bag.circle" tintColor={color} size={size} />
                  : <Feather name="shopping-bag" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarIcon: ({ color, size }) =>
            isIOS ? <SymbolView name="person.circle" tintColor={color} size={size} />
                  : <Feather name="user" size={22} color={color} />,
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
