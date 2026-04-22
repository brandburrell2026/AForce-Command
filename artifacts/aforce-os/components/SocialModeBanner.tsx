/**
 * SocialModeBanner — Top-of-home indicator while Social Mode is active
 * (or while the 8h Recovery window is still open). Tap opens the
 * Social Mode sheet for full controls.
 *
 * Subtle purple/amber accent per spec — the banner is informational,
 * not alarming. Tone never says "don't drink".
 */

import React from 'react';
import { Pressable, View, Text, StyleSheet, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';

import { HangoverRiskBadge } from './HangoverRiskBadge';
import type { ScoreEngineOutput } from '../types';

interface Props {
  social: NonNullable<ScoreEngineOutput['social']>;
  onPress: () => void;
}

const PURPLE = '#9D7CFB';
const AMBER = '#F4B23F';

export function SocialModeBanner({ social, onPress }: Props) {
  const { t } = useTranslation();
  const accent = social.inRecoveryWindow ? AMBER : PURPLE;
  const titleKey = social.inRecoveryWindow ? 'social.recovery_active' : 'social.mode_active';

  return (
    <Pressable
      onPress={() => {
        if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={t(titleKey)}
      testID="social-mode-banner"
      style={({ pressed }) => [
        styles.banner,
        { borderColor: `${accent}55`, backgroundColor: `${accent}14` },
        pressed && { opacity: 0.85 },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: `${accent}26` }]}>
        <Feather name={social.inRecoveryWindow ? 'sunrise' : 'moon'} size={16} color={accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: accent }]}>{t(titleKey)}</Text>
        <Text style={styles.subtitle}>
          {t('social.drinks_logged', { count: social.drinkCount })}
        </Text>
      </View>
      <HangoverRiskBadge risk={social.hangoverRisk} />
      <Feather name="chevron-right" size={18} color={accent} style={{ marginLeft: 6 }} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
    borderWidth: 1,
  },
  iconWrap: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 12, fontFamily: 'Inter_700Bold', letterSpacing: 1.5 },
  subtitle: { fontSize: 13, fontFamily: 'Inter_500Medium', color: 'rgba(255,255,255,0.72)', marginTop: 2 },
});
