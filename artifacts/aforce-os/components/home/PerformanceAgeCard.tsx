/**
 * PerformanceAgeCard — presentational Home surface for the Performance Age™
 * headline estimate.
 *
 * Pure / presentational: it renders whatever snapshot it is handed and
 * never reads or writes a store. The values are a one-directional
 * projection of the hydration + recovery engines and the analytics layer
 * (see services/performanceAgeService) — nothing here can change a score.
 *
 * States (all carry the required disclaimer):
 *   • missing-age   → prompt to add birth year (no number).
 *   • provisional   → number with a PROVISIONAL badge (or "collecting" when
 *                     no behaviour signal exists yet).
 *   • established   → number, band-tinted, with weekly/monthly trend rows.
 *
 * The medical/biological disclaimer is ALWAYS visible.
 */

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Colors } from '@/theme/colors';
import { accentForLevel } from '@/utils/scoreBand';
import {
  PERFORMANCE_AGE_DISCLAIMER,
  type PerformanceAgeResult,
  type PerformanceAgeTrend,
} from '@/utils/performanceAge';

const BRAND = Colors.accent.brand;

interface Props {
  result: PerformanceAgeResult;
  weeklyTrend: PerformanceAgeTrend;
  monthlyTrend: PerformanceAgeTrend;
  /** Routes the user to the profile to add their birth year. */
  onAddProfile: () => void;
}

function ProvisionalBadge() {
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>PROVISIONAL</Text>
    </View>
  );
}

/** Neutral, non-medical caption comparing performance age to actual age. */
function deltaCaption(yearsDelta: number): string {
  if (yearsDelta === 0) return 'On par with your actual age';
  const n = Math.abs(yearsDelta);
  const unit = n === 1 ? 'year' : 'years';
  return yearsDelta < 0
    ? `${n} ${unit} younger than your age`
    : `${n} ${unit} above your age`;
}

function trendText(trend: PerformanceAgeTrend): string {
  if (!trend.available || trend.deltaYears == null) return 'Collecting…';
  if (trend.direction === 'steady') return 'Steady';
  const n = Math.abs(trend.deltaYears);
  const unit = n === 1 ? 'yr' : 'yrs';
  return trend.direction === 'younger' ? `▼ ${n} ${unit}` : `▲ ${n} ${unit}`;
}

function trendTint(trend: PerformanceAgeTrend): string {
  if (!trend.available || trend.direction === 'steady') return Colors.text.muted;
  return trend.direction === 'younger'
    ? accentForLevel('PEAK').primary
    : accentForLevel('DEPLETED').primary;
}

function TrendRow({
  label,
  trend,
}: {
  label: string;
  trend: PerformanceAgeTrend;
}) {
  return (
    <View style={styles.trendCol}>
      <Text style={styles.trendLabel}>{label}</Text>
      <Text style={[styles.trendValue, { color: trendTint(trend) }]}>
        {trendText(trend)}
      </Text>
    </View>
  );
}

export function PerformanceAgeCard({
  result,
  weeklyTrend,
  monthlyTrend,
  onAddProfile,
}: Props) {
  const tint = result.band ? accentForLevel(result.band).primary : Colors.text.primary;

  return (
    <View style={styles.card} testID="home-performance-age-card">
      <View style={styles.header}>
        <Text style={styles.eyebrow}>PERFORMANCE AGE</Text>
        {result.provisional ? <ProvisionalBadge /> : null}
      </View>

      {result.status === 'missing-age' ? (
        <TouchableOpacity
          onPress={onAddProfile}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Add your birth year to unlock Performance Age"
          testID="home-performance-age-missing"
          style={styles.promptBtn}
        >
          <Icon name="user" size={15} color={BRAND} />
          <Text style={styles.promptText}>ADD BIRTH YEAR TO UNLOCK</Text>
        </TouchableOpacity>
      ) : result.performanceAge == null ? (
        <Text style={styles.collecting} testID="home-performance-age-collecting">
          Collecting your signals — your Performance Age appears once there's
          enough recent behaviour to estimate it.
        </Text>
      ) : (
        <View testID="home-performance-age-value">
          <View style={styles.valueRow}>
            <Text style={[styles.value, { color: tint }]}>{result.performanceAge}</Text>
            <Text style={styles.valueUnit}>YRS</Text>
          </View>
          {result.yearsDelta != null ? (
            <Text style={styles.caption}>{deltaCaption(result.yearsDelta)}</Text>
          ) : null}

          <View style={styles.trends}>
            <TrendRow label="7-DAY" trend={weeklyTrend} />
            <View style={styles.trendDivider} />
            <TrendRow label="30-DAY" trend={monthlyTrend} />
          </View>
        </View>
      )}

      <Text style={styles.disclaimer}>{PERFORMANCE_AGE_DISCLAIMER}</Text>
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
    marginBottom: 14,
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
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  value: {
    fontFamily: 'Inter_700Bold',
    fontSize: 52,
    letterSpacing: -1.5,
  },
  valueUnit: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    letterSpacing: 2,
    color: Colors.text.muted,
  },
  caption: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    letterSpacing: 0.2,
    color: Colors.text.secondary,
    marginTop: 4,
  },
  trends: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  trendCol: { flex: 1 },
  trendLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 10,
    letterSpacing: 1.4,
    color: Colors.text.muted,
    marginBottom: 4,
  },
  trendValue: {
    fontFamily: 'Inter_700Bold',
    fontSize: 15,
    letterSpacing: 0.4,
  },
  trendDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(255,255,255,0.07)',
    marginHorizontal: 14,
  },
  promptBtn: {
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
  promptText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
    letterSpacing: 1.5,
    color: BRAND,
  },
  collecting: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 17,
    color: Colors.text.secondary,
  },
  disclaimer: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    letterSpacing: 0.2,
    lineHeight: 14,
    color: Colors.text.muted,
    marginTop: 14,
  },
});
