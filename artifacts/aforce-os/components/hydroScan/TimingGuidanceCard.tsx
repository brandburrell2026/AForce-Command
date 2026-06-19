/**
 * HydroScan 2.0™ — Timing Guidance card.
 *
 * Renders the 3-level "when to take it" guidance. Pure presentational —
 * reads a precomputed `TimingGuidanceResult`; advisory only, never scores.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Icon } from '../Icon';
import { Colors } from '@/theme/colors';
import { TIMING_I18N_KEY } from '@/utils/impact/hydroScanCopy';
import type { TimingGuidanceLevel, TimingGuidanceResult } from '@/types/scan';

function timingTint(level: TimingGuidanceLevel): string {
  switch (level) {
    case 'GOOD_TIMING':
      return Colors.states.PEAK.primary;
    case 'HYDRATE_FIRST':
      return Colors.states.BALANCED.primary;
    case 'BEST_AFTER_NEXT_WATER_CYCLE':
      return Colors.states.RECOVERING.primary;
  }
}

export function TimingGuidanceCard({ timing }: { timing: TimingGuidanceResult }) {
  const { t } = useTranslation();
  const tint = timingTint(timing.level);

  return (
    <View
      style={[styles.row, { borderColor: `${tint}44` }]}
      testID="hydroscan2-timing-card"
      accessible
      accessibilityLabel={`Timing: ${t(TIMING_I18N_KEY[timing.level])}`}
    >
      <Icon name="clock" size={14} color={tint} />
      <View style={{ flex: 1 }}>
        <Text style={styles.eyebrow}>{t('hydroScan2.timing.eyebrow')}</Text>
        <Text style={[styles.value, { color: tint }]}>{t(TIMING_I18N_KEY[timing.level])}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: Colors.fill.light,
  },
  eyebrow: {
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    color: Colors.text.muted,
    letterSpacing: 1.8,
  },
  value: { fontSize: 14, fontFamily: 'Inter_600SemiBold', marginTop: 2 },
});
