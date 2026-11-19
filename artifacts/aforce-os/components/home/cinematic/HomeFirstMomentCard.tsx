/**
 * HomeFirstMomentCard — the approved prototype's "Your first Moment" card for
 * a member who has not planned one yet. Presentation only: its one button
 * opens One Breath, where planning and sealing already live.
 */
import React from 'react';
import { type ImageSourcePropType, Pressable, StyleSheet, Text, View } from 'react-native';
import { WorldPhotoThumb } from '@/components/world/WorldPhoto';
import { af } from '@/theme';
import type { FirstMomentCardModel } from '@/utils/firstMoment';

export function HomeFirstMomentCard({
  card,
  onPlan,
  photo,
}: {
  card: FirstMomentCardModel | null;
  onPlan: () => void;
  /** The small World photograph on the card. Optional. */
  photo?: ImageSourcePropType;
}) {
  if (!card) return null;
  return (
    <View style={styles.card} testID="home-first-moment-card">
      <View style={styles.head}>
        <WorldPhotoThumb source={photo} testID="home-first-moment-thumb" />
        <View style={styles.headText}>
          <Text style={styles.eyebrow}>{card.eyebrow.toUpperCase()}</Text>
          <Text style={styles.title} accessibilityRole="header">{card.title}</Text>
        </View>
      </View>
      <Text style={styles.note}>{card.note}</Text>
      <Pressable
        onPress={onPlan}
        accessibilityRole="button"
        accessibilityLabel={`${card.action}. ${card.title}`}
        style={({ pressed }) => [styles.btn, card.lead ? styles.primary : styles.ghost, pressed && styles.pressed]}
        testID="home-first-moment-plan"
      >
        <Text style={card.lead ? styles.primaryLabel : styles.ghostLabel}>{card.action}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: af.surface, borderWidth: 1, borderColor: af.border, borderRadius: 20,
    padding: 18, gap: 10, marginTop: 14,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headText: { flex: 1, gap: 4 },
  eyebrow: {
    fontFamily: 'IBMPlexMono_400Regular', fontSize: 11, lineHeight: 14, letterSpacing: 2,
    color: af.textSecondary,
  },
  title: { fontFamily: 'Inter_600SemiBold', fontSize: 18, lineHeight: 23, letterSpacing: -0.18, color: af.textPrimary },
  note: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, color: af.textSecondary },
  btn: { minHeight: 52, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  primary: { backgroundColor: af.primaryFill },
  ghost: { borderWidth: 1, borderColor: af.border },
  primaryLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: af.onPrimaryFill },
  ghostLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: af.textPrimary },
  pressed: { opacity: 0.85 },
});
