/**
 * AForce Concierge — suggested opening questions (chips).
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { af, afLayout, afType } from '@/theme';
import { useAFEyebrowType } from '@/hooks/useAFEyebrowType';

export const SUGGESTED_KEYS = ['focus', 'ritual', 'target', 'sleep', 'workout', 'tour'] as const;

export interface ConciergeSuggestedQuestionsProps {
  onPick: (text: string) => void;
  compact?: boolean;
  testID?: string;
}

export function ConciergeSuggestedQuestions({ onPick, compact, testID = 'concierge-suggested' }: ConciergeSuggestedQuestionsProps) {
  const { t } = useTranslation();
  const eyebrowType = useAFEyebrowType();
  const chips = SUGGESTED_KEYS.map((k) => ({ key: k, text: t(`concierge.suggested.${k}`) }));
  const body = chips.map((c) => (
    <Pressable
      key={c.key}
      onPress={() => onPick(c.text)}
      accessibilityRole="button"
      accessibilityLabel={c.text}
      style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
      testID={`${testID}-${c.key}`}
    >
      <Text style={styles.chipText}>{c.text}</Text>
    </Pressable>
  ));
  return (
    <View style={styles.wrap} testID={testID}>
      <Text style={[styles.label, eyebrowType]}>{t('concierge.suggested_label').toUpperCase()}</Text>
      {compact ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
          {body}
        </ScrollView>
      ) : (
        <View style={styles.grid}>{body}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  label: { ...afType.eyebrow, color: af.textTertiary },
  grid: { gap: 8 },
  rail: { gap: 8, paddingRight: afLayout.screenPaddingX },
  chip: {
    minHeight: afLayout.controlMinHeight,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: af.surface,
    borderWidth: afLayout.hairline,
    borderColor: af.border,
  },
  chipPressed: { backgroundColor: af.surfacePressed },
  chipText: { ...afType.secondary, color: af.textPrimary },
});
