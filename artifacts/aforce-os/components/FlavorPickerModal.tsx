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
}

interface Props {
  visible: boolean;
  format: 'stick' | 'rtd';
  onCancel: () => void;
  onConfirm: (flavor: FlavorChoice | null) => void;
}

export function FlavorPickerModal({ visible, format, onCancel, onConfirm }: Props) {
  const formatLabel = format === 'stick' ? 'STICK' : 'RTD';

  const choose = (flavor: FlavorChoice | null) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onConfirm(flavor);
  };

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
            <Text style={styles.title}>LOG AFORCE {formatLabel}</Text>
            <Pressable onPress={onCancel} hitSlop={12} accessibilityLabel="Cancel">
              <Feather name="x" size={20} color={Colors.text.secondary} />
            </Pressable>
          </View>
          <Text style={styles.subtitle}>Which flavor did you take?</Text>

          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {FLAVOR_VARIANTS.map((f) => {
              const fullLabel = `${f.name} +${f.functionalIngredient}`;
              const artwork =
                f.flavor in PRODUCT_FLAVORS
                  ? format === 'rtd'
                    ? PRODUCT_FLAVORS[f.flavor as FlavoredKey].can
                    : PRODUCT_FLAVORS[f.flavor as FlavoredKey].stick
                  : null;
              return (
                <Pressable
                  key={f.id}
                  onPress={() => choose({ id: f.id, label: fullLabel, flavor: f.flavor, accent: f.accent })}
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
                  testID={`flavor-${f.id}`}
                >
                  {artwork ? (
                    <Image source={artwork} style={styles.artwork} resizeMode="contain" />
                  ) : (
                    <View style={[styles.dot, { backgroundColor: f.accent }]} />
                  )}
                  <View style={styles.cardBody}>
                    <Text style={styles.cardName}>{f.name}</Text>
                    <Text style={styles.cardSub}>+{f.functionalIngredient}</Text>
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
