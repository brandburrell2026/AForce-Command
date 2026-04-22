/**
 * LogIntakeRow — Three explicit log buttons for the home screen.
 *
 * Replaces the older horizontally scrolling QuickIntakeBar. The user
 * asked for three obvious targets only — AForce Stick, AForce RTD, and
 * plain Water — so each option gets a full-width column with a clear
 * label and serving size, sized for thumb-tap accuracy.
 *
 * Tapping fires a Medium haptic + dispatches `logIntake` against the
 * existing app store. Disabled while a cycle completion is in flight
 * to prevent double-logs.
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { Colors } from '../theme/colors';
import { useAppStore } from '../store/useAppStore';
import { PRODUCTS, PRODUCT_FLAVORS } from '../data/products';
import type { FluidType } from '../types';

type FlavoredKey = keyof typeof PRODUCT_FLAVORS;
import { WaterAmountModal } from './WaterAmountModal';
import { FlavorPickerModal, type FlavorChoice } from './FlavorPickerModal';

interface Props {
  accentColor: string;
}

// Each tile's label is resolved through i18n at render time so the row
// re-localizes the moment the user changes language. Keep the icon /
// fluid id outside the i18n layer — those are stable identifiers.
const OPTIONS: Array<{
  fluid: FluidType;
  labelKey: string;
  icon: keyof typeof Feather.glyphMap;
}> = [
  { fluid: 'aforce_stick', labelKey: 'logIntake.row_stick_label', icon: 'zap' },
  { fluid: 'aforce_rtd', labelKey: 'logIntake.row_rtd_label', icon: 'package' },
  { fluid: 'water', labelKey: 'logIntake.row_water_label', icon: 'droplet' },
];

export function LogIntakeRow({ accentColor }: Props) {
  const { t } = useTranslation();
  const { logIntake, state } = useAppStore();
  const [waterPickerOpen, setWaterPickerOpen] = React.useState(false);
  const [flavorPickerFor, setFlavorPickerFor] = React.useState<
    null | 'aforce_stick' | 'aforce_rtd'
  >(null);
  // Remember the most recent flavor selected for each format so the
  // tile can swap to the matching artwork after a successful log.
  const [lastFlavor, setLastFlavor] = React.useState<{
    aforce_stick?: FlavoredKey;
    aforce_rtd?: FlavoredKey;
  }>({});

  // Water opens an oz picker (variable bottle sizes); sticks + RTD
  // open a flavor picker so the user can record which AForce flavor
  // (Berry / Watermelon / Soursop) they actually took.
  const handleLog = (fluid: FluidType) => {
    if (state.isCompletingCycle) return;
    if (fluid === 'water') {
      Haptics.selectionAsync().catch(() => {});
      setWaterPickerOpen(true);
      return;
    }
    if (fluid === 'aforce_stick' || fluid === 'aforce_rtd') {
      Haptics.selectionAsync().catch(() => {});
      setFlavorPickerFor(fluid);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    logIntake(fluid);
  };

  const handleWaterConfirm = (oz: number) => {
    setWaterPickerOpen(false);
    logIntake('water', { ozOverride: oz });
  };

  const handleFlavorConfirm = (flavor: FlavorChoice | null) => {
    const fluid = flavorPickerFor;
    setFlavorPickerFor(null);
    if (!fluid) return;
    if (flavor && flavor.flavor in PRODUCT_FLAVORS) {
      const key = flavor.flavor as FlavoredKey;
      setLastFlavor((prev) => ({ ...prev, [fluid]: key }));
    }
    logIntake(fluid, flavor ? { flavorLabel: flavor.label } : undefined);
  };

  // Resolve the artwork for a tile: use the flavored render once a
  // flavor has been picked, otherwise fall back to the default product
  // image from the catalog.
  const imageFor = (fluid: FluidType) => {
    if (fluid === 'aforce_stick' && lastFlavor.aforce_stick) {
      return PRODUCT_FLAVORS[lastFlavor.aforce_stick].stick;
    }
    if (fluid === 'aforce_rtd' && lastFlavor.aforce_rtd) {
      return PRODUCT_FLAVORS[lastFlavor.aforce_rtd].can;
    }
    return PRODUCTS[fluid]?.image;
  };

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {OPTIONS.map((opt) => {
          const product = PRODUCTS[opt.fluid];
          const tileImage = imageFor(opt.fluid);
          const label = t(opt.labelKey);
          return (
            <Pressable
              key={opt.fluid}
              onPress={() => handleLog(opt.fluid)}
              disabled={state.isCompletingCycle}
              accessibilityRole="button"
              accessibilityLabel={t('logIntake.a11y_log', { label })}
              testID={`log-${opt.fluid}`}
              style={({ pressed }) => [
                styles.tile,
                {
                  borderColor: pressed ? accentColor : Colors.border.medium,
                  backgroundColor: pressed
                    ? `${accentColor}1A`
                    : Colors.background.elevated,
                },
                state.isCompletingCycle && { opacity: 0.5 },
              ]}
            >
              {tileImage ? (
                <Image source={tileImage} style={styles.image} resizeMode="contain" />
              ) : (
                <View style={styles.iconCircle}>
                  <Feather name={opt.icon} size={22} color={accentColor} />
                </View>
              )}
              <Text style={styles.label} numberOfLines={1}>
                {t('logIntake.log_prefix')} {label}
              </Text>
              <Text style={[styles.oz, { color: accentColor }]}>
                {opt.fluid === 'water'
                  ? t('logIntake.choose_oz')
                  : opt.fluid === 'aforce_stick' || opt.fluid === 'aforce_rtd'
                  ? t('logIntake.pick_flavor')
                  : t('logIntake.size_oz', { oz: product?.ozPerServing ?? 12 })}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <WaterAmountModal
        visible={waterPickerOpen}
        accentColor={accentColor}
        onCancel={() => setWaterPickerOpen(false)}
        onConfirm={handleWaterConfirm}
      />
      <FlavorPickerModal
        visible={flavorPickerFor !== null}
        format={flavorPickerFor === 'aforce_rtd' ? 'rtd' : 'stick'}
        onCancel={() => setFlavorPickerFor(null)}
        onConfirm={handleFlavorConfirm}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  tile: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    gap: 6,
  },
  image: {
    width: 56,
    height: 64,
  },
  iconCircle: {
    width: 56,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: Colors.fill.light,
  },
  label: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    color: Colors.text.primary,
    letterSpacing: 1,
    textAlign: 'center',
  },
  oz: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.5,
  },
});
