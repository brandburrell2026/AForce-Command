/**
 * AFSegmentedControl — horizontal, scrollable segment switcher (spec §5,
 * Phase 3). Used for multi-section hubs like Community (Rankings / Challenges /
 * Battles / Teams / Map). The active segment carries the red accent; the rail
 * scrolls when segments overflow the width.
 */
import React from 'react';
import { ScrollView, Pressable, Text, StyleSheet } from 'react-native';
import { af, afType } from '@/theme';

export interface AFSegment {
  key: string;
  label: string;
}

export interface AFSegmentedControlProps {
  segments: AFSegment[];
  value: string;
  onChange: (key: string) => void;
  testID?: string;
}

export function AFSegmentedControl({ segments, value, onChange, testID }: AFSegmentedControlProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.rail}
      testID={testID}
    >
      {segments.map((seg) => {
        const active = seg.key === value;
        return (
          <Pressable
            key={seg.key}
            onPress={() => onChange(seg.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={seg.label}
            style={[styles.pill, active ? styles.pillActive : styles.pillIdle]}
          >
            <Text style={[styles.label, { color: active ? af.onRed : af.textSecondary }]}>
              {seg.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  rail: { gap: 8, paddingVertical: 2 },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 9999,
    borderWidth: 1,
  },
  pillActive: { backgroundColor: af.red, borderColor: af.red },
  pillIdle: { backgroundColor: 'transparent', borderColor: af.border },
  label: { ...afType.caption },
});
