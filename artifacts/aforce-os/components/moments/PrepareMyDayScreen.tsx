/**
 * PrepareMyDayScreen — the preparation plan, not a calendar grid (Phase 2,
 * founder approval 2026-08-12). Simple day selector (today/tomorrow +5),
 * honest summary, and ONLY the prep-worthy moments with their prep-begins
 * times. ADD A MOMENT opens the manual form — required so Moments works
 * without calendar access (Phase 3 is founder-gated).
 */
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';

import { AFScreen, AFTopBar, AFCard, AFSecondaryButton, AFEmptyState } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { af, afType, Spacing } from '@/theme';
import type { Moment } from '@/types/moments';
import { useMomentsData } from './useMomentsData';
import { accentForType, clockLabel, daySummary } from './momentsPresentation';
import { AddMomentSheet } from './AddMomentSheet';

const DAY_MS = 86_400_000;

function dayKeyLocal(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function PrepareMyDayScreen({ fixtureMoments, fixtureNowIso }: { fixtureMoments?: Moment[]; fixtureNowIso?: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const data = useMomentsData({ fixtureMoments, fixtureNowIso });
  const [dayOffset, setDayOffset] = React.useState(0);
  const [addOpen, setAddOpen] = React.useState(false);

  const nowMs = Date.parse(data.nowIso);
  const selectedDate = new Date(nowMs + dayOffset * DAY_MS);
  const selectedKey = dayKeyLocal(selectedDate.toISOString());
  const allMoments = fixtureMoments ?? data.surfaced;
  // Day strip filters ALL stored moments by local day (not just the horizon).
  const dayMoments = (fixtureMoments ?? data.surfaced)
    .filter((m) => dayKeyLocal(m.startAtIso) === selectedKey)
    .sort((a, b) => Date.parse(a.startAtIso) - Date.parse(b.startAtIso));
  const summary = daySummary(dayMoments);
  const prepWorthy = dayMoments.filter((m) => m.importance !== 'low');

  const dayName = new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  }).format(selectedDate);

  return (
    <AFScreen scroll contentContainerStyle={styles.scrollContent}>
      <AFTopBar
        eyebrow={t('moments.overview_eyebrow')}
        title={t('moments.plan_title')}
        onBack={() => router.back()}
      />
      <Text style={styles.date}>{dayName}</Text>

      {/* Simple day strip — a plan selector, never a calendar grid */}
      <View style={styles.dayStrip} testID="plan-day-strip">
        {Array.from({ length: 6 }, (_, i) => {
          const d = new Date(nowMs + i * DAY_MS);
          const label =
            i === 0 ? t('moments.add_today') : i === 1 ? t('moments.add_tomorrow')
            : new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(d);
          const on = i === dayOffset;
          return (
            <Pressable
              key={i}
              onPress={() => setDayOffset(i)}
              style={[styles.dayPill, on && styles.dayPillOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
            >
              <Text style={[styles.dayPillText, on && styles.dayPillTextOn]}>{label}</Text>
              <Text style={[styles.dayPillNum, on && styles.dayPillTextOn]}>{d.getDate()}</Text>
            </Pressable>
          );
        })}
      </View>

      {dayMoments.length === 0 ? (
        <AFEmptyState
          title={t('moments.empty_title')}
          message={t('moments.empty_body')}
          testID="plan-empty"
        />
      ) : (
        <>
          <AFCard variant="raised" style={styles.summary} testID="plan-summary">
            <Text style={styles.summaryLine}>
              {t('moments.plan_summary', { dayName: dayName.split(',')[0], total: summary.total })}
            </Text>
            <Text style={styles.summarySub}>
              {t('moments.plan_summary_prep', { n: summary.prepWorthy })}
            </Text>
          </AFCard>

          <View style={styles.list}>
            {prepWorthy.map((m) => {
              const rec = data.recFor(m);
              const accent = accentForType(m.type);
              return (
                <Pressable
                  key={m.id}
                  onPress={() => router.push(`/moment/${m.id}`)}
                  style={styles.row}
                  accessibilityRole="button"
                  accessibilityLabel={`${clockLabel(m.startAtIso)} ${m.title}`}
                  testID={`plan-row-${m.id}`}
                >
                  <View style={[styles.rowBadge, { backgroundColor: `${accent}1F` }]}>
                    <Icon
                      name={m.type === 'travel' ? 'send' : m.type === 'training' ? 'activity' : 'briefcase'}
                      size={15}
                      color={accent}
                    />
                  </View>
                  <View style={styles.rowBody}>
                    <Text style={styles.rowTime}>{clockLabel(m.startAtIso)}</Text>
                    <Text style={styles.rowTitle} numberOfLines={1}>{m.title}</Text>
                    <Text style={styles.rowSub} numberOfLines={1}>
                      {t(`moments.demand_${m.type}`)} · {t(`moments.importance_${m.importance}`)}
                    </Text>
                    <Text style={[styles.rowPrep, { color: accent }]}>
                      {t('moments.prep_begins', { time: clockLabel(rec.prepWindowStartIso) })}
                    </Text>
                  </View>
                  <Icon name="chevron-right" size={16} color={af.textTertiary} />
                </Pressable>
              );
            })}
          </View>
        </>
      )}

      <AFSecondaryButton
        label={t('moments.add_moment')}
        onPress={() => setAddOpen(true)}
        testID="plan-add-moment"
      />

      <AddMomentSheet visible={addOpen} onClose={() => setAddOpen(false)} baseNowIso={data.nowIso} />
    </AFScreen>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: Spacing[24] + Spacing[8], gap: 16 },
  date: { ...afType.body, color: af.textSecondary, marginTop: 6 },
  dayStrip: { flexDirection: 'row', gap: 8 },
  dayPill: {
    flex: 1, alignItems: 'center', gap: 2, paddingVertical: 10, borderRadius: 12,
    borderWidth: 1, borderColor: af.border, backgroundColor: af.surface,
  },
  dayPillOn: { backgroundColor: af.red, borderColor: af.red },
  dayPillText: { ...afType.caption, color: af.textTertiary, fontSize: 11 },
  dayPillNum: { ...afType.bodyStrong, color: af.textSecondary, fontVariant: ['tabular-nums'] },
  dayPillTextOn: { color: af.onRed },
  summary: { gap: 6 },
  summaryLine: { ...afType.title3, color: af.textPrimary },
  summarySub: { ...afType.body, color: af.textSecondary },
  list: { gap: 10 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12,
    borderRadius: 14, borderWidth: 1, borderColor: af.border, backgroundColor: af.surface,
  },
  rowBadge: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1, gap: 1 },
  rowTime: { ...afType.caption, color: af.textTertiary, fontVariant: ['tabular-nums'] },
  rowTitle: { ...afType.bodyStrong, color: af.textPrimary },
  rowSub: { ...afType.caption, color: af.textSecondary },
  rowPrep: { ...afType.caption, marginTop: 2 },
});
