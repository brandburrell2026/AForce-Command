/**
 * Comparison Screen — real-time AI-driven product comparison.
 *
 * Reads engineOutput + userState from the store and recomputes the ranking
 * any time state changes. Surfaces a final command tied to the winner.
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';

import { GradientBackground } from '@/components/GradientBackground';
import { ComparisonList } from '@/components/ComparisonList';
import { useAppStore } from '@/store/useAppStore';
import { computeComparison, inferInputs } from '@/services/comparisonEngine';
import { Colors } from '@/theme/colors';

export default function ComparisonScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { state } = useAppStore();
  const { engineOutput, userState } = state;

  const [mode, setMode] = React.useState<'why' | 'full'>('full');

  const output = React.useMemo(() => {
    const inputs = inferInputs(engineOutput, userState);
    return computeComparison({ inputs });
  }, [engineOutput, userState]);

  const hasWinner = !!output.winner;
  const winnerAccent = output.winner?.product.isAForce
    ? Colors.states.PEAK.primary
    : Colors.states.BALANCED.primary;

  const topPadding = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPadding = Platform.OS === 'web' ? 34 : insets.bottom + 24;

  return (
    <View style={styles.root}>
      <GradientBackground>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingTop: topPadding + 8, paddingBottom: bottomPadding + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.headerRow}>
            <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
              <Feather name="chevron-left" size={22} color={Colors.text.primary} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>REAL-TIME DECISION</Text>
              <Text style={styles.title}>Compare Options</Text>
            </View>
            <View style={[styles.statePill, { borderColor: `${winnerAccent}55` }]}>
              <Text style={[styles.statePillText, { color: winnerAccent }]}>
                {output.inputs.protocol.replace(/_/g, ' ').toUpperCase()}
              </Text>
            </View>
          </View>

          {/* Best option (or empty fallback) */}
          {hasWinner ? (
            <View style={[styles.winnerBox, { borderColor: `${winnerAccent}55`, backgroundColor: `${winnerAccent}0E` }]}>
              <Text style={styles.winnerEyebrow}>BEST OPTION RIGHT NOW</Text>
              <Text style={[styles.winnerName, { color: Colors.text.primary }]}>{output.winner!.product.name}</Text>
              <View style={styles.winnerScoreRow}>
                <Text style={[styles.winnerScore, { color: winnerAccent }]}>{output.winner!.fitScore}</Text>
                <Text style={styles.winnerScoreLabel}>FIT SCORE</Text>
              </View>
              <Text style={styles.winnerCmd}>{output.command.action}</Text>
              <Text style={styles.winnerExpl}>{output.command.explanation}</Text>
            </View>
          ) : (
            <View style={[styles.winnerBox, { borderColor: Colors.border.subtle }]}>
              <Text style={styles.winnerEyebrow}>NO PRODUCTS AVAILABLE</Text>
              <Text style={[styles.winnerName, { color: Colors.text.primary }]}>Baseline hydration</Text>
              <Text style={styles.winnerCmd}>{output.command.action}</Text>
              <Text style={styles.winnerExpl}>{output.command.explanation}</Text>
            </View>
          )}

          {/* Mode toggle */}
          <View style={styles.toggleRow}>
            <ToggleBtn label="Why AForce Wins" active={mode === 'why'} onPress={() => setMode('why')} />
            <ToggleBtn label="Full Comparison" active={mode === 'full'} onPress={() => setMode('full')} />
          </View>

          {/* List */}
          <ComparisonList results={output.results} whyAForceWins={mode === 'why'} />

          {/* Footer note */}
          <Text style={styles.footnote}>
            Re-ranks in real time based on your performance state, protocol, and environment.
          </Text>
        </ScrollView>
      </GradientBackground>
    </View>
  );
}

function ToggleBtn({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.toggleBtn, active && styles.toggleBtnActive]}
    >
      <Text style={[styles.toggleBtnText, active && styles.toggleBtnTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background.primary },
  scroll: { flex: 1 },
  content: {},
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingBottom: 12,
    gap: 10,
  },
  back: {
    width: 32, height: 32, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: Colors.fill.light,
  },
  eyebrow: { fontSize: 10, fontFamily: 'Inter_700Bold', color: Colors.text.muted, letterSpacing: 2.5 },
  title: { fontSize: 22, fontFamily: 'Inter_700Bold', color: Colors.text.primary, letterSpacing: -0.6, marginTop: 2 },
  statePill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100, borderWidth: 1 },
  statePillText: { fontSize: 9, fontFamily: 'Inter_700Bold', letterSpacing: 1.5 },

  winnerBox: {
    marginHorizontal: 20, marginTop: 4, marginBottom: 16,
    padding: 18, borderRadius: 20, borderWidth: 1.5,
  },
  winnerEyebrow: { fontSize: 10, fontFamily: 'Inter_700Bold', color: Colors.text.muted, letterSpacing: 2 },
  winnerName: { fontSize: 22, fontFamily: 'Inter_700Bold', marginTop: 6, letterSpacing: -0.4 },
  winnerScoreRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 6, marginBottom: 12 },
  winnerScore: { fontSize: 44, fontFamily: 'Inter_700Bold', letterSpacing: -2 },
  winnerScoreLabel: { fontSize: 10, fontFamily: 'Inter_700Bold', color: Colors.text.muted, letterSpacing: 1.5 },
  winnerCmd: { fontSize: 15, fontFamily: 'Inter_700Bold', color: Colors.text.primary, lineHeight: 21 },
  winnerExpl: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.text.secondary, lineHeight: 17, marginTop: 6 },

  toggleRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 14,
    backgroundColor: Colors.background.card,
    borderRadius: 100,
    padding: 4,
  },
  toggleBtn: { flex: 1, paddingVertical: 9, borderRadius: 100, alignItems: 'center' },
  toggleBtnActive: { backgroundColor: Colors.fill.strong },
  toggleBtnText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: Colors.text.muted, letterSpacing: 0.5 },
  toggleBtnTextActive: { color: Colors.text.primary },

  footnote: {
    fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.text.muted,
    textAlign: 'center', paddingHorizontal: 28, marginTop: 16, lineHeight: 16,
  },
});
