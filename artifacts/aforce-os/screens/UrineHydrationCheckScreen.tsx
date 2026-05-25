/**
 * Urine Hydration Check — AForce OS.
 *
 * Primary purpose: map a urine color signal to a hydration verdict
 * (pure logic in services/urineHydrationCheck.ts).
 *
 * Also hosts the Performance Signals + Energy State self-report
 * sections that previously lived on the removed "Check" tab — they
 * feed the same engine recalculation. The urine color picker is the
 * existing block and is intentionally left untouched.
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';

// Symmetric teardrop path: tip at top (12,1), bulb at bottom centred
// on (12,16) with radius 10. Drawn in a 24×24 viewBox.
const DROP_PATH =
  'M12 1 C 12 1 22 12 22 16 A 10 10 0 1 1 2 16 C 2 12 12 1 12 1 Z';

/**
 * UrineDropCluster — three teardrop SVGs arranged in a triangle
 * (one above, two below). All three share the same urine color so
 * the swatch reads as a small fluid cluster instead of a flat
 * circle.
 */
function UrineDropCluster({ color }: { color: string }) {
  return (
    <View style={swatchStyles.cluster}>
      <View style={swatchStyles.topDrop}>
        <Svg width={22} height={22} viewBox="0 0 24 24">
          <Path d={DROP_PATH} fill={color} />
        </Svg>
      </View>
      <View style={swatchStyles.bottomRow}>
        <Svg width={18} height={18} viewBox="0 0 24 24">
          <Path d={DROP_PATH} fill={color} />
        </Svg>
        <Svg width={18} height={18} viewBox="0 0 24 24">
          <Path d={DROP_PATH} fill={color} />
        </Svg>
      </View>
    </View>
  );
}

const swatchStyles = StyleSheet.create({
  cluster: {
    width: 56,
    height: 56,
    marginBottom: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topDrop: {
    marginBottom: -2,
  },
  bottomRow: {
    flexDirection: 'row',
    gap: 4,
  },
});

import { GradientBackground } from '@/components/GradientBackground';
import { Colors } from '@/theme/colors';
import { Icon } from '@/components/Icon';
import { useAppStore } from '@/store/useAppStore';
import { SYMPTOM_CATALOG, ENERGY_STATE_OPTIONS } from '@/data/mockData';
import type { UserState } from '@/types';
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

// Lazy haptics — same pattern as elsewhere; never reject on web.
const hapticSelection = () => {
  import('expo-haptics')
    .then((m) => m.selectionAsync().catch(() => {}))
    .catch(() => {});
};
const hapticImpactHeavy = () => {
  import('expo-haptics')
    .then((m) => m.impactAsync(m.ImpactFeedbackStyle.Heavy).catch(() => {}))
    .catch(() => {});
};

export default function UrineHydrationCheckScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selection, setSelection] = useState<UrineColor | null>(null);
  const result: UrineCheckResult | null = selection ? assessUrineColor(selection) : null;
  const accent = result ? SEVERITY_COLOR[result.severity] : Colors.accent.primary;

  // ── Performance Signals + Energy State (merged in from the old Check tab) ──
  const { state, updateSymptoms, updateEnergyState, confirmStatus } = useAppStore();
  const { userState, engineOutput } = state;
  const stateColor = engineOutput.performanceState.color;

  const [symptoms, setSymptoms] = useState<string[]>(userState.symptoms);
  const [energy, setEnergy] = useState<UserState['energyState']>(userState.energyState);

  useEffect(() => { setSymptoms(userState.symptoms); }, [userState.symptoms]);
  useEffect(() => { setEnergy(userState.energyState); }, [userState.energyState]);

  const toggleSymptom = (id: string) => {
    hapticSelection();
    setSymptoms((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const handleConfirm = async () => {
    hapticImpactHeavy();
    try {
      await Promise.all([
        updateSymptoms(symptoms),
        updateEnergyState(energy),
      ]);
      await confirmStatus();
    } catch (err) {
      console.error('Confirm status failed:', err);
    }
  };

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

        {/* Color tiles — UNCHANGED */}
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
                <UrineDropCluster color={opt.hex} />
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

        {/* ── Performance Signals (merged from removed Check tab) ─────────── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>Performance signals</Text>
          <Text style={styles.sectionHint}>{symptoms.length} active</Text>
        </View>
        <View style={styles.card}>
          <View style={styles.chipRow}>
            {SYMPTOM_CATALOG.map((s) => {
              const active = symptoms.includes(s.id);
              return (
                <Pressable
                  key={s.id}
                  onPress={() => toggleSymptom(s.id)}
                  style={[
                    styles.chip,
                    active && { borderColor: Colors.danger, backgroundColor: `${Colors.danger}1A` },
                  ]}
                >
                  <Icon
                    name={active ? 'alert-circle' : 'circle'}
                    size={12}
                    color={active ? Colors.danger : Colors.text.muted}
                  />
                  <Text style={[styles.chipText, active && { color: Colors.danger }]}>
                    {s.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* ── Energy State ──────────────────────────────────────────────── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>Energy state</Text>
        </View>
        <View style={styles.energyGrid}>
          {ENERGY_STATE_OPTIONS.map((opt) => {
            const selected = energy === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => { hapticSelection(); setEnergy(opt.value); }}
                style={[
                  styles.energyTile,
                  {
                    borderColor: selected ? opt.color : Colors.border.medium,
                    backgroundColor: selected ? `${opt.color}14` : Colors.background.card,
                  },
                ]}
              >
                <Text style={[styles.energyLabel, { color: opt.color }]}>{opt.label}</Text>
                <Text style={styles.energyDesc}>{opt.desc}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* ── Live score preview ────────────────────────────────────────── */}
        <View style={[styles.previewCard, { borderColor: `${stateColor}33` }]}>
          <Text style={styles.previewLabel}>Current score</Text>
          <Text style={[styles.previewScore, { color: stateColor }]}>{engineOutput.score}</Text>
          <Text style={styles.previewState}>
            {engineOutput.performanceState.level} · {engineOutput.command.action}
          </Text>
        </View>

        {/* ── Confirm Status ────────────────────────────────────────────── */}
        <TouchableOpacity
          style={[styles.confirmBtn, { borderColor: `${stateColor}66` }]}
          onPress={handleConfirm}
          activeOpacity={0.85}
        >
          <View style={[styles.confirmGlow, { backgroundColor: `${stateColor}1F` }]} />
          <Icon name="check-circle" size={20} color={stateColor} />
          <Text style={styles.confirmText}>Complete cycle</Text>
        </TouchableOpacity>
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

  // ── Performance Signals / Energy State (merged sections) ────────────
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 32,
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: Colors.text.muted,
    letterSpacing: 0.2,
  },
  sectionHint: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: Colors.text.secondary,
    letterSpacing: 0.1,
  },
  card: {
    backgroundColor: Colors.background.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    padding: 16,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: Colors.border.medium,
    backgroundColor: Colors.fill.light,
  },
  chipText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: Colors.text.secondary,
  },
  energyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  energyTile: {
    width: '48%',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  energyLabel: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  energyDesc: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: Colors.text.secondary,
  },
  previewCard: {
    backgroundColor: Colors.background.card,
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    marginTop: 24,
    marginBottom: 16,
    alignItems: 'center',
  },
  previewLabel: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: Colors.text.muted,
    letterSpacing: 0.2,
    marginBottom: 6,
  },
  previewScore: {
    fontSize: 44,
    fontFamily: 'Inter_700Bold',
    letterSpacing: -2,
    lineHeight: 50,
    marginBottom: 4,
  },
  previewState: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
    borderRadius: 16,
    borderWidth: 1.5,
    backgroundColor: Colors.background.elevated,
    overflow: 'hidden',
  },
  confirmGlow: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  confirmText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text.primary,
    letterSpacing: 0.6,
  },
});
