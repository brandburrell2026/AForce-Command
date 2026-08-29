/**
 * EdNextMomentLine — The Cover's NEXT context line (E2).
 *
 * A presentation-only re-composition of HomeMomentsSection's exact data
 * contract: same hooks (useMomentsData with the guarded recFor,
 * useMomentPrepScheduling for OS prep-signal sync), same fields (masked
 * title, clock, prep window, guarded action label, best-before, WHY THIS
 * evidence sheet), same routes, same absence rules — nothing before
 * hydration, and the single quiet doorway line when nothing is imminent
 * (founder ruling 2026-08-28: a line, never a card). Context that never
 * competes with the command.
 */
import React from 'react';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, type TextStyle, View } from 'react-native';

import { useMomentsData } from '@/components/moments/useMomentsData';
import { useMomentPrepScheduling } from '@/components/moments/useMomentPrepScheduling';
import { clockLabel, prepWindowLabel, windowPosture } from '@/components/moments/momentsPresentation';
import { WhyThisSheet } from '@/components/moments/WhyThisSheet';
import { edPositive, edRhythm, edType } from '@/theme/editorialTokens';

import { EdRule, useEdInk } from '../core';

export function EdNextMomentLine({
  fixtureMoments,
  fixtureNowIso,
}: {
  /** Gallery-only deterministic override (the momentsFixture idiom). */
  fixtureMoments?: import('@/types/moments').Moment[];
  fixtureNowIso?: string;
} = {}) {
  const data = useMomentsData(
    fixtureMoments ? { fixtureMoments, fixtureNowIso } : undefined,
  );
  useMomentPrepScheduling();
  const { t } = useTranslation();
  const router = useRouter();
  const ink = useEdInk();
  const [whyOpen, setWhyOpen] = React.useState(false);

  // Until the store answers, say nothing (never flash an empty doorway).
  if (!data.hydrated) return null;

  if (!data.next) {
    return (
      <Pressable
        onPress={() => router.push('/moments')}
        accessibilityRole="button"
        hitSlop={8}
        style={styles.doorway}
        testID="editorial-moments-doorway"
      >
        <Text style={[edType.caption as TextStyle, { color: ink.quiet }]}>
          {t('moments.home_entry')}
        </Text>
      </Pressable>
    );
  }

  const moment = data.next;
  const rec = data.recFor(moment);
  const action = rec.primaryAction;
  const active = windowPosture(rec, moment.startAtIso, data.nowIso) === 'active';
  const title = moment.masked ? t('moments.private_event') : moment.title;

  return (
    <View testID="editorial-next-moment">
      <EdRule />
      <Pressable
        onPress={() => router.push(`/moment/${moment.id}`)}
        accessibilityRole="button"
        accessibilityLabel={`${t('moments.next_label')}: ${title}, ${clockLabel(moment.startAtIso)}`}
        style={styles.line}
      >
        <View style={styles.titleRow}>
          <Text style={[edType.caption as TextStyle, { color: active ? edPositive : ink.quiet }]}>
            {t('moments.next_label')}
          </Text>
          <Text
            style={[edType.body as TextStyle, { color: ink.primary, flexShrink: 1 }]}
            numberOfLines={1}
          >
            {title}
          </Text>
          <Text style={[edType.data as TextStyle, { color: ink.quiet }]}>
            {clockLabel(moment.startAtIso)}
          </Text>
        </View>
        <Text style={[edType.micro as TextStyle, { color: active ? edPositive : ink.quiet, marginTop: 6 }]}>
          {t('moments.prep_window')} {prepWindowLabel(rec)} · {t(action.labelKey, action.labelParams)}
        </Text>
        {action.bestBeforeIso ? (
          <Text style={[edType.micro as TextStyle, { color: ink.quiet, marginTop: 4 }]}>
            {t('moments.best_before', { time: clockLabel(action.bestBeforeIso) })}
          </Text>
        ) : null}
      </Pressable>
      <View style={styles.underRow}>
        <Pressable
          onPress={() => setWhyOpen(true)}
          accessibilityRole="button"
          hitSlop={8}
          style={styles.underTarget}
          testID="editorial-next-moment-why"
        >
          <Text style={[edType.micro as TextStyle, { color: ink.quiet }]}>
            {t('moments.why_this')}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/moments')}
          accessibilityRole="button"
          hitSlop={8}
          style={styles.underTarget}
          testID="editorial-moments-all-today"
        >
          <Text style={[edType.micro as TextStyle, { color: ink.quiet }]}>
            {t('moments.all_today')}
          </Text>
        </Pressable>
      </View>
      <WhyThisSheet rec={rec} visible={whyOpen} onClose={() => setWhyOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  doorway: {
    minHeight: edRhythm.minTarget,
    justifyContent: 'center',
  },
  line: {
    minHeight: edRhythm.minTarget,
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    columnGap: 10,
  },
  underRow: {
    flexDirection: 'row',
    columnGap: 24,
  },
  underTarget: {
    minHeight: edRhythm.minTarget,
    justifyContent: 'center',
  },
});
