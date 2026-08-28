/**
 * NextMomentCard — the Home/Today integration for AForce Moments (Phases 1–2).
 * The Home hierarchy the founder locked: NEXT MOMENT → DO THIS NOW → WHY THIS?
 *
 * Wave 5: Home shows the NEXT moment SINGULAR. The TODAY'S MOMENTS list that
 * used to follow this card (its own section label, a "View all" action, and a
 * row per moment) was deleted — a second list under the command card made Home
 * read like a calendar and competed with the one thing Home is for. The full
 * day lives on the Moments overview, one quiet tap away (`AllTodayLink`).
 *
 * Rendered by HomeScreenV2 behind `moments_enabled` (OFF in production).
 * Visual language: AFCard idioms, green active left rail — no new design system.
 */
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';

import { AFCard } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { af, afType, afLayout } from '@/theme';
import type { Moment, MomentRecommendation } from '@/types/moments';
import { clockLabel, prepWindowLabel, windowPosture } from './momentsPresentation';
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
      {/* Standard, not raised: the command card above is the only lifted
          surface in this stack, and Moments stays under it. */}
      <AFCard
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

/**
 * The one path from Home to the full Moments overview, in the quietest
 * register the type scale has. It replaces the deleted list's section label +
 * "View all" pair: a single tertiary line that keeps the overview (and through
 * it PREPARE MY DAY / ADD A MOMENT) reachable without heading a section Home
 * no longer has.
 */
export function AllTodayLink({ labelKey = 'moments.all_today' }: { labelKey?: string } = {}) {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push('/moments')}
      style={styles.allToday}
      accessibilityRole="button"
      hitSlop={8}
      testID="home-moments-all-today"
    >
      <Text style={styles.allTodayText}>{t(labelKey)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  nextWrap: { flexDirection: 'row' },
  rail: { width: 3, borderRadius: 2, marginRight: 10, marginVertical: 4 },
  nextCard: { flex: 1 },
  // Tertiary, not green: the rail already says when prep is live, and a second
  // colored eyebrow under the command card pulled the eye off it.
  eyebrow: { ...afType.eyebrow, color: af.textTertiary },
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
    borderRadius: 999, borderWidth: 1, borderColor: af.border, backgroundColor: af.surfaceRaised,
  },
  whyText: { ...afType.caption, color: af.textSecondary },
  allToday: {
    alignSelf: 'flex-start', justifyContent: 'center',
    minHeight: afLayout.controlMinHeight, paddingRight: 12,
  },
  allTodayText: { ...afType.caption, color: af.textTertiary },
});
