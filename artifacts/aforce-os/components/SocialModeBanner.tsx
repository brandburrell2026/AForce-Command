/**
 * SocialModeBanner — Top-of-home indicator while Recovery Mode is
 * active (or while its 8h recovery window is still open). Tap opens
 * the Recovery Mode sheet for full controls.
 *
 * Reframed by chunk #3c of the Master Update: shows the live Recovery
 * Capacity Score and band label, not drink counts or BAC ranges.
 */

import React from 'react';
import { Pressable, View, Text, StyleSheet, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

import { Icon } from './Icon';
import type { ScoreEngineOutput } from '../types';

interface Props {
  social: NonNullable<ScoreEngineOutput['social']>;
  onPress: () => void;
}

function SocialModeBannerImpl({ social, onPress }: Props) {
  const accent = social.recoveryCapacity.meta.color;
  const bandLabel = social.recoveryCapacity.meta.label;
  const title = social.inRecoveryWindow ? 'RECOVERY WINDOW' : 'RECOVERY MODE';

  return (
    <Pressable
      onPress={() => {
        if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={title}
      testID="social-mode-banner"
      style={({ pressed }) => [
        styles.banner,
        { borderColor: `${accent}55`, backgroundColor: `${accent}14` },
        pressed && { opacity: 0.85 },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: `${accent}26` }]}>
        <Icon name={social.inRecoveryWindow ? 'sunrise' : 'activity'} size={16} color={accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: accent }]}>{title}</Text>
        <Text style={styles.subtitle}>
          {bandLabel} · {social.recoveryCapacity.score}/100
        </Text>
      </View>
      <Icon name="chevron-right" size={18} color={accent} style={{ marginLeft: 6 }} />
    </Pressable>
  );
}

export const SocialModeBanner = React.memo(SocialModeBannerImpl);

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16,
    marginTop: 4, marginBottom: 8, paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: 18, borderWidth: 1,
  },
  iconWrap: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 12, fontFamily: 'Inter_700Bold', letterSpacing: 1.5 },
  subtitle: { fontSize: 12, fontFamily: 'Inter_500Medium', color: 'rgba(255,255,255,0.72)', marginTop: 2 },
});
