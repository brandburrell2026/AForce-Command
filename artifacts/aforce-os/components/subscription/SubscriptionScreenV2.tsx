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
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/Icon';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

import { GradientBackground } from '@/components/GradientBackground';
import { SubscriptionPlanCard } from '@/components/SubscriptionPlanCard';
import { EnterprisePlanCard } from '@/components/EnterprisePlanCard';
import { af } from '@/theme';
import { useSubscriptionSlice } from '@/store/slices';
import { useAppStore } from '@/store/useAppStore';
import { SUBSCRIPTION_PLANS, LAUNCHED_PLAN_IDS } from '@/data/subscriptionPlans';
import type { SubscriptionPlan, SubscriptionPlanId } from '@/types/subscription';
import { createCheckoutSession, fetchCheckoutSession } from '@/lib/api';
import { refreshEntitlement } from '@/hooks/useEntitlement';
import { recordSubscriptionStarted, revenueForPlan } from '@/analytics/subscription_tracker';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';

// Plans that route through real Stripe Checkout. Anything not in this set
// (Core entry tier, Team / Performance Systems enterprise tiers) goes
// through a "Contact sales" alert at launch — there is no mock plan
// switch in the shipped app.
const STRIPE_PLAN_IDS = new Set<SubscriptionPlanId>(['recovery_plus', 'athlete', 'system', 'elite']);

type CategoryId = 'consumer' | 'team' | 'performance';

// Filter tabs — labels resolve under subscription.v2.filter_* at render.
const FILTERS: { id: CategoryId; labelKey: string }[] = [
  { id: 'consumer',    labelKey: 'filter_consumer' },
  { id: 'team',        labelKey: 'filter_team' },
  { id: 'performance', labelKey: 'filter_performance' },
];

function useRestorePurchases() {
  // S2-3(C) — 'Restore purchases' against the REAL purchase authority.
  // Purchases here are Stripe-side and the server entitlement endpoint is
  // the single source of truth (useEntitlement docblock); on this
  // architecture, restoration IS a forced re-sync of that entitlement for
  // the signed-in account — there is no App Store IAP receipt to replay,
  // and no fake path is offered. The outcome line reports the re-synced
  // plan honestly, whatever it is.
  const [restoreState, setRestoreState] = React.useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const restore = React.useCallback(async () => {
    setRestoreState('busy');
    try {
      // RESTORE-ERROR TRUTHFULNESS (founder-authorized): refreshEntitlement
      // used to resolve void on EVERY outcome — offline, HTTP failure, even
      // no mounted hook — so this control always landed 'done' and told the
      // member "Plan re-synced from your account" over a fetch that never
      // happened; the error branch below was dead code. The promise now
      // reports whether the server was actually reached; 'done' is only
      // claimed for a real re-sync.
      const synced = await refreshEntitlement();
      setRestoreState(synced ? 'done' : 'error');
    } catch {
      setRestoreState('error');
    }
  }, []);
  return { restoreState, restore };
}

export function SubscriptionScreenV2() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { restoreState, restore } = useRestorePurchases();
  const entitlementNow = useSubscriptionSlice();
  const layout = useResponsiveLayout();
  const { state } = useAppStore();
  const params = useLocalSearchParams<{ planId?: string; autoCheckout?: string; status?: string; kind?: string; session_id?: string }>();
  const [filter, setFilter] = useState<CategoryId>('consumer');
  const [pendingPlanId, setPendingPlanId] = useState<SubscriptionPlanId | null>(null);
  const autoCheckoutFiredRef = useRef(false);

  const topPadding = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPadding = Platform.OS === 'web' ? 34 : insets.bottom;

  // Launch gating: only tiers in LAUNCHED_PLAN_IDS render. The other tiers stay
  // defined in the catalog but dark until added to the allowlist.
  const visiblePlans = useMemo(
    () =>
      SUBSCRIPTION_PLANS
        .filter((p) => p.category === filter && LAUNCHED_PLAN_IDS.has(p.id))
        .sort((a, b) => a.rank - b.rank),
    [filter],
  );

  // Hide any category tab with zero launched plans (an empty tab reads as broken).
  const availableFilters = useMemo(
    () =>
      FILTERS.filter((f) =>
        SUBSCRIPTION_PLANS.some((p) => p.category === f.id && LAUNCHED_PLAN_IDS.has(p.id)),
      ),
    [],
  );

  const clutchPlans = useMemo(() => visiblePlans.filter((p) => p.subcategory === 'clutch'), [visiblePlans]);
  const guardianPlans = useMemo(() => visiblePlans.filter((p) => p.subcategory === 'guardian'), [visiblePlans]);

  // Live view of the store's plan for the activation poll (the closure
  // value would be stale inside the async loop).
  const activePlanRef = React.useRef(state.subscription.planId);
  React.useEffect(() => {
    activePlanRef.current = state.subscription.planId;
  }, [state.subscription.planId]);

  /** Poll authoritative entitlement until `planId` is live (~45s cap). */
  const waitForEntitlement = async (planId: SubscriptionPlanId): Promise<boolean> => {
    for (let attempt = 0; attempt < 15; attempt++) {
      await refreshEntitlement();
      if (activePlanRef.current === planId) return true;
      await new Promise((r) => setTimeout(r, 3000));
    }
    return activePlanRef.current === planId;
  };

  const onSelect = async (planId: SubscriptionPlanId) => {
    if (state.subscription.planId === planId || pendingPlanId) return;
    setPendingPlanId(planId);
    try {
      // Core is the free default tier — no checkout, no sales flow. Tapping
      // your current Core plan already no-ops above; a paid user tapping Core
      // is a downgrade, so route to Manage (downgrade flows are intentionally
      // not built for launch).
      if (planId === 'core') {
        router.push('/subscription/manage');
        return;
      }
      // Paid consumer upgrades route through real Stripe Checkout. Everything
      // else (Team, Performance Systems) is sales-led and does not have an
      // in-app self-serve flow at launch.
      if (!STRIPE_PLAN_IDS.has(planId)) {
        Alert.alert(t('subscription.v2.sales_title'), t('subscription.v2.sales_body'));
        return;
      }

      // Wave-3 PR3: App-Store 3.1.1 posture — ported from the legacy screen
      // (V2 shipped WITHOUT this gate). iOS in-app direct checkout stays OFF
      // (ios_direct_checkout_enabled=false) until counsel clears the
      // external-purchase-link path; users purchase on the web and the
      // Shopify→entitlement bridge unlocks the account.
      if (Platform.OS === 'ios' && !state.featureFlags.ios_direct_checkout_enabled) {
        Alert.alert(
          'Purchase on the web',
          'AForce Command is available at drinkaforce.com. Your account unlocks automatically after purchase with this email.',
        );
        return;
      }

      const returnUrl = Linking.createURL('/subscription', { queryParams: {} });
      let session;
      try {
        session = await createCheckoutSession({ planId, returnUrl });
      } catch (err) {
        const msg = err instanceof Error ? err.message : t('subscription.v2.checkout_could_not_start');
        Alert.alert(t('subscription.v2.checkout_unavailable_title'), msg);
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
        Alert.alert(t('subscription.v2.checkout_unconfirmed_title'), t('subscription.v2.checkout_unconfirmed_body'));
        return;
      }

      // Wave-3 PR3: ACTIVATION WAITS FOR AUTHORITATIVE ENTITLEMENT. A paid
      // session is necessary but not sufficient — the plan is live only
      // when /api/entitlement (fed by the Stripe webhook→synced schema)
      // says so. Poll on a short backoff instead of a single refetch so
      // webhook lag renders as "activating", never as canceled/none.
      const activated = await waitForEntitlement(planId);
      if (!activated) {
        Alert.alert(
          t('subscription.v2.activation_pending_title'),
          t('subscription.v2.activation_pending_body'),
        );
      }

      // INTERNAL analytics: the client is the SOLE emitter of
      // `subscription_started` (the server webhook emit was removed to
      // avoid a payload race). Record the paid conversion with descriptive
      // non-PII revenue metadata, deduped per checkout session. Best-effort
      // and fire-and-forget — never blocks the UI or touches score.
      void recordSubscriptionStarted(session.sessionId, revenueForPlan(planId));
    } finally {
      setPendingPlanId(null);
    }
  };

  // Wave-3 PR3: a checkout return that arrives as a COLD-START deep link
  // (Safari finished the purchase; the in-app browser session was gone)
  // previously did nothing — the bounce params were dropped and the user
  // stared at a paywall they had just paid through. Verify the forwarded
  // session server-side, then run the same activation wait.
  const coldReturnFiredRef = React.useRef(false);
  useEffect(() => {
    if (coldReturnFiredRef.current) return;
    const status = params.status as string | undefined;
    const sessionId = params.session_id as string | undefined;
    if (status !== 'success' || !sessionId || !/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return;
    coldReturnFiredRef.current = true;
    router.setParams({ status: undefined, kind: undefined, planId: undefined, session_id: undefined });
    void (async () => {
      try {
        const sessionStatus = await fetchCheckoutSession(sessionId);
        if (!sessionStatus.paid || !sessionStatus.planId) return;
        setPendingPlanId(sessionStatus.planId as SubscriptionPlanId);
        const activated = await waitForEntitlement(sessionStatus.planId as SubscriptionPlanId);
        if (!activated) {
          Alert.alert(
            t('subscription.v2.activation_pending_title'),
            t('subscription.v2.activation_pending_body'),
          );
        }
      } catch {
        // Verification failed — leave state untouched; the 60s entitlement
        // poll remains the recovery path. Never grant from the URL alone.
      } finally {
        setPendingPlanId(null);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.status, params.session_id]);

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
            <Pressable
              onPress={() => router.back()}
              style={styles.backBtn}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={t('common.back')}
            >
              <Icon name="chevron-left" size={20} color={af.textPrimary} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>{t('subscription.v2.eyebrow')}</Text>
              <Text style={styles.title}>{t('subscription.v2.title')}</Text>
            </View>
            <Pressable
              onPress={() => router.push('/subscription/manage')}
              style={styles.manageBtn}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={t('subscription.v2.manage_gear_a11y')}
            >
              <Icon name="settings" size={16} color={af.textPrimary} />
            </Pressable>
          </View>

          <Text style={styles.subtitle}>{t('subscription.v2.subtitle')}</Text>

          {/* Category filter */}
          <View style={styles.filterRow} accessibilityRole="tablist">
            {availableFilters.map((f) => {
              const active = filter === f.id;
              return (
                <Pressable
                  key={f.id}
                  onPress={() => setFilter(f.id)}
                  style={[styles.filterBtn, active && styles.filterBtnActive]}
                  accessibilityRole="tab"
                  hitSlop={{ top: 7, bottom: 7 }}
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.filterText, active && styles.filterTextActive]}>{t(`subscription.v2.${f.labelKey}`)}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* Section header */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionEyebrow}>{t(`subscription.v2.cat_${filter}_eyebrow`)}</Text>
            <Text style={styles.sectionTitle}>{t(`subscription.v2.cat_${filter}_title`)}</Text>
            <Text style={styles.sectionSubtitle}>{t(`subscription.v2.cat_${filter}_subtitle`)}</Text>
          </View>

          {/* Plan cards */}
          {filter === 'performance' ? (
            <>
              {/* Clutch sub-section */}
              <SubGroupHeader
                accent={af.cyan}
                eyebrow={t('subscription.v2.clutch_eyebrow')}
                title={t('subscription.v2.clutch_title')}
                hint={t('subscription.v2.clutch_hint')}
              />
              <View style={styles.plans}>
                {clutchPlans.map(renderEnterpriseCard)}
              </View>

              {/* Guardian sub-section */}
              <SubGroupHeader
                accent={af.guardian}
                eyebrow={t('subscription.v2.guardian_eyebrow')}
                title={t('subscription.v2.guardian_title')}
                hint={t('subscription.v2.guardian_hint')}
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
            <Icon name="shield" size={12} color={af.textTertiary} />
            <Text style={styles.trustText}>{t('subscription.v2.trust')}</Text>
          </View>

          {/* S2-3(C) — restore against the server entitlement (the purchase
              authority on this Stripe architecture). */}
          <Pressable
            onPress={restore}
            disabled={restoreState === 'busy'}
            style={styles.restoreBtn}
            accessibilityRole="button"
            accessibilityLabel={t('subscription.v2.restore_purchases')}
            testID="subscription-restore"
          >
            <Text style={styles.restoreText}>
              {restoreState === 'busy' ? t('subscription.v2.restore_busy') : t('subscription.v2.restore_purchases')}
            </Text>
          </Pressable>
          {restoreState === 'done' ? (
            <Text style={styles.restoreOutcome} accessibilityLiveRegion="polite">
              {t('subscription.v2.restore_done', { plan: entitlementNow.planId.toUpperCase() })}
            </Text>
          ) : restoreState === 'error' ? (
            <Text style={[styles.restoreOutcome, { color: af.redText }]} accessibilityLiveRegion="polite">
              {t('subscription.v2.restore_error')}
            </Text>
          ) : null}
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
  root: { flex: 1, backgroundColor: af.canvas },
  content: { paddingHorizontal: 20, gap: 16 },

  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: af.surface,
    borderWidth: 1, borderColor: af.divider,
    alignItems: 'center', justifyContent: 'center',
  },
  manageBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: af.surface,
    borderWidth: 1, borderColor: af.divider,
    alignItems: 'center', justifyContent: 'center',
  },
  eyebrow: { fontSize: 10, fontFamily: 'Inter_700Bold', color: af.textTertiary, letterSpacing: 2.5 },
  title: { fontSize: 22, fontFamily: 'Inter_700Bold', color: af.textPrimary, letterSpacing: -0.6, marginTop: 2 },
  subtitle: {
    fontSize: 13, fontFamily: 'Inter_400Regular',
    color: af.textSecondary, lineHeight: 18,
  },

  filterRow: {
    flexDirection: 'row', gap: 4,
    backgroundColor: af.surface,
    padding: 4, borderRadius: 100,
    borderWidth: 1, borderColor: af.divider,
  },
  filterBtn: {
    flex: 1, paddingVertical: 8, paddingHorizontal: 4, borderRadius: 100,
    alignItems: 'center', justifyContent: 'center',
  },
  filterBtnActive: { backgroundColor: af.surfaceRaised },
  filterText: {
    fontSize: 9.5, fontFamily: 'Inter_700Bold',
    color: af.textTertiary, letterSpacing: 1.2,
  },
  filterTextActive: { color: af.textPrimary },

  sectionHeader: { marginTop: 4 },
  sectionEyebrow: { fontSize: 10, fontFamily: 'Inter_700Bold', color: af.textTertiary, letterSpacing: 2.5 },
  sectionTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: af.textPrimary, letterSpacing: -0.4, marginTop: 4 },
  sectionSubtitle: { fontSize: 12, fontFamily: 'Inter_400Regular', color: af.textSecondary, marginTop: 4, lineHeight: 17 },

  subGroupHeader: {
    flexDirection: 'row', gap: 12, alignItems: 'flex-start',
    marginTop: 4,
  },
  subGroupBar: { width: 3, alignSelf: 'stretch', borderRadius: 2, marginTop: 4 },
  subGroupEyebrow: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 2 },
  subGroupTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', color: af.textPrimary, letterSpacing: -0.3, marginTop: 3 },
  subGroupHint: { fontSize: 11.5, fontFamily: 'Inter_400Regular', color: af.textSecondary, marginTop: 3, lineHeight: 16 },

  plans: { gap: 14 },

  trustRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingTop: 8,
  },
  trustText: { fontSize: 11, fontFamily: 'Inter_500Medium', color: af.textTertiary, textAlign: 'center' },
  restoreBtn: { alignSelf: 'center', marginTop: 14, minHeight: 44, justifyContent: 'center', paddingHorizontal: 16 },
  restoreText: { fontSize: 12.5, fontFamily: 'Inter_500Medium', color: af.textSecondary, letterSpacing: 0.3 },
  restoreOutcome: { fontSize: 11.5, fontFamily: 'Inter_400Regular', color: af.textTertiary, textAlign: 'center', marginTop: 6 },
});
