/**
 * QuickIntakeBar — Tap-to-log for the 5 supported intake types.
 * Includes an interactive image for each AForce product format.
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable, Image, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors } from '../theme/colors';
import { useAppStore } from '../store/useAppStore';
import { PRODUCTS, QUICK_INTAKE_ORDER } from '../data/products';
import type { FluidType } from '../types';

interface Props {
  accentColor: string;
}

export function QuickIntakeBar({ accentColor }: Props) {
  const { logIntake, state } = useAppStore();

  const handleLog = (fluidType: FluidType) => {
    if (state.isCompletingCycle) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    logIntake(fluidType);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>QUICK LOG</Text>
        <Text style={[styles.hint, { color: Colors.text.muted }]}>
          Tap to log instantly
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {QUICK_INTAKE_ORDER.map((ft) => {
          const p = PRODUCTS[ft];
          return (
            <Pressable
              key={ft}
              onPress={() => handleLog(ft)}
              style={({ pressed }) => [
                styles.tile,
                { borderColor: pressed ? accentColor : Colors.border.medium, backgroundColor: pressed ? `${accentColor}14` : Colors.background.elevated },
              ]}
            >
              {p.image ? (
                <Image source={p.image} style={styles.image} resizeMode="contain" />
              ) : (
                <View style={styles.iconFallback}>
                  <Feather name="droplet" size={28} color={Colors.text.secondary} />
                </View>
              )}
              <Text style={styles.name} numberOfLines={1}>{p.shortName}</Text>
              <Text style={[styles.oz, { color: accentColor }]}>{p.ozPerServing} oz</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  label: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    color: Colors.text.muted,
    letterSpacing: 2.5,
  },
  hint: {
    fontSize: 10,
    fontFamily: 'Inter_500Medium',
    letterSpacing: 0.5,
  },
  row: {
    paddingHorizontal: 20,
    gap: 10,
  },
  tile: {
    width: 102,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    gap: 6,
  },
  image: {
    width: 64,
    height: 78,
  },
  iconFallback: {
    width: 64,
    height: 78,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text.primary,
    letterSpacing: 0.2,
  },
  oz: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.5,
  },
});
