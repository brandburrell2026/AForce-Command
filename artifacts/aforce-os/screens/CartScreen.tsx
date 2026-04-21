/**
 * Cart Screen — review and check out.
 *
 * Reads from useCartStore. Lets the user adjust qty per line, remove lines,
 * and proceeds to a checkout CTA. Real Stripe / RevenueCat checkout is not
 * yet wired (see Subscription for separate plan management); the CTA shows
 * a clear "Coming soon" state instead of a fake success.
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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";

import { GradientBackground } from "@/components/GradientBackground";
import { Colors } from "@/theme/colors";
import { formatPrice } from "@/data/pricing";
import { PRODUCT_FLAVORS } from "@/data/products";
import { useCart } from "@/store/useCartStore";

const SHIPPING_THRESHOLD_CENTS = 5000; // $50 free-shipping threshold

export default function CartScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { resolvedLines, itemCount, subtotalCents, setQty, remove, clear } = useCart();
  const [checkoutNotice, setCheckoutNotice] = useState<string | null>(null);

  const shippingCents = subtotalCents >= SHIPPING_THRESHOLD_CENTS || subtotalCents === 0 ? 0 : 599;
  const taxCents = Math.round(subtotalCents * 0.0875);
  const totalCents = subtotalCents + shippingCents + taxCents;
  const shipGap = Math.max(0, SHIPPING_THRESHOLD_CENTS - subtotalCents);

  const onCheckout = () => {
    if (itemCount === 0) return;
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    }
    setCheckoutNotice(
      "Checkout is coming soon — payment processing will go live once Stripe is connected. Your cart is saved.",
    );
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
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerRow}>
            <Pressable
              onPress={() => {
                if (router.canGoBack()) router.back();
                else router.replace("/(tabs)/store");
              }}
              style={styles.backBtn}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <Feather name="chevron-left" size={20} color={Colors.text.primary} />
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
              <Feather name="shopping-bag" size={28} color={Colors.text.muted} />
              <Text style={styles.emptyTitle}>Your cart is empty</Text>
              <Text style={styles.emptyHint}>
                Browse the Store tab and add the formats your protocol needs.
              </Text>
              <Pressable
                onPress={() => router.replace("/(tabs)/store")}
                style={styles.emptyCta}
              >
                <Feather name="grid" size={14} color={Colors.text.primary} />
                <Text style={styles.emptyCtaText}>BROWSE STORE</Text>
              </Pressable>
            </View>
          ) : (
            <>
              {shipGap > 0 ? (
                <View style={styles.shipBanner}>
                  <Feather name="truck" size={12} color={Colors.text.muted} />
                  <Text style={styles.shipBannerText}>
                    Add {formatPrice(shipGap)} more for free shipping.
                  </Text>
                </View>
              ) : (
                <View style={[styles.shipBanner, { borderColor: `${Colors.states.PEAK.primary}55` }]}>
                  <Feather name="check-circle" size={12} color={Colors.states.PEAK.primary} />
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
                      <Image source={img} style={styles.lineImg} resizeMode="contain" />
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
                          <Feather name="minus" size={14} color={Colors.text.primary} />
                        </Pressable>
                        <Text style={styles.qtyText}>{line.qty}</Text>
                        <Pressable
                          onPress={() => setQty(line.skuId, line.qty + 1)}
                          style={styles.qtyBtn}
                          accessibilityRole="button"
                          accessibilityLabel="Increase quantity"
                        >
                          <Feather name="plus" size={14} color={Colors.text.primary} />
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
                      <Feather name="x" size={14} color={Colors.text.muted} />
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
                  <Feather name="info" size={14} color={Colors.text.primary} />
                  <Text style={styles.noticeText}>{checkoutNotice}</Text>
                </View>
              )}

              <Pressable
                onPress={onCheckout}
                style={({ pressed }) => [
                  styles.checkoutBtn,
                  pressed && { opacity: 0.9 },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Proceed to checkout"
              >
                <Feather name="lock" size={14} color="#000" />
                <Text style={styles.checkoutBtnText}>SECURE CHECKOUT · {formatPrice(totalCents)}</Text>
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
