/**
 * SocialModeSheet — Activation + control surface for Social Mode.
 *
 * - When mode is OFF: shows the calm intro + drink picker grid. Picking
 *   a drink also activates the mode (single-tap entry).
 * - When mode is ON: shows the live drink count, hangover risk badge,
 *   "Log next drink" button, hydration confirmation row (when prompted),
 *   and "End night" button (which transitions to Recovery Mode).
 * - When in Recovery: shows the recovery checklist and an "I'm done"
 *   button to clear the badge.
 *
 * Reuses the ScoreBreakdownSheet pattern: full-screen Animated.View
 * overlay + spring-in bottom sheet. No external modal lib.
 */

import React, { useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable, Platform, ScrollView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withSpring, Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';

import { Colors } from '../theme/colors';
import { HangoverRiskBadge } from './HangoverRiskBadge';
import { ImpairmentRiskBadge } from './ImpairmentRiskBadge';
import { BACEstimateCard } from './BACEstimateCard';
import { SocialSafetyCard } from './SocialSafetyCard';
import { RecoveryModeCard } from './RecoveryModeCard';
import { ALCOHOL_DRINKS, DRINK_TYPES_ORDER } from '../data/alcoholDrinks';
import type { DrinkType, ScoreEngineOutput, SocialModeState } from '../types';

interface Props {
  visible: boolean;
  onDismiss: () => void;
  socialMode: SocialModeState | undefined;
  social: ScoreEngineOutput['social'];
  onActivate: () => void;
  onLogDrink: (type: DrinkType) => void;
  onConfirmHydration: (confirmed: boolean) => void;
  onDeactivate: () => void;
}

const PURPLE = '#9D7CFB';
const AMBER = '#F4B23F';

const DRINK_ICON: Record<DrinkType, React.ComponentProps<typeof Feather>['name']> = {
  beer: 'coffee',
  wine: 'droplet',
  cocktail: 'feather',
  liquor: 'zap',
  hard_seltzer: 'cloud-drizzle',
  custom: 'plus-circle',
};

export function SocialModeSheet({
  visible, onDismiss, socialMode, social,
  onActivate, onLogDrink, onConfirmHydration, onDeactivate,
}: Props) {
  const { t } = useTranslation();
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(60);

  useEffect(() => {
    if (visible) {
      if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
      opacity.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.quad) });
      translateY.value = withSpring(0, { damping: 18, stiffness: 220 });
    } else {
      opacity.value = withTiming(0, { duration: 180 });
      translateY.value = withTiming(60, { duration: 180 });
    }
  }, [visible]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  if (!visible) return null;

  const isActive = !!social?.active;
  const inRecovery = !!social?.inRecoveryWindow && !isActive;
  const accent = inRecovery ? AMBER : PURPLE;

  const lastDrink = socialMode?.drinks?.length
    ? socialMode.drinks[socialMode.drinks.length - 1]
    : null;
  const showHydrationPrompt = isActive
    && lastDrink != null
    && lastDrink.hydrated == null
    && (Date.now() - lastDrink.loggedAt.getTime()) < 8 * 60 * 1000;

  const handleDrink = (type: DrinkType) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onLogDrink(type);
  };

  return (
    <Animated.View style={[styles.overlay, overlayStyle]} pointerEvents="auto">
      <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />
      <Animated.View style={[styles.sheet, sheetStyle, { borderColor: `${accent}33` }]} testID="social-mode-sheet">
        <View style={styles.handle} />
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.eyebrow, { color: accent }]}>{t('social.title')}</Text>
            <Text style={styles.headline}>
              {inRecovery ? t('social.recovery_headline')
                : isActive ? t('social.active_headline')
                : t('social.intro_headline')}
            </Text>
          </View>
          <Pressable hitSlop={12} onPress={onDismiss} style={styles.closeBtn}>
            <Feather name="x" size={18} color={Colors.text.secondary} />
          </Pressable>
        </View>

        <ScrollView style={{ maxHeight: 520 }} showsVerticalScrollIndicator={false}>
          {!isActive && !inRecovery && (
            <>
              <Text style={styles.body}>{t('social.intro_body')}</Text>
              <Text style={styles.sectionLabel}>{t('social.pick_drink')}</Text>
              <View style={styles.grid}>
                {DRINK_TYPES_ORDER.map((type) => (
                  <Pressable
                    key={type}
                    onPress={() => {
                      if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
                      // Single-tap entry from OFF state. The server's
                      // /social/drink route auto-activates a fresh
                      // session when one isn't already running, so we
                      // call only the drink endpoint to avoid a
                      // race where /activate could land after /drink
                      // and clobber the just-logged drink.
                      onLogDrink(type);
                    }}
                    style={({ pressed }) => [
                      styles.drinkTile,
                      { borderColor: `${PURPLE}55` },
                      pressed && { opacity: 0.8 },
                    ]}
                    testID={`social-drink-${type}`}
                  >
                    <Feather name={DRINK_ICON[type]} size={22} color={PURPLE} />
                    <Text style={styles.drinkLabel}>{t(`social.drink_${type}`)}</Text>
                    <Text style={styles.drinkMeta}>+{Math.round((ALCOHOL_DRINKS[type].decayMultiplier - 1) * 100)}%</Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}

          {isActive && social && (
            <>
              <View style={styles.statusRow}>
                <View style={styles.statBlock}>
                  <Text style={styles.statValue}>{social.drinkCount}</Text>
                  <Text style={styles.statLabel}>{t('social.drinks')}</Text>
                </View>
                <View style={styles.statBlock}>
                  <Text style={styles.statValue}>×{social.alcoholMultiplier.toFixed(2)}</Text>
                  <Text style={styles.statLabel}>{t('social.decay_mult')}</Text>
                </View>
                <View style={[styles.statBlock, { alignItems: 'flex-end' }]}>
                  <ImpairmentRiskBadge impairment={social.impairment} />
                  <Text style={[styles.statLabel, { marginTop: 6 }]}>{t('social.impairment_label')}</Text>
                </View>
              </View>

              {/* BAC + impairment surface — always rendered while active so
                  the user can see the trend before things escalate. */}
              <BACEstimateCard bac={social.bac} />

              {/* Legal & transportation safety — only renders at MODERATE+. */}
              <SocialSafetyCard prompt={social.transportation} />

              <View style={styles.hangoverInline}>
                <HangoverRiskBadge risk={social.hangoverRisk} showScore />
                <Text style={styles.hangoverLabel}>{t('social.hangover_risk')}</Text>
              </View>

              {showHydrationPrompt && (
                <View style={[styles.hydrateCard, { borderColor: `${PURPLE}55` }]} testID="social-hydration-prompt">
                  <Text style={[styles.eyebrow, { color: PURPLE }]}>{t('social.hydration_check')}</Text>
                  <Text style={styles.body}>{t('social.hydration_prompt')}</Text>
                  <View style={styles.hydrateRow}>
                    <Pressable
                      onPress={() => onConfirmHydration(true)}
                      style={[styles.choiceBtn, { borderColor: Colors.states.PEAK.primary }]}
                      testID="social-hydrate-yes"
                    >
                      <Feather name="check" size={16} color={Colors.states.PEAK.primary} />
                      <Text style={[styles.choiceText, { color: Colors.states.PEAK.primary }]}>
                        {t('social.hydrated_yes')}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => onConfirmHydration(false)}
                      style={[styles.choiceBtn, { borderColor: Colors.text.muted }]}
                      testID="social-hydrate-no"
                    >
                      <Feather name="x" size={16} color={Colors.text.muted} />
                      <Text style={[styles.choiceText, { color: Colors.text.muted }]}>
                        {t('social.hydrated_not_yet')}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              )}

              <Text style={styles.sectionLabel}>{t('social.log_next_drink')}</Text>
              <View style={styles.grid}>
                {DRINK_TYPES_ORDER.map((type) => (
                  <Pressable
                    key={type}
                    onPress={() => handleDrink(type)}
                    style={({ pressed }) => [
                      styles.drinkTile,
                      { borderColor: `${PURPLE}55` },
                      pressed && { opacity: 0.8 },
                    ]}
                    testID={`social-drink-${type}`}
                  >
                    <Feather name={DRINK_ICON[type]} size={20} color={PURPLE} />
                    <Text style={styles.drinkLabel}>{t(`social.drink_${type}`)}</Text>
                  </Pressable>
                ))}
              </View>

              <Pressable
                onPress={onDeactivate}
                style={[styles.endNightBtn, { borderColor: `${AMBER}66` }]}
                testID="social-end-night"
              >
                <Feather name="moon" size={16} color={AMBER} />
                <Text style={[styles.endNightText, { color: AMBER }]}>{t('social.end_night')}</Text>
              </Pressable>
            </>
          )}

          {inRecovery && social && (
            <>
              <Text style={styles.body}>{t('social.recovery_body')}</Text>
              <View style={styles.statusRow}>
                <View style={styles.statBlock}>
                  <Text style={styles.statValue}>{social.drinkCount}</Text>
                  <Text style={styles.statLabel}>{t('social.drinks_last_session')}</Text>
                </View>
                <View style={[styles.statBlock, { alignItems: 'flex-end' }]}>
                  <HangoverRiskBadge risk={social.hangoverRisk} showScore />
                  <Text style={[styles.statLabel, { marginTop: 6 }]}>{t('social.hangover_risk')}</Text>
                </View>
              </View>

              <RecoveryModeCard timeToClearMinutes={social.bac.timeToClearMinutes} />

              <Pressable
                onPress={onDismiss}
                style={[styles.endNightBtn, { borderColor: `${AMBER}66` }]}
              >
                <Feather name="check" size={16} color={AMBER} />
                <Text style={[styles.endNightText, { color: AMBER }]}>{t('social.recovery_done')}</Text>
              </Pressable>
            </>
          )}
        </ScrollView>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.78)',
    justifyContent: 'flex-end',
    zIndex: 1000,
  },
  sheet: {
    backgroundColor: '#101015',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 32,
    maxHeight: '92%',
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignSelf: 'center', marginBottom: 18,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  eyebrow: { fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 2, marginBottom: 4 },
  headline: { fontSize: 18, fontFamily: 'Inter_700Bold', color: Colors.text.primary, lineHeight: 23 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center',
  },
  body: { fontSize: 14, fontFamily: 'Inter_400Regular', color: Colors.text.secondary, lineHeight: 20, marginBottom: 12 },
  sectionLabel: {
    fontSize: 11, fontFamily: 'Inter_700Bold', color: Colors.text.muted,
    letterSpacing: 1.6, marginTop: 8, marginBottom: 10,
  },
  grid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
    marginBottom: 14,
  },
  drinkTile: {
    width: '31%', minHeight: 78,
    paddingVertical: 12, paddingHorizontal: 8,
    borderRadius: 14, borderWidth: 1,
    backgroundColor: 'rgba(157,124,251,0.06)',
    alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  drinkLabel: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: Colors.text.primary, marginTop: 4 },
  drinkMeta: { fontSize: 10, fontFamily: 'Inter_500Medium', color: Colors.text.muted, marginTop: 2 },
  statusRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 14, paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16, marginBottom: 14, gap: 12,
  },
  statBlock: { flex: 1 },
  statValue: { fontSize: 22, fontFamily: 'Inter_700Bold', color: Colors.text.primary },
  statLabel: { fontSize: 10, fontFamily: 'Inter_700Bold', color: Colors.text.muted, letterSpacing: 1.4, marginTop: 2 },
  hydrateCard: {
    borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 14,
    backgroundColor: 'rgba(157,124,251,0.07)',
  },
  hydrateRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  choiceBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12, borderRadius: 12, borderWidth: 1,
  },
  choiceText: { fontSize: 13, fontFamily: 'Inter_700Bold', letterSpacing: 0.5 },
  endNightBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: 14, borderWidth: 1,
    marginTop: 8,
  },
  endNightText: { fontSize: 13, fontFamily: 'Inter_700Bold', letterSpacing: 1.2 },
  hangoverInline: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginBottom: 14,
  },
  hangoverLabel: {
    fontSize: 11, fontFamily: 'Inter_500Medium', color: Colors.text.muted,
    letterSpacing: 0.4,
  },
});
