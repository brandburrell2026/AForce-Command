/**
 * Subscription screen — plan picker.
 *
 * Lists all AForce subscription plans with the user's current plan
 * pre-selected. Tapping a plan switches via the (mock) billing service
 * and immediately updates the live store + unlocked feature flags.
 */

import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Platform, Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';

import { GradientBackground } from '@/components/GradientBackground';
import { SubscriptionPlanCard } from '@/components/SubscriptionPlanCard';
import { Colors } from '@/theme/colors';
import { useAppStore } from '@/store/useAppStore';
import { SUBSCRIPTION_PLANS } from '@/data/subscriptionPlans';
import { switchPlan } from '@/services/subscriptionService';
import type { SubscriptionPlanId } from '@/types/subscription';

const FILTERS: { id: 'consumer' | 'team' | 'enterprise'; label: string }[] = [
  { id: 'consumer',   label: 'CONSUMER' },
  { id: 'team',       label: 'TEAM' },
  { id: 'enterprise', label: 'ENTERPRISE' },
];

export default function SubscriptionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { state, setSubscription } = useAppStore();
  const [filter, setFilter] = useState<'consumer' | 'team' | 'enterprise'>('consumer');
  const [pendingPlanId, setPendingPlanId] = useState<SubscriptionPlanId | null>(null);

  const topPadding = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPadding = Platform.OS === 'web' ? 34 : insets.bottom;

  const visiblePlans = useMemo(
    () => SUBSCRIPTION_PLANS.filter((p) => p.audience === filter).sort((a, b) => a.rank - b.rank),
    [filter],
  );

  const onSelect = async (planId: SubscriptionPlanId) => {
    if (state.subscription.planId === planId || pendingPlanId) return;
    setPendingPlanId(planId);
    try {
      const next = await switchPlan(planId);
      setSubscription(next);
    } finally {
      setPendingPlanId(null);
    }
  };

  return (
    <View style={styles.root}>
      <GradientBackground>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.content, { paddingTop: topPadding + 8, paddingBottom: bottomPadding + 32 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerRow}>
            <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
              <Feather name="chevron-left" size={20} color={Colors.text.primary} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>AFORCE SUBSCRIPTION</Text>
              <Text style={styles.title}>Choose Your Plan</Text>
            </View>
            <Pressable onPress={() => router.push('/subscription/manage')} style={styles.manageBtn} hitSlop={10}>
              <Feather name="settings" size={16} color={Colors.text.primary} />
            </Pressable>
          </View>

          <Text style={styles.subtitle}>
            AForce is a performance OS. Pick the tier that matches your mission.
          </Text>

          {/* Audience filter */}
          <View style={styles.filterRow}>
            {FILTERS.map((f) => {
              const active = filter === f.id;
              return (
                <Pressable
                  key={f.id}
                  onPress={() => setFilter(f.id)}
                  style={[styles.filterBtn, active && styles.filterBtnActive]}
                >
                  <Text style={[styles.filterText, active && styles.filterTextActive]}>{f.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* Plan cards */}
          <View style={styles.plans}>
            {visiblePlans.map((plan) => (
              <SubscriptionPlanCard
                key={plan.id}
                plan={plan}
                isCurrent={state.subscription.planId === plan.id}
                isProcessing={pendingPlanId === plan.id}
                onSelect={onSelect}
              />
            ))}
          </View>

          <View style={styles.trustRow}>
            <Feather name="shield" size={12} color={Colors.text.muted} />
            <Text style={styles.trustText}>
              Demo billing. Cancel any time. Apple IAP / Stripe integrations ready.
            </Text>
          </View>
        </ScrollView>
      </GradientBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background.primary },
  content: { paddingHorizontal: 20, gap: 16 },

  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.background.card,
    borderWidth: 1, borderColor: Colors.border.subtle,
    alignItems: 'center', justifyContent: 'center',
  },
  manageBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.background.card,
    borderWidth: 1, borderColor: Colors.border.subtle,
    alignItems: 'center', justifyContent: 'center',
  },
  eyebrow: { fontSize: 10, fontFamily: 'Inter_700Bold', color: Colors.text.muted, letterSpacing: 2.5 },
  title: { fontSize: 22, fontFamily: 'Inter_700Bold', color: Colors.text.primary, letterSpacing: -0.6, marginTop: 2 },
  subtitle: {
    fontSize: 13, fontFamily: 'Inter_400Regular',
    color: Colors.text.secondary, lineHeight: 18,
  },

  filterRow: {
    flexDirection: 'row', gap: 8,
    backgroundColor: Colors.background.card,
    padding: 4, borderRadius: 100,
    borderWidth: 1, borderColor: Colors.border.subtle,
  },
  filterBtn: {
    flex: 1, paddingVertical: 8, borderRadius: 100,
    alignItems: 'center', justifyContent: 'center',
  },
  filterBtnActive: { backgroundColor: Colors.background.elevated },
  filterText: {
    fontSize: 10, fontFamily: 'Inter_700Bold',
    color: Colors.text.muted, letterSpacing: 1.4,
  },
  filterTextActive: { color: Colors.text.primary },

  plans: { gap: 14 },

  trustRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingTop: 8,
  },
  trustText: { fontSize: 11, fontFamily: 'Inter_500Medium', color: Colors.text.muted, textAlign: 'center' },
});
