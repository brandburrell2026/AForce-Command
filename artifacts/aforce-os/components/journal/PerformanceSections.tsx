/**
 * PerformanceSections — top-of-screen strip for the Performance
 * Timeline that renders:
 *
 *   1. A horizontal scroll of 6 section summary tiles
 *      (Recovery / Heat / Hydration / Corrections / Territory / Streaks)
 *   2. A vertical "Win Moments" list of derived achievement moments
 *
 * Pure presentation — both data sets are computed by callers from
 * `services/performanceTimeline.ts`. This component knows nothing
 * about the store or the API.
 */

import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../Icon';
import { af, afType, afAlpha, withAlpha, Typography } from '@/theme';
import type {
  SectionSummary,
  WinMoment,
} from '@/services/performanceTimeline';

interface Props {
  sections: SectionSummary[];
  winMoments: WinMoment[];
}

export default function PerformanceSections({ sections, winMoments }: Props) {
  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tilesRow}
        accessibilityLabel="Performance sections"
      >
        {sections.map((s) => (
          <View key={s.key} style={styles.tile} accessibilityRole="summary">
            <Text style={styles.tileLabel}>{s.label.toUpperCase()}</Text>
            <Text style={styles.tileValue}>{s.value}</Text>
            <Text style={styles.tileHint}>{s.hint}</Text>
          </View>
        ))}
      </ScrollView>

      {winMoments.length > 0 && (
        <View style={styles.winsCard}>
          <View style={styles.winsHeader}>
            <Icon name="award" size={14} color={af.redText} />
            <Text style={styles.winsTitle}>WIN MOMENTS</Text>
          </View>
          {winMoments.map((m) => (
            <View key={m.id} style={styles.winRow}>
              <Icon name={m.icon} size={13} color={af.redText} />
              <Text style={styles.winText}>{m.text}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 14,
  },
  tilesRow: {
    gap: 10,
    paddingRight: 4,
  },
  tile: {
    width: 116,
    backgroundColor: af.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: af.divider,
  },
  tileLabel: {
    ...afType.microLabel,
    color: af.textSecondary,
    letterSpacing: 1,
  },
  tileValue: {
    ...afType.title3,
    fontFamily: Typography.fonts.bold,
    color: af.textPrimary,
    marginTop: 6,
  },
  tileHint: {
    ...afType.caption,
    color: af.textTertiary,
    marginTop: 2,
    letterSpacing: 0.3,
  },
  winsCard: {
    marginTop: 14,
    backgroundColor: withAlpha(af.red, afAlpha.a06),
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: withAlpha(af.red, afAlpha.a16),
  },
  winsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  winsTitle: {
    ...afType.eyebrow,
    color: af.redText,
    letterSpacing: 1.2,
  },
  winRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 5,
  },
  winText: {
    ...afType.caption,
    fontFamily: Typography.fonts.medium,
    flex: 1,
    color: af.textPrimary,
  },
});
