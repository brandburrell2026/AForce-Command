/**
 * Manage Subscription — current plan, billing, product shipment, controls.
 *
 * Cancel / pause / resume / update payment method are all handled by the
 * Stripe Customer Portal (POST /api/stripe/portal-session). One button
 * opens the hosted portal in a browser session; on return we trigger an
 * entitlement refresh so any plan change reflects immediately instead of
 * waiting for the next 60s poll tick.
 *
 * Product-shipment skipping is not a Stripe Subscription concept and is
 * deferred to a v1.1 fulfillment endpoint.
 */

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Platform, Pressable, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Icon, type IconName } from '@/components/Icon';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

import { GradientBackground } from '@/components/GradientBackground';
import { af } from '@/theme';
import { useAppStore } from '@/store/useAppStore';
import { PLAN_BY_ID, getEffectiveFeatures } from '@/data/subscriptionPlans';
import { createPortalSession, type ApiError } from '@/lib/api';
import { refreshEntitlement } from '@/hooks/useEntitlement';

/**
 * `lib/api.request` throws a plain `{ status, message }` ApiError object,
 * not a real Error instance, so `err instanceof Error` is false. Use a
 * structural check instead.
 */
function isApiError(err: unknown): err is ApiError {
  return (
    typeof err === 'object' &&
    err !== null &&
    typeof (err as { status?: unknown }).status === 'number' &&
    typeof (err as { message?: unknown }).message === 'string'
  );
}

function formatDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function ManageSubscriptionScreenV2() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { state } = useAppStore();
  const sub = state.subscription;
  const plan = PLAN_BY_ID[sub.planId];
  const features = getEffectiveFeatures(sub.planId);
  const [busy, setBusy] = useState(false);

  const topPadding = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPadding = Platform.OS === 'web' ? 34 : insets.bottom;

  const onManageBilling = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const returnUrl = Linking.createURL('/subscription/manage', { queryParams: {} });
      let session;
      try {
        session = await createPortalSession(returnUrl);
      } catch (err) {
        // The most common failure here is `no_stripe_customer` (404):
        // the user has never completed Checkout so Stripe has no
        // customer record for them. Surface a clear next step instead
        // of a raw error. For any other failure we keep the message
        // generic — server error bodies aren't safe to render verbatim.
        let friendly = 'Could not open billing. Please try again.';
        if (isApiError(err)) {
          if (err.status === 404 && err.message.includes('no_stripe_customer')) {
            friendly = 'No billing account yet. Choose a plan to set up billing first.';
          } else if (err.status === 401) {
            friendly = 'Please sign in again to manage billing.';
          }
        }
        Alert.alert('Billing unavailable', friendly);
        return;
      }
      await WebBrowser.openAuthSessionAsync(session.url, returnUrl);
      // The portal handles cancel / pause / resume / payment method in
      // its own UI; on return, refetch entitlement so the local plan +
      // status reflect anything the user changed.
      await refreshEntitlement();
    } finally {
      setBusy(false);
    }
  };

  const statusColor =
    sub.status === 'active' ? af.green :
    sub.status === 'trialing' ? af.cyan :
    sub.status === 'paused' ? af.amber :
    sub.status === 'past_due' ? af.amber :
    af.red;

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
              <Icon name="chevron-left" size={20} color={af.textPrimary} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>SUBSCRIPTION</Text>
              <Text style={styles.title}>Manage Plan</Text>
            </View>
          </View>

          {/* Current plan */}
          <View style={styles.planCard}>
            <Text style={styles.planName}>{plan.name}</Text>
            <Text style={styles.planTagline}>{plan.positioning}</Text>
            <View style={styles.planMeta}>
              <View style={[styles.statusPill, { borderColor: `${statusColor}55`, backgroundColor: `${statusColor}14` }]}>
                <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                <Text style={[styles.statusText, { color: statusColor }]}>{sub.status.toUpperCase()}</Text>
              </View>
              <Text style={styles.priceText}>{plan.priceLabel}</Text>
            </View>

            <Pressable onPress={() => router.push('/subscription')} style={styles.changeBtn}>
              <Icon name="repeat" size={14} color={af.textPrimary} />
              <Text style={styles.changeBtnText}>CHANGE PLAN</Text>
            </Pressable>
          </View>

          {/* Billing */}
          <SectionHeader label="BILLING" />
          <View style={styles.card}>
            <Row icon="calendar"    label="Next renewal"    value={formatDate(sub.billing.nextRenewalAt)} />
            <Divider />
            <Row icon="dollar-sign" label="Last charge"     value={sub.billing.lastChargeAmount != null ? `$${sub.billing.lastChargeAmount.toLocaleString('en-US')}` : '—'} />
            {plan.setupFee != null && (
              <>
                <Divider />
                <Row icon="package" label="One-time setup"  value={`$${plan.setupFee.toLocaleString('en-US')}`} />
              </>
            )}
            {plan.minimumTermMonths != null && (
              <>
                <Divider />
                <Row icon="calendar" label="Minimum term"   value={`${plan.minimumTermMonths} months`} />
              </>
            )}
            <Divider />
            <Row icon="credit-card" label="Payment method"  value={sub.billing.paymentMethodLabel ?? '—'} />
            <Divider />
            <Row icon="shield"      label="Provider"        value={sub.billing.provider.toUpperCase()} />
          </View>

          {/* Product subscription — display only at launch. Skip / pause
              of physical shipments isn't a Stripe Subscription concept
              and will land via a v1.1 fulfillment endpoint. */}
          {sub.product && (
            <>
              <SectionHeader label="PRODUCT SHIPMENTS" />
              <View style={styles.card}>
                <View style={styles.shipmentTop}>
                  <Icon name="package" size={16} color={af.green} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.shipmentTitle}>Next delivery</Text>
                    <Text style={styles.shipmentDate}>{formatDate(sub.product.nextDeliveryAt)}</Text>
                  </View>
                  <Text style={styles.shipmentStatus}>{sub.product.status.toUpperCase()}</Text>
                </View>
                {sub.product.allotments.map((a, i) => (
                  <React.Fragment key={a.fluidType}>
                    {i === 0 && <Divider />}
                    <Row icon="droplet" label={a.label} value={`× ${a.unitsPerCycle}`} />
                    {i < sub.product!.allotments.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </View>
            </>
          )}

          {/* Features unlocked */}
          <SectionHeader label="UNLOCKED FEATURES" hint={`${features.length} included`} />
          <View style={styles.card}>
            {features.map((f, i) => (
              <React.Fragment key={f.id}>
                {i > 0 && <Divider />}
                <View style={styles.featureRow}>
                  <Icon name="check" size={14} color={af.green} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.featureLabel}>{f.label}</Text>
                    {f.detail && <Text style={styles.featureDetail}>{f.detail}</Text>}
                  </View>
                  {f.badge && (
                    <View style={styles.featureBadge}>
                      <Text style={styles.featureBadgeText}>{f.badge}</Text>
                    </View>
                  )}
                </View>
              </React.Fragment>
            ))}
          </View>

          {/* Controls — Stripe Customer Portal handles cancel / pause /
              resume / payment method update / invoices in one hosted UI. */}
          <SectionHeader label="SUBSCRIPTION CONTROLS" />
          <View style={styles.card}>
            <Pressable
              onPress={onManageBilling}
              disabled={busy}
              style={({ pressed }) => [styles.portalBtn, pressed && styles.portalBtnPressed]}
            >
              <Icon name="external-link" size={14} color={af.textPrimary} />
              <Text style={styles.portalBtnText}>
                {busy ? 'OPENING…' : 'MANAGE BILLING'}
              </Text>
            </Pressable>
            <Text style={styles.portalHint}>
              Cancel, pause, update payment, or download invoices in the Stripe billing portal.
            </Text>
          </View>

          <Text style={styles.footnote}>
            Secured by Stripe.
          </Text>
        </ScrollView>
      </GradientBackground>
    </View>
  );
}

function SectionHeader({ label, hint }: { label: string; hint?: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {hint && <Text style={styles.sectionHint}>{hint}</Text>}
    </View>
  );
}
function Row({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <Icon name={icon} size={14} color={af.cyan} />
        <Text style={styles.rowLabel}>{label}</Text>
      </View>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}
function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: af.canvas },
  content: { paddingHorizontal: 20, gap: 14 },

  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: af.surface,
    borderWidth: 1, borderColor: af.divider,
    alignItems: 'center', justifyContent: 'center',
  },
  eyebrow: { fontSize: 10, fontFamily: 'Inter_700Bold', color: af.textTertiary, letterSpacing: 2.5 },
  title: { fontSize: 22, fontFamily: 'Inter_700Bold', color: af.textPrimary, letterSpacing: -0.6, marginTop: 2 },

  planCard: {
    backgroundColor: af.surface, borderRadius: 18,
    borderWidth: 1, borderColor: af.divider,
    padding: 18, gap: 8,
  },
  planName: { fontSize: 22, fontFamily: 'Inter_700Bold', color: af.textPrimary, letterSpacing: -0.5 },
  planTagline: { fontSize: 13, fontFamily: 'Inter_400Regular', color: af.textSecondary, lineHeight: 18 },
  planMeta: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100, borderWidth: 1,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 9, fontFamily: 'Inter_700Bold', letterSpacing: 1.4 },
  priceText: {
    fontSize: 14, fontFamily: 'Inter_700Bold',
    color: af.textPrimary, marginLeft: 'auto',
  },
  changeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 12, borderRadius: 12, borderWidth: 1,
    borderColor: af.border, marginTop: 6,
  },
  changeBtnText: { fontSize: 11, fontFamily: 'Inter_700Bold', color: af.textPrimary, letterSpacing: 1.2 },

  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 6, marginBottom: -4,
  },
  sectionLabel: { fontSize: 10, fontFamily: 'Inter_700Bold', color: af.textTertiary, letterSpacing: 2.5 },
  sectionHint: { fontSize: 10, fontFamily: 'Inter_500Medium', color: af.textSecondary },

  card: {
    backgroundColor: af.surface, borderRadius: 16,
    borderWidth: 1, borderColor: af.divider, overflow: 'hidden',
  },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 12,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowLabel: { fontSize: 13, fontFamily: 'Inter_500Medium', color: af.textPrimary },
  rowValue: { fontSize: 13, fontFamily: 'Inter_500Medium', color: af.textSecondary },
  divider: { height: 1, backgroundColor: af.divider, marginHorizontal: 14 },

  shipmentTop: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 14,
  },
  shipmentTitle: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: af.textPrimary },
  shipmentDate: { fontSize: 12, fontFamily: 'Inter_500Medium', color: af.textSecondary, marginTop: 2 },
  shipmentStatus: { fontSize: 9, fontFamily: 'Inter_700Bold', color: af.textTertiary, letterSpacing: 1.5 },

  featureRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  featureLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: af.textPrimary },
  featureDetail: { fontSize: 11, fontFamily: 'Inter_400Regular', color: af.textTertiary, marginTop: 2 },
  featureBadge: {
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
    borderWidth: 1, borderColor: af.border, backgroundColor: af.surface,
  },
  featureBadgeText: { fontSize: 8, fontFamily: 'Inter_700Bold', color: af.textPrimary, letterSpacing: 0.8 },

  portalBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 16, paddingHorizontal: 14,
  },
  portalBtnPressed: { opacity: 0.6 },
  portalBtnText: { fontSize: 12, fontFamily: 'Inter_700Bold', color: af.textPrimary, letterSpacing: 1.4 },
  portalHint: {
    fontSize: 11, fontFamily: 'Inter_400Regular', color: af.textTertiary,
    paddingHorizontal: 14, paddingBottom: 14, textAlign: 'center', lineHeight: 16,
  },

  footnote: {
    fontSize: 11, fontFamily: 'Inter_400Regular',
    color: af.textTertiary, textAlign: 'center', marginTop: 8,
  },
});
