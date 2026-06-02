/**
 * Leaderboard — ordered list of LeaderboardEntry items.
 * Highlights the current user's row when scope === 'individual'.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';

import type { LeaderboardEntry } from '../types/competition';
import { CURRENT_USER_KEY } from '../mocks/competitionData';
import { RankingCard } from './RankingCard';

interface Props {
  entries: LeaderboardEntry[];
}

export function Leaderboard({ entries }: Props) {
  return (
    <View style={styles.list}>
      {entries.map((e, i) => {
        const isMe = e.kind === 'individual' && e.entry.id === CURRENT_USER_KEY;
        return <RankingCard key={`${e.kind}-${e.entry.id ?? i}`} item={e} highlight={isMe} />;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 20, paddingTop: 4 },
});
