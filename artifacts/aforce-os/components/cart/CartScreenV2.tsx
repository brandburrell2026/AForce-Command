/**
 * Cart Screen — review and check out.
 *
 * Reads from useCartStore. Lets the user adjust qty per line, remove lines,
 * and checks out via real Stripe Checkout (one-time payment). The server
 * re-prices every line against its own SKU catalog, so the client only sends
 * `{skuId, qty}`. After Stripe redirects with `status=success`, the cart is
 * cleared and a confirmation banner is shown.
 */

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { Icon, type IconName } from '@/components/Icon';

import { GradientBackground } from "@/components/GradientBackground";
import { ZoomableProductImage } from "@/components/ZoomableProductImage";
import { af } from '@/theme';
import { AFInlineErrorRow } from '@/components/ui';
import { formatPrice } from "@/data/pricing";
import { PRODUCT_FLAVORS } from "@/data/products";
import { useCart } from "@/store/useCartStore";
import { createCartCheckoutSession, fetchCheckoutSession } from "@/lib/api";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";

const SHIPPING_THRESHOLD_CENTS = 5000; // $50 free-shipping threshold

export function CartScreenV2() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const layout = useResponsiveLayout();
  const { resolvedLines, itemCount, subtotalCents, setQty, remove, clear } = useCart();
  const [checkoutNotice, setCheckoutNotice] = useState<string | null>(null);
  // RC-1 Wave-2B (item 4, audit P1-7) — the checkout-session-creation
  // failure used to pop a native Alert.alert. In-brand inline treatment
  // instead: an AFInlineErrorRow with a Retry affordance that re-invokes the
  // EXACT SAME onCheckout the primary button calls (no new retry logic).
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const shippingCents = subtotalCents >= SHIPPING_THRESHOLD_CENTS || subtotalCents === 0 ? 0 : 599;
  const taxCents = Math.round(subtotalCents * 0.0875);
  const totalCents = subtotalCents + shippingCents + taxCents;
  const shipGap = Math.max(0, SHIPPING_THRESHOLD_CENTS - subtotalCents);

  const onCheckout = async () => {
    if (itemCount === 0 || pending) return;
    setPending(true);
    setCheckoutNotice(null);
    setCheckoutError(null);
    try {
      const items = resolvedLines.map((l) => ({ skuId: l.skuId, qty: l.qty }));
      const returnUrl = Linking.createURL("/cart", { queryParams: {} });

      let session;
      try {
        session = await createCartCheckoutSession({ items, returnUrl });
      } catch (err) {
        const msg = err instanceof Error ? err.message : t('cart.v2.checkout_could_not_start');
        setCheckoutError(msg);
        return;
      }

      const result = await WebBrowser.openAuthSessionAsync(session.url, returnUrl);
      const redirected =
        result.type === "success" && typeof result.url === "string" ? result.url : null;
      if (!redirected) return; // dismissed / cancelled — leave cart intact

      const parsed = Linking.parse(redirected);
      const status = (parsed.queryParams?.status as string | undefined) ?? "";
      if (status !== "success") {
        setCheckoutNotice(t('cart.v2.checkout_cancelled'));
        return;
      }

      // Trust no redirect — verify with the server before clearing the cart.
      // If the deep-link bounce is intercepted or the user crafts a fake
      // success URL, this guards against double-charge and false confirmations.
      let verified = false;
      try {
        const status = await fetchCheckoutSession(session.sessionId);
        verified = status.paid && status.kind === "cart";
      } catch {
        verified = false;
      }
      if (!verified) {
        setCheckoutNotice(t('cart.v2.checkout_unconfirmed'));
        return;
      }

      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      clear();
      setCheckoutNotice(t('cart.v2.checkout_confirmed'));
    } finally {
      setPending(false);
    }
  };

  const topPadding = Platform.OS === "web" ? 24 : insets.top;

  return (
    <View style={styles.root}>
      <GradientBackground>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.content,
            { paddingTop: topPadding + 8, paddingBottom: insets.bottom + 32 },
            // Cap line length on Fold-open / tablet — cart line items
            // and the totals panel get hard to scan at full width.
            layout.isWide && {
              maxWidth: layout.contentMaxWidth,
              alignSelf: "center",
              width: "100%",
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerRow}>
            <Pressable
              onPress={() => {
                if (router.canGoBack()) router.back();
                else router.replace("/store");
              }}
              style={styles.backBtn}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={t('cart.v2.back_a11y')}
            >
              <Icon name="chevron-left" size={20} color={af.textPrimary} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>{t('cart.v2.eyebrow')}</Text>
              <Text style={styles.title}>{t('cart.v2.title')}</Text>
            </View>
            {resolvedLines.length > 0 && (
              <Pressable onPress={clear} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('cart.v2.clear_a11y')}>
                <Text style={styles.clearText}>{t('cart.v2.clear')}</Text>
              </Pressable>
            )}
          </View>

          {resolvedLines.length === 0 ? (
            <View style={styles.emptyCard}>
              <Icon name="shopping-bag" size={28} color={af.textTertiary} />
              <Text style={styles.emptyTitle}>{t('cart.v2.empty_title')}</Text>
              <Text style={styles.emptyHint}>{t('cart.v2.empty_hint')}</Text>
              <Pressable
                onPress={() => router.replace("/store")}
                style={styles.emptyCta}
                accessibilityRole="button"
                accessibilityLabel={t('cart.v2.browse_fuel')}
              >
                <Icon name="grid" size={14} color={af.textPrimary} />
                <Text style={styles.emptyCtaText}>{t('cart.v2.browse_fuel')}</Text>
              </Pressable>
            </View>
          ) : (
            <>
              {shipGap > 0 ? (
                <View style={styles.shipBanner}>
                  <Icon name="truck" size={12} color={af.textTertiary} />
                  <Text style={styles.shipBannerText}>
                    {t('cart.v2.ship_gap', { price: formatPrice(shipGap) })}
                  </Text>
                </View>
              ) : (
                <View style={[styles.shipBanner, { borderColor: `${af.green}55` }]}>
                  <Icon name="check-circle" size={12} color={af.green} />
                  <Text style={[styles.shipBannerText, { color: af.green }]}>
                    {t('cart.v2.ship_unlocked')}
                  </Text>
                </View>
              )}

              {resolvedLines.map((line) => {
                const flavorKey = line.sku.flavor as keyof typeof PRODUCT_FLAVORS;
                const accent = PRODUCT_FLAVORS[flavorKey].accent;
                const img = PRODUCT_FLAVORS[flavorKey].stick;
                return (
                  <View key={line.skuId} style={styles.lineCard}>
                    <View style={[styles.lineArtwork, { borderColor: `${accent}55` }]}>
                      <ZoomableProductImage
                        source={img}
                        style={styles.lineImg}
                        containerStyle={{ width: '100%', height: '100%' }}
                        resizeMode="contain"
                        accent={accent}
                        caption={line.sku.title}
                        accessibilityLabel={t('cart.v2.zoom_a11y', { title: line.sku.title })}
                        testID={`cart-zoom-${line.skuId}`}
                      />
                    </View>
                    <View style={styles.lineBody}>
                      <Text style={styles.lineTitle} numberOfLines={2}>{line.sku.title}</Text>
                      <Text style={styles.lineFormat}>{line.sku.formatLabel}</Text>

                      <View style={styles.qtyRow}>
                        <Pressable
                          onPress={() => setQty(line.skuId, line.qty - 1)}
                          style={styles.qtyBtn}
                          hitSlop={10}
                          accessibilityRole="button"
                          accessibilityLabel={t('cart.v2.qty_decrease_a11y')}
                        >
                          <Icon name="minus" size={14} color={af.textPrimary} />
                        </Pressable>
                        <Text style={styles.qtyText}>{line.qty}</Text>
                        <Pressable
                          onPress={() => setQty(line.skuId, line.qty + 1)}
                          style={styles.qtyBtn}
                          hitSlop={10}
                          accessibilityRole="button"
                          accessibilityLabel={t('cart.v2.qty_increase_a11y')}
                        >
                          <Icon name="plus" size={14} color={af.textPrimary} />
                        </Pressable>
                        <View style={{ flex: 1 }} />
                        <Text style={styles.lineSubtotal}>{formatPrice(line.lineSubtotalCents)}</Text>
                      </View>
                    </View>
                    <Pressable
                      onPress={() => remove(line.skuId)}
                      style={styles.removeBtn}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={t('cart.v2.remove_a11y', { title: line.sku.title })}
                    >
                      <Icon name="x" size={14} color={af.textTertiary} />
                    </Pressable>
                  </View>
                );
              })}

              <View style={styles.totalsCard}>
                <View
                  style={styles.totalsRow}
                  accessible
                  accessibilityLabel={`${t('cart.v2.subtotal')} ${formatPrice(subtotalCents)}`}
                >
                  <Text style={styles.totalsLabel}>{t('cart.v2.subtotal')}</Text>
                  <Text style={styles.totalsValue}>{formatPrice(subtotalCents)}</Text>
                </View>
                <View
                  style={styles.totalsRow}
                  accessible
                  accessibilityLabel={`${t('cart.v2.shipping')} ${shippingCents === 0 ? t('cart.v2.free') : formatPrice(shippingCents)}`}
                >
                  <Text style={styles.totalsLabel}>{t('cart.v2.shipping')}</Text>
                  <Text style={styles.totalsValue}>
                    {shippingCents === 0 ? t('cart.v2.free') : formatPrice(shippingCents)}
                  </Text>
                </View>
                <View
                  style={styles.totalsRow}
                  accessible
                  accessibilityLabel={`${t('cart.v2.estimated_tax')} ${formatPrice(taxCents)}`}
                >
                  <Text style={styles.totalsLabel}>{t('cart.v2.estimated_tax')}</Text>
                  <Text style={styles.totalsValue}>{formatPrice(taxCents)}</Text>
                </View>
                <View style={styles.totalsDivider} />
                <View
                  style={styles.totalsRow}
                  accessible
                  accessibilityLabel={`${t('cart.v2.total')} ${formatPrice(totalCents)}`}
                >
                  <Text style={styles.totalsLabelBig}>{t('cart.v2.total')}</Text>
                  <Text style={styles.totalsValueBig}>{formatPrice(totalCents)}</Text>
                </View>
              </View>

              {checkoutNotice && (
                <View
                  style={styles.noticeBox}
                  accessible
                  accessibilityRole="alert"
                  accessibilityLiveRegion="polite"
                  accessibilityLabel={checkoutNotice}
                >
                  <Icon name="info" size={14} color={af.textPrimary} />
                  <Text style={styles.noticeText}>{checkoutNotice}</Text>
                </View>
              )}

              {checkoutError && (
                <View style={styles.checkoutErrorWrap}>
                  <AFInlineErrorRow
                    message={checkoutError}
                    onRetry={() => { void onCheckout(); }}
                    retryLabel={t('common.retry')}
                    testID="cart-checkout-error"
                  />
                </View>
              )}

              <Pressable
                onPress={onCheckout}
                disabled={pending}
                style={({ pressed }) => [
                  styles.checkoutBtn,
                  (pressed || pending) && { opacity: 0.85 },
                ]}
                accessibilityRole="button"
                accessibilityLabel={t('cart.v2.checkout_a11y')}
                accessibilityState={{ disabled: pending, busy: pending }}
              >
                {pending ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <Icon name="lock" size={14} color="#000" />
                )}
                <Text style={styles.checkoutBtnText}>
                  {pending ? t('cart.v2.checkout_starting') : t('cart.v2.checkout_secure', { price: formatPrice(totalCents) })}
                </Text>
              </Pressable>

              <Text style={styles.footnote}>{t('cart.v2.footnote')}</Text>
            </>
          )}
        </ScrollView>
      </GradientBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: af.canvas },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16 },

  headerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  backBtn: {
    width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: af.border, backgroundColor: af.surface,
  },
  eyebrow: { fontSize: 11, letterSpacing: 1.6, color: af.textTertiary, fontWeight: "600" },
  title: { fontSize: 22, fontWeight: "700", color: af.textPrimary, marginTop: 2 },
  clearText: { fontSize: 11, letterSpacing: 1.2, color: af.textTertiary, fontWeight: "700" },

  emptyCard: {
    marginTop: 24, padding: 24, alignItems: "center", gap: 10,
    borderRadius: 16, borderWidth: 1, borderColor: af.border,
    backgroundColor: af.surface,
  },
  emptyTitle: { fontSize: 15, fontWeight: "700", color: af.textPrimary, marginTop: 6 },
  emptyHint: { fontSize: 12, color: af.textSecondary, textAlign: "center", lineHeight: 18 },
  emptyCta: {
    marginTop: 12, flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 10, borderWidth: 1, borderColor: af.border,
    backgroundColor: af.surface,
  },
  emptyCtaText: { color: af.textPrimary, fontSize: 11, fontWeight: "700", letterSpacing: 1 },

  shipBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingVertical: 10, paddingHorizontal: 12, marginBottom: 12,
    borderRadius: 10, borderWidth: 1, borderColor: af.border,
    backgroundColor: af.surface,
  },
  shipBannerText: { fontSize: 11, color: af.textSecondary, letterSpacing: 0.5 },

  lineCard: {
    flexDirection: "row", gap: 12, padding: 12,
    borderRadius: 14, marginBottom: 10,
    borderWidth: 1, borderColor: af.border,
    backgroundColor: af.surface,
  },
  lineArtwork: {
    width: 64, height: 84, borderRadius: 8,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1, overflow: "hidden",
  },
  lineImg: { width: 52, height: 76 },
  lineBody: { flex: 1, gap: 4 },
  lineTitle: { fontSize: 14, fontWeight: "700", color: af.textPrimary },
  lineFormat: { fontSize: 11, color: af.textTertiary },
  qtyRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  qtyBtn: {
    width: 28, height: 28, borderRadius: 6,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: af.border,
    backgroundColor: af.surface,
  },
  qtyText: { color: af.textPrimary, fontSize: 13, fontWeight: "700", minWidth: 20, textAlign: "center" },
  lineSubtotal: { color: af.textPrimary, fontSize: 14, fontWeight: "700" },
  removeBtn: {
    width: 24, height: 24, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
  },

  totalsCard: {
    marginTop: 6, padding: 14,
    borderRadius: 12, borderWidth: 1, borderColor: af.border,
    backgroundColor: af.surface, gap: 8,
  },
  totalsRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  totalsLabel: { fontSize: 12, color: af.textSecondary },
  totalsValue: { fontSize: 12, color: af.textPrimary, fontWeight: "600" },
  totalsLabelBig: { fontSize: 14, color: af.textPrimary, fontWeight: "700" },
  totalsValueBig: { fontSize: 18, color: af.textPrimary, fontWeight: "700" },
  totalsDivider: { height: 1, backgroundColor: af.border, marginVertical: 4 },

  noticeBox: {
    marginTop: 12, padding: 12, flexDirection: "row", gap: 8, alignItems: "flex-start",
    borderRadius: 10, borderWidth: 1, borderColor: af.border,
    backgroundColor: af.surface,
  },
  noticeText: { flex: 1, fontSize: 12, color: af.textPrimary, lineHeight: 17 },
  checkoutErrorWrap: { marginTop: 12 },

  checkoutBtn: {
    marginTop: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    paddingVertical: 16, borderRadius: 12,
    backgroundColor: af.green,
  },
  checkoutBtnText: { color: "#000", fontSize: 13, fontWeight: "800", letterSpacing: 1.2 },
  footnote: {
    marginTop: 10, fontSize: 11, color: af.textTertiary, textAlign: "center", lineHeight: 17,
  },
});
