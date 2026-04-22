/**
 * RecoveryModePaywall — locked variant of RecoveryModeCard.
 *
 * Shown during the post-session Recovery window when the user is NOT
 * subscribed to Recovery+ ($9.99/mo). Calm, never preachy. Tapping the
 * CTA navigates to the subscription screen (which runs the existing
 * Stripe Checkout flow that PLAN_CATALOG.recovery_plus is wired into).
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';

import { Colors } from '../theme/colors';

const TEAL = '#7CD3E5';
const AMBER = '#F4B23F';

const FEATURES: { key: string; icon: React.ComponentProps<typeof Feather>['name'] }[] = [
  { key: 'social.recovery_paywall_feat_morning', icon: 'sunrise' },
  { key: 'social.recovery_paywall_feat_steps',   icon: 'check-circle' },
  { key: 'social.recovery_paywall_feat_rtd',     icon: 'zap' },
];

export function RecoveryModePaywall() {
  const { t } = useTranslation();
  const router = useRouter();

  const onSubscribe = () => {
    // The subscription screen owns the Stripe Checkout flow. The
    // `recovery_plus` plan is registered in both client SUBSCRIPTION_PLANS
    // and server PLAN_CATALOG so the existing flow handles it natively.
    router.push({ pathname: '/subscription', params: { planId: 'recovery_plus', autoCheckout: '1' } });
  };

  return (
    <View style={[styles.card, { borderColor: `${TEAL}40` }]} testID="recovery-mode-paywall">
      <View style={styles.header}>
        <View style={[styles.iconWrap, { backgroundColor: `${TEAL}26` }]}>
          <Feather name="lock" size={18} color={TEAL} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.eyebrow, { color: TEAL }]}>{t('social.recovery_paywall_eyebrow')}</Text>
          <Text style={styles.title}>{t('social.recovery_paywall_title')}</Text>
        </View>
      </View>

      <Text style={styles.blurb}>{t('social.recovery_paywall_blurb')}</Text>

      <View style={styles.featuresBlock}>
        {FEATURES.map((f) => (
          <View key={f.key} style={styles.featureRow}>
            <Feather name={f.icon} size={14} color={AMBER} style={styles.featureIcon} />
            <Text style={styles.featureText}>{t(f.key)}</Text>
          </View>
        ))}
      </View>

      <View style={styles.priceRow}>
        <Text style={styles.priceValue}>{t('social.recovery_paywall_price')}</Text>
        <Text style={styles.priceCadence}>{t('social.recovery_paywall_cadence')}</Text>
      </View>

      <Pressable
        onPress={onSubscribe}
        style={({ pressed }) => [
          styles.cta,
          { backgroundColor: TEAL, opacity: pressed ? 0.85 : 1 },
        ]}
        testID="recovery-mode-paywall-cta"
      >
        <Feather name="arrow-right" size={16} color="#0A0A0F" />
        <Text style={styles.ctaText}>{t('social.recovery_paywall_cta')}</Text>
      </Pressable>

      <Text style={styles.disclaimer}>
        {t('social.estimate_only')} · {t('social.not_legal_medical')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: 'rgba(124,211,229,0.07)',
    padding: 14,
    marginBottom: 12,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  iconWrap: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  eyebrow: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.6,
    marginBottom: 2,
  },
  title: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: Colors.text.primary,
  },
  blurb: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 18,
  },
  featuresBlock: { gap: 6 },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureIcon: { width: 18 },
  featureText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 18,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginTop: 2,
  },
  priceValue: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    color: Colors.text.primary,
  },
  priceCadence: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: 'rgba(255,255,255,0.6)',
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
  },
  ctaText: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    color: '#0A0A0F',
    letterSpacing: 0.4,
  },
  disclaimer: {
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255,255,255,0.45)',
    lineHeight: 14,
  },
});
