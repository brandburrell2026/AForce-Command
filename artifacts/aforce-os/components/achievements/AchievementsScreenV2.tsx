/**
 * Achievements Screen — grid of locked / unlocked badges.
 *
 * Reads from `/api/aforce/achievements` which returns the catalog +
 * the user's unlocked rows. Refreshes on pull-down so the user sees
 * a freshly-unlocked badge after, e.g., importing their first sensor
 * file.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { useRouter } from 'expo-router';

import { GradientBackground } from '@/components/GradientBackground';
import { af } from '@/theme';
import {
  ACHIEVEMENTS,
  type AchievementUnlockState,
} from '@/services/achievementsCatalog';
import { fetchAchievements } from '@/services/realApi';

export function AchievementsScreenV2() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [unlocks, setUnlocks] = useState<AchievementUnlockState[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const topPadding = Platform.OS === 'web' ? 24 : insets.top + 8;
  const bottomPadding = Platform.OS === 'web' ? 34 : insets.bottom + 24;

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetchAchievements();
      setUnlocks(res.unlocks);
    } catch (err) {
      console.warn('[Achievements] fetch failed', err);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const unlockedCount = unlocks.filter((u) => u.unlocked).length;

  return (
    <View style={styles.root}>
      <GradientBackground>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingTop: topPadding, paddingBottom: bottomPadding }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={af.textPrimary} />}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerRow}>
            <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={12} testID="achievements-back">
              <Icon name="chevron-left" size={20} color={af.textPrimary} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>RETENTION</Text>
              <Text style={styles.title}>Achievements</Text>
            </View>
          </View>

          <View style={styles.summary}>
            <Text style={styles.summaryNumber}>{unlockedCount}</Text>
            <Text style={styles.summaryDivider}>/</Text>
            <Text style={styles.summaryTotal}>{ACHIEVEMENTS.length}</Text>
            <Text style={styles.summaryLabel}>Unlocked</Text>
          </View>

          <View style={styles.grid}>
            {ACHIEVEMENTS.map((a) => {
              const u = unlocks.find((x) => x.code === a.code);
              const unlocked = !!u?.unlocked;
              const progress = u?.progress ?? (unlocked ? 1 : 0);
              return (
                <View
                  key={a.code}
                  style={[styles.tile, unlocked ? styles.tileUnlocked : styles.tileLocked]}
                  testID={`achievement-${a.code}`}
                >
                  <View style={[styles.iconWrap, unlocked ? styles.iconWrapUnlocked : styles.iconWrapLocked]}>
                    <Icon
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      name={a.icon as any}
                      size={18}
                      color={unlocked ? af.green : af.textTertiary}
                    />
                  </View>
                  <Text style={[styles.tileTitle, !unlocked && { color: af.textSecondary }]}>{a.title}</Text>
                  <Text style={styles.tileDesc} numberOfLines={2}>{a.description}</Text>
                  {progress > 0 && progress < 1 && (
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
                    </View>
                  )}
                  {unlocked && u?.unlockedAt && (
                    <Text style={styles.unlockDate}>
                      {new Date(u.unlockedAt).toLocaleDateString()}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        </ScrollView>
      </GradientBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: af.canvas },
  content: { paddingHorizontal: 20, gap: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backButton: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: af.surface,
    borderWidth: 1, borderColor: af.divider,
    alignItems: 'center', justifyContent: 'center',
  },
  eyebrow: { fontFamily: 'Inter_700Bold', fontSize: 10, color: af.textTertiary, letterSpacing: 2 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 24, color: af.textPrimary, marginTop: 2 },

  summary: {
    flexDirection: 'row', alignItems: 'baseline', gap: 6,
    paddingVertical: 12, paddingHorizontal: 16,
    backgroundColor: af.surface,
    borderRadius: 14, borderWidth: 1, borderColor: af.divider,
  },
  summaryNumber: { fontFamily: 'Inter_700Bold', fontSize: 32, color: af.textPrimary },
  summaryDivider: { fontFamily: 'Inter_400Regular', fontSize: 18, color: af.textTertiary, marginHorizontal: 2 },
  summaryTotal: { fontFamily: 'Inter_600SemiBold', fontSize: 20, color: af.textSecondary },
  summaryLabel: {
    fontFamily: 'Inter_700Bold', fontSize: 10, color: af.textTertiary,
    letterSpacing: 1.6, marginLeft: 'auto',
  },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: {
    width: '47%', flexGrow: 1,
    minWidth: 140,
    padding: 14, borderRadius: 14,
    borderWidth: 1, gap: 8,
  },
  tileLocked: {
    backgroundColor: af.surface, borderColor: af.divider,
  },
  tileUnlocked: {
    backgroundColor: `${af.green}10`,
    borderColor: `${af.green}55`,
  },
  iconWrap: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  iconWrapLocked: { backgroundColor: af.surface },
  iconWrapUnlocked: { backgroundColor: `${af.green}1A` },
  tileTitle: { fontFamily: 'Inter_700Bold', fontSize: 13, color: af.textPrimary },
  tileDesc: { fontFamily: 'Inter_400Regular', fontSize: 11, color: af.textTertiary, lineHeight: 15 },

  progressTrack: {
    marginTop: 4, height: 4, borderRadius: 2,
    backgroundColor: af.surface, overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: af.cyan },

  unlockDate: {
    fontFamily: 'Inter_500Medium', fontSize: 10, color: af.green, marginTop: 2,
  },
});
