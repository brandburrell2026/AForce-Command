/**
 * Square card share — Instagram-grid optimized. Broadcast-first layout:
 * dominant headline, small subtext, dark luxury, minimal, high contrast.
 *
 * The card is identity, not data. The score (when present) lives in a
 * tiny badge in the corner — supporting evidence, not the headline.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '@/theme/colors';
import type { BroadcastEntry, ShareContext, StateLabel } from '@/types/share';

interface Props {
  broadcast: BroadcastEntry;
  context: ShareContext;
}

const ACCENT_FOR_STATE: Record<StateLabel, string> = {
  Peak:       Colors.states.PEAK.primary,
  Balanced:   Colors.states.BALANCED.primary,
  Recovering: Colors.states.RECOVERING.primary,
  Depleted:   Colors.states.DEPLETED.primary,
};

export const ShareCard: React.FC<Props> = ({ broadcast, context }) => {
  // State-tied accent for everything visual: the dot, the score badge,
  // AND the dominant background glow. The glow now reflects the user's
  // score band at share time (Peak → green, Balanced → teal,
  // Recovering → amber, Depleted → red) so the card reads as a true
  // status snapshot, not a generic broadcast skin.
  const accent = (context.state && ACCENT_FOR_STATE[context.state]) || Colors.states.BALANCED.primary;
  const showBadge = context.score != null;

  return (
    <View style={styles.card}>
      <View pointerEvents="none" style={styles.glowWrap}>
        <View style={[styles.glow, { backgroundColor: accent }]} />
      </View>

      <View style={styles.topRow}>
        <View style={styles.brandRow}>
          <View style={[styles.dot, { backgroundColor: accent }]} />
          <Text style={styles.eyebrow}>AFORCE · {broadcast.voice.toUpperCase()}</Text>
        </View>
        {showBadge && (
          <View style={[styles.scoreBadge, { borderColor: `${accent}66` }]}>
            <Text style={[styles.scoreBadgeText, { color: accent }]}>{context.score}</Text>
          </View>
        )}
      </View>

      <View style={styles.body}>
        <Text style={styles.headline} numberOfLines={3} adjustsFontSizeToFit>
          {broadcast.headline}
        </Text>
        {broadcast.subtext ? (
          <Text style={styles.subtext} numberOfLines={2}>{broadcast.subtext}</Text>
        ) : null}
      </View>

      <View style={styles.footer}>
        <Text style={styles.brand}>aforce.os</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    aspectRatio: 1,
    backgroundColor: '#06070A',
    borderRadius: 24,
    padding: 30,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  glowWrap: {
    position: 'absolute',
    top: -120, left: -60, right: -60,
    alignItems: 'center',
  },
  glow: {
    width: 320, height: 320, borderRadius: 200, opacity: 0.14,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  eyebrow: {
    color: Colors.text.muted,
    fontSize: 10,
    letterSpacing: 3,
    fontWeight: '700',
  },
  scoreBadge: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 100, borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  scoreBadgeText: {
    fontSize: 12, fontWeight: '700', letterSpacing: 1,
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  headline: {
    color: '#FFFFFF',
    fontSize: 44,
    fontWeight: '800',
    letterSpacing: -0.5,
    lineHeight: 48,
    textTransform: 'uppercase',
  },
  subtext: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0.4,
    lineHeight: 19,
  },
  footer: { marginTop: 8 },
  brand: {
    color: Colors.text.muted,
    fontSize: 11,
    letterSpacing: 2.5,
    fontWeight: '700',
  },
});

export default ShareCard;
