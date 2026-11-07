/** Private v1.7 Circle: members and consented Moments only. */
import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { AFScreen, AFCard, AFSectionLabel } from '@/components/ui';
import { useTabBarClearance } from '@/hooks/useTabBarClearance';
import { af, afType, afLayout } from '@/theme';
import { CircleMembersPanel } from './CircleMembersPanel';

export function CircleScreenV4() {
  const tabClearance = useTabBarClearance();
  return (
    <AFScreen scroll contentContainerStyle={{ paddingBottom: tabClearance }} testID="circle-v4-screen">
      <AFSectionLabel label="CIRCLES" />
      <Text accessibilityRole="header" style={styles.title}>Your people. Your moments.</Text>
      <Text style={styles.intro}>Circle is private by default. People see only the Moments and updates you choose to share.</Text>
      <AFCard style={styles.notice} testID="circle-v4-privacy">
        <Text style={styles.noticeTitle}>Nothing is shared by default.</Text>
        <Text style={styles.noticeCopy}>Scores, HydroState, ranks, streaks, and health data never appear in a Circle.</Text>
      </AFCard>
      <CircleMembersPanel />
    </AFScreen>
  );
}
const styles = StyleSheet.create({
  title: { ...afType.title1, color: af.textPrimary, marginTop: 8 },
  intro: { ...afType.body, color: af.textSecondary, marginTop: 12, marginBottom: afLayout.sectionGap },
  notice: { gap: 8, marginBottom: afLayout.sectionGap },
  noticeTitle: { ...afType.bodyStrong, color: af.textPrimary },
  noticeCopy: { ...afType.secondary, color: af.textSecondary },
});
