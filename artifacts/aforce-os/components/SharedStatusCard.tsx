/**
 * SharedStatusCard — what your circle sees about you. Used in
 * MySharedStatusScreen to preview the projected status (after privacy).
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Icon } from './Icon';
import { Colors } from '@/theme/colors';
import type { SharedStatus, SharedStateLabel } from '@/types/circle';

interface Props {
  status: SharedStatus;
  yourName: string;
  /** Overrides the visibility eyebrow (community-sharing passes the live scope). */
  visibilityLabel?: string;
  yourInitials: string;
}

const STATE_COLOR: Record<SharedStateLabel, string> = {
  Peak:       Colors.states.PEAK.primary,
  Balanced:   Colors.states.BALANCED.primary,
  Recovering: Colors.states.RECOVERING.primary,
  Depleted:   Colors.states.DEPLETED.primary,
};

export const SharedStatusCard: React.FC<Props> = ({ status, yourName, yourInitials, visibilityLabel }) => {
  const accent = STATE_COLOR[status.state];
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={[styles.avatar, { borderColor: `${accent}55`, backgroundColor: `${accent}14` }]}>
          <Text style={[styles.avatarText, { color: accent }]}>{yourInitials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{yourName}</Text>
          <Text style={styles.eyebrow}>{visibilityLabel ?? 'VISIBLE TO YOUR CIRCLE'}</Text>
        </View>
        <Text style={[styles.score, { color: accent }]}>{status.score || '—'}</Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.gridRow}>
        <Stat label="STATE"    value={status.state}    accent={accent} />
        <Stat label="STREAK"   value={`${status.streakDays}d`} />
        <Stat label="PROTOCOL" value={status.protocolComplete ? 'DONE' : 'OPEN'}
              accent={status.protocolComplete ? Colors.states.PEAK.primary : Colors.text.muted} />
        <Stat label="TREND"    value={status.trend.toUpperCase()}
              icon={status.trend === 'up' ? 'trending-up' : status.trend === 'down' ? 'trending-down' : 'minus'} />
      </View>
    </View>
  );
};

interface StatProps { label: string; value: string; accent?: string; icon?: 'trending-up' | 'trending-down' | 'minus' }
const Stat: React.FC<StatProps> = ({ label, value, accent, icon }) => (
  <View style={styles.stat}>
    <Text style={styles.statLabel}>{label}</Text>
    <View style={styles.statValueRow}>
      {icon ? <Icon name={icon} size={12} color={accent ?? Colors.text.primary} /> : null}
      <Text style={[styles.statValue, accent ? { color: accent } : null]}>{value}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.background.card,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1, borderColor: Colors.border.subtle,
    gap: 14,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  avatarText: { fontSize: 14, fontWeight: '700', letterSpacing: 1 },
  name:    { color: Colors.text.primary, fontSize: 16, fontWeight: '600' },
  eyebrow: { color: Colors.text.muted, fontSize: 10, letterSpacing: 2, fontWeight: '600', marginTop: 2 },
  score:   { fontSize: 36, fontWeight: '200', letterSpacing: -1 },
  divider: { height: 1, backgroundColor: Colors.border.subtle },
  gridRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  stat: { flexBasis: '47%', flexGrow: 1, gap: 6 },
  statLabel: { color: Colors.text.muted, fontSize: 10, letterSpacing: 2, fontWeight: '600' },
  statValueRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statValue: { color: Colors.text.primary, fontSize: 14, fontWeight: '600', letterSpacing: 1 },
});

export default SharedStatusCard;
