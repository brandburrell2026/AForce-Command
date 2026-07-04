/**
 * ResponseTimelineCard — Section 60 read-only surface for the Response Timeline.
 *
 * The timeline is gated by a data-maturity threshold (~60 days of personal
 * history). Until then — which is every user pre-launch — it shows a solid,
 * honest "collecting" state with real progress toward the threshold, never a
 * fabricated trend. Once mature, it renders a compact newest-first weekly
 * summary of per-category response activity.
 *
 * Score-Protection: display ONLY. Reads the Command-Event Ledger through the
 * pure Section 60 query layer; dispatches nothing and never touches score.
 * Mounted behind `response_timeline_enabled`; self-contained, no new navigation.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { Colors } from '@/theme/colors';
import i18n from '@/services/i18nService';
import { useResponseTimeline } from '@/hooks/useResponseTimeline';
import { RESPONSE_TIMELINE_MIN_DATA_DAYS } from '@/config/hydroStateModel';
import { RESPONSE_CATEGORIES, type ResponseCategory } from '@/types/adaptiveResponse';
import type { ResponseTimelineBucket } from '@/utils/intelligence/responseTimeline';

function activeCategories(bucket: ResponseTimelineBucket): ResponseCategory[] {
  return RESPONSE_CATEGORIES.filter((c) => bucket.perCategory[c] !== undefined);
}

function weekLabel(index: number): string {
  return index === 0
    ? i18n.t('responseTimeline.week_current')
    : i18n.t('responseTimeline.week_ago', { count: index });
}

export function ResponseTimelineCard() {
  const { timeline, ready, daysOfData } = useResponseTimeline();

  if (!ready) {
    const pct = Math.min(100, Math.max(0, Math.round((daysOfData / RESPONSE_TIMELINE_MIN_DATA_DAYS) * 100)));
    return (
      <View style={styles.card}>
        <Text style={styles.title}>{i18n.t('responseTimeline.title')}</Text>
        <View style={styles.collectHead}>
          <Text style={styles.collectTitle}>{i18n.t('responseTimeline.collecting_title')}</Text>
          <Text style={styles.collectCount}>
            {daysOfData} / {RESPONSE_TIMELINE_MIN_DATA_DAYS}d
          </Text>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.max(2, pct)}%` }]} />
        </View>
        <Text style={styles.collecting}>
          {i18n.t('responseTimeline.collecting', {
            days: daysOfData,
            target: RESPONSE_TIMELINE_MIN_DATA_DAYS,
          })}
        </Text>
      </View>
    );
  }

  const active = timeline
    .map((bucket, index) => ({ bucket, index }))
    .filter(({ bucket }) => activeCategories(bucket).length > 0);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{i18n.t('responseTimeline.title')}</Text>
      <Text style={styles.subtitle}>{i18n.t('responseTimeline.subtitle')}</Text>

      {active.length === 0 ? (
        <Text style={styles.collecting}>{i18n.t('responseTimeline.empty')}</Text>
      ) : (
        active.map(({ bucket, index }) => (
          <View key={bucket.startMs} style={styles.week}>
            <Text style={styles.weekLabel}>{weekLabel(index)}</Text>
            <Text style={styles.weekBody}>
              {activeCategories(bucket)
                .map((c) => {
                  const cell = bucket.perCategory[c]!;
                  return `${i18n.t(`adaptiveResponse.category_${c}`)} ${cell.followed}/${cell.sampleSize}`;
                })
                .join('  ·  ')}
            </Text>
          </View>
        ))
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
    gap: 8,
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
  },
  collectHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: 2,
  },
  collectTitle: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text.primary,
  },
  collectCount: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text.muted,
    letterSpacing: 0.5,
  },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.fill.medium,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: Colors.text.secondary,
  },
  collecting: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.text.muted,
    lineHeight: 17,
  },
  week: {
    borderTopWidth: 1,
    borderTopColor: Colors.border.subtle,
    paddingTop: 10,
    marginTop: 2,
    gap: 3,
  },
  weekLabel: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    color: Colors.text.muted,
    letterSpacing: 1.2,
  },
  weekBody: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: Colors.text.primary,
    lineHeight: 17,
  },
});
