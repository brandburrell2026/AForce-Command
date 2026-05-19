/**
 * Urine Hydration Check — AForce OS.
 *
 * Single-purpose screen that maps a urine color signal to a hydration
 * verdict. Pure logic lives in services/urineHydrationCheck.ts. The
 * screen only renders inputs (four color tiles), the non-medical
 * disclaimer, and the result card.
 *
 * Tone matches the HydroScan rebrand — natural observation, never an
 * aggressive sell, 12 oz pour as the standard, AForce positioned as
 * mineral recovery / hydration efficiency support.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { GradientBackground } from '@/components/GradientBackground';
import { Colors } from '@/theme/colors';
import { Icon } from '@/components/Icon';
import {
  assessUrineColor,
  URINE_COLOR_OPTIONS,
  URINE_DISCLAIMER,
  type UrineColor,
  type UrineCheckResult,
  type UrineSeverity,
} from '@/services/urineHydrationCheck';

const SEVERITY_COLOR: Record<UrineSeverity, string> = {
  stable: Colors.states.PEAK.primary,
  good: Colors.states.BALANCED.primary,
  support: Colors.states.RECOVERING.primary,
  correction: Colors.states.DEPLETED.primary,
};

export default function UrineHydrationCheckScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selection, setSelection] = useState<UrineColor | null>(null);
  const result: UrineCheckResult | null = selection ? assessUrineColor(selection) : null;
  const accent = result ? SEVERITY_COLOR[result.severity] : Colors.accent.primary;

  return (
    <GradientBackground>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Top bar — back affordance, identical pattern to other tool screens. */}
        <View style={styles.topBar}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Back"
            testID="urine-check-back"
          >
            <Icon name="chevron-left" size={22} color="#FFFFFF" />
          </Pressable>
          <View style={{ flex: 1 }} />
        </View>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.eyebrow}>AFORCE · TOOL</Text>
          <Text style={styles.title}>URINE HYDRATION CHECK</Text>
          <Text style={styles.subtitle}>{URINE_DISCLAIMER}</Text>
        </View>

        {/* Color tiles */}
        <View style={styles.tileGrid}>
          {URINE_COLOR_OPTIONS.map((opt) => {
            const active = selection === opt.color;
            return (
              <Pressable
                key={opt.color}
                onPress={() => setSelection(opt.color)}
                accessibilityRole="button"
                accessibilityLabel={`Select ${opt.label}`}
                accessibilityState={{ selected: active }}
                testID={`urine-color-${opt.color}`}
                style={({ pressed }) => [
                  styles.tile,
                  {
                    borderColor: active ? Colors.accent.primary : 'rgba(255,255,255,0.08)',
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <View style={[styles.swatch, { backgroundColor: opt.hex }]} />
                <Text style={styles.tileLabel}>{opt.label.toUpperCase()}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Result */}
        {result && (
          <View
            style={[styles.resultCard, { borderColor: accent }]}
            testID="urine-check-result"
          >
            <Text style={[styles.resultEyebrow, { color: accent }]}>
              {result.colorLabel.toUpperCase()}
            </Text>
            <Text style={styles.resultVerdict} testID="urine-check-verdict">
              {result.verdict}
            </Text>
            <Text style={styles.resultDetail}>{result.detail}</Text>
            <View style={[styles.recommendationCard, { borderColor: accent }]}>
              <Text style={[styles.recommendationLabel, { color: accent }]}>
                RECOMMENDED
              </Text>
              <Text style={styles.recommendationBody}>{result.recommendation}</Text>
            </View>
          </View>
        )}

        {!result && (
          <View style={styles.placeholderCard}>
            <Text style={styles.placeholderText}>
              Tap a color above to read your hydration signal.
            </Text>
          </View>
        )}
      </ScrollView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 20,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 8,
  },
  header: {
    marginTop: 8,
    marginBottom: 28,
  },
  eyebrow: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    letterSpacing: 2.4,
    fontWeight: '600',
    marginBottom: 12,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 30,
    letterSpacing: 1.5,
    fontWeight: '800',
    marginBottom: 14,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  tile: {
    width: '47%',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 22,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatch: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  tileLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    letterSpacing: 1.4,
    fontWeight: '700',
  },
  resultCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 22,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  resultEyebrow: {
    fontSize: 11,
    letterSpacing: 2.2,
    fontWeight: '700',
    marginBottom: 10,
  },
  resultVerdict: {
    color: '#FFFFFF',
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    marginBottom: 12,
  },
  resultDetail: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 20,
  },
  recommendationCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  recommendationLabel: {
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: '700',
    marginBottom: 8,
  },
  recommendationBody: {
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
  },
  placeholderCard: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 22,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  placeholderText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 14,
    lineHeight: 21,
  },
});
