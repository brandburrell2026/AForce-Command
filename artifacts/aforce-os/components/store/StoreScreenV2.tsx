/**
 * Fuel Screen — AForce Fuel (guided, not sold).
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
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";
import { Icon, type IconName } from '@/components/Icon';

import { GradientBackground } from "@/components/GradientBackground";
import { ZoomableProductImage } from "@/components/ZoomableProductImage";
import { af } from "@/theme";
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
// `labelKey` resolves under store.v2.* at render (format names are screen copy).
const FORMAT_ORDER: { id: StoreFormatId; labelKey: string; artwork: "stick" | "can" | "jar" | "bag" }[] = [
  { id: "aforce_stick", labelKey: "format_stick", artwork: "stick" },
  { id: "aforce_rtd", labelKey: "format_rtd", artwork: "can" },
  { id: "aforce_canister", labelKey: "format_canister", artwork: "jar" },
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
    case "Heat":     return af.green;
    case "Recovery": return af.amber;
    case "Daily":    return af.cyan;
    case "Field":    return af.textSecondary;
  }
}

/** protocolRole → store.v2.role_* key suffix (translated at the call site). */
function protocolRoleKey(role: StoreSKU["protocolRole"]): string {
  return `role_${role}`;
}

export function StoreScreenV2() {
  const { t } = useTranslation();
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
              <Text style={styles.eyebrow}>{t('store.v2.eyebrow')}</Text>
              <Text style={styles.title}>{t('store.v2.title')}</Text>
            </View>
            <Pressable
              onPress={() => router.push("/cart")}
              style={styles.cartIconBtn}
              accessibilityRole="button"
              accessibilityLabel={t('store.v2.cart_a11y', { count: itemCount })}
              hitSlop={10}
            >
              <Icon name="shopping-bag" size={18} color={af.textPrimary} />
              {itemCount > 0 && (
                <View style={styles.cartIconBadge}>
                  <Text style={styles.cartIconBadgeText}>{itemCount}</Text>
                </View>
              )}
            </Pressable>
          </View>

          <Text style={styles.subtitle}>{t('store.v2.subtitle')}</Text>

          {/* Recommended-for-you banner */}
          <View
            style={[
              styles.recommendCard,
              { borderColor: `${recommendedVariant.accent}66`, backgroundColor: `${recommendedVariant.accent}14` },
            ]}
          >
            <Text style={styles.recommendLabel}>{t('store.v2.recommended_for_you')}</Text>
            <Text style={styles.recommendName}>
              {recommendedVariant.name}{" "}
              <Text style={styles.recommendIngredient}>+ {recommendedVariant.functionalIngredient}</Text>
            </Text>
            <Text style={styles.recommendCmd}>{recommendedVariant.aiCommand}</Text>
            <Text style={styles.recommendState}>{t('store.v2.state', { level: userLevel })}</Text>
          </View>

          {FORMAT_ORDER.map((fmt) => {
            const skus = STORE_SKUS.filter((s) => s.formatId === fmt.id);
            if (skus.length === 0) return null;
            return (
              <View key={fmt.id} style={styles.formatBlock}>
                <Text style={styles.formatHeader}>{t(`store.v2.${fmt.labelKey}`).toUpperCase()}</Text>
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
                                accessibilityLabel={t('store.v2.zoom_a11y', { title: sku.title })}
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
                                      borderColor: af.guardian,
                                      backgroundColor: af.guardianTint,
                                    },
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.badgeChipText,
                                      { color: af.guardian },
                                    ]}
                                  >
                                    {t('store.v2.performance_bundle')}
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
                                {t(`store.v2.${protocolRoleKey(sku.protocolRole)}`).toUpperCase()}
                              </Text>
                            </View>
                            <Text style={styles.intelRecommend}>
                              {t('store.v2.recommended_for')}{" "}
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
                            accessibilityState={{ selected: !isSubscribed }}
                          >
                            <Text
                              style={[
                                styles.toggleBtnText,
                                !isSubscribed && { color: accent },
                              ]}
                            >
                              {t('store.v2.one_time')}
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
                            accessibilityState={{ selected: isSubscribed }}
                          >
                            <Text
                              style={[
                                styles.toggleBtnText,
                                isSubscribed && { color: accent },
                              ]}
                            >
                              {t('store.v2.subscribe_toggle', { discount: subPricing.discountLabel.toUpperCase() })}
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
                              accessibilityState={{ selected: selectedBundleId === null }}
                            >
                              <Text
                                style={[
                                  styles.bundleChipText,
                                  selectedBundleId === null && { color: accent },
                                ]}
                              >
                                {t('store.v2.single')}
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
                                  accessibilityState={{ selected: active }}
                                  accessibilityLabel={t('store.v2.select_bundle_a11y', { label: b.bundle.label, savings: b.savingsLabel })}
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
                        <View
                          style={styles.priceRow}
                          accessible
                          accessibilityLabel={[
                            formatPrice(bigPriceCents),
                            compareCents != null && compareCents > bigPriceCents
                              ? formatPrice(compareCents)
                              : null,
                            !selectedBundle
                              ? t('store.v2.per_serving', { price: formatPrice(perServing) })
                              : t('store.v2.per_pack', { price: formatPrice(selectedBundle.effectiveUnitCents) }),
                          ]
                            .filter(Boolean)
                            .join(' ')}
                        >
                          <Text style={styles.priceMain}>{formatPrice(bigPriceCents)}</Text>
                          {compareCents != null && compareCents > bigPriceCents ? (
                            <Text style={styles.priceCompare}>{formatPrice(compareCents)}</Text>
                          ) : null}
                          {!selectedBundle ? (
                            <Text style={styles.pricePerServing}>
                              {t('store.v2.per_serving', { price: formatPrice(perServing) })}
                            </Text>
                          ) : (
                            <Text style={styles.pricePerServing}>
                              {t('store.v2.per_pack', { price: formatPrice(selectedBundle.effectiveUnitCents) })}
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
                          accessibilityLabel={`${t('store.v2.add_a11y', { title: sku.title })}${
                            isSubscribed ? t('store.v2.add_a11y_subscription') : ""
                          }${selectedBundle ? ` (${selectedBundle.bundle.label})` : ""}`}
                          testID={`store-add-${sku.id}`}
                        >
                          <Icon name="plus" size={14} color={accent} />
                          <Text style={[styles.addBtnText, { color: accent }]}>
                            {isSubscribed
                              ? t('store.v2.add_subscribe', { discount: subPricing.discountLabel.toUpperCase() })
                              : selectedBundle
                                ? t('store.v2.add_bundle', { bundle: selectedBundle.bundle.label.toUpperCase() })
                                : t('store.v2.add_to_cart')}
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
              {t('store.v2.legal_prefix')}
              <Text
                style={styles.legalLink}
                onPress={() => router.push("/subscription")}
              >
                {t('store.v2.legal_link')}
              </Text>
              {t('store.v2.legal_suffix')}
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
            accessibilityLabel={t('store.v2.view_cart_a11y', { count: itemCount, subtotal: formatPrice(subtotalCents) })}
          >
            <View style={styles.cartPillIcon}>
              <Icon name="shopping-bag" size={14} color={af.textPrimary} />
              <View style={styles.cartPillBadge}>
                <Text style={styles.cartPillBadgeText}>{itemCount}</Text>
              </View>
            </View>
            <Text style={styles.cartPillText}>{t('store.v2.view_cart')}</Text>
            <Text style={styles.cartPillTotal}>{formatPrice(subtotalCents)}</Text>
            <Icon name="chevron-right" size={16} color={af.textPrimary} />
          </Pressable>
        )}
      </GradientBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: af.canvas },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16 },

  headerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 },
  eyebrow: { fontSize: 11, letterSpacing: 1.6, color: af.textTertiary, fontWeight: "600" },
  title: { fontSize: 26, fontWeight: "700", color: af.textPrimary, marginTop: 2 },
  subtitle: { fontSize: 13, color: af.textSecondary, lineHeight: 19, marginVertical: 12 },

  cartIconBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: af.border,
    backgroundColor: af.surface,
  },
  cartIconBadge: {
    position: "absolute", top: -4, right: -4,
    minWidth: 18, height: 18, borderRadius: 9,
    paddingHorizontal: 5,
    alignItems: "center", justifyContent: "center",
    backgroundColor: af.green,
  },
  cartIconBadgeText: {
    fontSize: 10, fontWeight: "700", color: "#000",
  },

  recommendCard: {
    borderRadius: 16, padding: 14, marginBottom: 18,
    borderWidth: 1,
  },
  recommendLabel: { fontSize: 10, letterSpacing: 1.4, color: af.textTertiary, fontWeight: "700" },
  recommendName: { fontSize: 16, fontWeight: "700", color: af.textPrimary, marginTop: 6 },
  recommendIngredient: { fontWeight: "500", color: af.textSecondary },
  recommendCmd: { fontSize: 12, color: af.textPrimary, marginTop: 6, lineHeight: 17 },
  recommendState: { fontSize: 10, color: af.textTertiary, marginTop: 6, letterSpacing: 0.6 },

  formatBlock: { marginBottom: 18 },
  formatHeader: {
    fontSize: 11, letterSpacing: 1.6, fontWeight: "700",
    color: af.textTertiary, marginBottom: 10,
  },

  skuGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  skuCardWide: { flexBasis: "48%", flexGrow: 1, marginBottom: 0 },

  skuCard: {
    padding: 12,
    borderRadius: 14, marginBottom: 10,
    borderWidth: 1, borderColor: af.border,
    backgroundColor: af.surface,
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

  skuTitle: { fontSize: 15, fontWeight: "700", color: af.textPrimary },
  skuFormat: { fontSize: 11, color: af.textTertiary, letterSpacing: 0.4 },
  skuBlurb: { fontSize: 12, color: af.textSecondary, lineHeight: 17, marginTop: 2 },

  intelRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6, flexWrap: "wrap" },
  intelChip: { fontSize: 9, fontWeight: "700", letterSpacing: 1, color: af.textSecondary },
  intelDivider: { fontSize: 10, color: af.textTertiary },
  intelRecommend: { fontSize: 9, fontWeight: "700", letterSpacing: 1, color: af.textTertiary, marginTop: 4 },

  toggleRow: { flexDirection: "row", gap: 6 },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8, paddingHorizontal: 10,
    borderRadius: 8, borderWidth: 1,
    borderColor: af.border,
    backgroundColor: "rgba(255,255,255,0.02)",
    alignItems: "center", justifyContent: "center",
  },
  toggleBtnText: {
    fontSize: 10, fontWeight: "700", letterSpacing: 1,
    color: af.textTertiary,
  },

  bundleRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  bundleChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 9, paddingVertical: 6,
    borderRadius: 8, borderWidth: 1,
    borderColor: af.border,
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  bundleChipText: {
    fontSize: 10, fontWeight: "700", letterSpacing: 0.8,
    color: af.textSecondary,
  },
  bundleChipSavings: {
    fontSize: 9, fontWeight: "700", color: af.textTertiary,
  },

  priceRow: {
    flexDirection: "row", alignItems: "baseline", gap: 6,
    flexWrap: "wrap",
  },
  priceMain: { fontSize: 19, fontWeight: "700", color: af.textPrimary },
  priceCompare: {
    fontSize: 12, color: af.textTertiary,
    textDecorationLine: "line-through",
  },
  pricePerServing: { fontSize: 11, color: af.textTertiary },
  addBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 10, borderWidth: 1,
    alignSelf: "stretch",
    justifyContent: "center",
  },
  addBtnText: { fontSize: 11, fontWeight: "700", letterSpacing: 1 },

  legalBlock: { marginTop: 8, paddingHorizontal: 4 },
  legalText: { fontSize: 11, color: af.textTertiary, lineHeight: 17 },
  legalLink: { color: af.green, fontWeight: "600" },

  cartPill: {
    position: "absolute",
    left: 16, right: 16,
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 14, paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: af.green,
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
