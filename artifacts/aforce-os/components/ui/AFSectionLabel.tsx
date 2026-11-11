/**
 * AFSectionLabel — tracked uppercase eyebrow with an optional trailing action
 * (spec §5). Used to head grouped content on operational screens.
 *
 * Black Issue: the section header is a RED mono eyebrow over a hairline, with
 * an optional right-aligned mono `meta` ("3 TODAY", "TOP 4 OF 15"). `tone`
 * 'quiet' keeps the grey eyebrow for metadata labels that are not headers;
 * `rule={false}` drops the hairline inside tight cards.
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { af, afType } from '@/theme';
import { useAFEyebrowType } from '@/hooks/useAFEyebrowType';

export interface AFSectionLabelProps {
  label: string;
  action?: { label: string; onPress: () => void };
  /** Right-aligned mono metadata (already formatted; rendered uppercase). */
  meta?: string;
  /** 'red' (default) = section header; 'quiet' = grey metadata eyebrow. */
  tone?: 'red' | 'quiet';
  /** Hairline under the row. Default true. */
  rule?: boolean;
  testID?: string;
}

export function AFSectionLabel({ label, action, meta, tone = 'red', rule = true, testID }: AFSectionLabelProps) {
  const eyebrowType = useAFEyebrowType();
  return (
    <View style={[styles.row, rule && styles.ruled]} testID={testID}>
      {/* Nested so the S2-14b yield stays `[styles.label, eyebrowType]`; the
          tone entry carries colour only. */}
      <Text
        style={[[styles.label, eyebrowType], tone === 'red' ? styles.labelRed : styles.labelQuiet]}
        accessibilityRole="header"
      >
        {label.toUpperCase()}
      </Text>
      {meta && !action && (
        <Text style={[styles.meta, eyebrowType]}>{meta.toUpperCase()}</Text>
      )}
      {action && (
        <Pressable
          onPress={action.onPress}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          hitSlop={13}
        >
          <Text style={[styles.action, eyebrowType]}>{action.label.toUpperCase()}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ruled: { paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: af.divider },
  label: { ...afType.eyebrow },
  labelRed: { color: af.redText },
  labelQuiet: { color: af.textTertiary },
  meta: { ...afType.eyebrow, color: af.textTertiary },
  action: { ...afType.eyebrow, color: af.redText },
});
