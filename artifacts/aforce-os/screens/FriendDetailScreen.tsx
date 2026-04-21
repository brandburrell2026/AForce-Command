/**
 * FriendDetailScreen — full performance view of a single circle member,
 * with a reaction picker and (later) challenge CTA. No comment thread.
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@/theme/colors';
import { getUser, getSharedStatus } from '@/services/circleService';
import { sendReaction } from '@/services/reactionService';
import ReactionBar from '@/components/ReactionBar';
import type { ReactionId, SharedStateLabel } from '@/types/circle';

const STATE_COLOR: Record<SharedStateLabel, string> = {
  Peak:       Colors.states.PEAK.primary,
  Balanced:   Colors.states.BALANCED.primary,
  Recovering: Colors.states.RECOVERING.primary,
  Depleted:   Colors.states.DEPLETED.primary,
};

const TREND_ICON = {
  up:   'trending-up'   as const,
  flat: 'minus'         as const,
  down: 'trending-down' as const,
};

export const FriendDetailScreen: React.FC = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const userId = String(params.id ?? '');
  const user   = getUser(userId);
  const status = getSharedStatus(userId);

  if (!user || !status) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn} hitSlop={12}>
          <Feather name="chevron-left" size={22} color={Colors.text.primary} />
        </Pressable>
        <View style={styles.empty}>
          <Text style={styles.emptyText}>That circle member isn't reachable.</Text>
        </View>
      </View>
    );
  }

  const accent = STATE_COLOR[status.state];

  const onSend = (reaction: ReactionId) => {
    sendReaction({ fromUserId: 'me', toUserId: user.userId, reaction });
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn} hitSlop={12} accessibilityLabel="Back">
          <Feather name="chevron-left" size={22} color={Colors.text.primary} />
        </Pressable>
        <Text style={styles.title}>CIRCLE</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={[styles.avatar, { borderColor: `${accent}55`, backgroundColor: `${accent}14` }]}>
            <Text style={[styles.avatarText, { color: accent }]}>{user.initials}</Text>
          </View>
          <Text style={styles.name}>{user.name}</Text>
          <Text style={styles.sub}>{user.city ?? '—'}</Text>
          <View style={styles.scoreRow}>
            <Text style={[styles.score, { color: accent }]}>{status.score}</Text>
            <Feather
              name={TREND_ICON[status.trend]} size={18}
              color={status.trend === 'up' ? Colors.states.PEAK.primary
                : status.trend === 'down' ? Colors.states.DEPLETED.primary
                : Colors.text.muted}
            />
          </View>
          <View style={[styles.statePill, { borderColor: `${accent}55`, backgroundColor: `${accent}14` }]}>
            <View style={[styles.dot, { backgroundColor: accent }]} />
            <Text style={[styles.stateText, { color: accent }]}>{status.state.toUpperCase()}</Text>
          </View>
        </View>

        <View style={styles.statsCard}>
          <Stat label="STREAK"      value={`${status.streakDays} days`} />
          <View style={styles.statDivider} />
          <Stat label="PROTOCOL"    value={status.protocolComplete ? 'Complete' : 'In progress'} />
          <View style={styles.statDivider} />
          <Stat label="LAST UPDATE" value={timeAgo(status.updatedAt)} />
        </View>

        <ReactionBar state={status.state} onSend={onSend} />
      </ScrollView>
    </View>
  );
};

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={{ flex: 1, gap: 4 }}>
    <Text style={styles.statLabel}>{label}</Text>
    <Text style={styles.statValue}>{value}</Text>
  </View>
);

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background.primary },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 4 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', color: Colors.text.primary, fontSize: 12, letterSpacing: 4, fontWeight: '600' },
  content: { paddingHorizontal: 20, paddingTop: 12, gap: 24 },
  hero: { alignItems: 'center', gap: 8, paddingVertical: 8 },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, marginBottom: 4,
  },
  avatarText: { fontSize: 24, fontWeight: '700', letterSpacing: 1.5 },
  name: { color: Colors.text.primary, fontSize: 22, fontWeight: '600', letterSpacing: -0.3 },
  sub:  { color: Colors.text.muted, fontSize: 13, letterSpacing: 0.5 },
  scoreRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 8 },
  score: { fontSize: 72, fontWeight: '200', letterSpacing: -2.5 },
  statePill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100, borderWidth: 1,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  stateText: { fontSize: 10, letterSpacing: 2, fontWeight: '700' },
  statsCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.background.card, borderRadius: 18, padding: 16,
    borderWidth: 1, borderColor: Colors.border.subtle,
  },
  statDivider: { width: 1, alignSelf: 'stretch', backgroundColor: Colors.border.subtle, marginHorizontal: 12 },
  statLabel: { color: Colors.text.muted, fontSize: 10, letterSpacing: 2, fontWeight: '600' },
  statValue: { color: Colors.text.primary, fontSize: 14, fontWeight: '600' },
  empty: { padding: 32, alignItems: 'center' },
  emptyText: { color: Colors.text.muted, fontSize: 13 },
});

export default FriendDetailScreen;
