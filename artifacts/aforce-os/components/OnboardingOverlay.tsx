/**
 * OnboardingOverlay — First-launch coach mark.
 * 3 paged screens introducing AForce OS, the 4 tabs, and the Demo Access toggle.
 *
 * Visual design:
 *  - Card is bottom-anchored so the live Pulse/score it's introducing
 *    stays visible above it (the user sees what's being explained).
 *  - Backdrop is a soft dim, not opaque, for the same reason.
 *  - All copy goes through i18n so onboarding matches the user's
 *    saved language (previously hardcoded English caused a broken
 *    first impression for non-English users).
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withSpring, Easing,
} from 'react-native-reanimated';
import { Icon } from './Icon';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '../theme/colors';
import { afMotion } from '../theme/afTokens';

interface Props {
  visible: boolean;
  onDismiss: () => void;
}

const PAGE_KEYS = ['page1', 'page2', 'page3'] as const;
const PAGE_ICONS = ['activity', 'compass', 'unlock'] as const;

export function OnboardingOverlay({ visible, onDismiss }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState(0);
  const opacity = useSharedValue(visible ? 1 : 0);
  const translateY = useSharedValue(visible ? 0 : 40);

  React.useEffect(() => {
    if (visible) {
      // ENTER (afMotion pattern #1): durations.entrance + easing.standardOut,
      // was 280ms/no easing (linear) — diff 20ms, now an explicit ease-out curve.
      opacity.value = withTiming(1, { duration: afMotion.durations.entrance, easing: Easing.bezier(...afMotion.easing.standardOut) });
      translateY.value = withSpring(0, afMotion.springs.standard);
      // was { damping: 18, stiffness: 220 } — the dominant sheet spring, token match.
    } else {
      // EXIT (afMotion pattern #2): durations.selection, was 180ms — diff 30ms.
      opacity.value = withTiming(0, { duration: afMotion.durations.selection });
      translateY.value = withTiming(40, { duration: afMotion.durations.selection });
    }
  }, [visible]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const cardStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));

  if (!visible) return null;

  const isLast = page === PAGE_KEYS.length - 1;
  const pageKey = PAGE_KEYS[page];
  const accent = Colors.states.PEAK.primary;

  const next = () => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    if (isLast) onDismiss();
    else setPage(page + 1);
  };

  return (
    <Animated.View
      style={[styles.overlay, overlayStyle, { paddingBottom: Math.max(insets.bottom + 12, 28) }]}
      pointerEvents="auto"
      accessibilityViewIsModal
    >
      {/* Tap-outside-to-dismiss target. Hidden from a11y so screen
          readers don't see a duplicate/ambiguous skip control — the
          explicit Skip button below remains the primary dismiss path. */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onDismiss}
        accessible={false}
        importantForAccessibility="no-hide-descendants"
      />
      <Animated.View style={[styles.card, cardStyle, { borderColor: `${accent}33` }]}>
        <View style={styles.cardHeader}>
          <View style={[styles.iconCircle, { backgroundColor: `${accent}1A`, borderColor: `${accent}55` }]}>
            <Icon name={PAGE_ICONS[page]} size={22} color={accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.eyebrow, { color: accent }]}>{t(`onboarding.${pageKey}.eyebrow`)}</Text>
            <Text style={styles.title}>{t(`onboarding.${pageKey}.title`)}</Text>
          </View>
        </View>
        <Text style={styles.body}>{t(`onboarding.${pageKey}.body`)}</Text>

        <View style={styles.dotsRow}>
          {PAGE_KEYS.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor: i === page ? accent : Colors.fill.medium,
                  width: i === page ? 22 : 6,
                },
              ]}
            />
          ))}
        </View>

        <View style={styles.actions}>
          {page > 0 && (
            <Pressable
              onPress={() => setPage(page - 1)}
              style={styles.backBtn}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('onboarding.back')}
            >
              <Icon name="chevron-left" size={14} color={Colors.text.secondary} />
              <Text style={styles.backText}>{t('onboarding.back')}</Text>
            </Pressable>
          )}
          <View style={{ flex: 1 }} />
          <Pressable
            onPress={onDismiss}
            style={styles.skipBtn}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('onboarding.skip')}
          >
            <Text style={styles.skipText}>{t('onboarding.skip')}</Text>
          </Pressable>
          <Pressable
            onPress={next}
            style={[styles.nextBtn, { backgroundColor: accent }]}
            accessibilityRole="button"
            accessibilityLabel={isLast ? t('onboarding.start') : t('onboarding.next')}
          >
            <Text style={styles.nextText}>{isLast ? t('onboarding.start') : t('onboarding.next')}</Text>
            <Icon name={isLast ? 'check' : 'arrow-right'} size={14} color="#000" />
          </Pressable>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    // Soft dim only — we want the live Pulse/score to remain visible
    // through the backdrop so the user can SEE what's being introduced.
    backgroundColor: 'rgba(2,2,8,0.55)',
    justifyContent: 'flex-end',
    zIndex: 300,
    paddingHorizontal: 18,
    // paddingBottom is set inline so it can respect safe-area insets.
  },
  card: {
    width: '100%',
    backgroundColor: Colors.background.elevated,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 22,
    paddingVertical: 22,
    // Lift the card off the dim backdrop with a soft shadow.
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -6 },
    elevation: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 14,
  },
  iconCircle: {
    width: 44, height: 44, borderRadius: 22, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  eyebrow: {
    fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 2.2, marginBottom: 4,
  },
  title: {
    fontSize: 17, fontFamily: 'Inter_700Bold',
    color: Colors.text.primary, letterSpacing: -0.3, lineHeight: 22,
  },
  body: {
    fontSize: 13.5, fontFamily: 'Inter_400Regular',
    color: Colors.text.secondary, lineHeight: 19, marginBottom: 18,
  },
  dotsRow: {
    flexDirection: 'row', gap: 6, marginBottom: 18,
  },
  dot: { height: 6, borderRadius: 3 },
  actions: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  backBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingVertical: 8, paddingRight: 8,
  },
  backText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.text.secondary },
  skipBtn: { paddingVertical: 10, paddingHorizontal: 12 },
  skipText: { fontSize: 11, fontFamily: 'Inter_700Bold', color: Colors.text.muted, letterSpacing: 1.5 },
  nextBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12,
  },
  nextText: { fontSize: 12, fontFamily: 'Inter_700Bold', color: '#000', letterSpacing: 1.5 },
});
