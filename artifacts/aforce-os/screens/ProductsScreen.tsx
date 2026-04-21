/**
 * Products Screen — AForce product catalog with functional flavor variants.
 *
 * Each AForce product (Stick, RTD, Canister, FIELD BAG) is a system format.
 * Flavors are TOOLS — each one pairs a functional ingredient with a user
 * state and an AI command. Selecting a flavor updates the bio, focus tags,
 * recommended use, and the suggested AI command line in real time.
 */

import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Image, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';

import { GradientBackground } from '@/components/GradientBackground';
import { Colors } from '@/theme/colors';
import { PRODUCTS, PRODUCT_FLAVORS } from '@/data/products';
import { FLAVOR_VARIANTS, flavorForState, type FlavorVariant } from '@/data/flavors';
import { useAppStore } from '@/store/useAppStore';
import type { FluidType, ProductFlavor } from '@/types';

interface ProductFormat {
  id: FluidType;
  title: string;
  blurb: string;
  artworkKey: 'stick' | 'can' | 'jar' | 'bag';
  /** Subset of flavors offered in this format. Sticks + RTD = all 3 today. */
  flavors: FlavorVariant['id'][];
}

const FORMATS: ProductFormat[] = [
  {
    id: 'aforce_stick',
    title: 'AForce Hydration Sticks',
    blurb: '12-stick alkaline mix. Mix with 16–20 oz water.',
    artworkKey: 'stick',
    flavors: ['berry_blast_dulse', 'watermelon_surge_chlorella', 'soursop_edge_seamoss'],
  },
  {
    id: 'aforce_rtd',
    title: 'AForce RTD Can',
    blurb: '11–12 oz ready-to-drink alkaline performance can.',
    artworkKey: 'can',
    flavors: ['berry_blast_dulse', 'watermelon_surge_chlorella', 'soursop_edge_seamoss'],
  },
  {
    id: 'aforce_canister',
    title: 'AForce Canister',
    blurb: 'Daily protocol fuel. Scoop into 16–20 oz water.',
    artworkKey: 'jar',
    flavors: ['berry_blast_dulse', 'watermelon_surge_chlorella', 'soursop_edge_seamoss'],
  },
  {
    id: 'aforce_bulk_bag',
    title: 'AForce FIELD BAG',
    blurb: 'Team / program bulk format. 16 oz per serving.',
    artworkKey: 'bag',
    flavors: ['soursop_edge_seamoss'],
  },
];

function flavorImage(format: ProductFormat, variant: FlavorVariant): any {
  const set = (PRODUCT_FLAVORS as Record<ProductFlavor, any>)[variant.flavor];
  if (!set) return undefined;
  return set[format.artworkKey] ?? set.stick;
}

export default function ProductsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { state } = useAppStore();
  const userLevel = state.engineOutput.performanceState.level;

  // Default flavor: AI-recommended for the user's current state.
  const recommended = useMemo(() => flavorForState(userLevel), [userLevel]);

  // Track selected flavor per format. Honor the per-format flavor allow-list:
  // if the recommended flavor isn't offered in this format, fall back to the
  // first flavor that IS offered (e.g. FIELD BAG only ships in Soursop today).
  const [selectedByFormat, setSelectedByFormat] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      FORMATS.map((f) => [
        f.id,
        f.flavors.includes(recommended.id) ? recommended.id : f.flavors[0],
      ]),
    ),
  );

  const select = (formatId: string, flavorId: string) => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    setSelectedByFormat((prev) => ({ ...prev, [formatId]: flavorId }));
  };

  const topPadding = Platform.OS === 'web' ? 24 : insets.top;

  return (
    <View style={styles.root}>
      <GradientBackground>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingTop: topPadding + 8, paddingBottom: insets.bottom + 64 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerRow}>
            <Pressable
              onPress={() => router.back()}
              style={styles.backBtn}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <Feather name="chevron-left" size={20} color={Colors.text.primary} />
            </Pressable>
            <View style={styles.headerTextWrap}>
              <Text style={styles.eyebrow}>AFORCE PRODUCTS</Text>
              <Text style={styles.title}>The System</Text>
            </View>
          </View>

          <Text style={styles.subtitle}>
            Flavors are tools. Each one pairs a functional ingredient with the state your body is in.
          </Text>

          <View style={styles.recommendCard}>
            <Text style={styles.recommendLabel}>RECOMMENDED FOR YOU</Text>
            <Text style={styles.recommendName}>
              {recommended.name} <Text style={styles.recommendIngredient}>+ {recommended.functionalIngredient}</Text>
            </Text>
            <Text style={styles.recommendCmd}>{recommended.aiCommand}</Text>
            <Text style={styles.recommendState}>State: {userLevel}</Text>
          </View>

          {FORMATS.map((format) => {
            const product = PRODUCTS[format.id];
            const flavorOptions = FLAVOR_VARIANTS.filter((f) => format.flavors.includes(f.id));
            const selectedId = selectedByFormat[format.id];
            // Constrain rendered variant to this format's allowed flavors.
            const variant =
              flavorOptions.find((f) => f.id === selectedId) ?? flavorOptions[0];
            const img = flavorImage(format, variant);

            return (
              <View key={format.id} style={styles.formatCard}>
                <View style={styles.formatHeader}>
                  <View style={[styles.artworkSlot, { borderColor: `${variant.accent}55` }]}>
                    {img ? <Image source={img} style={styles.artwork} resizeMode="contain" /> : null}
                  </View>
                  <View style={styles.formatHeaderText}>
                    <Text style={styles.formatTitle}>{format.title}</Text>
                    <Text style={styles.formatBlurb}>{format.blurb}</Text>
                    <Text style={styles.formatMeta}>{product.ozPerServing} oz / serving</Text>
                  </View>
                </View>

                <Text style={styles.sectionLabel}>SELECT FLAVOR</Text>
                <View style={styles.flavorRow}>
                  {flavorOptions.map((opt) => {
                    const active = opt.id === selectedId;
                    return (
                      <Pressable
                        key={opt.id}
                        onPress={() => select(format.id, opt.id)}
                        style={[
                          styles.flavorChip,
                          active && {
                            borderColor: opt.accent,
                            backgroundColor: `${opt.accent}1A`,
                          },
                        ]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={`${opt.name} with ${opt.functionalIngredient}`}
                      >
                        <View style={[styles.flavorDot, { backgroundColor: opt.accent }]} />
                        <View style={styles.flavorChipTextWrap}>
                          <Text style={[styles.flavorChipName, active && { color: Colors.text.primary }]}>
                            {opt.name}
                          </Text>
                          <Text style={styles.flavorChipIngredient}>+ {opt.functionalIngredient}</Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>

                <View style={[styles.detailBlock, { borderLeftColor: variant.accent }]}>
                  <Text style={styles.tagline}>"{variant.tagline}"</Text>
                  <Text style={styles.bio}>{variant.bio}</Text>

                  <Text style={styles.sectionLabel}>BEST USE</Text>
                  <View style={styles.tagWrap}>
                    {variant.bestUse.map((u) => (
                      <View key={u} style={styles.tag}>
                        <Text style={styles.tagText}>{u}</Text>
                      </View>
                    ))}
                  </View>

                  <Text style={styles.sectionLabel}>FUNCTIONAL FOCUS</Text>
                  <View style={styles.tagWrap}>
                    {variant.functionalFocus.map((u) => (
                      <View key={u} style={[styles.tag, { borderColor: `${variant.accent}66` }]}>
                        <Text style={[styles.tagText, { color: variant.accent }]}>{u}</Text>
                      </View>
                    ))}
                  </View>

                  <View style={styles.cmdBox}>
                    <Text style={styles.cmdLabel}>AI COMMAND</Text>
                    <Text style={styles.cmdText}>{variant.aiCommand}</Text>
                  </View>
                </View>
              </View>
            );
          })}
        </ScrollView>
      </GradientBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background.primary },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  backBtn: {
    width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border.medium, backgroundColor: Colors.fill.light,
  },
  headerTextWrap: { flex: 1 },
  eyebrow: { fontSize: 11, letterSpacing: 1.6, color: Colors.text.muted, fontWeight: '600' },
  title: { fontSize: 26, fontWeight: '700', color: Colors.text.primary, marginTop: 2 },
  subtitle: { fontSize: 13, color: Colors.text.secondary, lineHeight: 20, marginBottom: 16 },

  recommendCard: {
    borderRadius: 16, padding: 16, marginBottom: 20,
    borderWidth: 1, borderColor: Colors.border.medium, backgroundColor: Colors.fill.light,
  },
  recommendLabel: { fontSize: 10, letterSpacing: 1.4, color: Colors.text.muted, fontWeight: '700' },
  recommendName: { fontSize: 18, fontWeight: '700', color: Colors.text.primary, marginTop: 6 },
  recommendIngredient: { fontWeight: '500', color: Colors.text.secondary },
  recommendCmd: { fontSize: 13, color: Colors.text.primary, marginTop: 8, lineHeight: 19 },
  recommendState: { fontSize: 11, color: Colors.text.muted, marginTop: 6, letterSpacing: 0.6 },

  formatCard: {
    borderRadius: 18, padding: 16, marginBottom: 18,
    borderWidth: 1, borderColor: Colors.border.medium, backgroundColor: Colors.fill.light,
  },
  formatHeader: { flexDirection: 'row', gap: 14, alignItems: 'center', marginBottom: 14 },
  artworkSlot: {
    width: 78, height: 100, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: Colors.border.medium,
    overflow: 'hidden',
  },
  artwork: { width: 64, height: 92 },
  formatHeaderText: { flex: 1 },
  formatTitle: { fontSize: 16, fontWeight: '700', color: Colors.text.primary },
  formatBlurb: { fontSize: 12, color: Colors.text.secondary, marginTop: 4, lineHeight: 17 },
  formatMeta: { fontSize: 11, color: Colors.text.muted, marginTop: 4 },

  sectionLabel: {
    fontSize: 10, letterSpacing: 1.4, color: Colors.text.muted, fontWeight: '700',
    marginTop: 14, marginBottom: 8,
  },

  flavorRow: { gap: 8 },
  flavorChip: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, paddingHorizontal: 12,
    borderRadius: 12, borderWidth: 1, borderColor: Colors.border.medium,
    backgroundColor: Colors.fill.medium,
  },
  flavorDot: { width: 10, height: 10, borderRadius: 5 },
  flavorChipTextWrap: { flex: 1 },
  flavorChipName: { fontSize: 14, fontWeight: '600', color: Colors.text.secondary },
  flavorChipIngredient: { fontSize: 11, color: Colors.text.muted, marginTop: 1 },

  detailBlock: {
    marginTop: 14, paddingLeft: 12, borderLeftWidth: 2,
  },
  tagline: { fontSize: 14, fontStyle: 'italic', color: Colors.text.primary, marginBottom: 8 },
  bio: { fontSize: 13, color: Colors.text.secondary, lineHeight: 19 },

  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: {
    paddingVertical: 5, paddingHorizontal: 10, borderRadius: 999,
    borderWidth: 1, borderColor: Colors.border.medium, backgroundColor: Colors.fill.medium,
  },
  tagText: { fontSize: 11, color: Colors.text.secondary, fontWeight: '500' },

  cmdBox: {
    marginTop: 14, padding: 12, borderRadius: 10,
    backgroundColor: Colors.fill.medium, borderWidth: 1, borderColor: Colors.border.medium,
  },
  cmdLabel: { fontSize: 10, letterSpacing: 1.4, color: Colors.text.muted, fontWeight: '700', marginBottom: 4 },
  cmdText: { fontSize: 13, color: Colors.text.primary, lineHeight: 18 },
});
