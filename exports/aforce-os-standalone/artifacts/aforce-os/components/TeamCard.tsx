/**
 * TeamCard — a featured team detail card. Used in the Team scope to surface
 * the user's own team prominently above the team leaderboard.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Icon } from './Icon';

import type { CompetitorTeam } from '../types/competition';
import { Colors } from '../theme/colors';

interface Props {
  team: CompetitorTeam;
  yourRank?: number;
}

export function TeamCard({ team, yourRank }: Props) {
  const accent = team.rank === 1 ? Colors.states.PEAK.primary : Colors.states.BALANCED.primary;
  return (
    <View style={[styles.card, { borderColor: `${accent}55`, backgroundColor: `${accent}10` }]}>
      <View style={styles.header}>
        <Text style={[styles.eyebrow, { color: accent }]}>YOUR TEAM</Text>
        {team.rank === 1 && (
          <View style={[styles.crown, { backgroundColor: accent }]}>
            <Icon name="award" size={11} color={Colors.text.inverse} />
            <Text style={styles.crownText}>#1 THIS WEEK</Text>
          </View>
        )}
      </View>
      <Text style={styles.name}>{team.name}</Text>
      <Text style={styles.banner}>{team.banner}</Text>
      <View style={styles.row}>
        <Stat label="TEAM SCORE"   value={String(team.competitionScore)} accent={accent} />
        <Stat label="ROSTER"       value={String(team.rosterSize)} />
        <Stat label="RANK"         value={`#${team.rank}`} accent={accent} />
        {yourRank != null && <Stat label="YOUR SLOT" value={`#${yourRank}`} />}
      </View>
    </View>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, accent ? { color: accent } : null]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1.5,
    marginBottom: 14,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  eyebrow: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 2 },
  crown: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100 },
  crownText: { fontSize: 9, fontFamily: 'Inter_700Bold', color: Colors.text.inverse, letterSpacing: 1 },
  name: { fontSize: 22, fontFamily: 'Inter_700Bold', color: Colors.text.primary, letterSpacing: -0.4, marginTop: 2 },
  banner: { fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.text.secondary, marginTop: 2, marginBottom: 12 },
  row: { flexDirection: 'row', gap: 16 },
  stat: { flex: 1 },
  statValue: { fontSize: 22, fontFamily: 'Inter_700Bold', color: Colors.text.primary, letterSpacing: -0.6 },
  statLabel: { fontSize: 9, fontFamily: 'Inter_700Bold', color: Colors.text.muted, letterSpacing: 1.5, marginTop: 2 },
});
