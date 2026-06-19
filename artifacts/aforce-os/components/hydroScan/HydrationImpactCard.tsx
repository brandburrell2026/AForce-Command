/**
 * HydroScan 2.0™ — Hydration Impact card.
 *
 * Renders the profile-aware, 4-level hydration impact headline plus the
 * dominant drivers. Pure presentational: it reads a precomputed
 * `HydrationImpactResult` and never touches score (Score-Protection).
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Icon } from '../Icon';
import { Colors } from '@/theme/colors';
import { IMPACT_I18N_KEY, impactDriverKey } from '@/utils/impact/hydroScanCopy';
import type { HydrationImpactLevel, HydrationImpactResult } from '@/types/scan';

function levelColor(level: HydrationImpactLevel): string {
  switch (level) {
    case 'HIGH_SUPPORT':
      return Colors.states.PEAK.primary;
    case 'NEUTRAL':
      return Colors.states.BALANCED.primary;
    case 'MODERATE_IMPACT':
      return Colors.states.RECOVERING.primary;
    case 'HIGH_IMPACT':
      return Colors.states.DEPLETED.primary;
  }
}

export function HydrationImpactCard({ impact }: { impact: HydrationImpactResult }) {
  const { t } = useTranslation();
  const tint = levelColor(impact.level);
  const fillPct = Math.max(0, Math.min(100, Math.round(impact.score)));

  return (
    <View
      style={[styles.card, { borderColor: `${tint}44` }]}
      testID="hydroscan2-impact-card"
      accessible
      accessibilityLabel={`Hydration impact for you: ${t(IMPACT_I18N_KEY[impact.level])}`}
    >
      <View style={styles.header}>
        <Icon name="droplet" size={13} color={tint} />
        <Text style={styles.eyebrow}>{t('hydroScan2.impact.eyebrow')}</Text>
        {impact.lowConfidence && (
          <View style={styles.lowConf}>
            <Icon name="info" size={10} color={Colors.text.muted} />
            <Text style={styles.lowConfText}>{t('hydroScan2.impact.lowConfidence')}</Text>
          </View>
        )}
      </View>

      <Text style={[styles.level, { color: tint }]}>{t(IMPACT_I18N_KEY[impact.level])}</Text>

      <View style={styles.track}>
        <View style={[styles.fill, { width: `${fillPct}%`, backgroundColor: tint }]} />
      </View>

      {impact.drivers.length > 0 && (
        <View style={styles.drivers}>
          {impact.drivers.map((d) => {
            const supportive = d.direction === 'support';
            const c = supportive ? Colors.states.PEAK.primary : Colors.states.RECOVERING.primary;
            return (
              <View key={`${d.key}-${d.direction}`} style={[styles.chip, { borderColor: `${c}44` }]}>
                <Icon
                  name={supportive ? 'trending-up' : 'trending-down'}
                  size={10}
                  color={c}
                />
                <Text style={[styles.chipText, { color: c }]}>{t(impactDriverKey(d.key))}</Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: Colors.background.card,
    gap: 10,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  eyebrow: {
    flex: 1,
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    color: Colors.text.muted,
    letterSpacing: 1.8,
  },
  lowConf: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  lowConfText: { fontSize: 9, color: Colors.text.muted, letterSpacing: 0.4 },
  level: { fontSize: 20, fontFamily: 'Inter_700Bold', letterSpacing: -0.4 },
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.fill.light,
    overflow: 'hidden',
  },
  fill: { height: 4, borderRadius: 2 },
  drivers: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 100,
    borderWidth: 1,
  },
  chipText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
});
