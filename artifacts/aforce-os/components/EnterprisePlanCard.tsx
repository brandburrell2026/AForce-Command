/**
 * Enterprise / Performance Systems plan card.
 *
 * Used for Clutch Access and Guardian tiers. Heavier visual weight than
 * the Consumer/Team card: surfaces setup fee, minimum term, ELITE badge,
 * and value-note ROI line.
 *
 * Premium positioning: WHOOP × Tesla × enterprise SaaS.
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { hapticImpact } from '@/services/haptics';
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

function accentFor(plan: SubscriptionPlan): string {
  return plan.subcategory === 'guardian' ? Colors.guardian.primary : Colors.clutch.primary;
}

function fmtUsd(n: number): string {
  return `$${n.toLocaleString('en-US')}`;
}

export function EnterprisePlanCard({ plan, isCurrent, isProcessing, onSelect }: Props) {
  const accent = accentFor(plan);
  const elite = plan.badge === 'ELITE';
  const inheritedFromName = plan.inheritsFromId ? PLAN_BY_ID[plan.inheritsFromId]?.name : undefined;

  return (
    <View
      style={[
        styles.card,
        elite && styles.eliteCard,
        { borderColor: elite ? accent : `${accent}55` },
        isCurrent && { borderColor: accent, backgroundColor: `${accent}0F` },
      ]}
    >
      {/* Top bar — subcategory + ELITE badge */}
      <View style={styles.topBar}>
        <View style={[styles.subcatChip, { borderColor: `${accent}66`, backgroundColor: `${accent}14` }]}>
          <View style={[styles.subcatDot, { backgroundColor: accent }]} />
          <Text style={[styles.subcatText, { color: accent }]}>
            {plan.subcategory === 'guardian' ? 'GUARDIAN' : 'CLUTCH ACCESS'}
          </Text>
        </View>
        {elite && (
          <View style={[styles.eliteBadge, { backgroundColor: accent }]}>
            <Icon name="award" size={10} color="#000" />
            <Text style={styles.eliteBadgeText}>ELITE</Text>
          </View>
        )}
      </View>

      {/* Title block */}
      <Text style={[styles.name, { color: accent }]}>{plan.name}</Text>
      <Text style={styles.positioning}>{plan.positioning}</Text>

      {/* Price block */}
      <View style={[styles.priceBlock, { borderColor: `${accent}33` }]}>
        <View style={styles.priceTop}>
          <Text style={[styles.priceMain, { color: accent }]}>{plan.priceLabel}</Text>
        </View>
        <View style={styles.priceMeta}>
          {plan.setupFee != null && (
            <View style={styles.priceMetaItem}>
              <Icon name="package" size={11} color={Colors.text.muted} />
              <Text style={styles.priceMetaText}>{fmtUsd(plan.setupFee)} one-time setup</Text>
            </View>
          )}
          {plan.minimumTermMonths != null && (
            <View style={styles.priceMetaItem}>
              <Icon name="calendar" size={11} color={Colors.text.muted} />
              <Text style={styles.priceMetaText}>{plan.minimumTermMonths}-month minimum term</Text>
            </View>
          )}
        </View>
      </View>

      {/* Description */}
      <Text style={styles.description}>{plan.description}</Text>

      {inheritedFromName && (
        <Text style={styles.inherits}>Everything in {inheritedFromName}, plus:</Text>
      )}

      {/* Feature list */}
      <View style={styles.features}>
        {plan.features.map((f) => (
          <View key={f.id} style={styles.featureRow}>
            <Icon name="check" size={13} color={accent} />
            <Text style={styles.featureLabel} numberOfLines={2}>{f.label}</Text>
            {f.badge && (
              <View style={[styles.featureBadge, { borderColor: `${accent}66`, backgroundColor: `${accent}14` }]}>
                <Text style={[styles.featureBadgeText, { color: accent }]}>{f.badge}</Text>
              </View>
            )}
          </View>
        ))}
      </View>

      {/* Value note */}
      {plan.valueNote && (
        <View style={[styles.valueNoteWrap, { borderColor: `${accent}44`, backgroundColor: `${accent}0D` }]}>
          <Icon name="trending-down" size={12} color={accent} />
          <Text style={[styles.valueNoteText, { color: Colors.text.primary }]}>{plan.valueNote}</Text>
        </View>
      )}

      {/* CTA */}
      <Pressable
        onPress={() => {
          if (isCurrent || isProcessing) return;
          if (Platform.OS !== 'web') hapticImpact('heavy');
          onSelect(plan.id);
        }}
        disabled={isCurrent || isProcessing}
        accessibilityRole="button"
        accessibilityState={{ selected: isCurrent, disabled: isCurrent || isProcessing, busy: isProcessing === true }}
        accessibilityLabel={`${plan.name}, ${plan.priceLabel}, ${isProcessing ? 'updating' : isCurrent ? 'current plan, selected' : plan.ctaLabel}`}
        style={({ pressed }) => [
          styles.cta,
          {
            borderColor: accent,
            backgroundColor: isCurrent ? 'transparent' : elite ? accent : `${accent}26`,
            opacity: pressed ? 0.88 : 1,
          },
        ]}
      >
        <Text
          style={[
            styles.ctaText,
            { color: isCurrent ? accent : elite ? '#000' : accent },
          ]}
        >
          {isProcessing
            ? 'UPDATING…'
            : isCurrent
              ? 'CURRENT PLAN'
              : plan.ctaLabel.toUpperCase()}
        </Text>
        {!isCurrent && !isProcessing && (
          <Icon name="arrow-right" size={14} color={isCurrent ? accent : elite ? '#000' : accent} />
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.background.card,
    borderRadius: 22,
    borderWidth: 1,
    padding: 20,
    gap: 12,
    overflow: 'hidden',
  },
  eliteCard: { borderWidth: 1.5 },

  topBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  subcatChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 100, borderWidth: 1,
  },
  subcatDot: { width: 6, height: 6, borderRadius: 3 },
  subcatText: { fontSize: 9, fontFamily: 'Inter_700Bold', letterSpacing: 1.6 },
  eliteBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 100,
  },
  eliteBadgeText: {
    fontSize: 9, fontFamily: 'Inter_700Bold', letterSpacing: 1.4, color: '#000',
  },

  name: { fontSize: 22, fontFamily: 'Inter_700Bold', letterSpacing: -0.6, marginTop: 4 },
  positioning: {
    fontSize: 13, fontFamily: 'Inter_600SemiBold',
    color: Colors.text.primary, lineHeight: 18,
  },

  priceBlock: {
    borderRadius: 14, borderWidth: 1,
    padding: 14, gap: 8, marginTop: 4,
  },
  priceTop: { flexDirection: 'row', alignItems: 'baseline' },
  priceMain: { fontSize: 26, fontFamily: 'Inter_700Bold', letterSpacing: -1 },
  priceMeta: { gap: 4, marginTop: 2 },
  priceMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  priceMetaText: { fontSize: 11, fontFamily: 'Inter_500Medium', color: Colors.text.secondary },

  description: {
    fontSize: 12, fontFamily: 'Inter_400Regular',
    color: Colors.text.secondary, lineHeight: 18,
  },
  inherits: {
    fontSize: 11, fontFamily: 'Inter_500Medium',
    color: Colors.text.muted, fontStyle: 'italic',
  },
  features: { gap: 9, marginTop: 2 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featureLabel: { fontSize: 12.5, fontFamily: 'Inter_500Medium', color: Colors.text.primary, flex: 1 },
  featureBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  featureBadgeText: { fontSize: 8, fontFamily: 'Inter_700Bold', letterSpacing: 0.8 },

  valueNoteWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 12, borderWidth: 1, marginTop: 2,
  },
  valueNoteText: {
    fontSize: 11.5, fontFamily: 'Inter_600SemiBold',
    flex: 1, lineHeight: 16,
  },

  cta: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 14, borderWidth: 1, marginTop: 4,
  },
  ctaText: { fontSize: 12, fontFamily: 'Inter_700Bold', letterSpacing: 1.4 },
});
