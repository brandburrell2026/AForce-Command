/**
 * Subscription screen — plan picker.
 *
 * Three categories:
 *   - CONSUMER             (Core / Athlete / System)
 *   - TEAM / PROGRAM       (Team Core Starter / Growth / Pro)
 *   - PERFORMANCE SYSTEMS  (Clutch Access + Guardian)
 *
 * Performance Systems is sub-grouped (Clutch / Guardian) and uses the
 * heavier EnterprisePlanCard with setup-fee + minimum-term metadata.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Platform, Pressable, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

import { GradientBackground } from '@/components/GradientBackground';
import { SubscriptionPlanCard } from '@/components/SubscriptionPlanCard';
import { EnterprisePlanCard } from '@/components/EnterprisePlanCard';
import { Colors } from '@/theme/colors';
import { useAppStore } from '@/store/useAppStore';
import { SUBSCRIPTION_PLANS } from '@/data/subscriptionPlans';
import type { SubscriptionPlan, SubscriptionPlanId } from '@/types/subscription';
import { createCheckoutSession, fetchCheckoutSession } from '@/lib/api';
import { refreshEntitlement } from '@/hooks/useEntitlement';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';

// Plans that route through real Stripe Checkout. Anything not in this set
// (Core entry tier, Team / Performance Systems enterprise tiers) goes
// through a "Contact sales" alert at launch — there is no mock plan
// switch in the shipped app.
const STRIPE_PLAN_IDS = new Set<SubscriptionPlanId>(['recovery_plus', 'athlete', 'system', 'elite']);

type CategoryId = 'consumer' | 'team' | 'performance';

const FILTERS: { id: CategoryId; label: string }[] = [
  { id: 'consumer',    label: 'CONSUMER' },
  { id: 'team',        label: 'TEAM / PROGRAM' },
  { id: 'performance', label: 'PERFORMANCE' },
];

const CATEGORY_HEADER: Record<CategoryId, { eyebrow: string; title: string; subtitle: string }> = {
  consumer: {
    eyebrow: 'CONSUMER',
    title: 'Your performance system.',
    subtitle: 'AForce OS for individuals — from the entry layer to the full system.',
  },
  team: {
    eyebrow: 'TEAM / PROGRAM',
    title: 'Run your roster.',
    subtitle: 'Roster-aware AForce OS for programs and organizations.',
  },
  performance: {
    eyebrow: 'PERFORMANCE SYSTEMS',
    title: 'Mission-critical performance.',
    subtitle: 'Real-time team command and roster protection for elite organizations.',
  },
};

export default function SubscriptionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const layout = useResponsiveLayout();
  const { state } = useAppStore();
  const params = useLocalSearchParams<{ planId?: string; autoCheckout?: string }>();
  const [filter, setFilter] = useState<CategoryId>('consumer');
  const [pendingPlanId, setPendingPlanId] = useState<SubscriptionPlanId | null>(null);
  const autoCheckoutFiredRef = useRef(false);

  const topPadding = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPadding = Platform.OS === 'web' ? 34 : insets.bottom;

  const visiblePlans = useMemo(
    () => SUBSCRIPTION_PLANS.filter((p) => p.category === filter).sort((a, b) => a.rank - b.rank),
    [filter],
  );

  const clutchPlans = useMemo(() => visiblePlans.filter((p) => p.subcategory === 'clutch'), [visiblePlans]);
  const guardianPlans = useMemo(() => visiblePlans.filter((p) => p.subcategory === 'guardian'), [visiblePlans]);

  const onSelect = async (planId: SubscriptionPlanId) => {
    if (state.subscription.planId === planId || pendingPlanId) return;
    setPendingPlanId(planId);
    try {
      // Paid consumer upgrades route through real Stripe Checkout. Everything
      // else (Core entry tier, Team, Performance Systems) is sales-led and
      // does not have an in-app self-serve flow at launch.
      if (!STRIPE_PLAN_IDS.has(planId)) {
        Alert.alert(
          'Talk to our team',
          'This plan is sold direct. Email sales@aforce.app and we will get you set up.',
        );
        return;
      }

      const returnUrl = Linking.createURL('/subscription', { queryParams: {} });
      let session;
      try {
        session = await createCheckoutSession({ planId, returnUrl });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Could not start checkout.';
        Alert.alert('Checkout unavailable', msg);
        return;
      }

      const result = await WebBrowser.openAuthSessionAsync(session.url, returnUrl);

      // openAuthSessionAsync resolves with the redirect URL on success.
      const redirected =
        result.type === 'success' && typeof result.url === 'string' ? result.url : null;

      if (!redirected) return; // cancelled / dismissed — leave plan unchanged

      const parsed = Linking.parse(redirected);
      const status = (parsed.queryParams?.status as string | undefined) ?? '';
      if (status !== 'success') return;

      // Verify with the server before reflecting the plan switch — the
      // redirect alone is not a trust boundary (a tampered or stale URL
      // must not flip a user onto a paid plan they didn't actually pay
      // for).
      let paid = false;
      try {
        const sessionStatus = await fetchCheckoutSession(session.sessionId);
        paid = sessionStatus.paid && sessionStatus.planId === planId;
      } catch {
        paid = false;
      }
      if (!paid) {
        Alert.alert(
          'Could not confirm checkout',
          'We could not verify your payment. If you were charged, your plan will update shortly.',
        );
        return;
      }

      // Pull the authoritative plan from /api/entitlement (set by the
      // Stripe webhook) instead of writing optimistic local state. The
      // 60s polling interval would eventually reconcile, but kicking an
      // immediate refetch keeps the UI in sync with the charge.
      await refreshEntitlement();
    } finally {
      setPendingPlanId(null);
    }
  };

  // Deep-link auto-checkout: when the Recovery+ paywall (or any other
  // entry point) routes here with `?planId=X&autoCheckout=1`, kick off
  // the same Stripe-gated `onSelect` flow once. Switch the visible
  // category filter to match so the user sees the plan card if they
  // back out of the browser.
  useEffect(() => {
    if (autoCheckoutFiredRef.current) return;
    const planId = params.planId as SubscriptionPlanId | undefined;
    const auto = params.autoCheckout === '1';
    if (!planId || !auto) return;
    const plan = SUBSCRIPTION_PLANS.find((p) => p.id === planId);
    if (!plan) return;
    autoCheckoutFiredRef.current = true;
    setFilter(plan.category as CategoryId);
    // Strip the auto-checkout params from the URL/route immediately so a
    // remount or back-navigation cannot re-fire the Stripe session and
    // create duplicate charges.
    router.setParams({ planId: undefined, autoCheckout: undefined });
    // Defer one tick so the screen mounts before opening the browser.
    const id = setTimeout(() => { void onSelect(planId); }, 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.planId, params.autoCheckout]);

  const renderConsumerOrTeamCard = (plan: SubscriptionPlan) => (
    <SubscriptionPlanCard
      key={plan.id}
      plan={plan}
      isCurrent={state.subscription.planId === plan.id}
      isProcessing={pendingPlanId === plan.id}
      onSelect={onSelect}
    />
  );

  const renderEnterpriseCard = (plan: SubscriptionPlan) => (
    <EnterprisePlanCard
      key={plan.id}
      plan={plan}
      isCurrent={state.subscription.planId === plan.id}
      isProcessing={pendingPlanId === plan.id}
      onSelect={onSelect}
    />
  );

  const header = CATEGORY_HEADER[filter];

  return (
    <View style={styles.root}>
      <GradientBackground>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[
            styles.content,
            { paddingTop: topPadding + 8, paddingBottom: bottomPadding + 32 },
            // Cap line length on Fold-open / tablet so plan cards
            // stay legible instead of stretching across the screen.
            layout.isWide && {
              maxWidth: layout.contentMaxWidth,
              alignSelf: 'center',
              width: '100%',
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerRow}>
            <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
              <Feather name="chevron-left" size={20} color={Colors.text.primary} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>AFORCE PRICING</Text>
              <Text style={styles.title}>Choose Your Plan</Text>
            </View>
            <Pressable onPress={() => router.push('/subscription/manage')} style={styles.manageBtn} hitSlop={10}>
              <Feather name="settings" size={16} color={Colors.text.primary} />
            </Pressable>
          </View>

          <Text style={styles.subtitle}>
            AForce is not hydration software. AForce is performance control, recovery intelligence, and team command.
          </Text>

          {/* Category filter */}
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

          {/* Section header */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionEyebrow}>{header.eyebrow}</Text>
            <Text style={styles.sectionTitle}>{header.title}</Text>
            <Text style={styles.sectionSubtitle}>{header.subtitle}</Text>
          </View>

          {/* Plan cards */}
          {filter === 'performance' ? (
            <>
              {/* Clutch sub-section */}
              <SubGroupHeader
                accent={Colors.clutch.primary}
                eyebrow="CLUTCH ACCESS"
                title="Real-time team command"
                hint="Live decision support for game-time and high-intensity environments."
              />
              <View style={styles.plans}>
                {clutchPlans.map(renderEnterpriseCard)}
              </View>

              {/* Guardian sub-section */}
              <SubGroupHeader
                accent={Colors.guardian.primary}
                eyebrow="GUARDIAN"
                title="Roster protection"
                hint="Mission-critical injury risk reduction and proactive intervention."
              />
              <View style={styles.plans}>
                {guardianPlans.map(renderEnterpriseCard)}
              </View>
            </>
          ) : (
            <View style={styles.plans}>
              {visiblePlans.map(renderConsumerOrTeamCard)}
            </View>
          )}

          <View style={styles.trustRow}>
            <Feather name="shield" size={12} color={Colors.text.muted} />
            <Text style={styles.trustText}>
              Secured by Stripe. Cancel anytime from Manage Plan.
            </Text>
          </View>
        </ScrollView>
      </GradientBackground>
    </View>
  );
}

function SubGroupHeader({
  accent, eyebrow, title, hint,
}: { accent: string; eyebrow: string; title: string; hint: string }) {
  return (
    <View style={styles.subGroupHeader}>
      <View style={[styles.subGroupBar, { backgroundColor: accent }]} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.subGroupEyebrow, { color: accent }]}>{eyebrow}</Text>
        <Text style={styles.subGroupTitle}>{title}</Text>
        <Text style={styles.subGroupHint}>{hint}</Text>
      </View>
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
    flexDirection: 'row', gap: 4,
    backgroundColor: Colors.background.card,
    padding: 4, borderRadius: 100,
    borderWidth: 1, borderColor: Colors.border.subtle,
  },
  filterBtn: {
    flex: 1, paddingVertical: 8, paddingHorizontal: 4, borderRadius: 100,
    alignItems: 'center', justifyContent: 'center',
  },
  filterBtnActive: { backgroundColor: Colors.background.elevated },
  filterText: {
    fontSize: 9.5, fontFamily: 'Inter_700Bold',
    color: Colors.text.muted, letterSpacing: 1.2,
  },
  filterTextActive: { color: Colors.text.primary },

  sectionHeader: { marginTop: 4 },
  sectionEyebrow: { fontSize: 10, fontFamily: 'Inter_700Bold', color: Colors.text.muted, letterSpacing: 2.5 },
  sectionTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: Colors.text.primary, letterSpacing: -0.4, marginTop: 4 },
  sectionSubtitle: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.text.secondary, marginTop: 4, lineHeight: 17 },

  subGroupHeader: {
    flexDirection: 'row', gap: 12, alignItems: 'flex-start',
    marginTop: 4,
  },
  subGroupBar: { width: 3, alignSelf: 'stretch', borderRadius: 2, marginTop: 4 },
  subGroupEyebrow: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 2 },
  subGroupTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', color: Colors.text.primary, letterSpacing: -0.3, marginTop: 3 },
  subGroupHint: { fontSize: 11.5, fontFamily: 'Inter_400Regular', color: Colors.text.secondary, marginTop: 3, lineHeight: 16 },

  plans: { gap: 14 },

  trustRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingTop: 8,
  },
  trustText: { fontSize: 11, fontFamily: 'Inter_500Medium', color: Colors.text.muted, textAlign: 'center' },
});
