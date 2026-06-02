/**
 * RankingCard — single row in any leaderboard.
 * Generic enough to render city/state/team/individual entries.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Icon, type IconName } from './Icon';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';

import type { LeaderboardEntry, RankTrend } from '../types/competition';
import { Colors } from '../theme/colors';

interface Props {
  item: LeaderboardEntry;
  highlight?: boolean;
}

function trendColor(t: RankTrend): string {
  if (t === 'up')   return Colors.states.PEAK.primary;
  if (t === 'down') return Colors.states.DEPLETED.primary;
  if (t === 'new')  return Colors.states.BALANCED.primary;
  return Colors.text.muted;
}
function trendIcon(t: RankTrend): IconName {
  if (t === 'up')   return 'arrow-up-right';
  if (t === 'down') return 'arrow-down-right';
  if (t === 'new')  return 'star';
  return 'minus';
}

function pickFields(item: LeaderboardEntry) {
  switch (item.kind) {
    case 'city':       return { title: item.entry.name, subtitle: `${item.entry.state} · ${item.entry.participantCount.toLocaleString()} active`, score: item.entry.competitionScore, rank: item.entry.rank, trend: item.entry.trend, badge: undefined as string | undefined };
    case 'state':      return { title: item.entry.name, subtitle: `${item.entry.cityCount} cities · ${item.entry.participantCount.toLocaleString()} active`, score: item.entry.competitionScore, rank: item.entry.rank, trend: item.entry.trend, badge: item.entry.abbr };
    case 'team':       return { title: item.entry.name, subtitle: `${item.entry.city} · ${item.entry.rosterSize} roster`, score: item.entry.competitionScore, rank: item.entry.rank, trend: item.entry.trend, badge: undefined };
    case 'individual': return { title: item.entry.name, subtitle: `${item.entry.city}, ${item.entry.state}`, score: item.entry.competitionScore, rank: item.entry.rank, trend: item.entry.trend, badge: item.entry.avatarInitials };
  }
}

export function RankingCard({ item, highlight }: Props) {
  const fields = pickFields(item);
  const accent = highlight ? Colors.states.PEAK.primary : Colors.text.primary;

  const w = useSharedValue(0);
  React.useEffect(() => {
    w.value = 0;
    w.value = withTiming(fields.score / 100, { duration: 600, easing: Easing.out(Easing.cubic) });
  }, [fields.score]);
  const wStyle = useAnimatedStyle(() => ({ width: `${Math.max(2, w.value * 100)}%` }));

  return (
    <View style={[
      styles.row,
      highlight && { borderColor: `${Colors.states.PEAK.primary}55`, backgroundColor: `${Colors.states.PEAK.primary}0E` },
    ]}>
      <View style={[styles.rankCell, fields.rank <= 3 && { backgroundColor: `${accent}22` }]}>
        <Text style={[styles.rankText, fields.rank <= 3 && { color: accent }]}>{fields.rank}</Text>
      </View>

      {fields.badge ? (
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{fields.badge}</Text>
        </View>
      ) : null}

      <View style={{ flex: 1, marginLeft: fields.badge ? 10 : 12 }}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, highlight && { color: Colors.states.PEAK.primary }]} numberOfLines={1}>
            {fields.title}
          </Text>
          {highlight && (
            <View style={[styles.youPill, { backgroundColor: Colors.states.PEAK.primary }]}>
              <Text style={styles.youPillText}>YOU</Text>
            </View>
          )}
        </View>
        <Text style={styles.subtitle} numberOfLines={1}>{fields.subtitle}</Text>
        <View style={styles.barTrack}>
          <Animated.View style={[styles.barFill, { backgroundColor: accent }, wStyle]} />
        </View>
      </View>

      <View style={styles.scoreCell}>
        <Text style={[styles.scoreText, { color: accent }]}>{fields.score}</Text>
        <View style={styles.trendRow}>
          <Icon name={trendIcon(fields.trend)} size={10} color={trendColor(fields.trend)} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: Colors.background.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    marginBottom: 8,
  },
  rankCell: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.fill.medium,
    justifyContent: 'center', alignItems: 'center',
  },
  rankText: { fontSize: 12, fontFamily: 'Inter_700Bold', color: Colors.text.primary },
  avatar: {
    marginLeft: 10, width: 30, height: 30, borderRadius: 15,
    backgroundColor: Colors.fill.strong,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 11, fontFamily: 'Inter_700Bold', color: Colors.text.primary, letterSpacing: 0.5 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontSize: 14, fontFamily: 'Inter_700Bold', color: Colors.text.primary, letterSpacing: -0.2, flexShrink: 1 },
  youPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 100 },
  youPillText: { fontSize: 8, fontFamily: 'Inter_700Bold', letterSpacing: 1, color: Colors.text.inverse },
  subtitle: { fontSize: 11, fontFamily: 'Inter_500Medium', color: Colors.text.muted, marginTop: 1 },
  barTrack: { height: 3, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden', marginTop: 6 },
  barFill: { height: '100%', borderRadius: 2 },
  scoreCell: { alignItems: 'flex-end', marginLeft: 8, minWidth: 42 },
  scoreText: { fontSize: 18, fontFamily: 'Inter_700Bold', letterSpacing: -0.5 },
  trendRow: { marginTop: 1 },
});
