/**
 * HydroScan Compare Screen.
 *
 * Two-pane experience powered by `beverageComparisonEngine`:
 *   1. Picker — grid of competitor beverages (Gatorade, LMNT, Liquid I.V.,
 *      Prime, Nuun, Pedialyte, Powerade, BODYARMOR, G2, Propel, DripDrop).
 *   2. Detail — side-by-side scorecard vs AForce: per-metric scores,
 *      winner badges, weighted total, and an overall verdict pill.
 *
 * Reads strictly from `data/beverageCompetitors.ts` so adding a new brand
 * is one entry — no UI changes required.
 */

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { GradientBackground } from '@/components/GradientBackground';
import { Colors } from '@/theme/colors';
import {
  AFORCE_PROFILE,
  COMPETITORS,
  type BeverageProfile,
  type CompetitorId,
} from '@/data/beverageCompetitors';
import {
  compareBeverages,
  type ComparisonResult,
  type MetricKey,
} from '@/services/beverageComparisonEngine';

const AFORCE_ACCENT = Colors.states.PEAK.primary;
const COMPETITOR_ACCENT = Colors.states.DEPLETED.primary;
const TIE_ACCENT = Colors.text.muted;

function winnerColor(w: 'aforce' | 'competitor' | 'tie'): string {
  if (w === 'aforce') return AFORCE_ACCENT;
  if (w === 'competitor') return COMPETITOR_ACCENT;
  return TIE_ACCENT;
}

export default function HydroScanCompareScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<CompetitorId | null>(null);

  const competitor: BeverageProfile | null = useMemo(
    () => (selected ? COMPETITORS.find((c) => c.id === selected) ?? null : null),
    [selected],
  );

  const result: ComparisonResult | null = useMemo(
    () => (competitor ? compareBeverages(AFORCE_PROFILE, competitor) : null),
    [competitor],
  );

  const choose = (id: CompetitorId) => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    setSelected(id);
  };

  const reset = () => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    setSelected(null);
  };

  const topPadding = Platform.OS === 'web' ? 24 : insets.top;

  return (
    <View style={styles.root}>
      <GradientBackground>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[
            styles.content,
            { paddingTop: topPadding + 8, paddingBottom: insets.bottom + 48 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerRow}>
            <Pressable
              onPress={() => (selected ? reset() : router.back())}
              style={styles.backBtn}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={selected ? 'Pick another competitor' : 'Back'}
            >
              <Feather name="chevron-left" size={20} color={Colors.text.primary} />
            </Pressable>
            <View style={styles.headerTextWrap}>
              <Text style={styles.eyebrow}>HYDROSCAN · COMPARE</Text>
              <Text style={styles.title}>
                {selected ? 'AForce vs Competitor' : 'Pick a competitor'}
              </Text>
            </View>
          </View>

          {!result && (
            <>
              <Text style={styles.subtitle}>
                Tap any brand to see how AForce stacks up across electrolytes,
                sugar, clean ingredients, functional adders, and alkaline lift.
              </Text>
              <View style={styles.grid}>
                {COMPETITORS.map((c) => (
                  <Pressable
                    key={c.id}
                    onPress={() => choose(c.id)}
                    style={({ pressed }) => [
                      styles.tile,
                      pressed && { borderColor: AFORCE_ACCENT, backgroundColor: `${AFORCE_ACCENT}14` },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Compare AForce vs ${c.brand} ${c.product}`}
                    testID={`compete-tile-${c.id}`}
                  >
                    <Text style={styles.tileBrand} numberOfLines={1}>{c.brand}</Text>
                    <Text style={styles.tileProduct} numberOfLines={2}>{c.product}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}

          {result && (
            <ComparisonView result={result} onPickAnother={reset} />
          )}
        </ScrollView>
      </GradientBackground>
    </View>
  );
}

function ComparisonView({
  result,
  onPickAnother,
}: {
  result: ComparisonResult;
  onPickAnother: () => void;
}) {
  const { aforce, competitor, metricWinners, winner, spread } = result;
  const verdictLabel =
    winner === 'aforce' ? 'AFORCE WINS' :
    winner === 'competitor' ? `${competitor.profile.brand.toUpperCase()} WINS` :
    'TIE';
  const verdictColor = winnerColor(winner);

  return (
    <View>
      <View style={[styles.verdictCard, { borderColor: `${verdictColor}66`, backgroundColor: `${verdictColor}10` }]}>
        <Text style={[styles.verdictLabel, { color: verdictColor }]}>{verdictLabel}</Text>
        <View style={styles.verdictScores}>
          <View style={styles.verdictCol}>
            <Text style={[styles.verdictBrand, { color: AFORCE_ACCENT }]}>AForce</Text>
            <Text style={[styles.verdictScore, { color: AFORCE_ACCENT }]}>{aforce.total}</Text>
          </View>
          <Text style={styles.verdictVs}>vs</Text>
          <View style={styles.verdictCol}>
            <Text style={[styles.verdictBrand, { color: COMPETITOR_ACCENT }]} numberOfLines={1}>
              {competitor.profile.brand}
            </Text>
            <Text style={[styles.verdictScore, { color: COMPETITOR_ACCENT }]}>{competitor.total}</Text>
          </View>
        </View>
        <Text style={styles.verdictSpread}>
          {spread > 0 ? `+${spread}` : spread} point spread (weighted 0–100)
        </Text>
      </View>

      <View style={styles.profileRow}>
        <View style={[styles.profileCard, { borderColor: `${AFORCE_ACCENT}55` }]}>
          <Text style={[styles.profileBrand, { color: AFORCE_ACCENT }]}>{aforce.profile.brand}</Text>
          <Text style={styles.profileProduct}>{aforce.profile.product}</Text>
          <Text style={styles.profileTagline}>{aforce.profile.tagline}</Text>
          <Text style={styles.profileServing}>{aforce.profile.servingOz} oz serving</Text>
        </View>
        <View style={[styles.profileCard, { borderColor: `${COMPETITOR_ACCENT}55` }]}>
          <Text style={[styles.profileBrand, { color: COMPETITOR_ACCENT }]}>{competitor.profile.brand}</Text>
          <Text style={styles.profileProduct}>{competitor.profile.product}</Text>
          <Text style={styles.profileTagline}>{competitor.profile.tagline}</Text>
          <Text style={styles.profileServing}>{competitor.profile.servingOz} oz serving</Text>
        </View>
      </View>

      <Text style={styles.sectionLabel}>METRIC BREAKDOWN</Text>
      {aforce.metrics.map((aMetric) => {
        const cMetric = competitor.metrics.find((m) => m.key === aMetric.key)!;
        const w = metricWinners[aMetric.key as MetricKey];
        return (
          <View key={aMetric.key} style={styles.metricRow}>
            <View style={styles.metricHeader}>
              <Text style={styles.metricLabel}>{aMetric.label}</Text>
              <View style={[styles.winnerPill, { backgroundColor: `${winnerColor(w)}1F` }]}>
                <Text style={[styles.winnerPillText, { color: winnerColor(w) }]}>
                  {w === 'aforce' ? 'AFORCE' : w === 'competitor' ? competitor.profile.brand.toUpperCase() : 'TIE'}
                </Text>
              </View>
            </View>
            <View style={styles.metricBars}>
              <MetricBar
                label="AForce"
                score={aMetric.score}
                display={aMetric.display}
                color={AFORCE_ACCENT}
              />
              <MetricBar
                label={competitor.profile.brand}
                score={cMetric.score}
                display={cMetric.display}
                color={COMPETITOR_ACCENT}
              />
            </View>
            <Text style={styles.metricDetail}>
              <Text style={{ color: AFORCE_ACCENT }}>AForce: </Text>{aMetric.detail}
              {'\n'}
              <Text style={{ color: COMPETITOR_ACCENT }}>{competitor.profile.brand}: </Text>{cMetric.detail}
            </Text>
          </View>
        );
      })}

      <Pressable
        onPress={onPickAnother}
        style={({ pressed }) => [styles.pickAnotherBtn, pressed && { opacity: 0.7 }]}
        accessibilityRole="button"
        accessibilityLabel="Pick another competitor"
      >
        <Feather name="refresh-cw" size={14} color={Colors.text.primary} />
        <Text style={styles.pickAnotherText}>PICK ANOTHER COMPETITOR</Text>
      </Pressable>
    </View>
  );
}

function MetricBar({
  label,
  score,
  display,
  color,
}: {
  label: string;
  score: number;
  display: string;
  color: string;
}) {
  return (
    <View style={styles.metricBarWrap}>
      <View style={styles.metricBarTopRow}>
        <Text style={[styles.metricBarLabel, { color }]} numberOfLines={1}>{label}</Text>
        <Text style={[styles.metricBarScore, { color }]}>{score}</Text>
      </View>
      <View style={styles.metricBarTrack}>
        <View
          style={[
            styles.metricBarFill,
            { width: `${Math.max(2, Math.min(100, score))}%`, backgroundColor: color },
          ]}
        />
      </View>
      <Text style={styles.metricBarDisplay}>{display}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background.primary },
  content: { paddingHorizontal: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border.medium, backgroundColor: Colors.fill.light,
  },
  headerTextWrap: { flex: 1 },
  eyebrow: { fontSize: 11, letterSpacing: 1.6, color: Colors.text.muted, fontWeight: '600' },
  title: { fontSize: 24, fontWeight: '700', color: Colors.text.primary, marginTop: 2 },
  subtitle: { fontSize: 13, color: Colors.text.secondary, lineHeight: 19, marginBottom: 16 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: {
    width: '48%',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border.medium,
    backgroundColor: Colors.fill.light,
    minHeight: 78,
    justifyContent: 'center',
  },
  tileBrand: { fontSize: 13, fontWeight: '700', color: Colors.text.primary, letterSpacing: 0.4 },
  tileProduct: { fontSize: 11, color: Colors.text.muted, marginTop: 4, lineHeight: 15 },

  verdictCard: {
    borderRadius: 16, padding: 18, marginBottom: 14,
    borderWidth: 1, alignItems: 'center',
  },
  verdictLabel: { fontSize: 11, letterSpacing: 2, fontWeight: '700', marginBottom: 12 },
  verdictScores: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  verdictCol: { alignItems: 'center', minWidth: 90 },
  verdictBrand: { fontSize: 13, fontWeight: '700', letterSpacing: 0.4 },
  verdictScore: { fontSize: 38, fontWeight: '800', marginTop: 4 },
  verdictVs: { fontSize: 12, color: Colors.text.muted, fontWeight: '600' },
  verdictSpread: { fontSize: 11, color: Colors.text.muted, marginTop: 12, letterSpacing: 0.4 },

  profileRow: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  profileCard: {
    flex: 1, padding: 12, borderRadius: 12,
    borderWidth: 1, backgroundColor: Colors.fill.light,
  },
  profileBrand: { fontSize: 12, fontWeight: '700', letterSpacing: 0.4 },
  profileProduct: { fontSize: 14, fontWeight: '700', color: Colors.text.primary, marginTop: 4 },
  profileTagline: { fontSize: 11, color: Colors.text.secondary, marginTop: 6, lineHeight: 15 },
  profileServing: { fontSize: 10, color: Colors.text.muted, marginTop: 8, letterSpacing: 0.4 },

  sectionLabel: {
    fontSize: 10, letterSpacing: 1.6, color: Colors.text.muted, fontWeight: '700',
    marginBottom: 10, marginTop: 4,
  },

  metricRow: {
    padding: 14, marginBottom: 10, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border.medium, backgroundColor: Colors.fill.light,
  },
  metricHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  metricLabel: { fontSize: 13, fontWeight: '700', color: Colors.text.primary, letterSpacing: 0.3 },
  winnerPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  winnerPillText: { fontSize: 9, fontWeight: '700', letterSpacing: 1 },
  metricBars: { gap: 10 },
  metricBarWrap: {},
  metricBarTopRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  metricBarLabel: { fontSize: 11, fontWeight: '600' },
  metricBarScore: { fontSize: 11, fontWeight: '700' },
  metricBarTrack: {
    height: 6, borderRadius: 3, backgroundColor: Colors.fill.medium, overflow: 'hidden',
  },
  metricBarFill: { height: '100%', borderRadius: 3 },
  metricBarDisplay: { fontSize: 10, color: Colors.text.muted, marginTop: 3 },
  metricDetail: { fontSize: 11, color: Colors.text.secondary, marginTop: 10, lineHeight: 16 },

  pickAnotherBtn: {
    marginTop: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: 14, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border.medium, backgroundColor: Colors.fill.light,
  },
  pickAnotherText: { fontSize: 12, fontWeight: '700', color: Colors.text.primary, letterSpacing: 1.2 },
});
