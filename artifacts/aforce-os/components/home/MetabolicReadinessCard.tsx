/**
 * MetabolicReadinessCard — presentational Athlete-tier surface showing two
 * display-only wellness ESTIMATES (Muscle + Cognitive readiness) on the
 * Home screen.
 *
 * Pure / presentational: it renders whatever readiness values it is handed
 * and never reads or writes a store. The values are a one-directional
 * projection of the hydration + recovery engines (see
 * services/metabolicReadinessService) — nothing here can change a score.
 *
 * Two states:
 *   • entitled   → live Muscle + Cognitive readiness (band-colored), with
 *                  an honest "needs more data" row when a signal is absent.
 *   • locked     → a teaser + "unlock with Athlete" CTA (→ onUpgrade).
 *
 * A medical disclaimer is ALWAYS visible: these are wellness estimates,
 * not medical measurements.
 */

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Colors } from '@/theme/colors';
import { accentForLevel } from '@/utils/scoreBand';
import type { MetabolicReadiness } from '@/utils/metabolicScore';

const BRAND = Colors.accent.brand;
const DISCLAIMER = 'Wellness estimate — not a medical measurement.';

interface Props {
  entitled: boolean;
  muscle: MetabolicReadiness;
  cognitive: MetabolicReadiness;
  /** Routes the user to the Athlete upgrade flow. */
  onUpgrade: () => void;
}

function ProBadge() {
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>PRO</Text>
    </View>
  );
}

function MetricRow({
  label,
  readiness,
  divider,
}: {
  label: string;
  readiness: MetabolicReadiness;
  divider?: boolean;
}) {
  const hasData =
    readiness.hasEnoughData && readiness.score != null && readiness.band != null;
  const tint = hasData ? accentForLevel(readiness.band!).primary : Colors.text.muted;
  return (
    <>
      {divider ? <View style={styles.divider} /> : null}
      <View style={styles.metricRow}>
        <Text style={styles.metricLabel}>{label}</Text>
        {hasData ? (
          <View style={styles.metricRight}>
            <Text style={[styles.metricScore, { color: tint }]}>{readiness.score}</Text>
            <Text style={[styles.metricBand, { color: tint }]}>{readiness.band}</Text>
          </View>
        ) : (
          <Text style={styles.metricEmpty}>Needs more data</Text>
        )}
      </View>
    </>
  );
}

export function MetabolicReadinessCard({ entitled, muscle, cognitive, onUpgrade }: Props) {
  return (
    <View style={styles.card} testID="home-metabolic-card">
      <View style={styles.header}>
        <Text style={styles.eyebrow}>METABOLIC READINESS</Text>
        <ProBadge />
      </View>

      {entitled ? (
        <View testID="home-metabolic-live">
          <MetricRow label="MUSCLE" readiness={muscle} />
          <MetricRow label="COGNITIVE" readiness={cognitive} divider />
        </View>
      ) : (
        <TouchableOpacity
          onPress={onUpgrade}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Unlock Metabolic Readiness with AForce Athlete"
          testID="home-metabolic-locked"
          style={styles.lockedBtn}
        >
          <Icon name="lock" size={15} color={BRAND} />
          <Text style={styles.lockedText}>UNLOCK WITH ATHLETE</Text>
        </TouchableOpacity>
      )}

      {!entitled ? (
        <Text style={styles.teaser}>
          Muscle + cognitive readiness, derived from your hydration, recovery, sleep & HRV.
        </Text>
      ) : null}

      <Text style={styles.disclaimer}>{DISCLAIMER}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.07)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    paddingVertical: 18,
    paddingHorizontal: 18,
    marginBottom: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  eyebrow: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    letterSpacing: 2.5,
    color: BRAND,
  },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.accent.brandGlow,
    backgroundColor: Colors.accent.brandSubtle,
  },
  badgeText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
    letterSpacing: 1.5,
    color: BRAND,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metricLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    letterSpacing: 0.6,
    color: Colors.text.muted,
  },
  metricRight: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  metricScore: {
    fontFamily: 'Inter_700Bold',
    fontSize: 26,
    letterSpacing: -0.8,
  },
  metricBand: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    letterSpacing: 1.2,
  },
  metricEmpty: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    letterSpacing: 0.2,
    color: Colors.text.muted,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.07)',
    marginVertical: 13,
  },
  lockedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 13,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.accent.brandGlow,
    backgroundColor: Colors.accent.brandSubtle,
  },
  lockedText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
    letterSpacing: 1.5,
    color: BRAND,
  },
  teaser: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 17,
    color: Colors.text.secondary,
    marginTop: 12,
  },
  disclaimer: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    letterSpacing: 0.2,
    color: Colors.text.muted,
    marginTop: 14,
  },
});
