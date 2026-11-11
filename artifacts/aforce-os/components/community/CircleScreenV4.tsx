/** Private v1.7 Circle: members and consented Moments only. */
import React from 'react';
import { Text, StyleSheet, View } from 'react-native';
import { AFScreen, AFCard } from '@/components/ui';
import { useTabBarClearance } from '@/hooks/useTabBarClearance';
import { af, afType, afLayout } from '@/theme';
import { CircleMembersPanel } from './CircleMembersPanel';

export function CircleScreenV4() {
  const tabClearance = useTabBarClearance();
  return (
    <AFScreen
      scroll
      contentContainerStyle={{ paddingBottom: tabClearance, gap: afLayout.sectionGap }}
      testID="circle-v4-screen"
    >
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>CIRCLE / YOUR PEOPLE</Text>
        <Text accessibilityRole="header" style={styles.title}>Circle.</Text>
        <Text style={styles.intro}>
          A private place for the people you choose. Share only the Moments and updates you approve.
        </Text>
      </View>

      <AFCard variant="editorial" style={styles.notice} testID="circle-v4-privacy">
        <Text style={styles.noticeLabel}>PRIVATE BY DEFAULT</Text>
        <Text style={styles.noticeTitle}>Nothing is shared by default.</Text>
        <Text style={styles.noticeCopy}>
          Scores, HydroState, ranks, streaks, and health data never appear in a Circle.
        </Text>
      </AFCard>

      <CircleMembersPanel showLegacySharing={false} />
    </AFScreen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: 10, paddingTop: 10 },
  eyebrow: { ...afType.eyebrow, color: af.redText },
  title: { ...afType.displayHero, color: af.textPrimary },
  intro: { ...afType.body, color: af.textSecondary, lineHeight: 25, maxWidth: 480 },
  notice: { gap: 8, marginBottom: 2, paddingVertical: 22 },
  noticeLabel: { ...afType.eyebrow, color: af.redText },
  noticeTitle: { ...afType.title3, color: af.textPrimary },
  noticeCopy: { ...afType.secondary, color: af.textSecondary, lineHeight: 21 },
});
