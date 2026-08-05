/**
 * Subscription Plan card.
 *
 * Used for Consumer + Team / Program tiers. Renders price, positioning,
 * inheritance bridge, feature bullets, optional badge ("BEST VALUE"),
 * optional value note, and a primary CTA. Premium WHOOP × Nike feel.
 *
 * Performance Systems plans (Clutch / Guardian) use EnterprisePlanCard
 * for the heavier setup-fee + minimum-term layout.
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Icon } from './Icon';

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
  core:            Colors.states.BALANCED.primary,
  recovery_plus:   Colors.states.RECOVERING.primary,
  athlete:         Colors.states.PEAK.primary,
  system:          Colors.states.PEAK.primary,
  elite:           Colors.guardian.primary,
  team_starter:    Colors.states.BALANCED.primary,
  team_growth:     Colors.states.BALANCED.primary,
  team_pro:        Colors.states.BALANCED.primary,
  clutch_starter:  Colors.clutch.primary,
  clutch_pro:      Colors.clutch.primary,
  clutch_elite:    Colors.clutch.primary,
  guardian_core:   Colors.guardian.primary,
  guardian_elite:  Colors.guardian.primary,
};

export function SubscriptionPlanCard({ plan, isCurrent, isProcessing, onSelect }: Props) {
  const accent = PLAN_ACCENT[plan.id];
  const flagship = plan.isBestValue === true;
  const inheritedFromName = plan.inheritsFromId ? PLAN_BY_ID[plan.inheritsFromId]?.name : undefined;
  const isFree = plan.priceMonthly === 0;

  return (
    <View
      style={[
        styles.card,
        flagship && styles.flagshipCard,
        { borderColor: flagship ? accent : `${accent}44` },
        isCurrent && { borderColor: accent, backgroundColor: `${accent}0F` },
      ]}
    >
      {plan.badge && (
        <View style={[styles.flagshipBadge, { backgroundColor: accent }]}>
          <Icon name="star" size={10} color="#000" />
          <Text style={styles.flagshipBadgeText}>{plan.badge}</Text>
        </View>
      )}

      <View style={styles.headerRow}>
        <View style={{ flex: 1, paddingRight: plan.badge ? 70 : 0 }}>
          <Text style={[styles.name, { color: accent }]}>{plan.name}</Text>
          <Text style={styles.positioning}>{plan.positioning}</Text>
        </View>
        <View style={[styles.priceWrap, { borderColor: `${accent}55`, backgroundColor: `${accent}14` }]}>
          <Text style={[styles.price, { color: accent }]}>{plan.priceLabel}</Text>
        </View>
      </View>

      {plan.userLimit && (
        <View style={styles.limitChip}>
          <Icon name="users" size={11} color={Colors.text.secondary} />
          <Text style={styles.limitText}>Up to {plan.userLimit} members</Text>
        </View>
      )}

      <Text style={styles.description} numberOfLines={3}>{plan.description}</Text>

      {inheritedFromName && (
        <Text style={styles.inherits}>Everything in {inheritedFromName}, plus:</Text>
      )}

      <View style={styles.features}>
        {plan.features.slice(0, 6).map((f) => (
          <View key={f.id} style={styles.featureRow}>
            <Icon name="check" size={12} color={accent} />
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
          <Icon name="package" size={12} color={accent} />
          <Text style={styles.productPanelText} numberOfLines={2}>
            {plan.productSubscription.allotments.map((a) => a.label).join(' · ')} — every month
          </Text>
        </View>
      )}

      {plan.valueNote && (
        <Text style={styles.valueNote}>{plan.valueNote}</Text>
      )}

      <Pressable
        onPress={() => {
          if (isCurrent || isProcessing) return;
          if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          onSelect(plan.id);
        }}
        disabled={isCurrent || isProcessing}
        accessibilityRole="button"
        accessibilityState={{ selected: isCurrent, disabled: isCurrent || isProcessing, busy: isProcessing === true }}
        accessibilityLabel={`${plan.name}, ${plan.priceLabel}, ${isProcessing ? 'updating' : isCurrent ? 'current plan, selected' : plan.ctaLabel}`}
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
          {isProcessing
            ? 'UPDATING…'
            : isCurrent
              ? 'CURRENT PLAN'
              : (isFree ? plan.ctaLabel : plan.ctaLabel).toUpperCase()}
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
  positioning: {
    fontSize: 12, fontFamily: 'Inter_600SemiBold',
    color: Colors.text.primary, marginTop: 4, lineHeight: 17, letterSpacing: 0.1,
  },
  priceWrap: {
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 10, borderWidth: 1,
  },
  price: { fontSize: 13, fontFamily: 'Inter_700Bold', letterSpacing: -0.2 },
  limitChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 100, borderWidth: 1,
    borderColor: Colors.border.subtle,
    backgroundColor: Colors.background.elevated,
  },
  limitText: {
    fontSize: 10, fontFamily: 'Inter_700Bold',
    color: Colors.text.secondary, letterSpacing: 1,
  },
  description: {
    fontSize: 12, fontFamily: 'Inter_400Regular',
    color: Colors.text.secondary, lineHeight: 17,
  },
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
  valueNote: {
    fontSize: 11, fontFamily: 'Inter_600SemiBold',
    color: Colors.text.secondary, fontStyle: 'italic',
    paddingTop: 2,
  },
  cta: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    paddingVertical: 12, borderRadius: 12, borderWidth: 1, marginTop: 4,
  },
  ctaText: { fontSize: 12, fontFamily: 'Inter_700Bold', letterSpacing: 1.2 },
});
