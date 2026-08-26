/**
 * Social (Legacy) — the original Recovery/Cruise/SocialModeSheet UI.
 *
 * Preserved verbatim so it can be re-enabled behind Developer Mode
 * (see `services/devMode.ts`). The production Social tab now renders
 * the spec-driven Social V2 screen at `app/(tabs)/social.tsx`.
 *
 * This route is always registered in the (tabs) group but its tab-bar
 * button is hidden (`href: null` in `_layout.tsx`) unless Developer
 * Mode is enabled. Wave-1 P0 hardening: `getDevMode()` itself reports
 * false unless developer controls are available (local dev / demo builds
 * / internal TestFlight), so this deep link — and every other devMode
 * surface — redirects for ordinary production users even if a persisted
 * pre-hardening toggle says otherwise.
 */

import React from 'react';
import {
  View, Text, StyleSheet, Pressable, Platform, ScrollView,
} from 'react-native';
import { useRouter, Redirect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { hapticImpact } from '@/services/haptics';
import { Icon } from '../../components/Icon';

import { useDevMode } from '@/services/devMode';
import { GradientBackground } from '@/components/GradientBackground';
import { SocialModeSheet } from '@/components/SocialModeSheet';
import { Colors } from '@/theme/colors';
import { af } from '@/theme';
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

export default function SocialLegacyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { state } = useAppStore();
  const userState = useUserSlice();
  const engine = useEngineSlice();
  const devMode = useDevMode();
  const {
    activateSocialMode,
    logSocialDrink,
    confirmSocialHydration,
    deactivateSocialMode,
    activateCruiseMode,
    activateVoyageShield,
  } = useActionsSlice<SocialActions>();

  // NO-b: this legacy QA surface is no longer publicly discoverable. It stays
  // reachable ONLY in Developer Mode; a production/normal deep link redirects to
  // Protocol (non-destructive — the screen is preserved for QA). No loop.
  if (!devMode) {
    return <Redirect href="/(tabs)/protocol" />;
  }

  const planId = state.subscription?.planId ?? 'core';
  const isSubscribed = planId !== 'core';

  const goToStore = React.useCallback(() => {
    if (Platform.OS !== 'web') {
      hapticImpact('medium');
    }
    router.push('/store');
  }, [router]);

  const goHome = React.useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [router]);

  if (isSubscribed) {
    return (
      <View style={styles.root}>
        <GradientBackground>
          <View style={styles.legacyBanner} pointerEvents="none">
            <Text style={styles.legacyBannerText}>LEGACY · DEVELOPER MODE</Text>
          </View>
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
        </GradientBackground>
      </View>
    );
  }

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

          <Text style={styles.eyebrow}>RECOVERY MODE · LEGACY</Text>
          <Text style={styles.title}>Recovery capacity, in real time</Text>
          <Text style={styles.body}>
            One blended 0–100 score across your AutoPilot performance,
            hydration compliance, and environmental stress. Watch it move
            through Peak, Stable, Declining, and Critical bands as your
            day evolves — and act before you fall.
          </Text>

          <View style={styles.planChip}>
            <Icon name="lock" size={11} color={PURPLE} />
            <Text style={styles.planChipText}>INCLUDED WITH ATHLETE +</Text>
          </View>

          <Pressable
            onPress={goToStore}
            style={({ pressed }) => [styles.cta, pressed && { opacity: 0.9 }]}
            accessibilityRole="button"
            accessibilityLabel="Upgrade to unlock Night Out"
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
  legacyBanner: {
    position: 'absolute', top: 0, left: 0, right: 0,
    paddingTop: Platform.OS === 'web' ? 8 : 44,
    paddingBottom: 6,
    alignItems: 'center',
    backgroundColor: 'rgba(193,40,27,0.10)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(193,40,27,0.35)',
    zIndex: 10,
  },
  legacyBannerText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 10, letterSpacing: 2,
    // af.red as TEXT fails AA (~3.3:1); af.redText is the AA-verified swap.
    // Banner background/border above keep the brand red fill, unaffected.
    color: af.redText,
  },
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
});
