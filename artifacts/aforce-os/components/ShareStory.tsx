/**
 * Vertical story share — IG/Snap/TikTok ratio (9:16). Broadcast-first
 * layout: dominant headline with massive type, subtext beneath, dark
 * luxury, minimal, high contrast.
 *
 * Same data as ShareCard, taller composition optimized for stories.
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

export const ShareStory: React.FC<Props> = ({ broadcast, context }) => {
  const accent = (context.state && ACCENT_FOR_STATE[context.state]) || Colors.states.BALANCED.primary;
  const showBadge = context.score != null;

  return (
    <View style={styles.story}>
      {/* Top + bottom edge glows tied to state — luxe vignette feel. */}
      <View pointerEvents="none" style={styles.glowTop}>
        <View style={[styles.glow, { backgroundColor: accent }]} />
      </View>
      <View pointerEvents="none" style={styles.glowBottom}>
        <View style={[styles.glow, { backgroundColor: accent, opacity: 0.08 }]} />
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
        <Text style={styles.headline} numberOfLines={4} adjustsFontSizeToFit>
          {broadcast.headline}
        </Text>
        {broadcast.subtext ? (
          <Text style={styles.subtext}>{broadcast.subtext}</Text>
        ) : null}
      </View>

      <Text style={styles.brand}>aforce.os</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  story: {
    aspectRatio: 9 / 16,
    backgroundColor: '#06070A',
    borderRadius: 24,
    padding: 32,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'space-between',
  },
  glowTop: {
    position: 'absolute',
    top: -140, left: -60, right: -60,
    alignItems: 'center',
  },
  glowBottom: {
    position: 'absolute',
    bottom: -140, left: -60, right: -60,
    alignItems: 'center',
  },
  glow: {
    width: 320, height: 320, borderRadius: 200, opacity: 0.16,
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
    gap: 14,
  },
  headline: {
    color: '#FFFFFF',
    fontSize: 56,
    fontWeight: '800',
    letterSpacing: -1,
    lineHeight: 60,
    textTransform: 'uppercase',
  },
  subtext: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: 0.4,
    lineHeight: 22,
  },
  brand: {
    color: Colors.text.muted,
    fontSize: 11,
    letterSpacing: 2.5,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 8,
  },
});

export default ShareStory;
