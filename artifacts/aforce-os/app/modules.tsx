/**
 * Modules — visible internal evaluation surface.
 *
 * Per the FINAL build lock: "Build once. Evaluate everything.
 * Release later." Every engine module stays reachable from a single
 * place so Julius / Brandon (and any internal reviewer) can see the
 * whole product without Developer Mode gating or deep-link guessing.
 *
 * This is not a public-facing tab. It's a visible launcher, opened
 * from Profile → Modules.
 */

import React from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, Platform,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { Colors } from '@/theme/colors';
import { TAB_BAR_HEIGHT, WEB_TOP_PADDING, WEB_BOTTOM_PADDING } from '@/constants/layout';

type IconName = React.ComponentProps<typeof Icon>['name'];

interface ModuleEntry {
  id: string;
  title: string;
  blurb: string;
  href: string;
  icon: IconName;
  tint: string;
  /** Optional badge: e.g. "Flag-gated" — surface gating to evaluators
   *  without hiding the module from the launcher. */
  gate?: string;
}

const MODULES: ModuleEntry[] = [
  {
    id: 'social',
    title: 'Social',
    blurb: 'Signal · Command · Forecast · Crew · Shared Context',
    href: '/social-v2',
    icon: 'users',
    tint: '#B6FF00',
  },
  {
    id: 'sleep',
    title: 'Sleep',
    blurb: 'Recovery layer · last-night memory · sleep debt',
    href: '/sleep',
    icon: 'moon',
    tint: '#9C7BFF',
  },
  {
    id: 'cruise',
    title: 'Cruise',
    blurb: 'Hydration intelligence for life at sea',
    href: '/cruise',
    icon: 'anchor',
    tint: '#00E5FF',
  },
  {
    id: 'guardian',
    title: 'Guardian',
    blurb: 'Heat-load watcher · environmental recovery',
    href: '/guardian',
    icon: 'shield',
    tint: '#FFA01E',
  },
  {
    id: 'clutch',
    title: 'Clutch',
    blurb: 'Pre-event activation · performance window',
    href: '/clutch',
    icon: 'zap',
    tint: '#00E5C8',
  },
  {
    id: 'phantom',
    title: 'Phantom',
    blurb: 'Phantom Band · wearable channel (gated)',
    href: '/phantom',
    icon: 'activity',
    tint: '#FF2D55',
    gate: 'Flag-gated · phantom_wearable_enabled',
  },
  {
    id: 'recovery',
    title: 'Recovery',
    blurb: 'Recovery score · replenishment plan · cut-off time',
    href: '/cruise/recovery',
    icon: 'refresh-cw',
    tint: '#16EC06',
    gate: 'Flag-gated · spec_cruise',
  },
  {
    id: 'science',
    title: 'Science',
    blurb: 'Methodology · citations · limitations · export PDF',
    href: '/science',
    icon: 'book-open',
    tint: 'rgba(255,255,255,0.55)',
  },
  {
    id: 'providers',
    title: 'Providers',
    blurb: 'Apple Health · Oura · WHOOP · freshest-wins merge',
    href: '/sensors',
    icon: 'upload-cloud',
    tint: '#0093E7',
  },
  {
    id: 'protocol',
    title: 'Protocol',
    blurb: 'AForce Protocol stage · synchronous derivation',
    href: '/protocol',
    icon: 'compass',
    tint: '#B6FF00',
  },
  {
    id: 'timeline',
    title: 'Timeline',
    blurb: 'Journal · rollups · per-event scoring',
    href: '/journal',
    icon: 'clock',
    tint: 'rgba(255,255,255,0.55)',
  },
  {
    id: 'hydroscan',
    title: 'HydroScan',
    blurb: 'Smart Capture · acidic load · stimulant load · superfood signals',
    href: '/scan',
    icon: 'camera',
    tint: '#B6FF00',
  },
  {
    id: 'developer-preview',
    title: 'Developer Preview',
    blurb: 'Encryption status · feature flags · internal toggles',
    href: '/(tabs)/profile',
    icon: 'settings',
    tint: 'rgba(255,255,255,0.55)',
  },
];

export default function ModulesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';

  const topPad = isWeb ? WEB_TOP_PADDING : insets.top + 16;
  const bottomPad = isWeb ? WEB_BOTTOM_PADDING : insets.bottom + TAB_BAR_HEIGHT + 24;

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={styles.backBtn}
        >
          <Icon name="chevron-left" size={22} color="#FFFFFF" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>INTERNAL EVALUATION</Text>
          <Text style={styles.title}>Modules</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.lede}>
          Every engine module, reachable from one place. Build once. Evaluate
          everything. Release later.
        </Text>

        <View style={styles.grid}>
          {MODULES.map((m) => (
            <Pressable
              key={m.id}
              onPress={() => router.push(m.href as never)}
              testID={`modules-card-${m.id}`}
              style={({ pressed }) => [
                styles.card,
                pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Open ${m.title} module`}
            >
              <View style={[styles.iconWrap, { borderColor: m.tint }]}>
                <Icon name={m.icon} size={20} color={m.tint} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{m.title}</Text>
                <Text style={styles.cardBlurb}>{m.blurb}</Text>
                {m.gate ? (
                  <View style={styles.gateTag}>
                    <Text style={styles.gateTagText}>{m.gate}</Text>
                  </View>
                ) : null}
              </View>
              <Icon name="chevron-right" size={16} color={Colors.text.muted} />
            </Pressable>
          ))}
        </View>

        <Text style={styles.footer}>
          {MODULES.length} modules · all listed · flag/hardware gates noted
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 12,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
  },
  eyebrow: {
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    letterSpacing: 2.5,
    color: 'rgba(255,255,255,0.55)',
  },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 28,
    color: '#FFFFFF',
    marginTop: 2,
  },
  lede: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 19,
    color: 'rgba(255,255,255,0.55)',
    marginTop: 4,
    marginBottom: 22,
  },
  grid: {
    gap: 10,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  iconWrap: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  cardTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
    color: '#FFFFFF',
  },
  cardBlurb: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    marginTop: 2,
    lineHeight: 16,
  },
  gateTag: {
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(182,255,0,0.25)',
    backgroundColor: 'rgba(182,255,0,0.06)',
  },
  gateTagText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 9,
    letterSpacing: 1,
    color: '#B6FF00',
    textTransform: 'uppercase',
  },
  footer: {
    marginTop: 22,
    textAlign: 'center',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    letterSpacing: 2,
    color: 'rgba(255,255,255,0.30)',
    textTransform: 'uppercase',
  },
});
