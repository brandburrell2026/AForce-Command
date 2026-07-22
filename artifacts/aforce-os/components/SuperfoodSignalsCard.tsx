/**
 * SuperfoodSignalsCard — surfaces the "SUPERFOOD SIGNALS ACTIVE"
 * block on the HydroScan result screen when the scanned product is
 * an AForce SKU.
 *
 * Renders:
 *   • Header  — "SUPERFOOD SIGNALS ACTIVE"
 *   • Chips   — Mineral / Recovery / Electrolyte Efficiency /
 *               Cellular Hydration / Performance
 *   • CTA     — "TAP TO LEARN WHY"   (expands the education layer)
 *   • Education layer (collapsible) — seamoss, dulse, chlorella,
 *               mineral support, balanced hydration support, the
 *               AForce positioning line, and the canonical
 *               sodium-balance note.
 *
 * Pure presentation. All copy comes from
 * `utils/superfoodSignals.ts`, which is guarded by a
 * compliant-language regression test (no cures / treats / prevents
 * disease wording, no framing sodium as bad). Do not hand-author
 * copy in this component — read it from the block.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Icon } from './Icon';
import { Colors } from '@/theme/colors';
import type { SuperfoodSignalsBlock } from '@/utils/superfoodSignals';

interface Props {
  block: SuperfoodSignalsBlock;
}

export function SuperfoodSignalsCard({ block }: Props) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const accent = Colors.accent.primary;

  return (
    <View style={styles.card} testID="superfood-signals-card">
      <View style={styles.headerRow}>
        <Icon name="target" size={12} color={accent} />
        <Text style={[styles.eyebrow, { color: accent }]}>{block.header}</Text>
      </View>

      <View style={styles.chipRow} accessibilityLabel={t('hydroScan2.cards.superfood_a11y')}>
        {block.signals.map((s) => (
          <View
            key={s.key}
            style={[styles.chip, { borderColor: `${accent}55` }]}
            testID={`superfood-chip-${s.key}`}
          >
            <Text style={styles.chipText} numberOfLines={1}>
              {s.label}
            </Text>
          </View>
        ))}
      </View>

      <Pressable
        onPress={() => setExpanded((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        testID="superfood-learn-cta"
        style={({ pressed }) => [styles.cta, { opacity: pressed ? 0.7 : 1 }]}
      >
        <Text style={[styles.ctaText, { color: accent }]}>{block.learnCta}</Text>
        <Icon
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={12}
          color={accent}
        />
      </Pressable>

      {expanded && (
        <View style={styles.educationWrap} testID="superfood-education">
          <Text style={styles.positioning}>{block.positioning}</Text>
          {block.education.map((entry) => (
            <View
              key={entry.key}
              style={styles.educationEntry}
              testID={`superfood-edu-${entry.key}`}
            >
              <Text style={styles.educationTitle}>{entry.title}</Text>
              <Text style={styles.educationBody}>{entry.body}</Text>
            </View>
          ))}
          <View style={[styles.sodiumNote, { borderColor: `${accent}55` }]}>
            <Text style={styles.sodiumText}>{block.sodiumNote}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    backgroundColor: Colors.fill.light,
    gap: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  eyebrow: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: Colors.fill.medium,
  },
  chipText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.3,
    color: Colors.text.primary,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 2,
  },
  ctaText: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.6,
  },
  educationWrap: {
    gap: 10,
    paddingTop: 6,
  },
  positioning: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: 'Inter_500Medium',
    color: Colors.text.primary,
  },
  educationEntry: {
    gap: 3,
  },
  educationTitle: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.4,
    color: Colors.text.primary,
  },
  educationBody: {
    fontSize: 12,
    lineHeight: 17,
    fontFamily: 'Inter_400Regular',
    color: Colors.text.secondary,
  },
  sodiumNote: {
    marginTop: 4,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: Colors.fill.medium,
  },
  sodiumText: {
    fontSize: 12,
    lineHeight: 17,
    fontFamily: 'Inter_500Medium',
    color: Colors.text.primary,
  },
});
