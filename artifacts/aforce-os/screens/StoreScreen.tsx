/**
 * Store Screen — AForce Shopping.
 *
 * Lists every SKU (format × flavor) with image, blurb, price, and add-to-cart
 * controls. Each card carries:
 *   - one-time / subscribe toggle (Subscribe & Save 15%)
 *   - bundle quantity selector with implied savings
 *   - product-intelligence chips (USE CASE · PROTOCOL ROLE · RECOMMENDED FOR)
 *   - a "Performance Bundle" badge surfacing system-tier inclusion for canisters
 *
 * Pricing math lives in services/productPricingService — the screen is purely
 * presentational. The cart is keyed by sku id, so subscription / bundle
 * variants reuse SKU ids defined in data/pricing.ts and the server catalog.
 */

import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";

import { GradientBackground } from "@/components/GradientBackground";
import { ZoomableProductImage } from "@/components/ZoomableProductImage";
import { Colors } from "@/theme/colors";
import {
  STORE_SKUS,
  formatPrice,
  pricePerServingCents,
  type StoreFormatId,
  type StoreSKU,
} from "@/data/pricing";
import {
  getSubscriptionPricing,
  getBundlesForSku,
  type BundlePricing,
} from "@/services/productPricingService";
import { PRODUCT_FLAVORS } from "@/data/products";
import { FLAVOR_VARIANTS, flavorForState } from "@/data/flavors";
import { useCart } from "@/store/useCartStore";
import { useAppStore } from "@/store/useAppStore";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";

// FIELD BAG / bulk bag is intentionally not offered in the store right now.
const FORMAT_ORDER: { id: StoreFormatId; label: string; artwork: "stick" | "can" | "jar" | "bag" }[] = [
  { id: "aforce_stick", label: "Hydration Sticks", artwork: "stick" },
  { id: "aforce_rtd", label: "Ready-To-Drink", artwork: "can" },
  { id: "aforce_canister", label: "Canisters", artwork: "jar" },
];

type FlavorKey = keyof typeof PRODUCT_FLAVORS;

function flavorAccent(flavor: StoreSKU["flavor"]): string {
  return PRODUCT_FLAVORS[flavor as FlavorKey].accent;
}

function flavorImage(sku: StoreSKU, artwork: "stick" | "can" | "jar" | "bag"): unknown {
  const set = PRODUCT_FLAVORS[sku.flavor as FlavorKey] as Record<string, unknown>;
  return set[artwork];
}

function useCaseChipColor(useCase: StoreSKU["useCase"]): string {
  switch (useCase) {
    case "Heat":     return Colors.states.PEAK.primary;
    case "Recovery": return Colors.states.RECOVERING.primary;
    case "Daily":    return Colors.states.BALANCED.primary;
    case "Field":    return Colors.text.secondary;
  }
}

function protocolRoleLabel(role: StoreSKU["protocolRole"]): string {
  switch (role) {
    case "baseline_hydration":      return "Baseline Hydration";
    case "field_grade_hydration":   return "Field-Grade Hydration";
    case "daily_protocol_fuel":     return "Daily Protocol Fuel";
    case "team_bulk":               return "Team Bulk";
  }
}

export default function StoreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const layout = useResponsiveLayout();
  const { add, itemCount, subtotalCents } = useCart();
  const { state } = useAppStore();
  const userLevel = state.engineOutput.performanceState.level;

  const recommended = useMemo(() => flavorForState(userLevel), [userLevel]);
  const recommendedVariant = useMemo(
    () => FLAVOR_VARIANTS.find((v) => v.flavor === recommended.flavor) ?? FLAVOR_VARIANTS[0],
    [recommended.flavor],
  );

  // Per-SKU UI state: subscribe toggle + selected bundle (null = single).
  const [subscribeMap, setSubscribeMap] = useState<Record<string, boolean>>({});
  const [bundleMap, setBundleMap] = useState<Record<string, string | null>>({});

  const onAdd = (sku: StoreSKU) => {
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    const bundleId = bundleMap[sku.id] ?? null;
    if (bundleId) {
      add(bundleId, 1);
    } else {
      add(sku.id, 1);
    }
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
            {
              paddingTop: topPadding + 8,
              paddingBottom: bottomPadding,
              ...(layout.isWide
                ? { maxWidth: layout.contentMaxWidth, alignSelf: 'center', width: '100%' }
                : null),
            },
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
            formats. Subscribe and save.
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
                <View style={layout.isWide ? styles.skuGrid : undefined}>
                  {skus.map((sku) => {
                    const accent = flavorAccent(sku.flavor);
                    const img = flavorImage(sku, fmt.artwork) as number | undefined;
                    const perServing = pricePerServingCents(sku);
                    const subPricing = getSubscriptionPricing(sku);
                    const isSubscribed = subscribeMap[sku.id] ?? false;
                    const bundles = getBundlesForSku(sku);
                    const selectedBundleId = bundleMap[sku.id] ?? null;
                    const selectedBundle: BundlePricing | undefined =
                      selectedBundleId
                        ? bundles.find((b) => b.bundle.id === selectedBundleId)
                        : undefined;

                    // Effective unit price shown big — bundle wins over sub
                    // wins over one-time. Bundles already imply a deeper
                    // discount, so we don't double-apply subscribe-save on
                    // top of bundle pricing (kept simple at the catalog
                    // level — the server will price authoritatively).
                    const bigPriceCents = selectedBundle
                      ? selectedBundle.bundlePriceCents
                      : isSubscribed
                        ? subPricing.subscriptionCents
                        : sku.priceCents;
                    const compareCents = selectedBundle
                      ? selectedBundle.singlesCents
                      : isSubscribed
                        ? sku.priceCents
                        : sku.compareAtCents;

                    return (
                      <View
                        key={sku.id}
                        style={[
                          styles.skuCard,
                          layout.isWide && styles.skuCardWide,
                          isSubscribed && { borderColor: `${accent}88` },
                        ]}
                      >
                        {/* Top row: artwork + body */}
                        <View style={styles.skuTopRow}>
                          <View style={[styles.skuArtwork, { borderColor: `${accent}55` }]}>
                            {img ? (
                              <ZoomableProductImage
                                source={img as number}
                                style={styles.skuImg}
                                containerStyle={{ width: '100%', height: '100%' }}
                                resizeMode="contain"
                                accent={accent}
                                caption={sku.title}
                                accessibilityLabel={`Zoom in on ${sku.title}`}
                                testID={`store-zoom-${sku.id}`}
                              />
                            ) : null}
                          </View>
                          <View style={styles.skuBody}>
                            {/* Badge row */}
                            <View style={styles.badgeRow}>
                              {sku.badge ? (
                                <View
                                  style={[
                                    styles.badgeChip,
                                    { borderColor: accent, backgroundColor: `${accent}22` },
                                  ]}
                                >
                                  <Text style={[styles.badgeChipText, { color: accent }]}>
                                    {sku.badge.toUpperCase()}
                                  </Text>
                                </View>
                              ) : null}
                              {sku.formatId === "aforce_canister" ? (
                                <View
                                  style={[
                                    styles.badgeChip,
                                    {
                                      borderColor: Colors.guardian.primary,
                                      backgroundColor: `${Colors.guardian.primary}22`,
                                    },
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.badgeChipText,
                                      { color: Colors.guardian.primary },
                                    ]}
                                  >
                                    INCLUDED · PERFORMANCE BUNDLE
                                  </Text>
                                </View>
                              ) : null}
                            </View>

                            <Text style={styles.skuTitle} numberOfLines={2}>
                              {sku.title}
                            </Text>
                            <Text style={styles.skuFormat}>{sku.formatLabel}</Text>
                            <Text style={styles.skuBlurb} numberOfLines={2}>
                              {sku.blurb}
                            </Text>

                            {/* Intelligence row */}
                            <View style={styles.intelRow}>
                              <Text style={[styles.intelChip, { color: useCaseChipColor(sku.useCase) }]}>
                                {sku.useCase.toUpperCase()}
                              </Text>
                              <Text style={styles.intelDivider}>·</Text>
                              <Text style={styles.intelChip}>
                                {protocolRoleLabel(sku.protocolRole).toUpperCase()}
                              </Text>
                            </View>
                            <Text style={styles.intelRecommend}>
                              RECOMMENDED FOR{" "}
                              <Text style={{ color: accent }}>
                                {sku.recommendedFor.join(" · ")}
                              </Text>
                            </Text>
                          </View>
                        </View>

                        {/* Subscribe / one-time toggle */}
                        <View style={styles.toggleRow}>
                          <Pressable
                            onPress={() =>
                              setSubscribeMap((m) => ({ ...m, [sku.id]: false }))
                            }
                            style={[
                              styles.toggleBtn,
                              !isSubscribed && {
                                borderColor: accent,
                                backgroundColor: `${accent}1A`,
                              },
                            ]}
                            accessibilityRole="button"
                          >
                            <Text
                              style={[
                                styles.toggleBtnText,
                                !isSubscribed && { color: accent },
                              ]}
                            >
                              ONE-TIME
                            </Text>
                          </Pressable>
                          <Pressable
                            onPress={() =>
                              setSubscribeMap((m) => ({ ...m, [sku.id]: true }))
                            }
                            style={[
                              styles.toggleBtn,
                              isSubscribed && {
                                borderColor: accent,
                                backgroundColor: `${accent}1A`,
                              },
                            ]}
                            accessibilityRole="button"
                          >
                            <Text
                              style={[
                                styles.toggleBtnText,
                                isSubscribed && { color: accent },
                              ]}
                            >
                              SUBSCRIBE · {subPricing.discountLabel.toUpperCase()}
                            </Text>
                          </Pressable>
                        </View>

                        {/* Bundle selector (if any) */}
                        {bundles.length > 0 ? (
                          <View style={styles.bundleRow}>
                            <Pressable
                              onPress={() =>
                                setBundleMap((m) => ({ ...m, [sku.id]: null }))
                              }
                              style={[
                                styles.bundleChip,
                                selectedBundleId === null && {
                                  borderColor: accent,
                                  backgroundColor: `${accent}1A`,
                                },
                              ]}
                              accessibilityRole="button"
                            >
                              <Text
                                style={[
                                  styles.bundleChipText,
                                  selectedBundleId === null && { color: accent },
                                ]}
                              >
                                SINGLE
                              </Text>
                            </Pressable>
                            {bundles.map((b) => {
                              const active = selectedBundleId === b.bundle.id;
                              return (
                                <Pressable
                                  key={b.bundle.id}
                                  onPress={() =>
                                    setBundleMap((m) => ({
                                      ...m,
                                      [sku.id]: b.bundle.id,
                                    }))
                                  }
                                  style={[
                                    styles.bundleChip,
                                    active && {
                                      borderColor: accent,
                                      backgroundColor: `${accent}1A`,
                                    },
                                  ]}
                                  accessibilityRole="button"
                                  accessibilityLabel={`Select ${b.bundle.label} · ${b.savingsLabel}`}
                                >
                                  <Text
                                    style={[
                                      styles.bundleChipText,
                                      active && { color: accent },
                                    ]}
                                  >
                                    {b.bundle.label.toUpperCase()}
                                  </Text>
                                  {b.savingsCents > 0 ? (
                                    <Text
                                      style={[
                                        styles.bundleChipSavings,
                                        active && { color: accent },
                                      ]}
                                    >
                                      {b.savingsLabel}
                                    </Text>
                                  ) : null}
                                </Pressable>
                              );
                            })}
                          </View>
                        ) : null}

                        {/* Price row */}
                        <View style={styles.priceRow}>
                          <Text style={styles.priceMain}>{formatPrice(bigPriceCents)}</Text>
                          {compareCents != null && compareCents > bigPriceCents ? (
                            <Text style={styles.priceCompare}>{formatPrice(compareCents)}</Text>
                          ) : null}
                          {!selectedBundle ? (
                            <Text style={styles.pricePerServing}>
                              · {formatPrice(perServing)}/serving
                            </Text>
                          ) : (
                            <Text style={styles.pricePerServing}>
                              · {formatPrice(selectedBundle.effectiveUnitCents)}/pack
                            </Text>
                          )}
                        </View>

                        {/* CTA */}
                        <Pressable
                          onPress={() => onAdd(sku)}
                          style={({ pressed }) => [
                            styles.addBtn,
                            { borderColor: accent, backgroundColor: `${accent}1A` },
                            pressed && { opacity: 0.85 },
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel={`Add ${sku.title} to cart${
                            isSubscribed ? " (subscription)" : ""
                          }${selectedBundle ? ` (${selectedBundle.bundle.label})` : ""}`}
                          testID={`store-add-${sku.id}`}
                        >
                          <Feather name="plus" size={14} color={accent} />
                          <Text style={[styles.addBtnText, { color: accent }]}>
                            {isSubscribed
                              ? `SUBSCRIBE & ${subPricing.discountLabel.toUpperCase()}`
                              : selectedBundle
                                ? `ADD ${selectedBundle.bundle.label.toUpperCase()}`
                                : "ADD TO CART"}
                          </Text>
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          })}

          <View style={styles.legalBlock}>
            <Text style={styles.legalText}>
              Prices in USD. Subscriptions billed monthly until canceled. Manage under{" "}
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
              layout.isWide && {
                left: "50%",
                right: undefined,
                width: layout.contentMaxWidth - 32,
                marginLeft: -((layout.contentMaxWidth - 32) / 2),
              },
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

  skuGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  skuCardWide: { flexBasis: "48%", flexGrow: 1, marginBottom: 0 },

  skuCard: {
    padding: 12,
    borderRadius: 14, marginBottom: 10,
    borderWidth: 1, borderColor: Colors.border.medium,
    backgroundColor: Colors.fill.light,
    gap: 10,
  },
  skuTopRow: { flexDirection: "row", gap: 12 },
  skuArtwork: {
    width: 86, height: 110, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    overflow: "hidden",
  },
  skuImg: { width: 70, height: 100 },
  skuBody: { flex: 1, gap: 4 },

  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 4 },
  badgeChip: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 6, borderWidth: 1,
  },
  badgeChipText: { fontSize: 9, fontWeight: "800", letterSpacing: 0.9 },

  skuTitle: { fontSize: 15, fontWeight: "700", color: Colors.text.primary },
  skuFormat: { fontSize: 11, color: Colors.text.muted, letterSpacing: 0.4 },
  skuBlurb: { fontSize: 12, color: Colors.text.secondary, lineHeight: 17, marginTop: 2 },

  intelRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6, flexWrap: "wrap" },
  intelChip: { fontSize: 9, fontWeight: "700", letterSpacing: 1, color: Colors.text.secondary },
  intelDivider: { fontSize: 10, color: Colors.text.muted },
  intelRecommend: { fontSize: 9, fontWeight: "700", letterSpacing: 1, color: Colors.text.muted, marginTop: 4 },

  toggleRow: { flexDirection: "row", gap: 6 },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8, paddingHorizontal: 10,
    borderRadius: 8, borderWidth: 1,
    borderColor: Colors.border.medium,
    backgroundColor: "rgba(255,255,255,0.02)",
    alignItems: "center", justifyContent: "center",
  },
  toggleBtnText: {
    fontSize: 10, fontWeight: "700", letterSpacing: 1,
    color: Colors.text.muted,
  },

  bundleRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  bundleChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 9, paddingVertical: 6,
    borderRadius: 8, borderWidth: 1,
    borderColor: Colors.border.medium,
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  bundleChipText: {
    fontSize: 10, fontWeight: "700", letterSpacing: 0.8,
    color: Colors.text.secondary,
  },
  bundleChipSavings: {
    fontSize: 9, fontWeight: "700", color: Colors.text.muted,
  },

  priceRow: {
    flexDirection: "row", alignItems: "baseline", gap: 6,
    flexWrap: "wrap",
  },
  priceMain: { fontSize: 19, fontWeight: "700", color: Colors.text.primary },
  priceCompare: {
    fontSize: 12, color: Colors.text.muted,
    textDecorationLine: "line-through",
  },
  pricePerServing: { fontSize: 11, color: Colors.text.muted },
  addBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 10, borderWidth: 1,
    alignSelf: "stretch",
    justifyContent: "center",
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
