/**
 * Store Screen — AForce Shopping.
 *
 * Lists every SKU (format × flavor) with image, blurb, price, and add-to-cart
 * controls. Recommends the user's state-aligned flavor at the top. Cart state
 * is persisted in useCartStore. Tapping the floating cart pill opens /cart.
 */

import React, { useMemo } from "react";
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
import {
  STORE_SKUS,
  formatPrice,
  pricePerServingCents,
  type StoreFormatId,
  type StoreSKU,
} from "@/data/pricing";
import { PRODUCT_FLAVORS } from "@/data/products";
import { FLAVOR_VARIANTS, flavorForState } from "@/data/flavors";
import { useCart } from "@/store/useCartStore";
import { useAppStore } from "@/store/useAppStore";

const FORMAT_ORDER: { id: StoreFormatId; label: string; artwork: "stick" | "can" | "jar" | "bag" }[] = [
  { id: "aforce_stick", label: "Hydration Sticks", artwork: "stick" },
  { id: "aforce_rtd", label: "Ready-To-Drink", artwork: "can" },
  { id: "aforce_canister", label: "Canisters", artwork: "jar" },
  { id: "aforce_bulk_bag", label: "FIELD BAG", artwork: "bag" },
];

type FlavorKey = keyof typeof PRODUCT_FLAVORS;

function flavorAccent(flavor: StoreSKU["flavor"]): string {
  return PRODUCT_FLAVORS[flavor as FlavorKey].accent;
}

function flavorImage(sku: StoreSKU, artwork: "stick" | "can" | "jar" | "bag"): unknown {
  const set = PRODUCT_FLAVORS[sku.flavor as FlavorKey] as Record<string, unknown>;
  return set[artwork];
}

export default function StoreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { add, itemCount, subtotalCents } = useCart();
  const { state } = useAppStore();
  const userLevel = state.engineOutput.performanceState.level;

  const recommended = useMemo(() => flavorForState(userLevel), [userLevel]);
  const recommendedVariant = useMemo(
    () => FLAVOR_VARIANTS.find((v) => v.flavor === recommended.flavor) ?? FLAVOR_VARIANTS[0],
    [recommended.flavor],
  );

  const onAdd = (sku: StoreSKU) => {
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    add(sku.id, 1);
  };

  const topPadding = Platform.OS === "web" ? 24 : insets.top;
  const bottomPadding = (Platform.OS === "web" ? 84 : insets.bottom + 84) + (itemCount > 0 ? 84 : 24);

  return (
    <View style={styles.root}>
      <GradientBackground>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.content,
            { paddingTop: topPadding + 8, paddingBottom: bottomPadding },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>AFORCE STORE</Text>
              <Text style={styles.title}>Shop the System</Text>
            </View>
            <Pressable
              onPress={() => router.push("/cart")}
              style={styles.cartIconBtn}
              accessibilityRole="button"
              accessibilityLabel={`Cart, ${itemCount} items`}
              hitSlop={10}
            >
              <Feather name="shopping-bag" size={18} color={Colors.text.primary} />
              {itemCount > 0 && (
                <View style={styles.cartIconBadge}>
                  <Text style={styles.cartIconBadgeText}>{itemCount}</Text>
                </View>
              )}
            </Pressable>
          </View>

          <Text style={styles.subtitle}>
            Every flavor pairs a functional ingredient with the state your body is in. Mix
            formats. Build your protocol.
          </Text>

          {/* Recommended-for-you banner */}
          <View
            style={[
              styles.recommendCard,
              { borderColor: `${recommendedVariant.accent}66`, backgroundColor: `${recommendedVariant.accent}14` },
            ]}
          >
            <Text style={styles.recommendLabel}>RECOMMENDED FOR YOU</Text>
            <Text style={styles.recommendName}>
              {recommendedVariant.name}{" "}
              <Text style={styles.recommendIngredient}>+ {recommendedVariant.functionalIngredient}</Text>
            </Text>
            <Text style={styles.recommendCmd}>{recommendedVariant.aiCommand}</Text>
            <Text style={styles.recommendState}>State: {userLevel}</Text>
          </View>

          {FORMAT_ORDER.map((fmt) => {
            const skus = STORE_SKUS.filter((s) => s.formatId === fmt.id);
            if (skus.length === 0) return null;
            return (
              <View key={fmt.id} style={styles.formatBlock}>
                <Text style={styles.formatHeader}>{fmt.label.toUpperCase()}</Text>
                {skus.map((sku) => {
                  const accent = flavorAccent(sku.flavor);
                  const img = flavorImage(sku, fmt.artwork) as number | undefined;
                  const perServing = pricePerServingCents(sku);
                  return (
                    <View key={sku.id} style={styles.skuCard}>
                      <View style={[styles.skuArtwork, { borderColor: `${accent}55` }]}>
                        {img ? (
                          <Image source={img as number} style={styles.skuImg} resizeMode="contain" />
                        ) : null}
                      </View>
                      <View style={styles.skuBody}>
                        <Text style={styles.skuTitle} numberOfLines={2}>
                          {sku.title}
                        </Text>
                        <Text style={styles.skuFormat}>{sku.formatLabel}</Text>
                        <Text style={styles.skuBlurb} numberOfLines={2}>
                          {sku.blurb}
                        </Text>

                        <View style={styles.priceRow}>
                          <Text style={styles.priceMain}>{formatPrice(sku.priceCents)}</Text>
                          {sku.compareAtCents && sku.compareAtCents > sku.priceCents && (
                            <Text style={styles.priceCompare}>{formatPrice(sku.compareAtCents)}</Text>
                          )}
                          <Text style={styles.pricePerServing}>
                            · {formatPrice(perServing)}/serving
                          </Text>
                        </View>

                        <Pressable
                          onPress={() => onAdd(sku)}
                          style={({ pressed }) => [
                            styles.addBtn,
                            { borderColor: accent, backgroundColor: `${accent}1A` },
                            pressed && { opacity: 0.85 },
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel={`Add ${sku.title} to cart`}
                        >
                          <Feather name="plus" size={14} color={accent} />
                          <Text style={[styles.addBtnText, { color: accent }]}>ADD TO CART</Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </View>
            );
          })}

          <View style={styles.legalBlock}>
            <Text style={styles.legalText}>
              Prices in USD. Subscriptions and recurring orders managed under{" "}
              <Text
                style={styles.legalLink}
                onPress={() => router.push("/subscription")}
              >
                Subscription
              </Text>
              .
            </Text>
          </View>
        </ScrollView>

        {/* Floating cart summary */}
        {itemCount > 0 && (
          <Pressable
            onPress={() => router.push("/cart")}
            style={[
              styles.cartPill,
              { bottom: (Platform.OS === "web" ? 100 : insets.bottom + 100) },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`View cart, ${itemCount} items, subtotal ${formatPrice(subtotalCents)}`}
          >
            <View style={styles.cartPillIcon}>
              <Feather name="shopping-bag" size={14} color={Colors.text.primary} />
              <View style={styles.cartPillBadge}>
                <Text style={styles.cartPillBadgeText}>{itemCount}</Text>
              </View>
            </View>
            <Text style={styles.cartPillText}>VIEW CART</Text>
            <Text style={styles.cartPillTotal}>{formatPrice(subtotalCents)}</Text>
            <Feather name="chevron-right" size={16} color={Colors.text.primary} />
          </Pressable>
        )}
      </GradientBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background.primary },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16 },

  headerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 },
  eyebrow: { fontSize: 11, letterSpacing: 1.6, color: Colors.text.muted, fontWeight: "600" },
  title: { fontSize: 26, fontWeight: "700", color: Colors.text.primary, marginTop: 2 },
  subtitle: { fontSize: 13, color: Colors.text.secondary, lineHeight: 19, marginVertical: 12 },

  cartIconBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: Colors.border.medium,
    backgroundColor: Colors.fill.light,
  },
  cartIconBadge: {
    position: "absolute", top: -4, right: -4,
    minWidth: 18, height: 18, borderRadius: 9,
    paddingHorizontal: 5,
    alignItems: "center", justifyContent: "center",
    backgroundColor: Colors.states.PEAK.primary,
  },
  cartIconBadgeText: {
    fontSize: 10, fontWeight: "700", color: "#000",
  },

  recommendCard: {
    borderRadius: 16, padding: 14, marginBottom: 18,
    borderWidth: 1,
  },
  recommendLabel: { fontSize: 10, letterSpacing: 1.4, color: Colors.text.muted, fontWeight: "700" },
  recommendName: { fontSize: 16, fontWeight: "700", color: Colors.text.primary, marginTop: 6 },
  recommendIngredient: { fontWeight: "500", color: Colors.text.secondary },
  recommendCmd: { fontSize: 12, color: Colors.text.primary, marginTop: 6, lineHeight: 17 },
  recommendState: { fontSize: 10, color: Colors.text.muted, marginTop: 6, letterSpacing: 0.6 },

  formatBlock: { marginBottom: 18 },
  formatHeader: {
    fontSize: 11, letterSpacing: 1.6, fontWeight: "700",
    color: Colors.text.muted, marginBottom: 10,
  },

  skuCard: {
    flexDirection: "row", gap: 12, padding: 12,
    borderRadius: 14, marginBottom: 10,
    borderWidth: 1, borderColor: Colors.border.medium,
    backgroundColor: Colors.fill.light,
  },
  skuArtwork: {
    width: 86, height: 110, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    overflow: "hidden",
  },
  skuImg: { width: 70, height: 100 },
  skuBody: { flex: 1, gap: 4 },
  skuTitle: { fontSize: 15, fontWeight: "700", color: Colors.text.primary },
  skuFormat: { fontSize: 11, color: Colors.text.muted, letterSpacing: 0.4 },
  skuBlurb: { fontSize: 12, color: Colors.text.secondary, lineHeight: 17, marginTop: 2 },
  priceRow: {
    flexDirection: "row", alignItems: "baseline", gap: 6,
    marginTop: 6, flexWrap: "wrap",
  },
  priceMain: { fontSize: 17, fontWeight: "700", color: Colors.text.primary },
  priceCompare: {
    fontSize: 12, color: Colors.text.muted,
    textDecorationLine: "line-through",
  },
  pricePerServing: { fontSize: 11, color: Colors.text.muted },
  addBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 9,
    borderRadius: 10, borderWidth: 1,
    alignSelf: "flex-start",
    marginTop: 8,
  },
  addBtnText: { fontSize: 11, fontWeight: "700", letterSpacing: 1 },

  legalBlock: { marginTop: 8, paddingHorizontal: 4 },
  legalText: { fontSize: 11, color: Colors.text.muted, lineHeight: 17 },
  legalLink: { color: Colors.states.PEAK.primary, fontWeight: "600" },

  cartPill: {
    position: "absolute",
    left: 16, right: 16,
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 14, paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: Colors.states.PEAK.primary,
    shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  cartPillIcon: {
    position: "relative",
    width: 28, height: 28,
    alignItems: "center", justifyContent: "center",
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  cartPillBadge: {
    position: "absolute", top: -4, right: -4,
    minWidth: 16, height: 16, paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: "#000",
    alignItems: "center", justifyContent: "center",
  },
  cartPillBadgeText: { color: "#fff", fontSize: 9, fontWeight: "700" },
  cartPillText: { flex: 1, color: "#000", fontSize: 12, fontWeight: "700", letterSpacing: 1.2 },
  cartPillTotal: { color: "#000", fontSize: 14, fontWeight: "700" },
});
