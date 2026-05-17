/**
 * Check — Performance Signals tab.
 * Sections (per brand language rules):
 *   1. Performance Signals (symptom toggles)
 *   2. Hydration Signal Check (urine scale)
 *   3. Energy State (selector)
 *   4. Confirm Status (recalculation CTA)
 */

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Platform, TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../components/Icon';

import { GradientBackground } from '@/components/GradientBackground';
import { Colors } from '@/theme/colors';
import { useAppStore } from '@/store/useAppStore';
import { SYMPTOM_CATALOG, HYDRATION_SIGNAL_SCALE, ENERGY_STATE_OPTIONS } from '@/data/mockData';
import type { UserState } from '@/types';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { WEB_TOP_PADDING, WEB_BOTTOM_PADDING, TAB_BAR_HEIGHT } from '@/constants/layout';

// Lazy-loaded haptics — `expo-haptics` rejects on web (no native
// module), and a top-level static import + bare `.then()` would leak
// "Possible Unhandled Promise Rejection" warnings into the console
// every time we tap. The `import('expo-haptics')` form bundles the
// module on native and tree-shakes / no-ops cleanly on web. We
// always swallow rejections so a haptics failure can never surface
// to the user.
const hapticSelection = () => {
  import('expo-haptics').then(m => m.selectionAsync().catch(() => {})).catch(() => {});
};
const hapticImpactHeavy = () => {
  import('expo-haptics').then(m => m.impactAsync(m.ImpactFeedbackStyle.Heavy).catch(() => {})).catch(() => {});
};

export default function CheckScreen() {
  const { state, updateSymptoms, updateUrineSignal, updateEnergyState, confirmStatus } = useAppStore();
  const { userState, engineOutput } = state;
  const insets = useSafeAreaInsets();
  const stateColor = engineOutput.performanceState.color;
  const layout = useResponsiveLayout();

  const [symptoms, setSymptoms] = useState<string[]>(userState.symptoms);
  const [urine, setUrine] = useState<number>(userState.urineSignal);
  const [energy, setEnergy] = useState<UserState['energyState']>(userState.energyState);

  useEffect(() => { setSymptoms(userState.symptoms); }, [userState.symptoms]);
  useEffect(() => { setUrine(userState.urineSignal); }, [userState.urineSignal]);
  useEffect(() => { setEnergy(userState.energyState); }, [userState.energyState]);

  const topPadding = Platform.OS === 'web' ? WEB_TOP_PADDING : insets.top;
  const bottomPadding = Platform.OS === 'web' ? WEB_BOTTOM_PADDING : insets.bottom + TAB_BAR_HEIGHT;

  const toggleSymptom = (id: string) => {
    hapticSelection();
    setSymptoms((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const handleConfirm = async () => {
    hapticImpactHeavy();
    // If any of the per-field updates throws (e.g. network blip while
    // syncing the engine state), don't recalculate against half-stale
    // data — surface the error and let the user retry.
    try {
      await Promise.all([
        updateSymptoms(symptoms),
        updateUrineSignal(urine),
        updateEnergyState(energy),
      ]);
      await confirmStatus();
    } catch (err) {
      console.error('Confirm status failed:', err);
      // optionally surface a toast here
    }
  };

  return (
    <View style={styles.root}>
      <GradientBackground>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            {
              paddingTop: topPadding + 8,
              paddingBottom: bottomPadding + 24,
              // Cap content column on Fold-open / tablet so the
              // signal cards don't stretch edge-to-edge.
              ...(layout.isWide
                ? { maxWidth: layout.contentMaxWidth, alignSelf: 'center', width: '100%' }
                : null),
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.eyebrow}>CHECK</Text>
          <Text style={styles.title}>Performance Signals</Text>
          <Text style={styles.subtitle}>
            Update your real-time signals. The engine recalculates instantly.
          </Text>

          {/* Performance Signals */}
          <SectionHeader label="PERFORMANCE SIGNALS" hint={`${symptoms.length} active`} />
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

          {/* Hydration Signal Check */}
          <SectionHeader label="HYDRATION SIGNAL CHECK" hint={`Level ${urine}/8`} />
          <View style={styles.card}>
            <View style={styles.scaleRow}>
              {HYDRATION_SIGNAL_SCALE.map((tile) => {
                const selected = urine === tile.value;
                return (
                  <Pressable
                    key={tile.value}
                    onPress={() => { hapticSelection(); setUrine(tile.value); }}
                    style={[
                      styles.scaleTile,
                      { backgroundColor: tile.color },
                      selected && styles.scaleTileSelected,
                    ]}
                  >
                    {selected && (
                      <View style={styles.scaleCheck}>
                        <Icon name="check" size={14} color="#000" />
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.scaleLabel}>
              {HYDRATION_SIGNAL_SCALE.find((t) => t.value === urine)?.label} —{' '}
              <Text style={{ color: Colors.text.secondary }}>
                {HYDRATION_SIGNAL_SCALE.find((t) => t.value === urine)?.tier}
              </Text>
            </Text>
          </View>

          {/* Energy State */}
          <SectionHeader label="ENERGY STATE" />
          <View style={styles.energyGrid}>
            {ENERGY_STATE_OPTIONS.map((opt) => {
              const selected = energy === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => { hapticSelection(); setEnergy(opt.value); }}
                  style={[
                    styles.energyTile,
                    { borderColor: selected ? opt.color : Colors.border.medium, backgroundColor: selected ? `${opt.color}14` : Colors.background.card },
                  ]}
                >
                  <Text style={[styles.energyLabel, { color: opt.color }]}>{opt.label}</Text>
                  <Text style={styles.energyDesc}>{opt.desc}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* Live preview */}
          <View style={[styles.previewCard, { borderColor: `${stateColor}33` }]}>
            <Text style={styles.previewLabel}>CURRENT SCORE</Text>
            <Text style={[styles.previewScore, { color: stateColor }]}>{engineOutput.score}</Text>
            <Text style={styles.previewState}>
              {engineOutput.performanceState.level} · {engineOutput.command.action}
            </Text>
          </View>

          {/* Confirm Status */}
          <TouchableOpacity
            style={[styles.confirmBtn, { borderColor: `${stateColor}66` }]}
            onPress={handleConfirm}
            activeOpacity={0.85}
          >
            <View style={[styles.confirmGlow, { backgroundColor: `${stateColor}1F` }]} />
            <Icon name="check-circle" size={20} color={stateColor} />
            <Text style={styles.confirmText}>CONFIRM STATUS</Text>
          </TouchableOpacity>
        </ScrollView>
      </GradientBackground>
    </View>
  );
}

function SectionHeader({ label, hint }: { label: string; hint?: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {hint && <Text style={styles.sectionHint}>{hint}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background.primary },
  content: { paddingHorizontal: 20 },
  eyebrow: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    color: Colors.text.muted,
    letterSpacing: 3,
    marginBottom: 4,
    marginTop: 8,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Inter_700Bold',
    color: Colors.text.primary,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: Colors.text.secondary,
    lineHeight: 18,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 4,
  },
  sectionLabel: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    color: Colors.text.muted,
    letterSpacing: 2.5,
  },
  sectionHint: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text.secondary,
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: Colors.background.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    padding: 16,
    marginBottom: 22,
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
  scaleRow: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 12,
  },
  scaleTile: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.2)',
  },
  scaleTileSelected: {
    borderWidth: 2,
    borderColor: '#FFF',
    transform: [{ scale: 1.05 }],
  },
  scaleCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scaleLabel: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text.primary,
    letterSpacing: 0.2,
  },
  energyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 22,
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
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.5,
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
    marginBottom: 16,
    alignItems: 'center',
  },
  previewLabel: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    color: Colors.text.muted,
    letterSpacing: 2.5,
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
    fontFamily: 'Inter_700Bold',
    color: Colors.text.primary,
    letterSpacing: 1.5,
  },
});
