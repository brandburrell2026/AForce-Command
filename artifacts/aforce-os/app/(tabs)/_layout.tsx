/**
 * AForce OS Tab Layout — 5 tabs:
 *   Home    = Hydration Control Center
 *   Check   = Performance Signals
 *   Protocol= AForce Protocol
 *   Store   = AForce Shopping
 *   Profile = Profile & Settings
 */

import React from 'react';
import { BlurView } from 'expo-blur';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { Tabs } from 'expo-router';
import { Icon, Label, NativeTabs } from 'expo-router/unstable-native-tabs';
import { SymbolView } from 'expo-symbols';
import { Feather } from '@expo/vector-icons';
import { Platform, StyleSheet, View } from 'react-native';
import { Colors } from '@/theme/colors';

function NativeTabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: 'bolt.circle', selected: 'bolt.circle.fill' }} />
        <Label>Home</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="check">
        <Icon sf={{ default: 'waveform.path.ecg', selected: 'waveform.path.ecg.rectangle.fill' }} />
        <Label>Check</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="protocol">
        <Icon sf={{ default: 'list.bullet.circle', selected: 'list.bullet.circle.fill' }} />
        <Label>Protocol</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="store">
        <Icon sf={{ default: 'bag.circle', selected: 'bag.circle.fill' }} />
        <Label>Store</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <Icon sf={{ default: 'person.circle', selected: 'person.circle.fill' }} />
        <Label>Profile</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function ClassicTabLayout() {
  const isIOS = Platform.OS === 'ios';
  const isWeb = Platform.OS === 'web';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.tabBar.active,
        tabBarInactiveTintColor: Colors.tabBar.inactive,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: isIOS ? 'transparent' : Colors.tabBar.background,
          borderTopWidth: 1,
          borderTopColor: Colors.border.subtle,
          elevation: 0,
          height: isWeb ? 84 : undefined,
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
          title: 'Home',
          tabBarIcon: ({ color, size }) =>
            isIOS ? <SymbolView name="bolt.circle" tintColor={color} size={size} />
                  : <Feather name="zap" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="check"
        options={{
          title: 'Check',
          tabBarIcon: ({ color, size }) =>
            isIOS ? <SymbolView name="waveform.path.ecg" tintColor={color} size={size} />
                  : <Feather name="activity" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="protocol"
        options={{
          title: 'Protocol',
          tabBarIcon: ({ color, size }) =>
            isIOS ? <SymbolView name="list.bullet.circle" tintColor={color} size={size} />
                  : <Feather name="list" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="store"
        options={{
          title: 'Store',
          tabBarIcon: ({ color, size }) =>
            isIOS ? <SymbolView name="bag.circle" tintColor={color} size={size} />
                  : <Feather name="shopping-bag" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) =>
            isIOS ? <SymbolView name="person.circle" tintColor={color} size={size} />
                  : <Feather name="user" size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}

export default function TabLayout() {
  if (isLiquidGlassAvailable()) return <NativeTabLayout />;
  return <ClassicTabLayout />;
}
