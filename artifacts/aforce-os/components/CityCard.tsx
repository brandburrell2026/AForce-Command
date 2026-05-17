/**
 * CityCard — region detail card. Used for both cities and individual teams
 * since the layout is identical; StateCard reuses RegionCard with a
 * slightly different label set.
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Icon } from './Icon';
import { Colors } from '@/theme/colors';
import type { TerritoryRegion } from '@/types/territory';
import { territoryScore, statusLabel } from '@/services/territoryEngine';

interface Props {
  region: TerritoryRegion;
  onChallenge?: (regionId: string) => void;
  onJoin?: (regionId: string) => void;
}

export const CityCard: React.FC<Props> = ({ region, onChallenge, onJoin }) => {
  const score = territoryScore(region.stats);
  const accent =
    score >= 85 ? Colors.states.PEAK.primary
    : score >= 70 ? Colors.states.BALANCED.primary
    : score >= 55 ? Colors.states.RECOVERING.primary
    : Colors.states.DEPLETED.primary;
  const trendIcon =
    region.trend === 'up'   ? 'trending-up'
    : region.trend === 'down' ? 'trending-down'
    : 'minus';
  const trendColor =
    region.trend === 'up'   ? Colors.states.PEAK.primary
    : region.trend === 'down' ? Colors.states.DEPLETED.primary
    : Colors.text.muted;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>{region.kind === 'city' ? 'CITY' : region.kind === 'state' ? 'STATE' : 'TEAM'}</Text>
          <Text style={styles.name}>{region.name}</Text>
          <Text style={styles.sub}>Rank #{region.rank} · {statusLabel(region.rank)}</Text>
        </View>
        <Text style={[styles.score, { color: accent }]}>{score}</Text>
      </View>

      <View style={styles.statsRow}>
        <Stat label="AVG SCORE"   value={Math.round(region.stats.avgPerformanceScore)} />
        <Stat label="PARTICIPANTS" value={region.stats.participants.toLocaleString()} />
        <Stat label="STREAK DENSITY" value={`${Math.round(region.stats.streakDensity * 100)}%`} />
      </View>

      <View style={styles.statsRow}>
        <Stat label="PROTOCOL" value={`${Math.round(region.stats.protocolCompletionRate * 100)}%`} />
        <Stat label="RECOVERY" value={`${Math.round(region.stats.recoveryEfficiency * 100)}%`} />
        <View style={[styles.stat, { flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
          <Text style={styles.statLabel}>TREND</Text>
          <Icon name={trendIcon} size={14} color={trendColor} />
        </View>
      </View>

      {region.battleStatus === 'active' && (
        <View style={styles.battlePill}>
          <View style={[styles.dot, { backgroundColor: Colors.states.PEAK.primary }]} />
          <Text style={styles.battleText}>BATTLE ACTIVE</Text>
        </View>
      )}

      <View style={styles.actions}>
        <Pressable
          onPress={() => onChallenge?.(region.regionId)}
          style={({ pressed }) => [styles.btn, styles.btnGhost, pressed && styles.btnPressed]}
          accessibilityRole="button"
          accessibilityLabel={`Challenge ${region.name}`}
        >
          <Text style={styles.btnGhostText}>CHALLENGE</Text>
        </Pressable>
        <Pressable
          onPress={() => onJoin?.(region.regionId)}
          style={({ pressed }) => [styles.btn, styles.btnPrimary, pressed && styles.btnPressed]}
          accessibilityRole="button"
          accessibilityLabel={`Join ${region.name} competition`}
        >
          <Text style={styles.btnPrimaryText}>JOIN</Text>
        </Pressable>
      </View>
    </View>
  );
};

const Stat: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
  <View style={styles.stat}>
    <Text style={styles.statLabel}>{label}</Text>
    <Text style={styles.statValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.background.card,
    borderRadius: 20, padding: 18,
    borderWidth: 1, borderColor: Colors.border.subtle,
    gap: 14,
  },
  headerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  eyebrow: { color: Colors.text.muted, fontSize: 10, letterSpacing: 3, fontWeight: '600' },
  name:    { color: Colors.text.primary, fontSize: 24, fontWeight: '600', letterSpacing: -0.5, marginTop: 2 },
  sub:     { color: Colors.text.muted, fontSize: 12, letterSpacing: 0.5, marginTop: 2 },
  score:   { fontSize: 48, fontWeight: '200', letterSpacing: -1.5 },
  statsRow: { flexDirection: 'row', gap: 16 },
  stat: { flex: 1, gap: 4 },
  statLabel: { color: Colors.text.muted, fontSize: 10, letterSpacing: 2, fontWeight: '600' },
  statValue: { color: Colors.text.primary, fontSize: 14, fontWeight: '600', letterSpacing: 0.5 },
  battlePill: {
    alignSelf: 'flex-start',
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100,
    backgroundColor: `${Colors.states.PEAK.primary}14`,
    borderWidth: 1, borderColor: `${Colors.states.PEAK.primary}55`,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  battleText: { color: Colors.states.PEAK.primary, fontSize: 10, letterSpacing: 2, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 10 },
  btn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  btnGhost: { borderWidth: 1, borderColor: Colors.border.medium, backgroundColor: Colors.fill.medium },
  btnPrimary: { backgroundColor: Colors.text.primary },
  btnPressed: { opacity: 0.85 },
  btnGhostText: { color: Colors.text.primary, fontSize: 11, letterSpacing: 2, fontWeight: '700' },
  btnPrimaryText: { color: Colors.text.inverse, fontSize: 11, letterSpacing: 2, fontWeight: '700' },
});

export default CityCard;
