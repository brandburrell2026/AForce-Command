/**
 * HomeMomentCards — the "Before the Moment" and "Return" cards under Home's
 * panel, as in the approved prototype. Presentation only: each card opens
 * the Moment's own screen, where sealing, Lock In and Replay already live.
 * Nothing is approved, changed or recorded from here.
 */
import React from 'react';
import { type ImageSourcePropType, Pressable, StyleSheet, Text, View } from 'react-native';
import { WorldPhotoThumb } from '@/components/world/WorldPhoto';
import { af } from '@/theme';
import type { HomeMomentCardModel } from './homeMomentCardsLogic';

export interface HomeMomentCardsProps {
  before: HomeMomentCardModel | null;
  back: HomeMomentCardModel | null;
  onOpen: (momentId: string) => void;
  /** Hides the Return card for this Moment until the app is next opened. */
  onSkipReturn: (momentId: string) => void;
  /** The small World photograph on each card. Optional. */
  beforePhoto?: ImageSourcePropType;
  backPhoto?: ImageSourcePropType;
}

export function HomeMomentCards({ before, back, onOpen, onSkipReturn, beforePhoto, backPhoto }: HomeMomentCardsProps) {
  if (!before && !back) return null;
  return (
    <View style={styles.wrap}>
      {before ? (
        <Pressable
          onPress={() => onOpen(before.momentId)}
          accessibilityRole="button"
          accessibilityLabel={`${before.eyebrow}. ${before.title} ${before.note}`}
          style={({ pressed }) => [styles.card, pressed && styles.pressed]}
          testID="home-before-card"
        >
          <View style={styles.head}>
            <WorldPhotoThumb source={beforePhoto} testID="home-before-thumb" />
            <View style={styles.headText}>
              <Text style={styles.eyebrow}>{before.eyebrow.toUpperCase()}</Text>
              <Text style={styles.title}>{before.title}</Text>
            </View>
          </View>
          <Text style={styles.note}>{before.note}</Text>
        </Pressable>
      ) : null}
      {back ? (
        <View style={styles.card} testID="home-return-card">
          <View style={styles.head}>
            <WorldPhotoThumb source={backPhoto} testID="home-return-thumb" />
            <View style={styles.headText}>
              <Text style={styles.eyebrow}>{back.eyebrow.toUpperCase()}</Text>
              <Text style={styles.title}>{back.title}</Text>
            </View>
          </View>
          <Text style={styles.note}>{back.note}</Text>
          <View style={styles.actions}>
            <Pressable
              onPress={() => onOpen(back.momentId)}
              accessibilityRole="button"
              accessibilityLabel={`${back.action}. ${back.title}`}
              style={({ pressed }) => [styles.btn, styles.primary, pressed && styles.pressed]}
              testID="home-return-replay"
            >
              <Text style={styles.primaryLabel}>{back.action}</Text>
            </Pressable>
            <Pressable
              onPress={() => onSkipReturn(back.momentId)}
              accessibilityRole="button"
              accessibilityLabel="Skip the replay for now"
              style={({ pressed }) => [styles.btn, styles.ghost, pressed && styles.pressed]}
              testID="home-return-skip"
            >
              <Text style={styles.ghostLabel}>Skip</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const MONO = 'IBMPlexMono_400Regular';

const styles = StyleSheet.create({
  wrap: { gap: 14, marginTop: 14 },
  card: { backgroundColor: af.surface, borderWidth: 1, borderColor: af.border, borderRadius: 20, padding: 18, gap: 4 },
  pressed: { opacity: 0.72 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headText: { flex: 1 },
  eyebrow: { fontFamily: MONO, fontSize: 11, letterSpacing: 2, color: af.textSecondary },
  title: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: af.textPrimary, marginTop: 3 },
  note: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, color: af.textSecondary },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  btn: { minHeight: 48, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  primary: { flex: 1, backgroundColor: af.primaryFill },
  primaryLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: af.onPrimaryFill },
  ghost: { borderWidth: 1, borderColor: af.border },
  ghostLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: af.textPrimary },
});
