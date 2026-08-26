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
import { hapticSelection } from '@/services/haptics';

import { Icon } from './Icon';
import { CommandConfidenceBadge } from './CommandConfidenceBadge';
import type { ScoreEngineOutput } from '../types';
import { useCommandConfidence } from '../hooks/useCommandConfidence';
import { useFlagsSlice } from '../store/slices';
import i18n from '../services/i18nService';
import { CONFIDENCE_LABEL_KEYS } from '../utils/commandConfidenceDisplay';

interface Props {
  social: NonNullable<ScoreEngineOutput['social']>;
  onPress: () => void;
}

function SocialModeBannerImpl({ social, onPress }: Props) {
  const accent = social.recoveryCapacity.meta.color;
  const bandLabel = social.recoveryCapacity.meta.label;
  const title = social.inRecoveryWindow ? 'RECOVERY WINDOW' : 'RECOVERY MODE';
  // Section 58 — Command Confidence on the Recovery Window surface, gated.
  const showConfidence = useFlagsSlice().spec_commandConfidenceDisplay;
  const confidence = useCommandConfidence();
  // The whole banner is one Pressable, so its accessibilityLabel is the ONLY
  // thing a screen reader announces — the nested confidence chip is otherwise
  // swallowed. Fold the confidence level into the banner's label so it's spoken.
  const confidenceLabel = showConfidence && confidence ? i18n.t(CONFIDENCE_LABEL_KEYS[confidence]) : null;
  const a11yLabel = confidenceLabel ? `${title}. ${confidenceLabel}` : title;

  return (
    <Pressable
      onPress={() => {
        if (Platform.OS !== 'web') hapticSelection();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
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
        {showConfidence ? (
          <View style={styles.confidence}>
            <CommandConfidenceBadge level={confidence} />
          </View>
        ) : null}
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
  confidence: { marginTop: 4 },
});
