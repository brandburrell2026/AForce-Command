/**
 * EliteWeeklyEditorial (E2) — the editorial section stack that turns the honest
 * Weekly Report model into a "personal performance review" below the chart.
 *
 * Mounted ONLY when `elite_weekly_report_enabled` is on (by ReadinessInsightsV2),
 * so the flag-off Weekly surface is byte-for-byte unchanged and none of the
 * model wiring (`useWeeklyReportModel`) runs. Every section is localized through
 * the shared `reports.*` copy (same source as the legacy report). Sections
 * without real data yet render an explicit **calibrating / awaiting** state — an
 * intentional "still gathering" block, never a fabricated win (Score-Protection).
 * Performance Age is tagged **Beta** and always carries its non-medical disclaimer.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AFCard, AFSectionLabel, AFStatusBadge } from '@/components/ui';
import type { AFStatusTone } from '@/components/ui/AFStatusBadge';
import { af, afType } from '@/theme';
import { PERFORMANCE_AGE_DISCLAIMER } from '@/utils/performanceAge';
import { useWeeklyReportModel } from '@/hooks/useWeeklyReportModel';
import { buildEditorialSections, type EditorialTone } from './weeklyEditorial';
import { sectionSummary, statusLabel } from './weeklyReportCopy';

const TONE_ACCENT: Record<EditorialTone, string> = {
  win: af.green,
  watch: af.amber,
  neutral: af.textSecondary,
  calibrating: af.cyan,
  awaiting: af.textTertiary,
};

const TONE_BADGE: Record<EditorialTone, AFStatusTone> = {
  win: 'positive',
  watch: 'caution',
  neutral: 'neutral',
  calibrating: 'info',
  awaiting: 'neutral',
};

export function EliteWeeklyEditorial() {
  const { t } = useTranslation();
  const { report } = useWeeklyReportModel();
  const sections = buildEditorialSections(report);

  return (
    <View style={styles.root}>
      <AFSectionLabel label={t('reports.elite.review_label')} />
      <View style={styles.stack}>
        {sections.map((sec) => {
          const section = report.sections.find((s) => s.key === sec.key);
          if (!section) return null;
          const isFocus = sec.key === 'nextWeekFocus';
          const accent = TONE_ACCENT[sec.tone];
          return (
            <AFCard
              key={sec.key}
              testID={`elite-weekly-${sec.key}`}
              style={isFocus ? styles.focusCard : undefined}
            >
              <View style={styles.head}>
                <View style={[styles.rail, { backgroundColor: accent }]} />
                <Text style={styles.title}>{t(`reports.sections.${sec.key}.title`)}</Text>
                {!isFocus && (
                  <AFStatusBadge label={statusLabel(t, section)} tone={TONE_BADGE[sec.tone]} />
                )}
              </View>

              <Text style={[styles.summary, isFocus && styles.focusSummary]}>
                {sectionSummary(t, section)}
              </Text>

              {sec.isPerformanceAge && (
                <View style={styles.paMeta}>
                  <View style={styles.betaPill}>
                    <Text style={styles.betaText}>{t('reports.elite.beta')}</Text>
                  </View>
                  <Text style={styles.disclaimer}>{PERFORMANCE_AGE_DISCLAIMER}</Text>
                </View>
              )}
            </AFCard>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginTop: 28, gap: 12 },
  stack: { gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rail: { width: 3, height: 18, borderRadius: 2 },
  title: { ...afType.bodyStrong, color: af.textPrimary, flex: 1 },
  summary: { ...afType.secondary, color: af.textSecondary, marginTop: 10, lineHeight: 21 },
  focusCard: { borderColor: af.redHairline, backgroundColor: af.redDim },
  focusSummary: { ...afType.bodyStrong, color: af.textPrimary },
  paMeta: { marginTop: 12, gap: 6 },
  betaPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: af.cyan,
  },
  betaText: { ...afType.eyebrow, color: af.cyan },
  disclaimer: { ...afType.caption, color: af.textTertiary, lineHeight: 17 },
});
