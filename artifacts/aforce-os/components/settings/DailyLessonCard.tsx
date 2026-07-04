/**
 * DailyLessonCard — Section 61 read-only surface for the Living Performance
 * Model's daily lesson.
 *
 * Renders today's single takeaway from the Personal Response Library, always
 * framed "your body taught us" (never "what did I learn about [name]"). When
 * nothing notable stands out it shows the Silent Intelligence on-track line
 * plainly — no fabricated lesson.
 *
 * Language rule: every string comes from `livingPerformance.*` / category-label
 * i18n keys, asserted compliant by the living-performance locale-guard test.
 *
 * Score-Protection: display ONLY. Dispatches nothing and never reads-into,
 * awards, mutates, or fabricates score. Mounted behind `living_performance_enabled`;
 * self-contained, no new navigation (build lock).
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { Colors } from '@/theme/colors';
import i18n from '@/services/i18nService';
import { useDailyLesson } from '@/hooks/useDailyLesson';

export function DailyLessonCard() {
  const lesson = useDailyLesson();
  const isLesson = lesson.kind === 'lesson';
  const category = lesson.categoryLabelKey ? i18n.t(lesson.categoryLabelKey) : '';
  const line = i18n.t(lesson.lineKey, { category, pct: lesson.followedPct ?? 0 });

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{i18n.t('livingPerformance.title')}</Text>
      <Text style={styles.eyebrow}>
        {isLesson ? i18n.t('livingPerformance.eyebrow') : i18n.t('livingPerformance.eyebrow_on_track')}
      </Text>
      <Text style={styles.line}>{line}</Text>
      {isLesson && lesson.confidence !== null ? (
        <Text style={styles.meta}>
          {i18n.t('adaptiveResponse.confidence_label')} · {Math.round(lesson.confidence * 100)}%
        </Text>
      ) : null}
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
  eyebrow: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    color: Colors.text.muted,
    letterSpacing: 2,
    marginTop: 2,
  },
  line: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: Colors.text.primary,
    lineHeight: 19,
  },
  meta: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text.muted,
    letterSpacing: 0.5,
  },
});
