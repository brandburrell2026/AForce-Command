/**
 * FlavorPickerModal — Choose which AForce flavor is being logged.
 *
 * Surfaced when the user taps LOG AFORCE STICK or LOG AFORCE RTD.
 * The fluid type (and therefore the hydration math) is the same for
 * every flavor — Berry +Dulse, Watermelon Surge +Chlorella, and
 * Soursop Edge +Seamoss all log as a single 12 oz stick / RTD — but
 * the history entry records *which* flavor so the user can see what
 * they actually drank later.
 *
 * Layout: bottom-sheet with three large flavor cards (using the
 * canonical accent color from FLAVOR_VARIANTS) plus a "no flavor"
 * fallback for users who don't care to specify.
 */

import React from 'react';
import { Modal, View, Text, StyleSheet, Pressable, ScrollView, Image } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors } from '../theme/colors';
import { FLAVOR_VARIANTS } from '../data/flavors';
import { PRODUCT_FLAVORS } from '../data/products';
import type { ProductFlavor } from '../types';

type FlavoredKey = keyof typeof PRODUCT_FLAVORS;

export interface FlavorChoice {
  id: string;
  label: string;
  flavor: ProductFlavor;
  accent: string;
  // Set when the picker is in 'both' mode so the caller knows which
  // physical product (stick / ready-to-drink can / plain water) was
  // selected. 'water' is the plain-water shortcut.
  fluid?: 'aforce_stick' | 'aforce_rtd' | 'water';
  // Optional explicit oz amount — used by the water size selector to
  // log 12 / 16 / 24 / 32 oz. When omitted, the caller falls back to
  // the product's default per-serving oz.
  ozOverride?: number;
}

const WATER_SIZES = [12, 16, 24, 32] as const;

const WATER_ACCENT = '#4FB6FF';

type PickerFormat = 'stick' | 'rtd' | 'both';

interface Props {
  visible: boolean;
  format: PickerFormat;
  onCancel: () => void;
  onConfirm: (flavor: FlavorChoice | null) => void;
}

// One render row in the picker: a flavor variant paired with the
// physical format being offered. In 'stick' / 'rtd' mode this is just
// the 3 flavors; in 'both' mode it expands to 6 options (3 flavors x 2
// formats) so the user can pick flavor and format in a single tap.
type PickerRow = {
  variant: (typeof FLAVOR_VARIANTS)[number];
  fluid: 'aforce_stick' | 'aforce_rtd';
  formatWord: 'Stick' | 'Can';
};

function buildRows(format: PickerFormat): PickerRow[] {
  const rows: PickerRow[] = [];
  for (const v of FLAVOR_VARIANTS) {
    if (format === 'stick' || format === 'both') {
      rows.push({ variant: v, fluid: 'aforce_stick', formatWord: 'Stick' });
    }
    if (format === 'rtd' || format === 'both') {
      rows.push({ variant: v, fluid: 'aforce_rtd', formatWord: 'Can' });
    }
  }
  return rows;
}

export function FlavorPickerModal({ visible, format, onCancel, onConfirm }: Props) {
  const titleSuffix =
    format === 'stick' ? ' STICK' : format === 'rtd' ? ' RTD' : '';
  const titleText = format === 'both' ? 'LOG INTAKE' : `LOG AFORCE${titleSuffix}`;

  const choose = (flavor: FlavorChoice | null) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onConfirm(flavor);
  };

  const rows = buildRows(format);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>{titleText}</Text>
            <Pressable onPress={onCancel} hitSlop={12} accessibilityLabel="Cancel">
              <Feather name="x" size={20} color={Colors.text.secondary} />
            </Pressable>
          </View>
          <Text style={styles.subtitle}>
            {format === 'both'
              ? 'Pick a flavor and format.'
              : 'Which flavor did you take?'}
          </Text>

          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {format === 'both' && (
              <View
                style={[
                  styles.waterCard,
                  { borderColor: `${WATER_ACCENT}66`, backgroundColor: `${WATER_ACCENT}14` },
                ]}
              >
                <View style={styles.waterHeader}>
                  <View style={styles.waterIcon}>
                    <Feather name="droplet" size={20} color={WATER_ACCENT} />
                  </View>
                  <View style={styles.cardBody}>
                    <Text style={styles.cardName}>Water</Text>
                    <Text style={styles.cardSub}>Plain · pick a size</Text>
                  </View>
                </View>
                <View style={styles.waterSizes}>
                  {WATER_SIZES.map((oz) => (
                    <Pressable
                      key={`water-${oz}`}
                      onPress={() =>
                        choose({
                          id: `plain-water-${oz}`,
                          label: `Water ${oz} oz`,
                          flavor: 'plain' as ProductFlavor,
                          accent: WATER_ACCENT,
                          fluid: 'water',
                          ozOverride: oz,
                        })
                      }
                      style={({ pressed }) => [
                        styles.waterSizeChip,
                        {
                          borderColor: pressed ? WATER_ACCENT : `${WATER_ACCENT}77`,
                          backgroundColor: pressed ? `${WATER_ACCENT}33` : `${WATER_ACCENT}1A`,
                        },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`Log ${oz} ounces of water`}
                      testID={`flavor-water-${oz}`}
                    >
                      <Text style={[styles.waterSizeLabel, { color: WATER_ACCENT }]}>
                        {oz} oz
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
            {rows.map((row) => {
              const f = row.variant;
              const fullLabel = `${f.name} +${f.functionalIngredient} ${row.formatWord}`;
              const artwork =
                f.flavor in PRODUCT_FLAVORS
                  ? row.fluid === 'aforce_rtd'
                    ? PRODUCT_FLAVORS[f.flavor as FlavoredKey].can
                    : PRODUCT_FLAVORS[f.flavor as FlavoredKey].stick
                  : null;
              const rowKey = `${f.id}-${row.fluid}`;
              return (
                <Pressable
                  key={rowKey}
                  onPress={() =>
                    choose({
                      id: f.id,
                      label: fullLabel,
                      flavor: f.flavor,
                      accent: f.accent,
                      fluid: row.fluid,
                    })
                  }
                  style={({ pressed }) => [
                    styles.card,
                    {
                      borderColor: pressed ? f.accent : `${f.accent}55`,
                      backgroundColor: pressed
                        ? `${f.accent}1F`
                        : `${f.accent}10`,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Log ${fullLabel}`}
                  testID={`flavor-${rowKey}`}
                >
                  {artwork ? (
                    <Image source={artwork} style={styles.artwork} resizeMode="contain" />
                  ) : (
                    <View style={[styles.dot, { backgroundColor: f.accent }]} />
                  )}
                  <View style={styles.cardBody}>
                    <Text style={styles.cardName}>{f.name}</Text>
                    <Text style={styles.cardSub}>
                      +{f.functionalIngredient} · {row.formatWord}
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={18} color={f.accent} />
                </Pressable>
              );
            })}

            <Pressable
              onPress={() => choose(null)}
              style={({ pressed }) => [
                styles.skipBtn,
                pressed && { backgroundColor: Colors.fill.medium },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Log without specifying a flavor"
              testID="flavor-skip"
            >
              <Text style={styles.skipText}>Skip — log without flavor</Text>
            </Pressable>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.background.elevated,
    paddingTop: 16,
    paddingHorizontal: 20,
    paddingBottom: 28,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    gap: 12,
    maxHeight: '80%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 3,
    color: Colors.text.primary,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: Colors.text.secondary,
    marginTop: -4,
  },
  list: {
    marginTop: 4,
  },
  listContent: {
    gap: 10,
    paddingBottom: 8,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  artwork: {
    width: 44,
    height: 56,
  },
  waterIcon: {
    width: 44,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waterCard: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  waterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  waterSizes: {
    flexDirection: 'row',
    gap: 8,
  },
  waterSizeChip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waterSizeLabel: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.5,
  },
  cardBody: {
    flex: 1,
  },
  cardName: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    color: Colors.text.primary,
    letterSpacing: 0.3,
  },
  cardSub: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: Colors.text.secondary,
    marginTop: 2,
  },
  skipBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
    marginTop: 4,
  },
  skipText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text.muted,
    letterSpacing: 0.5,
  },
});
