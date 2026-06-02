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
import { Colors } from '@/theme/colors';
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
            <Icon name="award" size={14} color="#B6FF00" />
            <Text style={styles.winsTitle}>WIN MOMENTS</Text>
          </View>
          {winMoments.map((m) => (
            <View key={m.id} style={styles.winRow}>
              <Icon name={m.icon} size={13} color="#B6FF00" />
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
    backgroundColor: Colors.background.card,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  tileLabel: {
    color: '#9CA3AF',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 9,
    letterSpacing: 1,
  },
  tileValue: {
    color: '#FFFFFF',
    fontFamily: 'Inter_700Bold',
    fontSize: 20,
    marginTop: 6,
  },
  tileHint: {
    color: '#5C6275',
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    marginTop: 2,
    letterSpacing: 0.3,
  },
  winsCard: {
    marginTop: 14,
    backgroundColor: 'rgba(180,255,0,0.05)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(180,255,0,0.18)',
  },
  winsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  winsTitle: {
    color: '#B6FF00',
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    letterSpacing: 1.2,
  },
  winRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 5,
  },
  winText: {
    flex: 1,
    color: '#E8FFC2',
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    lineHeight: 18,
  },
});
