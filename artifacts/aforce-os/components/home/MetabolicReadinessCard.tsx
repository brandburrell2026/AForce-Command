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
import { af, afType, afAlpha, withAlpha } from '@/theme';
import { accentForLevel } from '@/utils/scoreBand';
import type { MetabolicReadiness } from '@/utils/metabolicScore';
import { AFStatPair } from '@/components/ui/AFStatPair';

// Brand red splits by role under VS 3.0: AA-clean `af.redText` for text/icons,
// `af.red` (fills-only) behind `withAlpha` for the badge / CTA surfaces.
const BRAND_TEXT = af.redText;
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
  const tint = hasData ? accentForLevel(readiness.band!).primary : af.textTertiary;
  return (
    <>
      {divider ? <View style={styles.divider} /> : null}
      {hasData ? (
        <AFStatPair
          label={label}
          value={readiness.score as number}
          unit={readiness.band as string}
          unitLayout="adjacent"
          style={styles.metricRow}
          labelStyle={styles.metricLabel}
          valueStyle={[styles.metricScore, { color: tint }]}
          unitStyle={[styles.metricBand, { color: tint }]}
          valueGroupStyle={styles.metricRight}
        />
      ) : (
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>{label}</Text>
          <Text style={styles.metricEmpty}>Needs more data</Text>
        </View>
      )}
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
          <Icon name="lock" size={15} color={BRAND_TEXT} />
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
    borderColor: af.divider,
    backgroundColor: af.surface,
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
    ...afType.eyebrow,
    color: BRAND_TEXT,
  },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: withAlpha(af.red, afAlpha.a50),
    backgroundColor: withAlpha(af.red, afAlpha.a06),
  },
  badgeText: {
    ...afType.microLabel,
    letterSpacing: 1.5,
    color: BRAND_TEXT,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metricLabel: {
    ...afType.tab,
    letterSpacing: 0.6,
    color: af.textTertiary,
  },
  metricRight: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  metricScore: {
    ...afType.title2,
    letterSpacing: -0.8,
  },
  metricBand: {
    ...afType.microLabel,
    letterSpacing: 1.2,
  },
  metricEmpty: {
    ...afType.caption,
    color: af.textTertiary,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: af.divider,
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
    borderColor: withAlpha(af.red, afAlpha.a50),
    backgroundColor: withAlpha(af.red, afAlpha.a06),
  },
  lockedText: {
    ...afType.microLabel,
    letterSpacing: 1.5,
    color: BRAND_TEXT,
  },
  teaser: {
    ...afType.caption,
    color: af.textSecondary,
    marginTop: 12,
  },
  disclaimer: {
    ...afType.caption,
    color: af.textTertiary,
    marginTop: 14,
  },
});
