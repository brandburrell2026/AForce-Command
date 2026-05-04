/**
 * Segmented control for the Journal range picker (7d / 30d / 90d).
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Colors } from '@/theme/colors';

export type JournalRange = 7 | 30 | 90;

interface Props {
  value: JournalRange;
  onChange: (next: JournalRange) => void;
}

const RANGES: JournalRange[] = [7, 30, 90];

export default function JournalRangePicker({ value, onChange }: Props) {
  const { t } = useTranslation();
  return (
    <View style={styles.container} accessibilityRole="radiogroup">
      {RANGES.map((r) => {
        const active = r === value;
        return (
          <Pressable
            key={r}
            onPress={() => onChange(r)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            style={[styles.cell, active && styles.cellActive]}
          >
            <Text style={[styles.label, active && styles.labelActive]}>
              {t(`journal.range_${r}` as const)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: Colors.background.card,
    borderRadius: 999,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignSelf: 'flex-start',
  },
  cell: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 999,
    minWidth: 56,
    alignItems: 'center',
  },
  cellActive: {
    backgroundColor: '#B6FF00',
  },
  label: {
    color: '#9CA3AF',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    letterSpacing: 0.6,
  },
  labelActive: {
    color: '#0A0A1E',
  },
});
