/**
 * AForce Replacement card — the "Best AForce alternative" recommendation
 * surfaced when a competitor product was scanned.
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';

import { Colors } from '@/theme/colors';
import { COMPARE_PRODUCTS } from '@/data/productDatabase';
import type { ScanResult } from '@/types/scan';

interface Props {
  result: ScanResult;
  onTakeAction: () => void;
  isLogging?: boolean;
}

export function AForceReplacementCard({ result, onTakeAction, isLogging }: Props) {
  const replacementId = result.recommendation.aforceEquivalentId;
  if (!replacementId) return null;
  const product = COMPARE_PRODUCTS.find((p) => p.id === replacementId);
  if (!product) return null;

  const accent = Colors.states.PEAK.primary;
  return (
    <View style={[styles.card, { borderColor: `${accent}55` }]}>
      <View style={[styles.glow, { backgroundColor: `${accent}10` }]} />
      <View style={styles.headerRow}>
        <View style={[styles.badge, { backgroundColor: `${accent}1A`, borderColor: `${accent}66` }]}>
          <Feather name="zap" size={11} color={accent} />
          <Text style={[styles.badgeText, { color: accent }]}>BEST AFORCE REPLACEMENT</Text>
        </View>
      </View>

      <Text style={styles.name}>{product.name}</Text>
      <Text style={styles.detail}>{result.recommendation.detail}</Text>

      <Pressable
        onPress={() => {
          if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          onTakeAction();
        }}
        disabled={isLogging}
        style={({ pressed }) => [
          styles.cta,
          { borderColor: `${accent}66`, opacity: isLogging ? 0.6 : pressed ? 0.85 : 1 },
        ]}
      >
        <Feather name="arrow-right-circle" size={16} color={accent} />
        <Text style={[styles.ctaText, { color: accent }]} numberOfLines={2}>
          {isLogging ? 'LOGGING…' : result.recommendation.command.toUpperCase()}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.background.card,
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    overflow: 'hidden',
    gap: 10,
  },
  glow: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  headerRow: { flexDirection: 'row' },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 100, borderWidth: 1, alignSelf: 'flex-start',
  },
  badgeText: { fontSize: 9, fontFamily: 'Inter_700Bold', letterSpacing: 1.4 },
  name: {
    fontSize: 18, fontFamily: 'Inter_700Bold',
    color: Colors.text.primary, letterSpacing: -0.3, marginTop: 4,
  },
  detail: {
    fontSize: 12, fontFamily: 'Inter_400Regular',
    color: Colors.text.secondary, lineHeight: 17,
  },
  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 12, borderRadius: 12, borderWidth: 1, marginTop: 4,
  },
  ctaText: {
    fontSize: 12, fontFamily: 'Inter_700Bold',
    letterSpacing: 1.2, flexShrink: 1, textAlign: 'center',
  },
});
