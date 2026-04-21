/**
 * BattleCard — Miami vs New York-style live region rivalry. Shows both
 * sides, current scores, time remaining, leader, and a support CTA.
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/theme/colors';
import type { BattleView } from '@/services/battleService';

interface Props {
  battle: BattleView;
  onSupport?: (id: string, side: 'side1' | 'side2') => void;
}

export const BattleCard: React.FC<Props> = ({ battle, onSupport }) => {
  const leadingSide1 = battle.leader === 'side1';
  const leadingSide2 = battle.leader === 'side2';

  const handleSupport = (side: 'side1' | 'side2') => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    onSupport?.(battle.id, side);
  };

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Side
          name={battle.side1.name}
          score={battle.side1Score}
          leading={leadingSide1}
          align="flex-start"
        />
        <View style={styles.vsCol}>
          <Text style={styles.vs}>VS</Text>
          <Text style={styles.timer}>{battle.hoursRemaining}h LEFT</Text>
        </View>
        <Side
          name={battle.side2.name}
          score={battle.side2Score}
          leading={leadingSide2}
          align="flex-end"
        />
      </View>

      <View style={styles.actions}>
        <Pressable
          onPress={() => handleSupport('side1')}
          style={({ pressed }) => [styles.supportBtn, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`Support ${battle.side1.name}`}
        >
          <Feather name="arrow-up" size={12} color={Colors.text.primary} />
          <Text style={styles.supportText}>SUPPORT {battle.side1.name.toUpperCase()}</Text>
        </Pressable>
        <Pressable
          onPress={() => handleSupport('side2')}
          style={({ pressed }) => [styles.supportBtn, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`Support ${battle.side2.name}`}
        >
          <Feather name="arrow-up" size={12} color={Colors.text.primary} />
          <Text style={styles.supportText}>SUPPORT {battle.side2.name.toUpperCase()}</Text>
        </Pressable>
      </View>
    </View>
  );
};

interface SideProps { name: string; score: number; leading: boolean; align: 'flex-start' | 'flex-end' }
const Side: React.FC<SideProps> = ({ name, score, leading, align }) => (
  <View style={{ flex: 1, alignItems: align, gap: 4 }}>
    <Text style={[styles.sideName, leading && styles.sideNameLead]} numberOfLines={1}>
      {name}
    </Text>
    <Text style={[styles.sideScore, leading && styles.sideScoreLead]}>{score}</Text>
    {leading ? <Text style={styles.sideTag}>LEADING</Text> : null}
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.background.card,
    borderRadius: 20, padding: 18,
    borderWidth: 1, borderColor: Colors.border.subtle,
    gap: 16,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  vsCol: { alignItems: 'center', gap: 4, paddingHorizontal: 4 },
  vs: { color: Colors.text.muted, fontSize: 12, letterSpacing: 3, fontWeight: '700' },
  timer: { color: Colors.text.muted, fontSize: 10, letterSpacing: 2, fontWeight: '600' },
  sideName: { color: Colors.text.muted, fontSize: 12, letterSpacing: 1, fontWeight: '600' },
  sideNameLead: { color: Colors.text.primary },
  sideScore: { color: Colors.text.primary, fontSize: 32, fontWeight: '300', letterSpacing: -1 },
  sideScoreLead: { color: Colors.states.PEAK.primary },
  sideTag: { color: Colors.states.PEAK.primary, fontSize: 9, letterSpacing: 2, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 8 },
  supportBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border.medium, backgroundColor: Colors.fill.medium,
  },
  pressed: { opacity: 0.85 },
  supportText: { color: Colors.text.primary, fontSize: 10, letterSpacing: 1.5, fontWeight: '700' },
});

export default BattleCard;
