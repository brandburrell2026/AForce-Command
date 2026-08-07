/**
 * Segmented control for the Journal range picker (7d / 30d / 90d).
 */

import React, { useCallback } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { af, afType, Typography } from '@/theme';

export type JournalRange = 7 | 30 | 90;

interface Props {
  value: JournalRange;
  onChange: (next: JournalRange) => void;
}

const RANGES: JournalRange[] = [7, 30, 90];

export default function JournalRangePicker({ value, onChange }: Props) {
  const { t } = useTranslation();
  // Selection tick when switching range; no-op when the user taps the
  // already-active cell so haptics never fire without a real change.
  const handlePress = useCallback(
    (next: JournalRange) => {
      if (next === value) return;
      if (Platform.OS !== 'web') {
        Haptics.selectionAsync().catch(() => {});
      }
      onChange(next);
    },
    [value, onChange],
  );
  return (
    <View style={styles.container} accessibilityRole="radiogroup">
      {RANGES.map((r) => {
        const active = r === value;
        return (
          <Pressable
            key={r}
            onPress={() => handlePress(r)}
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
    backgroundColor: af.surface,
    borderRadius: 999,
    padding: 4,
    borderWidth: 1,
    borderColor: af.divider,
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
    backgroundColor: af.red,
  },
  label: {
    ...afType.caption,
    fontFamily: Typography.fonts.semibold,
    color: af.textTertiary,
    letterSpacing: 0.6,
  },
  labelActive: {
    // Dark ink on the Signal-Red active pill (preserves the inverted-chip look).
    color: af.canvas,
  },
});
