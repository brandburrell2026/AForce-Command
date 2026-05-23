/**
 * Social — subscriber-only tab.
 *
 * For free (`core`) users: shows an upgrade card pointing at Athlete+.
 * For paid users: renders the SocialModeSheet contents inline so the
 * full beer/wine/cocktail/liquor/seltzer/champagne flow lives here
 * instead of cluttering the home screen.
 */

import React from 'react';
import {
  View, Text, StyleSheet, Pressable, Platform, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Icon } from '../../components/Icon';

import { GradientBackground } from '@/components/GradientBackground';
import { SocialModeSheet } from '@/components/SocialModeSheet';
import { Colors } from '@/theme/colors';
import { useAppStore } from '@/store/useAppStore';
import {
  useUserSlice,
  useEngineSlice,
  useActionsSlice,
} from '@/store/slices';
import type { DrinkType } from '@/types';
import { TAB_BAR_HEIGHT, WEB_TOP_PADDING, WEB_BOTTOM_PADDING } from '@/constants/layout';

interface SocialActions {
  activateSocialMode: (preset?: 'travel' | 'heat' | 'hard_block' | null) => Promise<void>;
  logSocialDrink: (type: DrinkType) => Promise<void>;
  confirmSocialHydration: (confirmed: boolean) => Promise<void>;
  deactivateSocialMode: () => Promise<void>;
  /** Chunk #5 modifiers. */
  activateCruiseMode: () => Promise<void>;
  activateVoyageShield: () => Promise<void>;
}

const PURPLE = '#7C5CFF';

export default function SocialScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { state } = useAppStore();
  const userState = useUserSlice();
  const engine = useEngineSlice();
  const {
    activateSocialMode,
    logSocialDrink,
    confirmSocialHydration,
    deactivateSocialMode,
    activateCruiseMode,
    activateVoyageShield,
  } = useActionsSlice<SocialActions>();

  // Subscribers only. Free tier (`core`) sees the upgrade card.
  // Stripe webhook is the source of truth for `planId`; anything other
  // than `core` means the user is on a paid tier.
  const planId = state.subscription?.planId ?? 'core';
  const isSubscribed = planId !== 'core';

  const goToStore = React.useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    router.push('/store');
  }, [router]);

  const goHome = React.useCallback(() => {
    // When this tab is reached via the iOS "More" overflow (7 tabs →
    // 5 visible + More), the screen sits inside the More navigation
    // stack. `router.replace` on a group route ('/(tabs)') won't pop
    // that stack, so we pop first if we can, then route Home as a
    // fallback for the normal in-tab case.
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [router]);

  if (isSubscribed) {
    // Paid tier: render the existing Social sheet permanently mounted.
    // Closing the sheet (X button) returns the user to the home tab.
    return (
      <View style={styles.root}>
        <GradientBackground>
          <SocialModeSheet
            visible
            onDismiss={goHome}
            socialMode={userState.socialMode}
            social={engine.social}
            onActivate={(preset) => { void activateSocialMode?.(preset); }}
            onLogDrink={(type) => { void logSocialDrink?.(type); }}
            onConfirmHydration={(c) => { void confirmSocialHydration?.(c); }}
            onDeactivate={() => { void deactivateSocialMode?.(); }}
            onActivateCruise={() => { void activateCruiseMode?.(); }}
            onActivateShield={() => { void activateVoyageShield?.(); }}
          />
          <View style={styles.v2Pill} pointerEvents="box-none">
            <Pressable
              onPress={() => router.push('/social-v2')}
              style={({ pressed }) => [styles.v2Btn, pressed && { opacity: 0.85 }]}
              accessibilityRole="button"
              accessibilityLabel="Preview new Social Mode v2"
            >
              <Text style={styles.v2BtnText}>TRY SOCIAL MODE V2 →</Text>
            </Pressable>
          </View>
        </GradientBackground>
      </View>
    );
  }

  // Free tier — paywall card.
  const topPadding = Platform.OS === 'web' ? WEB_TOP_PADDING : insets.top;
  const bottomPadding = Platform.OS === 'web' ? WEB_BOTTOM_PADDING : insets.bottom + TAB_BAR_HEIGHT;

  return (
    <View style={styles.root}>
      <GradientBackground>
        <ScrollView
          contentContainerStyle={[
            styles.lockedContent,
            { paddingTop: topPadding + 32, paddingBottom: bottomPadding + 32 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.iconWrap}>
            <Icon name="users" size={28} color={PURPLE} />
          </View>

          <Text style={styles.eyebrow}>RECOVERY MODE</Text>
          <Text style={styles.title}>Recovery capacity, in real time</Text>
          <Text style={styles.body}>
            One blended 0–100 score across your AutoPilot performance,
            hydration compliance, and environmental stress. Watch it move
            through Peak, Stable, Declining, and Critical bands as your
            day evolves — and act before you fall.
          </Text>

          <View style={styles.featureList}>
            {[
              'Live Recovery Capacity Score (0–100)',
              'Four cinematic state bands — Peak to Critical',
              'AutoPilot + hydration + environment, blended',
              '8-hour recovery window with morning checklist',
            ].map((line) => (
              <View key={line} style={styles.featureRow}>
                <Icon name="check" size={14} color={PURPLE} />
                <Text style={styles.featureText}>{line}</Text>
              </View>
            ))}
          </View>

          <View style={styles.planChip}>
            <Icon name="lock" size={11} color={PURPLE} />
            <Text style={styles.planChipText}>INCLUDED WITH ATHLETE +</Text>
          </View>

          <Pressable
            onPress={goToStore}
            style={({ pressed }) => [styles.cta, pressed && { opacity: 0.9 }]}
            accessibilityRole="button"
            accessibilityLabel="Upgrade to unlock Social Mode"
          >
            <Text style={styles.ctaText}>UPGRADE TO UNLOCK</Text>
          </Pressable>
        </ScrollView>
      </GradientBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background.primary },
  lockedContent: {
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 14,
  },
  iconWrap: {
    width: 64, height: 64, borderRadius: 18,
    borderWidth: 1, borderColor: `${PURPLE}55`,
    backgroundColor: `${PURPLE}14`,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  eyebrow: {
    fontSize: 11, letterSpacing: 2,
    fontFamily: 'Inter_700Bold',
    color: PURPLE,
  },
  title: {
    fontSize: 26, lineHeight: 32, letterSpacing: -0.6,
    fontFamily: 'Inter_700Bold',
    color: Colors.text.primary,
    textAlign: 'center',
  },
  body: {
    fontSize: 14, lineHeight: 21,
    fontFamily: 'Inter_400Regular',
    color: Colors.text.secondary,
    textAlign: 'center',
    maxWidth: 360,
  },
  featureList: {
    width: '100%', maxWidth: 360,
    gap: 10, marginTop: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  featureText: {
    fontSize: 13, lineHeight: 18,
    fontFamily: 'Inter_400Regular',
    color: Colors.text.primary,
    flex: 1,
  },
  planChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 100,
    borderWidth: 1, borderColor: `${PURPLE}55`,
    backgroundColor: `${PURPLE}14`,
    marginTop: 6,
  },
  planChipText: {
    fontSize: 10, letterSpacing: 1.4,
    fontFamily: 'Inter_700Bold',
    color: PURPLE,
  },
  cta: {
    width: '100%', maxWidth: 360,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: PURPLE,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 16,
  },
  ctaText: {
    fontSize: 12, letterSpacing: 1.4,
    fontFamily: 'Inter_700Bold',
    color: '#0a0014',
  },
  v2Pill: {
    position: 'absolute', left: 0, right: 0, bottom: 24,
    alignItems: 'center',
  },
  v2Btn: {
    paddingVertical: 10, paddingHorizontal: 18,
    borderRadius: 100,
    borderWidth: 1, borderColor: 'rgba(182,255,0,0.55)',
    backgroundColor: 'rgba(182,255,0,0.12)',
  },
  v2BtnText: {
    fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 2,
    color: '#B6FF00',
  },
});
