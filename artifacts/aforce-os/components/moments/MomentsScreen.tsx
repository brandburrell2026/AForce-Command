/**
 * MomentsScreen — the full AForce Moments overview (Phase 2, founder approval
 * 2026-08-12). Summary → PREPARE MY DAY → UP NEXT.
 * Card rules from the founder spec: charcoal, subtle border, colored left
 * rail per category/active state, compact hierarchy, one primary + at most
 * one optional action, never a metric grid.
 *
 * Wave 5: UP NEXT has ONE priority. Every up-next moment used to render the
 * same dense card — prep window, DO THIS, optional action, WHY THIS — so N
 * moments meant N equal claims on attention and the screen read as a calendar.
 * The soonest moment keeps the full card; the rest are quiet rows carrying
 * WHAT'S COMING and WHEN PREPARATION MATTERS, with WHAT TO DO one tap away on
 * the moment's own ritual screen.
 */
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';

import { AFScreen, AFTopBar, AFCard, AFSectionLabel, AFSecondaryButton, AFEmptyState } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { af, afType, afLayout, Spacing } from '@/theme';
import type { Moment, MomentRecommendation } from '@/types/moments';
import { useFeatureFlags } from '@/store/useAppStore';
import { useMomentsData } from './useMomentsData';
import {
  accentForType,
  buildListRow,
  clockLabel,
  prepWindowLabel,
  startsIn,
  windowPosture,
  daySummary,
} from './momentsPresentation';
import { WhyThisSheet } from './WhyThisSheet';
import { MomentsOverviewSkeleton } from './MomentsSkeleton';

export function MomentsScreen({ fixtureMoments, fixtureNowIso }: { fixtureMoments?: Moment[]; fixtureNowIso?: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const data = useMomentsData({ fixtureMoments, fixtureNowIso });
  const calendarOn = useFeatureFlags().moments_calendar_enabled;
  const summary = daySummary(data.surfaced);
  const upNext = data.surfaced.filter((m) => Date.parse(m.startAtIso) > Date.parse(data.nowIso));

  return (
    <AFScreen scroll contentContainerStyle={styles.scrollContent}>
      <AFTopBar
        eyebrow={t('moments.overview_eyebrow')}
        title={t('moments.overview_title')}
        onBack={() => router.back()}
        actions={
          calendarOn
            ? [{ icon: 'calendar', onPress: () => router.push('/calendar-settings'), label: t('moments.calendar.title') }]
            : undefined
        }
      />

      {!data.hydrated ? (
        /* Until the store answers, "no moments" is not something we know — it
           is the shape of not having asked yet. Showing the empty state here
           told a member with a full day that their day was empty, then took it
           back. The route at /moment/[id] already waits on this same flag
           before calling an id unknown; the overview waits too. */
        <MomentsOverviewSkeleton />
      ) : data.surfaced.length === 0 ? (
        <AFEmptyState
          title={t('moments.empty_title')}
          message={t('moments.empty_body')}
          action={{ label: t('moments.add_moment'), onPress: () => router.push('/moments-plan') }}
          testID="moments-empty"
        />
      ) : (
        <>
          <AFCard variant="raised" style={styles.summaryCard} testID="moments-summary">
            <Text style={styles.summaryLine}>
              {t('moments.overview_summary', { total: summary.total })}
            </Text>
            <Text style={styles.summarySub}>
              {t('moments.overview_summary_prep', { n: summary.prepWorthy })}
            </Text>
            <AFSecondaryButton
              label={t('moments.prepare_my_day')}
              onPress={() => router.push('/moments-plan')}
              testID="moments-prepare-day"
            />
          </AFCard>

          {upNext.length > 0 ? (
            <View style={styles.section}>
              <AFSectionLabel label={t('moments.up_next')} />
              <View style={styles.cards}>
                <MomentOverviewCard
                  moment={upNext[0]!}
                  rec={data.recFor(upNext[0]!)}
                  nowIso={data.nowIso}
                />
              </View>
              {upNext.length > 1 ? (
                <View style={styles.laterRows} testID="moments-later-today">
                  {upNext.slice(1).map((m) => (
                    <MomentLaterRow
                      key={m.id}
                      moment={m}
                      rec={data.recFor(m)}
                      nowIso={data.nowIso}
                    />
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}
        </>
      )}
    </AFScreen>
  );
}

function MomentOverviewCard({
  moment,
  rec,
  nowIso,
}: {
  moment: Moment;
  rec: MomentRecommendation;
  nowIso: string;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const [whyOpen, setWhyOpen] = React.useState(false);
  const posture = windowPosture(rec, moment.startAtIso, nowIso);
  const accent = posture === 'active' ? af.green : accentForType(moment.type);
  const eta = startsIn(moment.startAtIso, nowIso);
  const active = posture === 'active';

  return (
    <View style={styles.cardWrap}>
      <View style={[styles.cardRail, { backgroundColor: accent }]} />
      <AFCard
        onPress={() => router.push(`/moment/${moment.id}`)}
        accessibilityLabel={`${clockLabel(moment.startAtIso)} ${moment.title}`}
        style={styles.card}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardHeadLeft}>
            <Text style={styles.cardTime}>{clockLabel(moment.startAtIso)}</Text>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {moment.masked ? t('moments.private_event') : moment.title}
            </Text>
          </View>
          {eta ? (
            <Text style={styles.cardEta}>
              {t('moments.starts_in')}{' '}
              {eta.hours > 0
                ? t('moments.in_h_m', { h: eta.hours, m: eta.minutes })
                : t('moments.in_m', { m: eta.minutes })}
            </Text>
          ) : null}
        </View>
        <Text style={[styles.cardCategory, { color: accent }]}>
          {t(`moments.category_${moment.type}`)} · {t(`moments.importance_${moment.importance}`)}
        </Text>

        <View style={styles.cardMeta}>
          <Text style={styles.cardMetaLabel}>{t('moments.prep_window')}</Text>
          <Text style={styles.cardMetaValue}>{prepWindowLabel(rec)}</Text>
        </View>

        <View style={styles.cardAction}>
          <Text style={styles.cardMetaLabel}>{t(active ? 'moments.do_this_now' : 'moments.do_this')}</Text>
          <View style={styles.cardActionRow}>
            <Icon name="droplet" size={15} color={accent} />
            <Text style={styles.cardActionText}>
              {t(rec.primaryAction.labelKey, rec.primaryAction.labelParams)}
            </Text>
          </View>
          {rec.primaryAction.bestBeforeIso && active ? (
            <Text style={styles.cardBestBefore}>
              {t('moments.best_before', { time: clockLabel(rec.primaryAction.bestBeforeIso) })}
            </Text>
          ) : null}
        </View>

        {rec.secondaryAction ? (
          <View style={styles.cardAction}>
            <Text style={styles.cardMetaLabel}>{t('moments.optional_label')}</Text>
            <Text style={styles.cardSecondary}>
              {t(rec.secondaryAction.labelKey, rec.secondaryAction.labelParams)}
              {rec.secondaryAction.kind === 'electrolytes'
                ? ` — ${t('moments.action.electrolytes_sub')}`
                : ''}
            </Text>
          </View>
        ) : null}

        <Pressable
          onPress={() => setWhyOpen(true)}
          style={styles.whyButton}
          accessibilityRole="button"
          hitSlop={8}
        >
          <Text style={styles.whyText}>{t('moments.why_this')}</Text>
        </Pressable>
      </AFCard>
      <WhyThisSheet rec={rec} visible={whyOpen} onClose={() => setWhyOpen(false)} />
    </View>
  );
}

/**
 * A later moment, in the quietest register: WHEN it is, WHAT it is, and WHEN
 * preparation matters. No accent, no icon badge, no action — everything that
 * made the full card a second claim on attention. Tapping opens the moment's
 * ritual, where the preparation actually lives.
 */
function MomentLaterRow({
  moment,
  rec,
  nowIso,
}: {
  moment: Moment;
  rec: MomentRecommendation;
  nowIso: string;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const row = buildListRow(moment, rec, nowIso);
  const title = moment.masked ? t('moments.private_event') : row.title;
  const window = t(
    moment.type === 'recovery' || moment.type === 'personal'
      ? 'moments.status_recovery'
      : 'moments.status_prep',
    { window: row.prepWindow },
  );

  return (
    <Pressable
      onPress={() => router.push(`/moment/${row.momentId}`)}
      style={styles.laterRow}
      accessibilityRole="button"
      accessibilityLabel={`${row.time}, ${title}, ${window}`}
      testID={`moment-row-${row.momentId}`}
    >
      <Text style={styles.laterTime}>{row.time}</Text>
      <View style={styles.laterBody}>
        <Text style={styles.laterTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.laterWindow} numberOfLines={1}>
          {window}
        </Text>
      </View>
      <Icon name="chevron-right" size={16} color={af.textTertiary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: Spacing[24] + Spacing[8] },
  summaryCard: { marginTop: 16, gap: 10 },
  summaryLine: { ...afType.title3, color: af.textPrimary },
  summarySub: { ...afType.body, color: af.textSecondary },
  section: { marginTop: 24 },
  cards: { gap: 14, marginTop: 12 },
  cardWrap: { flexDirection: 'row' },
  cardRail: { width: 3, borderRadius: 2, marginRight: 10, marginVertical: 6 },
  card: { flex: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  cardHeadLeft: { flex: 1, gap: 2 },
  cardTime: { ...afType.caption, color: af.textTertiary, fontVariant: ['tabular-nums'] },
  cardTitle: { ...afType.title3, color: af.textPrimary },
  cardEta: { ...afType.caption, color: af.textTertiary, fontVariant: ['tabular-nums'] },
  cardCategory: { ...afType.caption, marginTop: 4 },
  cardMeta: { marginTop: 12, gap: 3 },
  cardMetaLabel: { ...afType.eyebrow, color: af.textTertiary, fontSize: 10 },
  cardMetaValue: { ...afType.bodyStrong, color: af.textPrimary, fontVariant: ['tabular-nums'] },
  cardAction: { marginTop: 12, gap: 4 },
  cardActionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardActionText: { ...afType.bodyStrong, color: af.textPrimary },
  cardBestBefore: { ...afType.caption, color: af.textTertiary },
  cardSecondary: { ...afType.body, color: af.textSecondary },
  whyButton: {
    alignSelf: 'flex-end', marginTop: 12, paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 999, borderWidth: 1, borderColor: af.border, backgroundColor: af.surfaceRaised,
  },
  whyText: { ...afType.caption, color: af.textSecondary },
  // Divided by hairlines rather than boxed as cards — a list of what is coming
  // must not read as N more things to decide about.
  laterRows: { marginTop: 20 },
  laterRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    minHeight: afLayout.controlMinHeight, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: af.divider,
  },
  laterTime: { ...afType.caption, color: af.textTertiary, fontVariant: ['tabular-nums'], width: 64 },
  laterBody: { flex: 1, gap: 2 },
  laterTitle: { ...afType.bodyStrong, color: af.textPrimary },
  laterWindow: { ...afType.caption, color: af.textTertiary },
});
