/**
 * PersonalResponseLibraryCard — Section 59 read-only surface for the Adaptive
 * Response Engine™'s Personal Response Library.
 *
 * Projects the pure `useAdaptiveResponse` profile (derived from the append-only
 * Command-Event Ledger) into a human-readable, cause-and-effect read-out: per
 * ready category, What Worked + Confidence After Action. Categories without
 * enough real signal are simply not shown (no fabrication); when none are ready
 * it shows a neutral empty state.
 *
 * Language rule: every string comes from the `adaptiveResponse.*` i18n keys,
 * which are asserted cause-and-effect only (never risk / injury / diagnosis /
 * prevent) by responseCopy's locale-guard test.
 *
 * Score-Protection: display ONLY. It dispatches nothing into the hydration
 * reducer and never reads-into, awards, mutates, or fabricates score. Mounted
 * behind `adaptive_response_enabled`; self-contained so it drops into the
 * existing Profile settings card without adding navigation (build lock).
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { Colors } from '@/theme/colors';
import i18n from '@/services/i18nService';
import { useAdaptiveResponse } from '@/hooks/useAdaptiveResponse';
import { describeResponse } from '@/utils/intelligence/responseCopy';
import { RESPONSE_CATEGORIES } from '@/types/adaptiveResponse';

export function PersonalResponseLibraryCard() {
  const profile = useAdaptiveResponse();
  const ready = RESPONSE_CATEGORIES.map((c) => profile[c]).filter((e) => e.status === 'ready');

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{i18n.t('adaptiveResponse.title')}</Text>
      <Text style={styles.subtitle}>{i18n.t('adaptiveResponse.subtitle')}</Text>

      {ready.length === 0 ? (
        <Text style={styles.empty}>{i18n.t('adaptiveResponse.empty')}</Text>
      ) : (
        ready.map((entry) => {
          const d = describeResponse(entry);
          const category = i18n.t(d.categoryLabelKey);
          return (
            <View key={entry.category} style={styles.row}>
              <Text style={styles.line}>
                {i18n.t(d.lineKey, { category, pct: d.followedPct ?? 0 })}
              </Text>
              {d.confidencePct !== null ? (
                <Text style={styles.confidence}>
                  {i18n.t('adaptiveResponse.confidence_label')} · {d.confidencePct}%
                </Text>
              ) : null}
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.background.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    padding: 16,
    gap: 6,
  },
  title: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    color: Colors.text.primary,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.text.secondary,
    lineHeight: 17,
    marginBottom: 6,
  },
  empty: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.text.muted,
    lineHeight: 17,
  },
  row: {
    borderTopWidth: 1,
    borderTopColor: Colors.border.subtle,
    paddingTop: 10,
    marginTop: 4,
    gap: 3,
  },
  line: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: Colors.text.primary,
    lineHeight: 17,
  },
  confidence: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text.muted,
    letterSpacing: 0.5,
  },
});
