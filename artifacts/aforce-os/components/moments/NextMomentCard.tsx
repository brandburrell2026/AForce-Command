/**
 * NextMomentCard + TodaysMomentsList — the Home/Today integration for AForce
 * Moments (Phases 1–2). The Home hierarchy the founder locked: NEXT MOMENT →
 * DO THIS NOW → WHY THIS?; everything else secondary. The compact list shows
 * ONLY preparation-relevant moments (never a full calendar).
 *
 * Rendered by HomeScreenV2 behind `moments_enabled` (OFF in production).
 * Visual language: AFCard idioms, green active left rail, category accents
 * from momentsPresentation (green / amber / violet) — no new design system.
 */
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';

import { AFCard, AFSectionLabel } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { af, afType } from '@/theme';
import type { Moment, MomentRecommendation } from '@/types/moments';
import {
  accentForType,
  buildListRow,
  clockLabel,
  prepWindowLabel,
  windowPosture,
} from './momentsPresentation';
import { WhyThisSheet } from './WhyThisSheet';

export function NextMomentCard({
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
  const active = posture === 'active';
  const action = rec.primaryAction;

  return (
    <View style={styles.nextWrap} testID="home-next-moment">
      <View style={[styles.rail, { backgroundColor: active ? af.green : af.border }]} />
      <AFCard
        variant="raised"
        onPress={() => router.push(`/moment/${moment.id}`)}
        accessibilityLabel={`${t('moments.next_label')}: ${moment.title}, ${clockLabel(moment.startAtIso)}`}
        style={styles.nextCard}
      >
        <Text style={styles.eyebrow}>{t('moments.next_label')}</Text>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {moment.masked ? t('moments.private_event') : moment.title}
          </Text>
          <Text style={styles.time}>{clockLabel(moment.startAtIso)}</Text>
        </View>

        <View style={styles.block}>
          <Text style={styles.blockLabel}>{t('moments.prep_window')}</Text>
          <Text style={[styles.blockValue, active && { color: af.green }]}>
            {prepWindowLabel(rec)}
          </Text>
        </View>

        <View style={styles.block}>
          <Text style={styles.blockLabel}>{t('moments.do_this_now')}</Text>
          <View style={styles.actionRow}>
            <Icon name="droplet" size={16} color={active ? af.green : af.textSecondary} />
            <Text style={styles.actionText}>{t(action.labelKey, action.labelParams)}</Text>
          </View>
          {action.bestBeforeIso ? (
            <Text style={styles.bestBefore}>
              {t('moments.best_before', { time: clockLabel(action.bestBeforeIso) })}
            </Text>
          ) : null}
        </View>

        <Pressable
          onPress={() => setWhyOpen(true)}
          style={styles.whyButton}
          accessibilityRole="button"
          hitSlop={8}
          testID="home-next-moment-why"
        >
          <Text style={styles.whyText}>{t('moments.why_this')}</Text>
        </Pressable>
      </AFCard>
      <WhyThisSheet rec={rec} visible={whyOpen} onClose={() => setWhyOpen(false)} />
    </View>
  );
}

export function TodaysMomentsList({
  moments,
  recFor,
  nowIso,
}: {
  moments: Moment[];
  recFor: (m: Moment) => MomentRecommendation;
  nowIso: string;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  if (moments.length === 0) return null;

  return (
    <View testID="home-todays-moments">
      <AFSectionLabel
        label={t('moments.todays_label')}
        action={{ label: t('moments.view_all'), onPress: () => router.push('/moments') }}
      />
      <View style={styles.list}>
        {moments.map((m) => {
          const row = buildListRow(m, recFor(m), nowIso);
          const done = row.posture === 'completed';
          return (
            <Pressable
              key={row.momentId}
              onPress={() => router.push(`/moment/${row.momentId}`)}
              style={styles.row}
              accessibilityRole="button"
              accessibilityLabel={`${row.time} ${row.title}`}
              testID={`moment-row-${row.momentId}`}
            >
              <View style={[styles.rowBadge, { backgroundColor: `${row.accent}1F` }]}>
                <Icon
                  name={done ? 'check' : m.type === 'travel' ? 'send' : m.type === 'training' ? 'activity' : 'droplet'}
                  size={15}
                  color={done ? af.green : row.accent}
                />
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowTime}>{row.time}</Text>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {m.masked ? t('moments.private_event') : row.title}
                </Text>
                <Text style={[styles.rowStatus, done && { color: af.green }]} numberOfLines={1}>
                  {done
                    ? `${t(`moments.category_${row.type}`)} · ${t('moments.status_completed')}`
                    : t(m.type === 'recovery' || m.type === 'personal' ? 'moments.status_recovery' : 'moments.status_prep', { window: row.prepWindow })}
                </Text>
              </View>
              <Icon name="chevron-right" size={16} color={af.textTertiary} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  nextWrap: { flexDirection: 'row' },
  rail: { width: 3, borderRadius: 2, marginRight: 10, marginVertical: 4 },
  nextCard: { flex: 1 },
  eyebrow: { ...afType.eyebrow, color: af.green },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginTop: 8 },
  title: { ...afType.title3, color: af.textPrimary, flex: 1 },
  time: { ...afType.bodyStrong, color: af.textSecondary, fontVariant: ['tabular-nums'] },
  block: { marginTop: 14, gap: 4 },
  blockLabel: { ...afType.eyebrow, color: af.textTertiary, fontSize: 10 },
  blockValue: { ...afType.bodyStrong, color: af.textPrimary, fontVariant: ['tabular-nums'] },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actionText: { ...afType.bodyStrong, color: af.textPrimary },
  bestBefore: { ...afType.caption, color: af.textTertiary },
  whyButton: {
    alignSelf: 'flex-end', marginTop: 12, paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 999, borderWidth: 1, borderColor: af.border, backgroundColor: af.surface,
  },
  whyText: { ...afType.caption, color: af.textSecondary },
  list: { gap: 10, marginTop: 12 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12,
    borderRadius: 14, borderWidth: 1, borderColor: af.border, backgroundColor: af.surface,
  },
  rowBadge: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1, gap: 1 },
  rowTime: { ...afType.caption, color: af.textTertiary, fontVariant: ['tabular-nums'] },
  rowTitle: { ...afType.bodyStrong, color: af.textPrimary },
  rowStatus: { ...afType.caption, color: af.textSecondary },
});
