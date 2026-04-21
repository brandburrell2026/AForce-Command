/**
 * CircleChallengeCard — open challenge from someone in your circle.
 * Constrained, premium, accept-or-dismiss only.
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors } from '@/theme/colors';
import type { CircleChallenge } from '@/types/circle';
import { getUser } from '@/services/circleService';

interface Props {
  challenge: CircleChallenge;
  onAccept?: (id: string) => void;
}

function challengeTitle(c: CircleChallenge, fromName: string): string {
  switch (c.kind) {
    case 'match_my_score':       return `${fromName} dares you to match ${c.targetScore ?? 90}.`;
    case 'complete_your_cycle':  return `${fromName} wants you to finish today's cycle.`;
    case 'weekly_consistency':   return `${fromName} called a 7-day consistency challenge.`;
    case 'circle_ranking':       return `${fromName} called a circle ranking sprint.`;
  }
}

function hoursRemaining(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  const hrs = Math.max(0, Math.round(ms / (1000 * 60 * 60)));
  if (hrs < 1) return '<1h left';
  if (hrs < 24) return `${hrs}h left`;
  const days = Math.round(hrs / 24);
  return `${days}d left`;
}

export const CircleChallengeCard: React.FC<Props> = ({ challenge, onAccept }) => {
  const from = getUser(challenge.fromUserId);
  const fromName = from?.name ?? 'Someone';
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.iconWrap}>
          <Feather name="zap" size={14} color={Colors.states.PEAK.primary} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.eyebrow}>CHALLENGE</Text>
          <Text style={styles.title}>{challengeTitle(challenge, fromName)}</Text>
          <Text style={styles.meta}>{hoursRemaining(challenge.expiresAt)}</Text>
        </View>
      </View>
      <View style={styles.actions}>
        <Pressable
          onPress={() => onAccept?.(challenge.id)}
          style={({ pressed }) => [styles.accept, pressed && styles.acceptPressed]}
          accessibilityRole="button"
          accessibilityLabel="Accept challenge"
        >
          <Text style={styles.acceptText}>ACCEPT</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.background.card,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1, borderColor: Colors.border.subtle,
    gap: 14,
  },
  row: { flexDirection: 'row', gap: 12 },
  iconWrap: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: `${Colors.states.PEAK.primary}14`,
    borderWidth: 1, borderColor: `${Colors.states.PEAK.primary}55`,
  },
  eyebrow: { color: Colors.text.muted, fontSize: 10, letterSpacing: 3, fontWeight: '600' },
  title:   { color: Colors.text.primary, fontSize: 14, fontWeight: '500', lineHeight: 20 },
  meta:    { color: Colors.text.muted, fontSize: 11, letterSpacing: 1, fontWeight: '600' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end' },
  accept: {
    paddingHorizontal: 18, paddingVertical: 10,
    borderRadius: 100, backgroundColor: Colors.text.primary,
  },
  acceptPressed: { opacity: 0.85 },
  acceptText: { color: Colors.text.inverse, fontSize: 11, letterSpacing: 2, fontWeight: '700' },
});

export default CircleChallengeCard;
