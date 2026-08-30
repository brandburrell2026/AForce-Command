/**
 * EdReturn — the editorial return idiom shared by the two Moments surfaces.
 *
 * A chevron plus truthful, locale-formatted date furniture (R1: never an
 * issue reference). Uses the repo's GUARDED back idiom — these routes are
 * deep-linkable and `/moments` is itself a redirect target, so a bare
 * `router.back()` can be inert with an empty history.
 */
import React from 'react';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, type TextStyle } from 'react-native';

import { Icon } from '@/components/Icon';
import { edRhythm, edType } from '@/theme/editorialTokens';

import { useEdInk } from '../core';
import { returnLabel } from './editorialMomentsPresentation';

export function EdReturn({
  now,
  fallback = '/',
}: {
  now: Date;
  /** Typed route the guarded idiom falls back to when history is empty. */
  fallback?: '/' | '/moments';
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const ink = useEdInk();
  const label = returnLabel(now);
  return (
    <Pressable
      onPress={() => (router.canGoBack() ? router.back() : router.replace(fallback))}
      accessibilityRole="button"
      /* The date alone names WHERE, not WHAT: a reader announcing
         "SAT · AUG 29, button" says nothing about going back. The existing
         common.back string carries the purpose. */
      accessibilityLabel={`${t('common.back')}, ${label}`}
      hitSlop={8}
      style={styles.wrap}
      testID="editorial-return"
    >
      <Icon name="chevron-left" size={14} color={ink.quiet} />
      <Text style={[edType.micro as TextStyle, { color: ink.quiet }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 6,
    minHeight: edRhythm.minTarget,
    alignSelf: 'flex-start',
  },
});
