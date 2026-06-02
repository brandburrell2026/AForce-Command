/**
 * CircleUserCard — friend card in the My Circle feed.
 * Premium dark, performance-first. No badges, no avatars-as-art.
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Icon } from './Icon';
import { Colors } from '@/theme/colors';
import type { CircleFeedItem, SharedStateLabel } from '@/types/circle';

interface Props {
  item: CircleFeedItem;
  onPress?: () => void;
}

const STATE_COLOR: Record<SharedStateLabel, string> = {
  Peak:       Colors.states.PEAK.primary,
  Balanced:   Colors.states.BALANCED.primary,
  Recovering: Colors.states.RECOVERING.primary,
  Depleted:   Colors.states.DEPLETED.primary,
};

const TREND_ICON: Record<CircleFeedItem['trend'], { name: 'trending-up' | 'trending-down' | 'minus'; color: string }> = {
  up:   { name: 'trending-up',   color: Colors.states.PEAK.primary },
  flat: { name: 'minus',         color: Colors.text.muted },
  down: { name: 'trending-down', color: Colors.states.DEPLETED.primary },
};

export const CircleUserCard: React.FC<Props> = ({ item, onPress }) => {
  const accent = STATE_COLOR[item.state];
  const trend = TREND_ICON[item.trend];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      accessibilityRole="button"
      accessibilityLabel={`${item.user.name}, score ${item.score}, ${item.state}`}
    >
      <View style={styles.row}>
        <View style={[styles.avatar, { borderColor: `${accent}55`, backgroundColor: `${accent}14` }]}>
          <Text style={[styles.avatarText, { color: accent }]}>{item.user.initials}</Text>
        </View>
        <View style={styles.identity}>
          <Text style={styles.name}>{item.user.name}</Text>
          <Text style={styles.sub}>{item.user.city ?? '—'} · {labelForGroup(item.user.group)}</Text>
        </View>
        <View style={styles.scoreCol}>
          <Text style={[styles.score, { color: accent }]}>{item.score}</Text>
          <View style={styles.trendRow}>
            <Icon name={trend.name} size={12} color={trend.color} />
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <View style={styles.statePill}>
          <View style={[styles.dot, { backgroundColor: accent }]} />
          <Text style={[styles.stateText, { color: accent }]}>{item.state.toUpperCase()}</Text>
        </View>
        <Text style={styles.meta}>{item.streakDays}d streak</Text>
        <Text style={[styles.meta, item.protocolComplete ? styles.metaOk : styles.metaPending]}>
          {item.protocolComplete ? 'PROTOCOL ✓' : 'PROTOCOL —'}
        </Text>
      </View>
    </Pressable>
  );
};

function labelForGroup(g: CircleFeedItem['user']['group']): string {
  switch (g) {
    case 'friends': return 'Friend';
    case 'team':    return 'Team';
    case 'coach':   return 'Coach';
    case 'family':  return 'Family';
  }
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.background.card,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1, borderColor: Colors.border.subtle,
    gap: 12,
  },
  cardPressed: { opacity: 0.85 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  avatarText: { fontSize: 14, fontWeight: '700', letterSpacing: 1 },
  identity: { flex: 1, gap: 2 },
  name: { color: Colors.text.primary, fontSize: 16, fontWeight: '600', letterSpacing: 0.2 },
  sub: { color: Colors.text.muted, fontSize: 12, letterSpacing: 0.5 },
  scoreCol: { alignItems: 'flex-end', gap: 4 },
  score: { fontSize: 28, fontWeight: '300', letterSpacing: -1 },
  trendRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  footer: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingTop: 10,
    borderTopWidth: 1, borderTopColor: Colors.border.subtle,
  },
  statePill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 100,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  stateText: { fontSize: 10, fontWeight: '700', letterSpacing: 2 },
  meta: { color: Colors.text.muted, fontSize: 11, letterSpacing: 1, fontWeight: '600' },
  metaOk: { color: Colors.states.PEAK.primary },
  metaPending: { color: Colors.text.muted },
});

export default CircleUserCard;
