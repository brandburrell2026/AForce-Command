/**
 * Subscription Plan card.
 *
 * Renders one plan tile with price, tagline, feature bullets,
 * and a primary CTA. Bundle is visually flagship-elevated.
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';

import { Colors } from '@/theme/colors';
import type { SubscriptionPlan, SubscriptionPlanId } from '@/types/subscription';
import { PLAN_BY_ID } from '@/data/subscriptionPlans';

interface Props {
  plan: SubscriptionPlan;
  isCurrent: boolean;
  isProcessing?: boolean;
  onSelect: (planId: SubscriptionPlanId) => void;
}

const PLAN_ACCENT: Record<SubscriptionPlanId, string> = {
  core:      Colors.states.BALANCED.primary,
  athlete:   Colors.states.PEAK.primary,
  bundle:    Colors.states.PEAK.primary,
  core_team: Colors.states.BALANCED.primary,
  clutch:    Colors.clutch.primary,
  guardian:  Colors.guardian.primary,
};

export function SubscriptionPlanCard({ plan, isCurrent, isProcessing, onSelect }: Props) {
  const accent = PLAN_ACCENT[plan.id];
  const flagship = plan.isFlagship;
  const inheritedFromName = plan.inheritsFromId ? PLAN_BY_ID[plan.inheritsFromId]?.name : undefined;

  return (
    <View
      style={[
        styles.card,
        flagship && styles.flagshipCard,
        { borderColor: flagship ? accent : `${accent}44` },
        isCurrent && { borderColor: accent, backgroundColor: `${accent}0F` },
      ]}
    >
      {flagship && (
        <View style={[styles.flagshipBadge, { backgroundColor: accent }]}>
          <Feather name="star" size={10} color="#000" />
          <Text style={styles.flagshipBadgeText}>{plan.highlight ?? 'BEST VALUE'}</Text>
        </View>
      )}

      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, { color: accent }]}>{plan.name}</Text>
          <Text style={styles.tagline}>{plan.tagline}</Text>
        </View>
        <View style={[styles.priceWrap, { borderColor: `${accent}55`, backgroundColor: `${accent}14` }]}>
          <Text style={[styles.price, { color: accent }]}>{plan.priceLabel}</Text>
        </View>
      </View>

      {inheritedFromName && (
        <Text style={styles.inherits}>Everything in {inheritedFromName}, plus:</Text>
      )}

      <View style={styles.features}>
        {plan.features.slice(0, 6).map((f) => (
          <View key={f.id} style={styles.featureRow}>
            <Feather name="check" size={12} color={accent} />
            <Text style={styles.featureLabel} numberOfLines={2}>{f.label}</Text>
            {f.badge && (
              <View style={[styles.featureBadge, { borderColor: `${accent}66`, backgroundColor: `${accent}14` }]}>
                <Text style={[styles.featureBadgeText, { color: accent }]}>{f.badge}</Text>
              </View>
            )}
          </View>
        ))}
        {plan.features.length > 6 && (
          <Text style={styles.moreText}>+ {plan.features.length - 6} more</Text>
        )}
      </View>

      {plan.productSubscription && (
        <View style={[styles.productPanel, { borderColor: `${accent}33` }]}>
          <Feather name="package" size={12} color={accent} />
          <Text style={styles.productPanelText} numberOfLines={2}>
            {plan.productSubscription.allotments.map((a) => a.label).join(' · ')} — every month
          </Text>
        </View>
      )}

      <Pressable
        onPress={() => {
          if (isCurrent || isProcessing) return;
          if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          onSelect(plan.id);
        }}
        disabled={isCurrent || isProcessing}
        style={({ pressed }) => [
          styles.cta,
          {
            borderColor: isCurrent ? `${accent}55` : accent,
            backgroundColor: isCurrent ? 'transparent' : flagship ? accent : `${accent}1A`,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <Text
          style={[
            styles.ctaText,
            { color: isCurrent ? accent : flagship ? '#000' : accent },
          ]}
        >
          {isProcessing ? 'UPDATING…' : isCurrent ? 'CURRENT PLAN' : `CHOOSE ${plan.name.toUpperCase()}`}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.background.card,
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    gap: 12,
    overflow: 'hidden',
  },
  flagshipCard: {
    borderWidth: 1.5,
  },
  flagshipBadge: {
    position: 'absolute', top: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 4,
    borderBottomLeftRadius: 12,
  },
  flagshipBadgeText: {
    fontSize: 9, fontFamily: 'Inter_700Bold', letterSpacing: 1.2, color: '#000',
  },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  name: { fontSize: 18, fontFamily: 'Inter_700Bold', letterSpacing: -0.4 },
  tagline: {
    fontSize: 12, fontFamily: 'Inter_400Regular',
    color: Colors.text.secondary, marginTop: 4, lineHeight: 17,
  },
  priceWrap: {
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 10, borderWidth: 1,
  },
  price: { fontSize: 13, fontFamily: 'Inter_700Bold', letterSpacing: -0.2 },
  inherits: {
    fontSize: 11, fontFamily: 'Inter_500Medium',
    color: Colors.text.muted, fontStyle: 'italic',
  },
  features: { gap: 8, marginTop: 2 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featureLabel: { fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.text.primary, flex: 1 },
  featureBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  featureBadgeText: { fontSize: 8, fontFamily: 'Inter_700Bold', letterSpacing: 0.8 },
  moreText: { fontSize: 11, fontFamily: 'Inter_500Medium', color: Colors.text.muted, marginTop: 2 },
  productPanel: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 10, paddingVertical: 8,
    borderRadius: 10, borderWidth: 1,
  },
  productPanelText: {
    fontSize: 11, fontFamily: 'Inter_500Medium',
    color: Colors.text.secondary, flex: 1,
  },
  cta: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    paddingVertical: 12, borderRadius: 12, borderWidth: 1, marginTop: 4,
  },
  ctaText: { fontSize: 12, fontFamily: 'Inter_700Bold', letterSpacing: 1.2 },
});
