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
  Alert,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { Icon, type IconName } from '../components/Icon';

import { GradientBackground } from "@/components/GradientBackground";
import { ZoomableProductImage } from "@/components/ZoomableProductImage";
import { Colors } from "@/theme/colors";
import { formatPrice } from "@/data/pricing";
import { PRODUCT_FLAVORS } from "@/data/products";
import { useCart } from "@/store/useCartStore";
import { createCartCheckoutSession, fetchCheckoutSession } from "@/lib/api";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";

const SHIPPING_THRESHOLD_CENTS = 5000; // $50 free-shipping threshold

export default function CartScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const layout = useResponsiveLayout();
  const { resolvedLines, itemCount, subtotalCents, setQty, remove, clear } = useCart();
  const [checkoutNotice, setCheckoutNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const shippingCents = subtotalCents >= SHIPPING_THRESHOLD_CENTS || subtotalCents === 0 ? 0 : 599;
  const taxCents = Math.round(subtotalCents * 0.0875);
  const totalCents = subtotalCents + shippingCents + taxCents;
  const shipGap = Math.max(0, SHIPPING_THRESHOLD_CENTS - subtotalCents);

  const onCheckout = async () => {
    if (itemCount === 0 || pending) return;
    setPending(true);
    setCheckoutNotice(null);
    try {
      const items = resolvedLines.map((l) => ({ skuId: l.skuId, qty: l.qty }));
      const returnUrl = Linking.createURL("/cart", { queryParams: {} });

      let session;
      try {
        session = await createCartCheckoutSession({ items, returnUrl });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Could not start checkout.";
        Alert.alert("Checkout unavailable", msg);
        return;
      }

      const result = await WebBrowser.openAuthSessionAsync(session.url, returnUrl);
      const redirected =
        result.type === "success" && typeof result.url === "string" ? result.url : null;
      if (!redirected) return; // dismissed / cancelled — leave cart intact

      const parsed = Linking.parse(redirected);
      const status = (parsed.queryParams?.status as string | undefined) ?? "";
      if (status !== "success") {
        setCheckoutNotice("Checkout was cancelled. Your cart is saved.");
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
        setCheckoutNotice(
          "We couldn't confirm payment. If you were charged, your order is safe — refresh in a moment.",
        );
        return;
      }

      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      clear();
      setCheckoutNotice(
        "Order confirmed. Your cart has been cleared — a receipt is on its way.",
      );
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
              accessibilityLabel="Back"
            >
              <Icon name="chevron-left" size={20} color={Colors.text.primary} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>YOUR CART</Text>
              <Text style={styles.title}>Order Summary</Text>
            </View>
            {resolvedLines.length > 0 && (
              <Pressable onPress={clear} hitSlop={10} accessibilityRole="button" accessibilityLabel="Clear cart">
                <Text style={styles.clearText}>CLEAR</Text>
              </Pressable>
            )}
          </View>

          {resolvedLines.length === 0 ? (
            <View style={styles.emptyCard}>
              <Icon name="shopping-bag" size={28} color={Colors.text.muted} />
              <Text style={styles.emptyTitle}>Your cart is empty</Text>
              <Text style={styles.emptyHint}>
                Browse the Store and add the formats your protocol needs.
              </Text>
              <Pressable
                onPress={() => router.replace("/store")}
                style={styles.emptyCta}
              >
                <Icon name="grid" size={14} color={Colors.text.primary} />
                <Text style={styles.emptyCtaText}>BROWSE STORE</Text>
              </Pressable>
            </View>
          ) : (
            <>
              {shipGap > 0 ? (
                <View style={styles.shipBanner}>
                  <Icon name="truck" size={12} color={Colors.text.muted} />
                  <Text style={styles.shipBannerText}>
                    Add {formatPrice(shipGap)} more for free shipping.
                  </Text>
                </View>
              ) : (
                <View style={[styles.shipBanner, { borderColor: `${Colors.states.PEAK.primary}55` }]}>
                  <Icon name="check-circle" size={12} color={Colors.states.PEAK.primary} />
                  <Text style={[styles.shipBannerText, { color: Colors.states.PEAK.primary }]}>
                    Free shipping unlocked.
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
                        accessibilityLabel={`Zoom in on ${line.sku.title}`}
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
                          accessibilityRole="button"
                          accessibilityLabel="Decrease quantity"
                        >
                          <Icon name="minus" size={14} color={Colors.text.primary} />
                        </Pressable>
                        <Text style={styles.qtyText}>{line.qty}</Text>
                        <Pressable
                          onPress={() => setQty(line.skuId, line.qty + 1)}
                          style={styles.qtyBtn}
                          accessibilityRole="button"
                          accessibilityLabel="Increase quantity"
                        >
                          <Icon name="plus" size={14} color={Colors.text.primary} />
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
                      accessibilityLabel={`Remove ${line.sku.title}`}
                    >
                      <Icon name="x" size={14} color={Colors.text.muted} />
                    </Pressable>
                  </View>
                );
              })}

              <View style={styles.totalsCard}>
                <View style={styles.totalsRow}>
                  <Text style={styles.totalsLabel}>Subtotal</Text>
                  <Text style={styles.totalsValue}>{formatPrice(subtotalCents)}</Text>
                </View>
                <View style={styles.totalsRow}>
                  <Text style={styles.totalsLabel}>Shipping</Text>
                  <Text style={styles.totalsValue}>
                    {shippingCents === 0 ? "Free" : formatPrice(shippingCents)}
                  </Text>
                </View>
                <View style={styles.totalsRow}>
                  <Text style={styles.totalsLabel}>Estimated tax</Text>
                  <Text style={styles.totalsValue}>{formatPrice(taxCents)}</Text>
                </View>
                <View style={styles.totalsDivider} />
                <View style={styles.totalsRow}>
                  <Text style={styles.totalsLabelBig}>Total</Text>
                  <Text style={styles.totalsValueBig}>{formatPrice(totalCents)}</Text>
                </View>
              </View>

              {checkoutNotice && (
                <View style={styles.noticeBox}>
                  <Icon name="info" size={14} color={Colors.text.primary} />
                  <Text style={styles.noticeText}>{checkoutNotice}</Text>
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
                accessibilityLabel="Proceed to checkout"
                accessibilityState={{ disabled: pending, busy: pending }}
              >
                {pending ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <Icon name="lock" size={14} color="#000" />
                )}
                <Text style={styles.checkoutBtnText}>
                  {pending ? "STARTING CHECKOUT…" : `SECURE CHECKOUT · ${formatPrice(totalCents)}`}
                </Text>
              </Pressable>

              <Text style={styles.footnote}>
                AForce stands behind every product. 30-day satisfaction guarantee.
              </Text>
            </>
          )}
        </ScrollView>
      </GradientBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background.primary },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16 },

  headerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  backBtn: {
    width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: Colors.border.medium, backgroundColor: Colors.fill.light,
  },
  eyebrow: { fontSize: 11, letterSpacing: 1.6, color: Colors.text.muted, fontWeight: "600" },
  title: { fontSize: 22, fontWeight: "700", color: Colors.text.primary, marginTop: 2 },
  clearText: { fontSize: 11, letterSpacing: 1.2, color: Colors.text.muted, fontWeight: "700" },

  emptyCard: {
    marginTop: 24, padding: 24, alignItems: "center", gap: 10,
    borderRadius: 16, borderWidth: 1, borderColor: Colors.border.medium,
    backgroundColor: Colors.fill.light,
  },
  emptyTitle: { fontSize: 15, fontWeight: "700", color: Colors.text.primary, marginTop: 6 },
  emptyHint: { fontSize: 12, color: Colors.text.secondary, textAlign: "center", lineHeight: 18 },
  emptyCta: {
    marginTop: 12, flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 10, borderWidth: 1, borderColor: Colors.border.medium,
    backgroundColor: Colors.fill.medium,
  },
  emptyCtaText: { color: Colors.text.primary, fontSize: 11, fontWeight: "700", letterSpacing: 1 },

  shipBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingVertical: 10, paddingHorizontal: 12, marginBottom: 12,
    borderRadius: 10, borderWidth: 1, borderColor: Colors.border.medium,
    backgroundColor: Colors.fill.light,
  },
  shipBannerText: { fontSize: 11, color: Colors.text.secondary, letterSpacing: 0.5 },

  lineCard: {
    flexDirection: "row", gap: 12, padding: 12,
    borderRadius: 14, marginBottom: 10,
    borderWidth: 1, borderColor: Colors.border.medium,
    backgroundColor: Colors.fill.light,
  },
  lineArtwork: {
    width: 64, height: 84, borderRadius: 8,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1, overflow: "hidden",
  },
  lineImg: { width: 52, height: 76 },
  lineBody: { flex: 1, gap: 4 },
  lineTitle: { fontSize: 14, fontWeight: "700", color: Colors.text.primary },
  lineFormat: { fontSize: 11, color: Colors.text.muted },
  qtyRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  qtyBtn: {
    width: 28, height: 28, borderRadius: 6,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: Colors.border.medium,
    backgroundColor: Colors.fill.medium,
  },
  qtyText: { color: Colors.text.primary, fontSize: 13, fontWeight: "700", minWidth: 20, textAlign: "center" },
  lineSubtotal: { color: Colors.text.primary, fontSize: 14, fontWeight: "700" },
  removeBtn: {
    width: 24, height: 24, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
  },

  totalsCard: {
    marginTop: 6, padding: 14,
    borderRadius: 12, borderWidth: 1, borderColor: Colors.border.medium,
    backgroundColor: Colors.fill.light, gap: 8,
  },
  totalsRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  totalsLabel: { fontSize: 12, color: Colors.text.secondary },
  totalsValue: { fontSize: 12, color: Colors.text.primary, fontWeight: "600" },
  totalsLabelBig: { fontSize: 14, color: Colors.text.primary, fontWeight: "700" },
  totalsValueBig: { fontSize: 18, color: Colors.text.primary, fontWeight: "700" },
  totalsDivider: { height: 1, backgroundColor: Colors.border.medium, marginVertical: 4 },

  noticeBox: {
    marginTop: 12, padding: 12, flexDirection: "row", gap: 8, alignItems: "flex-start",
    borderRadius: 10, borderWidth: 1, borderColor: Colors.border.medium,
    backgroundColor: Colors.fill.medium,
  },
  noticeText: { flex: 1, fontSize: 12, color: Colors.text.primary, lineHeight: 17 },

  checkoutBtn: {
    marginTop: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    paddingVertical: 16, borderRadius: 12,
    backgroundColor: Colors.states.PEAK.primary,
  },
  checkoutBtnText: { color: "#000", fontSize: 13, fontWeight: "800", letterSpacing: 1.2 },
  footnote: {
    marginTop: 10, fontSize: 11, color: Colors.text.muted, textAlign: "center", lineHeight: 17,
  },
});
