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
import { Icon } from '../components/Icon';
import { useRouter } from 'expo-router';

import { GradientBackground } from '@/components/GradientBackground';
import { Colors } from '@/theme/colors';
import { af } from '@/theme';
import {
  ACHIEVEMENTS,
  type AchievementUnlockState,
} from '@/services/achievementsCatalog';
import { fetchAchievements } from '@/services/realApi';

export function AchievementsScreen() {
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
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={load}
              tintColor={af.textPrimary}
              colors={[af.textPrimary]}
              progressBackgroundColor={af.surface}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerRow}>
            <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={12} testID="achievements-back">
              <Icon name="chevron-left" size={20} color={Colors.text.primary} />
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
                      color={unlocked ? Colors.states.PEAK.primary : Colors.text.muted}
                    />
                  </View>
                  <Text style={[styles.tileTitle, !unlocked && { color: Colors.text.secondary }]}>{a.title}</Text>
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
  root: { flex: 1, backgroundColor: Colors.background.primary },
  content: { paddingHorizontal: 20, gap: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backButton: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.fill.light,
    borderWidth: 1, borderColor: Colors.border.subtle,
    alignItems: 'center', justifyContent: 'center',
  },
  eyebrow: { fontFamily: 'Inter_700Bold', fontSize: 10, color: Colors.text.muted, letterSpacing: 2 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 24, color: Colors.text.primary, marginTop: 2 },

  summary: {
    flexDirection: 'row', alignItems: 'baseline', gap: 6,
    paddingVertical: 12, paddingHorizontal: 16,
    backgroundColor: Colors.fill.light,
    borderRadius: 14, borderWidth: 1, borderColor: Colors.border.subtle,
  },
  summaryNumber: { fontFamily: 'Inter_700Bold', fontSize: 32, color: Colors.text.primary },
  summaryDivider: { fontFamily: 'Inter_400Regular', fontSize: 18, color: Colors.text.muted, marginHorizontal: 2 },
  summaryTotal: { fontFamily: 'Inter_600SemiBold', fontSize: 20, color: Colors.text.secondary },
  summaryLabel: {
    fontFamily: 'Inter_700Bold', fontSize: 10, color: Colors.text.muted,
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
    backgroundColor: Colors.fill.light, borderColor: Colors.border.subtle,
  },
  tileUnlocked: {
    backgroundColor: `${Colors.states.PEAK.primary}10`,
    borderColor: `${Colors.states.PEAK.primary}55`,
  },
  iconWrap: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  iconWrapLocked: { backgroundColor: Colors.fill.medium },
  iconWrapUnlocked: { backgroundColor: `${Colors.states.PEAK.primary}1A` },
  tileTitle: { fontFamily: 'Inter_700Bold', fontSize: 13, color: Colors.text.primary },
  tileDesc: { fontFamily: 'Inter_400Regular', fontSize: 11, color: Colors.text.muted, lineHeight: 15 },

  progressTrack: {
    marginTop: 4, height: 4, borderRadius: 2,
    backgroundColor: Colors.fill.medium, overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: Colors.states.BALANCED.primary },

  unlockDate: {
    fontFamily: 'Inter_500Medium', fontSize: 10, color: Colors.states.PEAK.primary, marginTop: 2,
  },
});
