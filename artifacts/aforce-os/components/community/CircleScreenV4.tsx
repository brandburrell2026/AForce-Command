/** Private v1.7 Circle: members and consented Moments only. */
import React from 'react';
import { Text, StyleSheet, View } from 'react-native';
import { AFScreen, AFCard } from '@/components/ui';
import { useTabBarClearance } from '@/hooks/useTabBarClearance';
import { af, afType, afLayout } from '@/theme';
import { CircleMembersPanel } from './CircleMembersPanel';
import { ProfileEntryButton } from '@/components/profile/ProfileEntryButton';

export function CircleScreenV4() {
  const tabClearance = useTabBarClearance();
  return (
    <AFScreen
      scroll
      contentContainerStyle={{ paddingBottom: tabClearance, gap: afLayout.sectionGap }}
      testID="circle-v4-screen"
    >
      {/* Circle v1.2 §2 landing order: header, then your people, then what
          your Circle can see. Start a Moment and the Tonight cards are not
          built yet, so they are not drawn as empty shells. */}
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <Text accessibilityRole="header" style={styles.title}>Circles</Text>
          <ProfileEntryButton testID="circle-profile-entry" />
        </View>
        <Text style={styles.intro}>Your people. Your moments.</Text>
      </View>

      <CircleMembersPanel showLegacySharing={false} />

      <AFCard variant="editorial" style={styles.notice} testID="circle-v4-privacy">
        <Text style={styles.noticeLabel}>WHAT YOUR CIRCLE CAN SEE</Text>
        <Text style={styles.noticeTitle}>Nothing is shared by default.</Text>
        <Text style={styles.noticeCopy}>
          You choose the Moments and updates you share. Scores, HydroState, ranks, streaks, and health data never appear in a Circle.
        </Text>
      </AFCard>
    </AFScreen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: 10, paddingTop: 10 },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  title: { ...afType.displayHero, color: af.textPrimary, flexShrink: 1 },
  intro: { ...afType.body, color: af.textSecondary, lineHeight: 25, maxWidth: 480 },
  notice: { gap: 8, marginBottom: 2, paddingVertical: 22 },
  noticeLabel: { ...afType.eyebrow, color: af.textSecondary },
  noticeTitle: { ...afType.title3, color: af.textPrimary },
  noticeCopy: { ...afType.secondary, color: af.textSecondary, lineHeight: 21 },
});
