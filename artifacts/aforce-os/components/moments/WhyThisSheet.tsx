/**
 * WhyThisSheet — the Moments "WHY THIS?" disclosure. Renders the
 * recommendation's fail-closed Evidence Engine payload: one plain-language
 * summary plus the real signal lines that actually drove the preparation.
 * No algorithm names, no medical language, no scores (founder constraints).
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AFDisclosureSheet } from '@/components/ui';
import { af, afType } from '@/theme';
import type { MomentRecommendation } from '@/types/moments';

export function WhyThisSheet({
  rec,
  visible,
  onClose,
}: {
  rec: MomentRecommendation;
  visible: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <AFDisclosureSheet visible={visible} onClose={onClose} title={t('moments.why_this')} testID="moments-why-sheet">
      <Text style={styles.summary}>{t(rec.evidence.summaryKey, rec.evidence.summaryParams)}</Text>
      <View style={styles.items}>
        {rec.evidence.items.map((item) => (
          <View key={item.key} style={styles.item}>
            <View style={styles.dot} />
            <Text style={styles.itemText}>{t(item.labelKey, item.labelParams)}</Text>
          </View>
        ))}
      </View>
    </AFDisclosureSheet>
  );
}

const styles = StyleSheet.create({
  summary: { ...afType.body, color: af.textPrimary, lineHeight: 24 },
  items: { marginTop: 16, gap: 10 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: af.green },
  itemText: { ...afType.caption, color: af.textSecondary, flex: 1 },
});
