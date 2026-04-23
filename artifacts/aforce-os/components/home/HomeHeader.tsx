/**
 * HomeHeader — top-of-screen identity strip:
 *   1. Personalized welcome (Clerk firstName / email-local-part)
 *   2. Eyebrow + product title + share button + state pill
 *   3. LocalTimeBar
 *   4. LiveStatusStrip
 *
 * Reads only from the Engine + User slices so it doesn't re-render when
 * unrelated app state mutates.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useUser } from '@clerk/expo';

import { Colors } from '../../theme/colors';
import { LocalTimeBar } from '../LocalTimeBar';
import { LiveStatusStrip } from '../LiveStatusStrip';
import { useEngineSlice, useUserSlice } from '../../store/slices';

function HomeHeaderImpl() {
  const { t } = useTranslation();
  const router = useRouter();
  const engine = useEngineSlice();
  const userState = useUserSlice();
  const clerkUser = useUser().user;
  const greetingName =
    clerkUser?.firstName ||
    clerkUser?.primaryEmailAddress?.emailAddress?.split('@')[0] ||
    'Athlete';
  const stateColor = engine.performanceState.color;

  const onShare = () => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    router.push('/share');
  };

  return (
    <>
      <View style={styles.welcomeBlock}>
        <Text style={styles.welcomeText}>{t('home.welcome', { name: greetingName })}</Text>
      </View>

      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>{t('home.subtitle_eyebrow')}</Text>
          <Text style={styles.title}>{t('home.subtitle_title')}</Text>
        </View>
        <TouchableOpacity
          onPress={onShare}
          activeOpacity={0.85}
          style={styles.shareIconBtn}
          accessibilityRole="button"
          accessibilityLabel={t('home.share_a11y')}
          testID="home-share-button"
        >
          <Feather name="share" size={14} color={Colors.text.primary} />
        </TouchableOpacity>
        <View style={[styles.statePill, { borderColor: `${stateColor}55`, backgroundColor: `${stateColor}14` }]}>
          <View style={[styles.dot, { backgroundColor: stateColor }]} />
          <Text style={[styles.stateLabel, { color: stateColor }]}>{engine.performanceState.level}</Text>
        </View>
      </View>

      <LocalTimeBar />

      <LiveStatusStrip
        performanceState={engine.performanceState}
        unitsToday={userState.unitsConsumedToday}
        dailyTarget={userState.dailyTarget}
      />
    </>
  );
}

export const HomeHeader = React.memo(HomeHeaderImpl);

const styles = StyleSheet.create({
  welcomeBlock: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 2 },
  welcomeText: {
    fontSize: 13, fontFamily: 'Inter_500Medium',
    color: Colors.text.secondary, letterSpacing: 0.2,
  },
  headerRow: {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: 20, paddingBottom: 8, paddingTop: 8, gap: 12,
  },
  eyebrow: {
    fontSize: 10, fontFamily: 'Inter_700Bold',
    color: Colors.text.muted, letterSpacing: 2.5,
  },
  title: {
    fontSize: 22, fontFamily: 'Inter_700Bold',
    color: Colors.text.primary, letterSpacing: -0.6, marginTop: 2,
  },
  statePill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 100, borderWidth: 1,
  },
  shareIconBtn: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border.medium,
    backgroundColor: Colors.fill.medium, marginRight: 8,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  stateLabel: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 1.5 },
});
