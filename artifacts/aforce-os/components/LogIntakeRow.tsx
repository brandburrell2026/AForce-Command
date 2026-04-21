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
import { Colors } from '../theme/colors';
import { useAppStore } from '../store/useAppStore';
import { PRODUCTS } from '../data/products';
import type { FluidType } from '../types';
import { WaterAmountModal } from './WaterAmountModal';

interface Props {
  accentColor: string;
}

const OPTIONS: Array<{
  fluid: FluidType;
  label: string;
  icon: keyof typeof Feather.glyphMap;
}> = [
  { fluid: 'aforce_stick', label: 'AFORCE STICK', icon: 'zap' },
  { fluid: 'aforce_rtd', label: 'AFORCE RTD', icon: 'package' },
  { fluid: 'water', label: 'WATER', icon: 'droplet' },
];

export function LogIntakeRow({ accentColor }: Props) {
  const { logIntake, state } = useAppStore();
  const [waterPickerOpen, setWaterPickerOpen] = React.useState(false);

  // Sticks + RTD use their fixed serving size; water opens a manual
  // picker because real-world water containers range from 8 → 32+ oz.
  const handleLog = (fluid: FluidType) => {
    if (state.isCompletingCycle) return;
    if (fluid === 'water') {
      Haptics.selectionAsync().catch(() => {});
      setWaterPickerOpen(true);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    logIntake(fluid);
  };

  const handleWaterConfirm = (oz: number) => {
    setWaterPickerOpen(false);
    logIntake('water', { ozOverride: oz });
  };

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {OPTIONS.map((opt) => {
          const product = PRODUCTS[opt.fluid];
          return (
            <Pressable
              key={opt.fluid}
              onPress={() => handleLog(opt.fluid)}
              disabled={state.isCompletingCycle}
              accessibilityRole="button"
              accessibilityLabel={`Log ${opt.label}`}
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
              {product?.image ? (
                <Image source={product.image} style={styles.image} resizeMode="contain" />
              ) : (
                <View style={styles.iconCircle}>
                  <Feather name={opt.icon} size={22} color={accentColor} />
                </View>
              )}
              <Text style={styles.label} numberOfLines={1}>LOG {opt.label}</Text>
              <Text style={[styles.oz, { color: accentColor }]}>
                {opt.fluid === 'water' ? 'choose oz' : `${product?.ozPerServing ?? 12} oz`}
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
