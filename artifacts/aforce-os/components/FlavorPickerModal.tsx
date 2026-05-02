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

import React, { useState } from 'react';
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
const FLAVOR_SIZES = [12] as const;

const WATER_ACCENT = '#4FB6FF';

type PickerFormat = 'stick' | 'rtd' | 'both';

interface Props {
  visible: boolean;
  format: PickerFormat;
  onCancel: () => void;
  onConfirm: (flavor: FlavorChoice | null) => void;
}

type FormatOption = { fluid: 'aforce_stick' | 'aforce_rtd'; word: 'Stick' | 'Drink' };

const STICK_OPTION: FormatOption = { fluid: 'aforce_stick', word: 'Stick' };
const DRINK_OPTION: FormatOption = { fluid: 'aforce_rtd', word: 'Drink' };

function formatOptionsFor(format: PickerFormat): FormatOption[] {
  if (format === 'stick') return [STICK_OPTION];
  if (format === 'rtd') return [DRINK_OPTION];
  return [STICK_OPTION, DRINK_OPTION];
}

interface FlavorCardProps {
  variant: (typeof FLAVOR_VARIANTS)[number];
  formatOptions: FormatOption[];
  onChoose: (choice: FlavorChoice) => void;
}

function FlavorCard({ variant: f, formatOptions, onChoose }: FlavorCardProps) {
  const [selected, setSelected] = useState<FormatOption>(formatOptions[0]);
  const artwork =
    f.flavor in PRODUCT_FLAVORS
      ? selected.fluid === 'aforce_rtd'
        ? PRODUCT_FLAVORS[f.flavor as FlavoredKey].can
        : PRODUCT_FLAVORS[f.flavor as FlavoredKey].stick
      : null;
  const fullLabel = `${f.name} +${f.functionalIngredient} ${selected.word}`;

  return (
    <View
      style={[
        styles.waterCard,
        { borderColor: `${f.accent}55`, backgroundColor: `${f.accent}10` },
      ]}
    >
      <View style={styles.waterHeader}>
        {artwork ? (
          <Image source={artwork} style={styles.artwork} resizeMode="contain" />
        ) : (
          <View style={[styles.dot, { backgroundColor: f.accent }]} />
        )}
        <View style={styles.cardBody}>
          <Text style={styles.cardName}>{f.name}</Text>
          <Text style={styles.cardSub}>
            +{f.functionalIngredient} · pick a size
          </Text>
        </View>
      </View>

      {formatOptions.length > 1 && (
        <View style={styles.formatToggle}>
          {formatOptions.map((opt) => {
            const active = opt.fluid === selected.fluid;
            return (
              <Pressable
                key={opt.fluid}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setSelected(opt);
                }}
                style={[
                  styles.formatChip,
                  {
                    borderColor: active ? f.accent : `${f.accent}55`,
                    backgroundColor: active ? `${f.accent}33` : 'transparent',
                  },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${f.name} ${opt.word}`}
                testID={`flavor-${f.id}-format-${opt.fluid}`}
              >
                <Text
                  style={[
                    styles.formatChipLabel,
                    { color: active ? f.accent : Colors.text.secondary },
                  ]}
                >
                  {opt.word}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <View style={styles.waterSizes}>
        {FLAVOR_SIZES.map((oz) => (
          <Pressable
            key={`${f.id}-${selected.fluid}-${oz}`}
            onPress={() =>
              onChoose({
                id: `${f.id}-${selected.fluid}-${oz}`,
                label: `${fullLabel} ${oz} ounces`,
                flavor: f.flavor,
                accent: f.accent,
                fluid: selected.fluid,
                ozOverride: oz,
              })
            }
            style={({ pressed }) => [
              styles.waterSizeChip,
              {
                borderColor: pressed ? f.accent : `${f.accent}66`,
                backgroundColor: pressed ? `${f.accent}33` : `${f.accent}1A`,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Log ${oz} ounces of ${fullLabel}`}
            testID={`flavor-${f.id}-${selected.fluid}-${oz}`}
          >
            <Text style={[styles.waterSizeLabel, { color: f.accent }]}>
              {oz} ounces
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function FlavorPickerModal({ visible, format, onCancel, onConfirm }: Props) {
  const titleSuffix =
    format === 'stick' ? ' STICK' : format === 'rtd' ? ' RTD' : '';
  const titleText = format === 'both' ? 'LOG INTAKE' : `LOG AFORCE${titleSuffix}`;

  const choose = (flavor: FlavorChoice | null) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onConfirm(flavor);
  };

  const formatOptions = formatOptionsFor(format);

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
                          label: `Water ${oz} ounces`,
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
                        {oz} ounces
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
            {FLAVOR_VARIANTS.map((variant) => (
              <FlavorCard
                key={variant.id}
                variant={variant}
                formatOptions={formatOptions}
                onChoose={choose}
              />
            ))}

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
  formatToggle: {
    flexDirection: 'row',
    gap: 8,
  },
  formatChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formatChipLabel: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
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
